-- Rift — migrations written 21 September 2026 and NOT yet applied.
--
-- Paste this whole file into the Supabase SQL editor, or run each file with
--   bash scripts/apply-sql-migration.sh <path>
--
-- Every statement is additive and re-runnable. Applying this twice is safe.
--
-- Until these run, three features degrade honestly rather than silently:
--   * /studio/referrals and /studio/offers say "nothing to read from"
--   * referral links record nothing, and the Studio panel says so
--   * the representation panel and Decision Rooms do not render
--
-- AFTER APPLYING, restart PostgREST's schema cache or the first write against
-- a new column fails with a message about a schema cache. On Supabase this is
-- automatic within a minute; locally it is `docker restart rift-postgrest`.


-- =====================================================================
-- 20260921010000_rift_referral_moments.sql
-- =====================================================================
-- ============================================================================
-- The referral engine, given somewhere to remember things.
--
-- `lib/core/referral.ts` has described eight moments, their triggers and the
-- private satisfaction gate since before any of this was built, and until now
-- nothing read it. docs/benchmark.md gives referral and retention a weight of
-- 15 out of 100 — a seventh of the product's own grade — and the shipped
-- product scored approximately nothing on it, because a closing produced a
-- commission and no next relationship.
--
-- THE RULE THIS SCHEMA EXISTS TO ENFORCE.
--
-- Nothing public is asked for before a private check. Every moment that would
-- put a client in front of strangers — the closing-day review, the six-month
-- ask, the anniversary — is gated behind one private question, and an unhappy
-- client is routed to Kaleb rather than to a review form. That is not review
-- gating to manufacture ratings: somebody who says they are unhappy is never
-- asked for a public rating at all, and the private route exists so the
-- complaint gets answered.
--
-- `mood` is the column that check writes to, and it is deliberately nullable
-- with no default. Unanswered is its own state and must not be mistaken for
-- fine — a default of 'good' would ask the entire back catalogue for reviews
-- on the first deployment.
-- ============================================================================

-- The private satisfaction check. Null means nobody has asked yet.
alter table rift_leads add column if not exists mood text
  check (mood is null or mood in ('good', 'mixed', 'bad'));
alter table rift_leads add column if not exists mood_at timestamptz;

comment on column rift_leads.mood is
  'Answer to the private satisfaction check. NULL means unasked, which is not the same as fine — no public ask may go out on a NULL. See gate() in lib/core/referral.ts.';

-- The closing date, as its own fact.
--
-- `stage_since` was nearly good enough: a lead sitting in 'Closed' entered it
-- on the closing day. Nearly, because stage_since is rewritten by any later
-- stage change, and the whole post-closing cadence — thirty days, six months,
-- every anniversary indefinitely — is counted from this date. A correction to
-- somebody's stage two years later would silently move all of their
-- anniversaries, and the only visible symptom would be a message arriving on
-- the wrong day.
alter table rift_leads add column if not exists closed_on date;

comment on column rift_leads.closed_on is
  'The closing date. Every post-closing moment is counted from here rather than from stage_since, which a later stage edit would move.';

-- D5.5, the referral attribution loop: a referred lead linked to its referrer,
-- visible and countable. One column, self-referencing.
--
-- ON DELETE SET NULL rather than CASCADE. Somebody exercising their right to
-- be forgotten must not take the people they referred with them — those are
-- separate relationships who consented separately, and deleting them would be
-- doing a second thing to a third party on the strength of one person's
-- request. The referred lead survives with no referrer, which is the honest
-- record of what is left.
alter table rift_leads add column if not exists referred_by uuid
  references rift_leads(id) on delete set null;

create index if not exists rift_leads_referred_by_idx
  on rift_leads (referred_by) where referred_by is not null;

comment on column rift_leads.referred_by is
  'The relationship that sent this one. SET NULL on delete: erasing a referrer must not erase the people they referred.';

create table if not exists rift_referral_moments (
  id          uuid primary key default gen_random_uuid(),
  agent_id    uuid not null references rift_agents(id) on delete cascade,
  lead_id     uuid not null references rift_leads(id) on delete cascade,

  moment_id   text not null check (moment_id in (
                'value_delivered', 'plan_published', 'financing_secured',
                'under_contract', 'closing_day', 'day_30', 'month_6', 'anniversary')),

  -- Which time round. Zero for the seven moments that happen once.
  --
  -- The anniversary repeats every year on the closing date, indefinitely. A
  -- record keyed on the moment alone would mark the first anniversary sent and
  -- then suppress every anniversary after it — a cadence that quietly stops
  -- after year one while every screen goes on showing it as running. That is
  -- this product's recurring failure shape, and one integer removes it.
  occurrence  integer not null default 0 check (occurrence >= 0),

  state       text not null check (state in
                ('waiting', 'due', 'sent', 'acted', 'declined', 'held')),

  -- Why, in the agent's own words. Held-back moments are the ones worth
  -- explaining to yourself six months later.
  note        text check (note is null or length(note) <= 500),

  decided_at  timestamptz not null default now(),
  created_at  timestamptz not null default now(),

  -- One decision per moment per occurrence. This is what makes recording a
  -- decision idempotent, so a retried request cannot produce two answers about
  -- the same moment and leave the reader to pick.
  unique (lead_id, moment_id, occurrence)
);

create index if not exists rift_referral_moments_lead_idx
  on rift_referral_moments (lead_id, moment_id, occurrence);

comment on table rift_referral_moments is
  'A decision Kaleb has taken about one referral moment. Absence means undecided: the state is then derived from lifecycle data by momentsFor() rather than stored, so a moment becomes due on its own.';

alter table rift_referral_moments enable row level security;

drop policy if exists rift_referral_moments_owner on rift_referral_moments;
create policy rift_referral_moments_owner on rift_referral_moments for all
  using (agent_id in (select id from rift_agents where auth_user_id = auth.uid()))
  with check (agent_id in (select id from rift_agents where auth_user_id = auth.uid()));

-- =====================================================================
-- 20260921030000_rift_referral_attribution.sql
-- =====================================================================
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

-- =====================================================================
-- 20260921040000_rift_representation.sql
-- =====================================================================
-- Representation: the gate between a lead and a client.
--
-- docs/product.md requires this to be "a visible lifecycle state rather than
-- an offline side channel". It was neither — there was no column at all, which
-- is why canPublish() in lib/core/seam.ts was called with `hasAgreement: true`
-- as a literal. The one precondition in the product that was asserted rather
-- than read, inside the function whose entire job is refusing to publish when
-- something is not true.
--
-- It is also the most consequential compliance moment in a residential
-- transaction, and the record of it is what an agent would be asked for.

alter table rift_leads add column if not exists representation text
  not null default 'none';

alter table rift_leads add column if not exists representation_signed_on date;
alter table rift_leads add column if not exists representation_expires_on date;

-- The vocabulary is closed, and it matches STATUSES in
-- lib/core/representation.ts exactly. A status outside this list does not
-- error anywhere — it simply fails `isCovered`, so the journey silently stops
-- advancing and nobody can see why.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'rift_leads_representation_check') then
    alter table rift_leads add constraint rift_leads_representation_check
      check (representation in ('none','prepared','sent','signed','expired','declined'));
  end if;
end $$;

-- A signed agreement has a date it was signed.
--
-- Not "should have". The dates are the whole evidentiary value of the record:
-- "signed" with no date says an agreement exists without saying when it began,
-- which is the question that actually gets asked. Every other status has no
-- signing date by definition, and storing one against `declined` would be a
-- contradiction sitting in a column.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'rift_leads_signed_is_dated') then
    alter table rift_leads add constraint rift_leads_signed_is_dated
      check (
        (representation = 'signed' and representation_signed_on is not null)
        or (representation <> 'signed' and representation_signed_on is null)
      );
  end if;
end $$;

-- An agreement cannot run out before it starts.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'rift_leads_expiry_follows_signing') then
    alter table rift_leads add constraint rift_leads_expiry_follows_signing
      check (
        representation_expires_on is null
        or representation_signed_on is null
        or representation_expires_on >= representation_signed_on
      );
  end if;
end $$;

-- An expiry date belongs to an agreement. Recording one against a lead with
-- nothing signed is a date attached to nothing, and it would render on the
-- agent's screen as a deadline he has no way to meet.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'rift_leads_expiry_needs_an_agreement') then
    alter table rift_leads add constraint rift_leads_expiry_needs_an_agreement
      check (representation_expires_on is null or representation_signed_on is not null);
  end if;
end $$;

comment on column rift_leads.representation is
  'none | prepared | sent | signed | expired | declined. Matches STATUSES in lib/core/representation.ts. NOTE: a stored ''signed'' with a past expiry reads as expired — standingOf() derives that rather than writing it back, because a derived truth stored twice is two truths.';

comment on column rift_leads.representation_expires_on is
  'Monitored deadline. docs/product.md: expiration "raises attention before it lapses, not after".';

create index if not exists rift_leads_representation_idx
  on rift_leads (agent_id, representation_expires_on)
  where representation = 'signed' and representation_expires_on is not null;

-- =====================================================================
-- 20260921050000_rift_decisions.sql
-- =====================================================================
-- Decision Rooms.
--
-- docs/benchmark.md scores criterion 4.3 at 0 in production. Not weak —
-- absent. The prototype has /app/decisions and a decision room; the shipped
-- product had no surface at all, and the criterion asks for rooms "at the
-- moments where clients actually stall, with scenarios and recorded outcomes".

create table if not exists rift_decisions (
  id          uuid primary key default gen_random_uuid(),
  agent_id    uuid not null references rift_agents(id) on delete cascade,
  lead_id     uuid not null references rift_leads(id) on delete cascade,

  kind        text not null default 'other'
              check (kind in ('affordability','offers','property','timing','other')),

  -- Written for the client to read, like a plan item. Bounded because it
  -- renders as a heading on their page and a paragraph in a heading slot is a
  -- paragraph nobody reads.
  question    text not null check (length(btrim(question)) between 5 and 200),

  -- The agent's framing. Optional, because a room with two clearly labelled
  -- options sometimes needs no preamble, and requiring one produces preamble.
  context     text check (context is null or length(btrim(context)) > 0),

  decide_by   date,

  -- Prepare-then-approve, criterion 2.2. NULL means the client cannot see it.
  -- Not a boolean: when it was released is the part that matters afterwards.
  released_at timestamptz,

  -- The recorded outcome. An outcome is a fact, not a state — which option,
  -- when, and in whose words.
  decided_at       timestamptz,
  chosen_option_id uuid,
  outcome_note     text,

  created_at  timestamptz not null default now()
);

create table if not exists rift_decision_options (
  id            uuid primary key default gen_random_uuid(),
  agent_id      uuid not null references rift_agents(id) on delete cascade,
  decision_id   uuid not null references rift_decisions(id) on delete cascade,

  label         text not null check (length(btrim(label)) between 1 and 120),
  detail        text,

  -- CENTS. These are money and a float is not money; the rest of this schema
  -- stores money the same way for the same reason.
  --
  -- NULL is meaningful and is not zero: "sell first, then buy" has no figure,
  -- and lib/core/decision.ts refuses to release a room where some options
  -- carry one and others do not, because side by side an option with no number
  -- reads as one that costs nothing.
  amount_cents  bigint,

  -- What that number IS: "would reach you", "a month", "at the table". Two
  -- options labelled differently are different quantities in the same column,
  -- and canRelease() refuses that too.
  amount_label  text,

  upside        text,
  downside      text,

  -- The agent's order. Never the amount: the largest number is not the best
  -- option, which is the entire point of headlineTrap in lib/core/offers.ts.
  sort          integer not null default 0,

  created_at    timestamptz not null default now()
);

-- A figure needs to say what it is. A bare number in a comparison column is
-- the reader's guess about what they are comparing.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'rift_decision_options_amount_is_labelled') then
    alter table rift_decision_options add constraint rift_decision_options_amount_is_labelled
      check (amount_cents is null or length(btrim(coalesce(amount_label,''))) > 0);
  end if;
end $$;

-- The chosen option must belong to this decision.
--
-- A plain foreign key to rift_decision_options would let a decision be
-- recorded against an option from a DIFFERENT room — which renders as a
-- perfectly ordinary outcome naming an option the reader cannot see. The
-- composite key makes that unrepresentable.
create unique index if not exists rift_decision_options_scoped_idx
  on rift_decision_options (id, decision_id);

-- ON DELETE RESTRICT, and the alternative is worth recording because it was
-- written first and is a trap.
--
-- `on delete set null` here does NOT null only chosen_option_id. A composite
-- foreign key sets EVERY column in the key to null, and the second column of
-- this one is rift_decisions.id — the primary key. Deleting an option that a
-- decision named failed with "null value in column id violates not-null
-- constraint", which is the good outcome; the bad one was available on
-- Postgres 15+ as `set null (chosen_option_id)`, and writing version-specific
-- syntax into a migration applied by hand to a database whose version nobody
-- has checked is how a migration half-applies.
--
-- RESTRICT is also the better rule. An option a recorded decision names is
-- part of the record of what was decided, and quietly removable evidence is
-- not evidence. Reopen the decision first — which clears the reference — and
-- then the option can go.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'rift_decisions_chosen_is_ours') then
    alter table rift_decisions add constraint rift_decisions_chosen_is_ours
      foreign key (chosen_option_id, id)
      references rift_decision_options (id, decision_id)
      on delete restrict
      deferrable initially deferred;
  end if;
end $$;

-- An outcome has a time and an option, or it has neither. Half an outcome is
-- a room that says a decision was made without saying what it was.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'rift_decisions_outcome_is_whole') then
    alter table rift_decisions add constraint rift_decisions_outcome_is_whole
      check ((decided_at is null) = (chosen_option_id is null));
  end if;
end $$;

create index if not exists rift_decisions_lead_idx
  on rift_decisions (lead_id, created_at desc);

-- The client's own read: released rooms for one relationship.
create index if not exists rift_decisions_released_idx
  on rift_decisions (lead_id, released_at) where released_at is not null;

create index if not exists rift_decision_options_decision_idx
  on rift_decision_options (decision_id, sort);

alter table rift_decisions        enable row level security;
alter table rift_decision_options enable row level security;

drop policy if exists rift_decisions_owner on rift_decisions;
create policy rift_decisions_owner on rift_decisions
  for all using (agent_id = rift_my_agent_id()) with check (agent_id = rift_my_agent_id());

drop policy if exists rift_decision_options_owner on rift_decision_options;
create policy rift_decision_options_owner on rift_decision_options
  for all using (agent_id = rift_my_agent_id()) with check (agent_id = rift_my_agent_id());

comment on column rift_decisions.released_at is
  'NULL means the client cannot see this room. Prepare-then-approve, benchmark 2.2.';

comment on column rift_decision_options.amount_cents is
  'NULL is "this option has no figure", which is not zero. See canRelease() in lib/core/decision.ts.';
