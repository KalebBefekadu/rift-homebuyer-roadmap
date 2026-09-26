-- ============================================================================
-- The team, and who does each checklist step (Blueprint v5 §8.6, §8.7).
--
--   rift_team_members     people the agent has let in to do their part of the
--                         checklist. One role today: coordinator. Invited by
--                         email; the first sign-in with that address binds the
--                         account. Removed by the agent, never deleted, so a
--                         mark they recorded still says whose it was.
--
--   rift_step_assignments who does each checklist step, where the agent has
--                         changed it from the default in lib/core/checklist.ts.
--                         One row per step, with who changed it and when. No
--                         row means the default.
--
--   rift_step_marks       gains who recorded each mark: the agent, or a named
--                         coordinator. A coordinator records only the steps
--                         assigned to the coordinator; the writer checks that,
--                         and the check below makes sure a coordinator's mark
--                         names the coordinator.
--
-- Protected steps (sending an agreement, presenting an offer, a price opinion)
-- cannot be assigned away from the agent: the check is in the writer and in
-- lib/core/checklist.ts, where the list of them lives.
--
-- A coordinator never reads a table directly: every read and write goes
-- through the server with the service role, scoped by the membership. So the
-- policies here are the agent's alone.
--
-- Retention: team members are kept while the agent's account exists, as the
-- record of who did what. Assignments are settings.
-- ============================================================================

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table public.rift_team_members (
  id              uuid primary key default gen_random_uuid(),
  agent_id        uuid not null references public.rift_agents(id) on delete cascade,
  email           text not null check (email = lower(btrim(email)) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 254),
  display_name    text not null check (length(btrim(display_name)) between 1 and 120),
  role            text not null default 'coordinator' check (role in ('coordinator')),
  invited_at      timestamptz not null default now(),
  -- Set on the first sign-in with the invited address.
  auth_user_id    uuid,
  accepted_at     timestamptz,
  revoked_at      timestamptz,
  revoked_reason  text check (revoked_reason is null or length(btrim(revoked_reason)) between 1 and 300),
  actor_label     text not null check (length(btrim(actor_label)) between 1 and 120),

  constraint rift_team_members_accepted_has_user check ((accepted_at is null) = (auth_user_id is null)),
  constraint rift_team_members_revoked_says_why check (revoked_at is null or revoked_reason is not null),
  -- For the composite reference from rift_step_marks.
  constraint rift_team_members_id_agent unique (id, agent_id)
);
-- One live membership per address, and one per account.
create unique index rift_team_members_email_live on public.rift_team_members (agent_id, email) where revoked_at is null;
create unique index rift_team_members_user_live on public.rift_team_members (auth_user_id) where revoked_at is null and auth_user_id is not null;

create table public.rift_step_assignments (
  agent_id     uuid not null references public.rift_agents(id) on delete cascade,
  step_id      text not null check (step_id ~ '^[bs]-[a-z0-9-]{1,40}$'),
  -- Only these three are the agent's to hand out: a professional or the
  -- client does their step whoever records it.
  doer         text not null check (doer in ('you', 'tc', 'rift')),
  actor_label  text not null check (length(btrim(actor_label)) between 1 and 120),
  updated_at   timestamptz not null default now(),
  primary key (agent_id, step_id)
);

alter table public.rift_step_marks
  add column if not exists actor_kind text not null default 'agent' check (actor_kind in ('agent', 'coordinator')),
  add column if not exists team_member_id uuid;
alter table public.rift_step_marks
  add constraint rift_step_marks_member_same_agent
    foreign key (team_member_id, agent_id) references public.rift_team_members (id, agent_id) on delete restrict,
  add constraint rift_step_marks_coordinator_named
    check ((actor_kind = 'coordinator') = (team_member_id is not null));

alter table public.rift_team_members enable row level security;
create policy rift_team_members_agent on public.rift_team_members for all to public
  using (agent_id = (select public.rift_my_agent_id()))
  with check (agent_id = (select public.rift_my_agent_id()));

alter table public.rift_step_assignments enable row level security;
create policy rift_step_assignments_agent on public.rift_step_assignments for all to public
  using (agent_id = (select public.rift_my_agent_id()))
  with check (agent_id = (select public.rift_my_agent_id()));

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.rift_team_members from anon;
    revoke all on public.rift_step_assignments from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on public.rift_team_members from authenticated;
    revoke all on public.rift_step_assignments from authenticated;
    grant select on public.rift_team_members to authenticated;
    grant select on public.rift_step_assignments to authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert, update, delete on public.rift_team_members to service_role;
    grant select, insert, update, delete on public.rift_step_assignments to service_role;
  end if;
end $$;

comment on table public.rift_team_members is
  'People the agent let in to record their part of the checklist. Removed, never deleted, so their marks still say whose they were.';
comment on table public.rift_step_assignments is
  'Who does each checklist step, where the agent changed it from the default. No row is the default.';

commit;
