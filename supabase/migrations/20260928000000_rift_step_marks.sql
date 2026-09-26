-- ============================================================================
-- The journey checklist (Blueprint v5 §8.6; lib/core/checklist.ts).
--
-- Each stage of a journey is a checklist of steps from the journey contracts,
-- each naming who does it. The steps themselves are code; what the agent
-- records against them is here, as history:
--
--   rift_step_marks   one row per thing recorded against one step of one
--                     journey: done (who did or confirmed it, and the day),
--                     reported (someone says so; nobody who can confirm it
--                     has), not needed (and why), or reopened (and why).
--                     The latest row for a step is where it stands.
--
-- The ten workstreams under contract are steps too, but their state lives in
-- rift_workstream_updates and is changed there; nothing here duplicates it.
--
-- Rule 9 is held by the checks below as well as by the writer: nothing is
-- done without a named party and a day, and a reopening says why. Only the
-- agent records marks; a client's word, when there is a way for them to give
-- it, arrives as 'reported'.
--
-- Retention: cascades when the journey is erased, like everything on it.
-- ============================================================================

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table public.rift_step_marks (
  id           uuid primary key default gen_random_uuid(),
  agent_id     uuid not null references public.rift_agents(id) on delete restrict,
  journey_id   uuid not null,
  -- A step id from lib/core/checklist.ts: b- for buying, s- for selling.
  step_id      text not null check (step_id ~ '^[bs]-[a-z0-9-]{1,40}$'),
  -- One sequence per step: two people recording at once, one is told to reload.
  seq          integer not null check (seq >= 1),
  state        text not null check (state in ('done', 'reported', 'not-needed', 'reopened')),
  -- Who did it, confirmed it, or says it happened.
  by_name      text check (by_name is null or length(btrim(by_name)) between 1 and 160),
  -- The day it happened, which may be before the day it was recorded.
  done_on      date,
  note         text check (note is null or length(btrim(note)) between 1 and 500),
  actor_label  text not null check (length(btrim(actor_label)) between 1 and 120),
  request_id   uuid not null unique,
  created_at   timestamptz not null default now(),

  constraint rift_step_marks_journey_same_agent
    foreign key (journey_id, agent_id) references public.rift_journeys (id, agent_id) on delete cascade,
  constraint rift_step_marks_seq unique (journey_id, step_id, seq),
  -- Rule 9: done names who and the day.
  constraint rift_step_marks_done_is_named check (state <> 'done' or (by_name is not null and done_on is not null)),
  -- UX-02: a report says whose word it is.
  constraint rift_step_marks_report_is_named check (state <> 'reported' or by_name is not null),
  constraint rift_step_marks_skip_says_why check (state not in ('not-needed', 'reopened') or note is not null)
);
create index rift_step_marks_journey_idx on public.rift_step_marks (journey_id, step_id, seq);

-- History is never edited. UPDATE only: a delete must still cascade when a
-- journey is erased (handoff 9b). The function is the progress tables' own.
create trigger rift_step_marks_are_history before update on public.rift_step_marks
  for each row execute function public.rift_progress_is_history();

alter table public.rift_step_marks enable row level security;
create policy rift_step_marks_agent on public.rift_step_marks for all to public
  using (agent_id = (select public.rift_my_agent_id()))
  with check (agent_id = (select public.rift_my_agent_id()));

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.rift_step_marks from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on public.rift_step_marks from authenticated;
    grant select on public.rift_step_marks to authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert, update, delete on public.rift_step_marks to service_role;
  end if;
end $$;

comment on table public.rift_step_marks is
  'What the agent recorded against one checklist step of one journey. The latest row per step is where it stands; done needs who and the day.';

commit;
