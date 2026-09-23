-- Representation: the gate between a lead and a client.
--
-- docs/product.md requires this to be "a visible lifecycle state rather than
-- an offline side channel". It was neither: there was no column at all, which
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
-- error anywhere: it simply fails `isCovered`, so the journey silently stops
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
  'none | prepared | sent | signed | expired | declined. Matches STATUSES in lib/core/representation.ts. NOTE: a stored ''signed'' with a past expiry reads as expired: standingOf() derives that rather than writing it back, because a derived truth stored twice is two truths.';

comment on column rift_leads.representation_expires_on is
  'Monitored deadline. docs/product.md: expiration "raises attention before it lapses, not after".';

create index if not exists rift_leads_representation_idx
  on rift_leads (agent_id, representation_expires_on)
  where representation = 'signed' and representation_expires_on is not null;
