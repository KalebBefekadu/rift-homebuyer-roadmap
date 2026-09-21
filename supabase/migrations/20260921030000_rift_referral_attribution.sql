-- Referral attribution: the writer for a column that had none.
--
-- 20260921010000 added rift_leads.referred_by, a Studio screen that counts it,
-- and referralLinks() to read it. Nothing in the product could ever set it.
-- Three reads, zero writes — so "advocacy share of pipeline", the first of the
-- three metrics docs/vision.md names as mattering most and the one with a 30%
-- target by month 12, was not merely at zero. It was incapable of being
-- anything else.
--
-- This adds the handle a referrer passes on, the field that carries it through
-- a visit, and the two constraints that stop attribution rewriting itself.

-- ---------------------------------------------------------------------------
-- The handle
-- ---------------------------------------------------------------------------

-- Deliberately NOT client_token. That one opens somebody's plan — it is a
-- credential, and the whole point of this column is to be given away. Handing
-- a friend a link that shows them your payoff, your stage and every step your
-- agent owes you is not a referral mechanism, it is a disclosure.
alter table rift_leads add column if not exists referral_token text;

-- A DEFAULT rather than an application write.
--
-- The alternative was minting one the first time the agent opened the record,
-- which works and adds a write to a read path plus one more thing that can
-- fail. A column default costs nothing, cannot be forgotten by a new insert
-- path, and means the handle exists from the moment the person does. Crucially
-- it also does not appear in any INSERT statement, so a deploy that lands
-- before this migration is unaffected — the column simply is not there yet.
alter table rift_leads
  alter column referral_token set default encode(gen_random_bytes(12), 'hex');

create unique index if not exists rift_leads_referral_token_idx
  on rift_leads (referral_token) where referral_token is not null;

comment on column rift_leads.referral_token is
  'Public handle this person hands to somebody else. Appears in a URL as ?r=. Never opens anything — it only records who sent the visitor. See client_token for the credential.';

-- ---------------------------------------------------------------------------
-- Carrying it through the visit
-- ---------------------------------------------------------------------------

-- A referral is a first touch. Somebody arrives on a friend's link, reads for
-- ten minutes, leaves, comes back a week later through a Google search and
-- finally finishes the assessment — the friend sent them, and an attribution
-- model that credits the search has just told the agent to buy more search.
alter table rift_attributions add column if not exists first_ref text;
alter table rift_attributions add column if not exists last_ref  text;

comment on column rift_attributions.first_ref is
  'The ?r= value on the visitor''s FIRST touch. Immutable, like every other first_* column — enforced by rift_reject_first_touch_change().';

-- The trigger names its columns one by one, so a new first_* column is not
-- covered until it is added here. Adding the column without this is the whole
-- bug class: a guarantee that silently stops applying to the newest field.
create or replace function rift_reject_first_touch_change()
returns trigger language plpgsql as $$
begin
  if new.first_source   is distinct from old.first_source
  or new.first_medium   is distinct from old.first_medium
  or new.first_campaign is distinct from old.first_campaign
  or new.first_referrer is distinct from old.first_referrer
  or new.first_landing  is distinct from old.first_landing
  or new.first_ref      is distinct from old.first_ref
  or new.first_at       is distinct from old.first_at then
    raise exception 'first touch is immutable (session %)', old.session_id;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Who sent them is written once
-- ---------------------------------------------------------------------------

-- Same reasoning as first touch, and it matters more here. A referral is the
-- highest-margin relationship an agent has; re-pointing one at a later channel
-- would make the cheapest source in the business look like the weakest.
--
-- WHAT IS REJECTED IS RE-POINTING, NOT CLEARING, and the difference is not a
-- softening — the first version of this rejected both and broke erasure.
--
-- referred_by is `on delete set null`. A foreign-key SET NULL action fires
-- row-level UPDATE triggers, so a trigger that refused every change to a
-- non-null referred_by refused the cascade too, and DELETING A REFERRER
-- FAILED. That is "delete all of it" — the strongest promise this product
-- makes and the one with a legal obligation behind it — broken by a
-- correctness guarantee about attribution, and it would have surfaced at the
-- worst possible moment: somebody exercising their erasure right, on a person
-- whose only distinguishing feature is that somebody else liked the product
-- enough to pass it on.
--
-- So:
--   NULL -> a value          allowed. The lead row is created first and the
--                            referrer resolved immediately afterwards.
--   a value -> a DIFFERENT   rejected. This is attribution being rewritten,
--   value                    and it is the only case that corrupts anything.
--   a value -> NULL          allowed. Either the referrer was deleted, or the
--                            link is being withdrawn. Neither is a lie about
--                            where a relationship came from; it is the absence
--                            of a claim.
create or replace function rift_reject_referrer_change()
returns trigger language plpgsql as $$
begin
  if old.referred_by is not null
     and new.referred_by is not null
     and new.referred_by is distinct from old.referred_by then
    raise exception 'who referred a lead cannot be repointed (lead %)', old.id;
  end if;
  return new;
end $$;

drop trigger if exists rift_referrer_is_immutable on rift_leads;
create trigger rift_referrer_is_immutable
  before update on rift_leads
  for each row execute function rift_reject_referrer_change();

-- Nobody refers themselves. Cheap to state, and the alternative is a
-- self-referential row that renders as a person who sent themselves in.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'rift_leads_no_self_referral'
  ) then
    alter table rift_leads add constraint rift_leads_no_self_referral
      check (referred_by is null or referred_by <> id);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Backfill
-- ---------------------------------------------------------------------------

-- Everybody already in the book gets a handle, so the agent can send a
-- referral link to a client he closed last month rather than only to people
-- who arrive after this migration.
update rift_leads
   set referral_token = encode(gen_random_bytes(12), 'hex')
 where referral_token is null;

create index if not exists rift_leads_referred_by_idx2
  on rift_leads (agent_id, referred_by) where referred_by is not null;
