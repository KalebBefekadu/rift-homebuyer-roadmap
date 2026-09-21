-- Rift Offer, inbound: the columns /offer writes and /studio/offers reads.
--
-- This migration was believed to exist and did not. `lib/db/offer-intake.ts`
-- shipped writing `property_address`, `submitted_email`, `submitted_phone`,
-- `submitted_firm`, `representing`, `source` and `submitter_lead_id` to a table
-- that has none of them, and reading them back in a nineteen-column select.
--
-- PostgREST answers an unknown column with an error about a schema cache, so
-- /studio/offers failed entirely and every /offer submission fell through to
-- its "we could not pass this on" fallback. The fallback is honest, which is
-- why this looked like an unconfigured feature rather than a broken one.
--
-- Found by scripts/verify-queries.mjs during a sweep of every column list in
-- lib/db, immediately after the same script found `rift_leads.figure_id`.

-- Where the offer came from. 'agent' is one Kaleb typed in against a listing
-- he holds; 'inbound' is one a stranger submitted at /offer.
alter table rift_offers add column if not exists source text not null default 'agent';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'rift_offers_source_check') then
    alter table rift_offers add constraint rift_offers_source_check
      check (source in ('agent','inbound'));
  end if;
end $$;

-- The property. Required for an inbound offer and meaningless for an agent
-- one, where the offer already belongs to a seller whose address is known.
alter table rift_offers add column if not exists property_address text;

-- How to reach whoever sent it. A cooperating agent or an unrepresented buyer.
--
-- docs/privacy: the phone number given to deliver ONE offer is passed on with
-- it and never stored beyond the offer's own retention. These live on the
-- offer row rather than on a lead deliberately — the submitter is a third
-- party until they choose to become a relationship.
alter table rift_offers add column if not exists submitted_email text;
alter table rift_offers add column if not exists submitted_phone text;
alter table rift_offers add column if not exists submitted_firm  text;

-- Whose side they are on, in their own words. Never inferred.
alter table rift_offers add column if not exists representing text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'rift_offers_representing_check') then
    alter table rift_offers add constraint rift_offers_representing_check
      check (representing is null or representing in ('buyer','self','other'));
  end if;
end $$;

-- If the submitter later becomes a relationship, this links the two.
--
-- SET NULL, not CASCADE. Deleting the lead must not delete the offer: the
-- record of what was received is the only protection either side has if the
-- terms are disputed, and vision.md is explicit that Rift never discards one.
alter table rift_offers add column if not exists submitter_lead_id uuid
  references rift_leads(id) on delete set null;

-- An inbound offer has no seller yet, because nobody has matched it to one.
alter table rift_offers alter column lead_id drop not null;

-- But it must be ABOUT something. A row with neither a seller nor an address
-- is an offer on nothing, and it would sit in the agent's queue forever with
-- no way to act on it.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'rift_offers_has_a_subject') then
    alter table rift_offers add constraint rift_offers_has_a_subject
      check (lead_id is not null or length(btrim(coalesce(property_address,''))) > 0);
  end if;
end $$;

create index if not exists rift_offers_inbound_idx
  on rift_offers (agent_id, created_at desc) where source = 'inbound';

comment on column rift_offers.source is
  'agent | inbound. An inbound offer arrived at /offer from a stranger and has no seller attached until the agent matches it.';

comment on column rift_offers.submitted_phone is
  'Passed on with the offer, kept only for the offer''s own retention window. See RETENTION in lib/core/privacy.ts.';
