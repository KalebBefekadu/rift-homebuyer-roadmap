-- ============================================================================
-- Pilot reconciliation (blueprint v4 W12; implementation plan §8 step 4).
--
-- Rift cannot see Matrix or the signed documents. What it holds is the
-- agent's record of them: the search he set up, the dates he entered. During
-- the pilot he checks, buyer by buyer, that the record still matches the
-- source, and this is where each check is kept:
--
--   search   the live Matrix search against the approved package it came
--            from: 'matches', 'differs', or 'none' when there is no live
--            search to check (then no package is named).
--   dates    the open contract's dates against the documents, the same way.
--   note     required when either differs: what differed and what was done.
--
-- Each check is history. A difference is resolved by fixing the source or
-- the record and checking again, never by editing the old check. The pilot
-- report reads the latest check per journey and says when the search or the
-- dates changed after it (lib/core/pilot.ts).
--
-- Additive: one new table, and a (id, journey_id) key on the packages so a
-- check can only name a package on its own journey.
-- ============================================================================

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.rift_search_packages
  add constraint rift_search_packages_id_journey unique (id, journey_id);

create table public.rift_reconciliations (
  id                 uuid primary key default gen_random_uuid(),
  agent_id           uuid not null references public.rift_agents(id) on delete restrict,
  journey_id         uuid not null,
  search_package_id  uuid,
  search             text not null check (search in ('matches', 'differs', 'none')),
  dates              text not null check (dates in ('matches', 'differs', 'none')),
  note               text check (note is null or length(btrim(note)) between 3 and 1000),
  actor_label        text not null check (length(btrim(actor_label)) between 1 and 120),
  request_id         uuid not null unique,
  created_at         timestamptz not null default now(),

  constraint rift_reconciliations_journey_same_agent
    foreign key (journey_id, agent_id) references public.rift_journeys (id, agent_id) on delete cascade,
  constraint rift_reconciliations_package_on_journey
    foreign key (search_package_id, journey_id) references public.rift_search_packages (id, journey_id) on delete cascade,
  -- A checked search names the package it was checked against; no search names none.
  constraint rift_reconciliations_search_names_package check ((search = 'none') = (search_package_id is null)),
  -- A difference says what it was.
  constraint rift_reconciliations_difference_says_what check ((search <> 'differs' and dates <> 'differs') or note is not null),
  -- A check that checked nothing is not a check.
  constraint rift_reconciliations_checked_something check (search <> 'none' or dates <> 'none')
);
create index rift_reconciliations_journey_idx on public.rift_reconciliations (journey_id, created_at desc);
create index rift_reconciliations_agent_idx on public.rift_reconciliations (agent_id, created_at desc);

create or replace function public.rift_reconciliations_are_history() returns trigger
language plpgsql as $$
begin
  raise exception '% is history and cannot be edited; record a new check', tg_table_name
    using errcode = 'check_violation';
end $$;

create trigger rift_reconciliations_are_history before update on public.rift_reconciliations
  for each row execute function public.rift_reconciliations_are_history();

alter table public.rift_reconciliations enable row level security;
create policy rift_reconciliations_agent on public.rift_reconciliations for all to public
  using (agent_id = (select public.rift_my_agent_id())) with check (agent_id = (select public.rift_my_agent_id()));

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.rift_reconciliations from anon;
    revoke execute on function public.rift_reconciliations_are_history() from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on public.rift_reconciliations from authenticated;
    grant select on public.rift_reconciliations to authenticated;
    revoke execute on function public.rift_reconciliations_are_history() from authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert, delete on public.rift_reconciliations to service_role;
  end if;
end $$;

comment on table public.rift_reconciliations is
  'Each pilot check that Rift''s record of a buyer''s Matrix search and contract dates still matches the source. History; the latest is current.';

commit;
