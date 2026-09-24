-- ============================================================================
-- Tours (blueprint v4, W06; journey contract B06; REQ-SEARCH-07 and 08).
--
-- A showing is arranged in ShowingTime. These tables are the record of what
-- the agent did there and what came back: a request, each step after it, and
-- the buyer's short answer afterwards. A request is not an appointment (AT17);
-- the rules for which step may follow which, and the check that a signed
-- agreement is in force before going ahead (AT18), are in lib/core/tour.ts and
-- enforced by lib/db/tours.ts, the only writer.
--
-- Access and lockbox details have no column anywhere here, on purpose. They
-- stay in ShowingTime.
--
-- Steps and answers are one row each and never edited, so "confirmed for
-- 2pm, then moved to 4pm, then cancelled" is history rather than an overwrite.
-- ============================================================================

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table public.rift_tour_stops (
  id                   uuid primary key default gen_random_uuid(),
  agent_id             uuid not null references public.rift_agents(id) on delete restrict,
  journey_id           uuid not null,
  home_id              uuid not null,
  requested_by_kind    text not null check (requested_by_kind in ('agent', 'client')),
  requested_by_member  uuid,
  requested_by_label   text not null check (length(btrim(requested_by_label)) between 1 and 120),
  -- When they could go, in their words. Not a slot: nothing is booked by asking.
  availability         text check (availability is null or length(btrim(availability)) between 1 and 300),
  created_at           timestamptz not null default now(),

  constraint rift_tour_stops_journey_same_agent
    foreign key (journey_id, agent_id) references public.rift_journeys (id, agent_id) on delete cascade,
  constraint rift_tour_stops_home_on_journey
    foreign key (home_id, journey_id) references public.rift_shortlist_homes (id, journey_id) on delete cascade,
  constraint rift_tour_stops_member_on_journey
    foreign key (requested_by_member, journey_id) references public.rift_journey_members (id, journey_id) on delete cascade,
  constraint rift_tour_stops_id_journey unique (id, journey_id),
  constraint rift_tour_stops_requested_by
    check ((requested_by_kind = 'agent') = (requested_by_member is null))
);
create index rift_tour_stops_journey_idx on public.rift_tour_stops (journey_id, created_at desc);

create table public.rift_tour_steps (
  id          uuid primary key default gen_random_uuid(),
  agent_id    uuid not null references public.rift_agents(id) on delete restrict,
  journey_id  uuid not null,
  stop_id     uuid not null,
  seq         integer not null check (seq >= 1),
  status      text not null check (status in ('requested', 'awaiting-confirmation', 'confirmed', 'changed', 'cancelled', 'completed')),
  starts_at   timestamptz,
  ends_at     timestamptz,
  -- The ShowingTime reference, when the agent has one.
  ref         text check (ref is null or length(btrim(ref)) between 1 and 200),
  note        text check (note is null or length(btrim(note)) between 1 and 500),
  actor_label text not null check (length(btrim(actor_label)) between 1 and 120),
  -- A double click or a retry records once.
  request_id  uuid not null unique,
  created_at  timestamptz not null default now(),

  constraint rift_tour_steps_journey_same_agent
    foreign key (journey_id, agent_id) references public.rift_journeys (id, agent_id) on delete cascade,
  constraint rift_tour_steps_stop_on_journey
    foreign key (stop_id, journey_id) references public.rift_tour_stops (id, journey_id) on delete cascade,
  -- Two people recording the next step at once: one wins, the other is told to reload.
  constraint rift_tour_steps_seq unique (stop_id, seq),
  constraint rift_tour_steps_slot_is_whole check ((starts_at is null) = (ends_at is null)),
  constraint rift_tour_steps_slot_forward check (ends_at is null or ends_at > starts_at),
  constraint rift_tour_steps_slot_when_timed
    check (status not in ('confirmed', 'changed') or starts_at is not null),
  constraint rift_tour_steps_cancel_says_why check (status <> 'cancelled' or note is not null),
  constraint rift_tour_steps_first_is_request check ((seq = 1) = (status = 'requested'))
);
create index rift_tour_steps_stop_idx on public.rift_tour_steps (stop_id, seq);

create table public.rift_tour_feedback (
  id            uuid primary key default gen_random_uuid(),
  agent_id      uuid not null references public.rift_agents(id) on delete restrict,
  journey_id    uuid not null,
  stop_id       uuid not null,
  -- Null when the agent recorded it on somebody's behalf, and then the label says whose.
  member_id     uuid,
  actor_label   text not null check (length(btrim(actor_label)) between 1 and 120),
  offer         text not null check (offer in ('yes', 'maybe', 'no')),
  reason        text check (reason is null or length(btrim(reason)) between 1 and 500),
  -- A note for the agent, never an edit to the brief (REQ-SEARCH-06).
  search_change text check (search_change is null or length(btrim(search_change)) between 1 and 500),
  created_at    timestamptz not null default now(),

  constraint rift_tour_feedback_journey_same_agent
    foreign key (journey_id, agent_id) references public.rift_journeys (id, agent_id) on delete cascade,
  constraint rift_tour_feedback_stop_on_journey
    foreign key (stop_id, journey_id) references public.rift_tour_stops (id, journey_id) on delete cascade,
  constraint rift_tour_feedback_member_on_journey
    foreign key (member_id, journey_id) references public.rift_journey_members (id, journey_id) on delete cascade
);
create index rift_tour_feedback_stop_idx on public.rift_tour_feedback (stop_id, created_at);

-- History is never edited. UPDATE only: a delete must still cascade when a
-- journey is erased (the lesson of referred_by, handoff 9b).
create or replace function public.rift_tour_history_is_history() returns trigger
language plpgsql as $$
begin
  raise exception '% is history and cannot be edited; record a new row', tg_table_name
    using errcode = 'check_violation';
end $$;

create trigger rift_tour_stops_are_history before update on public.rift_tour_stops
  for each row execute function public.rift_tour_history_is_history();
create trigger rift_tour_steps_are_history before update on public.rift_tour_steps
  for each row execute function public.rift_tour_history_is_history();
create trigger rift_tour_feedback_is_history before update on public.rift_tour_feedback
  for each row execute function public.rift_tour_history_is_history();

alter table public.rift_tour_stops    enable row level security;
alter table public.rift_tour_steps    enable row level security;
alter table public.rift_tour_feedback enable row level security;

create policy rift_tour_stops_agent on public.rift_tour_stops
  for all to public
  using (agent_id = (select public.rift_my_agent_id()))
  with check (agent_id = (select public.rift_my_agent_id()));
create policy rift_tour_steps_agent on public.rift_tour_steps
  for all to public
  using (agent_id = (select public.rift_my_agent_id()))
  with check (agent_id = (select public.rift_my_agent_id()));
create policy rift_tour_feedback_agent on public.rift_tour_feedback
  for all to public
  using (agent_id = (select public.rift_my_agent_id()))
  with check (agent_id = (select public.rift_my_agent_id()));

do $$
declare t text;
begin
  foreach t in array array['rift_tour_stops', 'rift_tour_steps', 'rift_tour_feedback'] loop
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on public.%I from anon', t);
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('revoke all on public.%I from authenticated', t);
      execute format('grant select on public.%I to authenticated', t);
    end if;
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format('grant select, insert, update, delete on public.%I to service_role', t);
    end if;
  end loop;
  -- Supabase grants EXECUTE on new functions to anon and authenticated
  -- directly (see 20260923050000). A trigger function needs no caller.
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke execute on function public.rift_tour_history_is_history() from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke execute on function public.rift_tour_history_is_history() from authenticated;
  end if;
end $$;

comment on table public.rift_tour_stops is
  'A request to see a home. Not an appointment: the appointment is in ShowingTime, and its steps are rift_tour_steps.';
comment on table public.rift_tour_steps is
  'Each step of a showing as the agent recorded it from ShowingTime, one row per step. The latest is current.';
comment on table public.rift_tour_feedback is
  'The short answer after a showing: would they consider an offer, and why. One row per answer.';

commit;
