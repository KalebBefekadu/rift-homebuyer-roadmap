-- ============================================================================
-- Journey identity (blueprint v4, work package W01).
--
-- One buying or selling goal, linked to an existing relationship. Taken from
-- docs/blueprint-v4/first-migration-proposal.md with two changes: grants to
-- Supabase roles are conditional, so the same file runs against the local test
-- harness (which has no `authenticated` or `service_role`), and nothing else.
--
-- Identity only. No stage, no lifecycle, no client access. Members, search
-- revisions and the shortlist ship in the migrations after this one, each with
-- its own constraints and tests.
--
-- Deletion: `origin_lead_id` is RESTRICT. Once a journey exists, deleting its
-- lead is refused rather than silently cascading. The two code paths that
-- delete leads handle it explicitly: the retention sweep leaves leads with a
-- journey alone (they are being worked), and "delete all of it" removes the
-- journeys first. See lib/db/retention.ts.
-- ============================================================================

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- The composite key protects the parent link even when a service role bypasses RLS.
create unique index rift_leads_id_agent_for_journeys_uidx
  on public.rift_leads (id, agent_id);

create table public.rift_journeys (
  id              uuid primary key default gen_random_uuid(),
  agent_id        uuid not null references public.rift_agents(id)
                    on delete restrict,
  origin_lead_id  uuid not null,
  side            text not null check (side in ('buy', 'sell')),
  label           text not null
                    check (length(btrim(label)) between 1 and 160),
  created_at      timestamptz not null default now(),

  constraint rift_journeys_relationship_same_agent
    foreign key (origin_lead_id, agent_id)
    references public.rift_leads (id, agent_id)
    on delete restrict,

  constraint rift_journeys_id_agent_unique unique (id, agent_id)
);

-- The agent list and the relationship's journey list are the first two reads.
create index rift_journeys_agent_created_idx
  on public.rift_journeys (agent_id, created_at desc, id);
create index rift_journeys_origin_lead_idx
  on public.rift_journeys (origin_lead_id, created_at desc, id);

alter table public.rift_journeys enable row level security;

create policy rift_journeys_agent_select
  on public.rift_journeys
  for select to public
  using (agent_id = (select public.rift_my_agent_id()));

create policy rift_journeys_agent_insert
  on public.rift_journeys
  for insert to public
  with check (agent_id = (select public.rift_my_agent_id()));

create policy rift_journeys_agent_update
  on public.rift_journeys
  for update to public
  using (agent_id = (select public.rift_my_agent_id()))
  with check (agent_id = (select public.rift_my_agent_id()));

-- Explicit grants: RLS does not itself grant table access. Only the label is
-- editable through the authenticated role in this first seam. The policies
-- above name `public` so the same file runs where `authenticated` does not
-- exist; these grants are what narrow it to signed-in agents.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.rift_journeys from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on public.rift_journeys from authenticated;
    grant select on public.rift_journeys to authenticated;
    grant insert (agent_id, origin_lead_id, side, label) on public.rift_journeys to authenticated;
    grant update (label) on public.rift_journeys to authenticated;
  end if;
  -- Deletion remains behind the server's tenant-checked retention command.
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert, update, delete on public.rift_journeys to service_role;
  end if;
end $$;

comment on table public.rift_journeys is
  'One buying or selling goal linked to an existing Rift relationship. '
  'Identity only: lifecycle events, client membership and search revisions '
  'ship through separately reviewed migrations.';

comment on column public.rift_journeys.origin_lead_id is
  'Transitional relationship anchor. Deletion is explicit so retention '
  'cannot accidentally remove a future transaction file.';

commit;
