-- ============================================================================
-- A sale linked to a purchase (STATE-07, Blueprint v5 §7, §9).
--
--   rift_dependencies        the purchase depends on the sale for something:
--                            its proceeds, possession, or timing. Who owns
--                            making it happen, in the agent's words. Never
--                            edited.
--   rift_dependency_events   what happened to it since: met (with evidence),
--                            or removed (with why). History only; the latest
--                            is its state, and none means open.
--
-- Recording one moves nothing: neither journey's stage, dates or workstreams
-- change because of it. The rules are lib/core/dependency.ts; the only
-- writer is lib/db/dependencies.ts.
-- ============================================================================

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table if not exists public.rift_dependencies (
  id                   uuid primary key default gen_random_uuid(),
  agent_id             uuid not null references public.rift_agents (id) on delete cascade,
  sale_journey_id      uuid not null references public.rift_journeys (id) on delete cascade,
  purchase_journey_id  uuid not null references public.rift_journeys (id) on delete cascade,
  kind                 text not null check (kind in ('proceeds', 'possession', 'timing')),
  note                 text not null check (length(btrim(note)) between 3 and 300),
  owner                text not null check (length(btrim(owner)) between 1 and 120),
  actor_label          text not null check (length(btrim(actor_label)) between 1 and 120),
  request_id           uuid not null,
  created_at           timestamptz not null default now(),
  constraint rift_dependencies_request unique (agent_id, request_id),
  constraint rift_dependencies_two_journeys check (sale_journey_id <> purchase_journey_id)
);
create index if not exists rift_dependencies_sale_idx on public.rift_dependencies (sale_journey_id);
create index if not exists rift_dependencies_purchase_idx on public.rift_dependencies (purchase_journey_id);

create table if not exists public.rift_dependency_events (
  id             uuid primary key default gen_random_uuid(),
  agent_id       uuid not null references public.rift_agents (id) on delete cascade,
  dependency_id  uuid not null references public.rift_dependencies (id) on delete cascade,
  state          text not null check (state in ('met', 'removed', 'reopened')),
  evidence       text not null check (length(btrim(evidence)) between 3 and 300),
  actor_label    text not null check (length(btrim(actor_label)) between 1 and 120),
  request_id     uuid not null,
  created_at     timestamptz not null default now(),
  constraint rift_dependency_events_request unique (agent_id, request_id)
);
create index if not exists rift_dependency_events_idx on public.rift_dependency_events (dependency_id, created_at);

-- A sale is a selling journey and a purchase a buying one, both the agent's.
create or replace function public.rift_dependencies_sides() returns trigger
language plpgsql as $$
begin
  if not exists (select 1 from public.rift_journeys where id = new.sale_journey_id and side = 'sell' and agent_id = new.agent_id)
     or not exists (select 1 from public.rift_journeys where id = new.purchase_journey_id and side = 'buy' and agent_id = new.agent_id) then
    raise exception 'a dependency links one of the agent''s selling journeys to one of their buying journeys'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists rift_dependencies_sides on public.rift_dependencies;
create trigger rift_dependencies_sides before insert on public.rift_dependencies
  for each row execute function public.rift_dependencies_sides();

create or replace function public.rift_dependencies_history() returns trigger
language plpgsql as $$
begin
  raise exception '% is history and cannot be edited; record what happened', tg_table_name
    using errcode = 'check_violation';
end $$;

drop trigger if exists rift_dependencies_are_history on public.rift_dependencies;
create trigger rift_dependencies_are_history before update on public.rift_dependencies
  for each row execute function public.rift_dependencies_history();
drop trigger if exists rift_dependency_events_are_history on public.rift_dependency_events;
create trigger rift_dependency_events_are_history before update on public.rift_dependency_events
  for each row execute function public.rift_dependencies_history();

do $$
declare t text;
begin
  foreach t in array array['rift_dependencies', 'rift_dependency_events'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_agent', t);
    execute format(
      'create policy %I on public.%I for all to public using (agent_id = (select public.rift_my_agent_id())) with check (agent_id = (select public.rift_my_agent_id()))',
      t || '_agent', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on public.%I from anon', t);
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('revoke all on public.%I from authenticated', t);
      execute format('grant select on public.%I to authenticated', t);
    end if;
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format('grant select, insert on public.%I to service_role', t);
    end if;
  end loop;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke execute on function public.rift_dependencies_history() from anon;
    revoke execute on function public.rift_dependencies_sides() from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke execute on function public.rift_dependencies_history() from authenticated;
    revoke execute on function public.rift_dependencies_sides() from authenticated;
  end if;
end $$;

comment on table public.rift_dependencies is 'A purchase that depends on a sale (proceeds, possession, timing), with its owner. Never moves either journey.';
comment on table public.rift_dependency_events is 'What happened to a dependency: met with evidence, removed with why, or reopened. History only.';

commit;
