-- ============================================================================
-- Seller stages (STATE-03, Blueprint v5 §9).
--
-- A selling journey moves through Prepare, Price & launch, Market & show,
-- Review offers, Under contract, Close and Continue. Prepare, Under contract
-- and Close are shared with the buyer's stages; the rest are the seller's.
-- A trigger keeps each journey to its own side's stages, and Continue, like
-- Own, is reached only through a contract. The rules are lib/core/progress.ts.
-- ============================================================================

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.rift_journey_events drop constraint if exists rift_journey_events_values;
alter table public.rift_journey_events add constraint rift_journey_events_values check (
  (kind = 'stage'
    and from_value in ('prepare', 'search', 'tour', 'offer', 'under-contract', 'close', 'own', 'price-launch', 'market', 'offers', 'continue')
    and to_value in ('prepare', 'search', 'tour', 'offer', 'under-contract', 'close', 'own', 'price-launch', 'market', 'offers', 'continue'))
  or (kind = 'status'
    and from_value in ('active', 'paused', 'completed', 'cancelled')
    and to_value in ('active', 'paused', 'completed', 'cancelled'))
);

alter table public.rift_journey_events drop constraint if exists rift_journey_events_contract_stages;
alter table public.rift_journey_events add constraint rift_journey_events_contract_stages check (
  kind <> 'stage' or to_value not in ('under-contract', 'own', 'continue') or transaction_id is not null
);

create or replace function public.rift_journey_events_side() returns trigger
language plpgsql as $$
declare s text;
begin
  if new.kind <> 'stage' then return new; end if;
  select side into s from public.rift_journeys where id = new.journey_id;
  if (s = 'buy' and new.to_value in ('price-launch', 'market', 'offers', 'continue'))
     or (s = 'sell' and new.to_value in ('search', 'tour', 'offer', 'own')) then
    raise exception 'a % journey has no % stage', s, new.to_value
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists rift_journey_events_side on public.rift_journey_events;
create trigger rift_journey_events_side before insert on public.rift_journey_events
  for each row execute function public.rift_journey_events_side();

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke execute on function public.rift_journey_events_side() from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke execute on function public.rift_journey_events_side() from authenticated;
  end if;
end $$;

commit;
