-- ============================================================================
-- Journey progress (blueprint v4, W07; REQ-STATE-01 to 06, REQ-UX-02 to 04).
--
-- Where a journey is and what is under way, kept as history:
--
--   rift_journey_events        each stage or status change, with its reason,
--                              evidence and who recorded it. The latest of
--                              each kind is current; nothing caches it.
--   rift_transactions          a contract attempt on one home. Recording one
--                              moves the journey to Under contract.
--   rift_transaction_outcomes  how an attempt ended, once: closed or
--                              terminated. The attempt and its record stay.
--   rift_workstream_updates    each update to one of the eight things that
--                              run at once under contract (earnest money,
--                              inspection, financing, appraisal, title,
--                              insurance, repairs, closing).
--
-- The rules are lib/core/progress.ts; lib/db/progress.ts is the only writer.
-- A client's "done" is stored as 'reported', never 'confirmed': confirming
-- needs a named source and the day they said it, and only the agent records
-- that (the checks below hold the line even against a bug in the writer).
--
-- Retention: these cascade when a journey is erased, like everything else on
-- it. Whether the broker must hold transaction records longer (F16) is open;
-- when it is answered, a hold goes here before W08.
-- ============================================================================

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table public.rift_transactions (
  id           uuid primary key default gen_random_uuid(),
  agent_id     uuid not null references public.rift_agents(id) on delete restrict,
  journey_id   uuid not null,
  home_id      uuid not null,
  financing    text not null check (financing in ('financed', 'cash')),
  -- What shows it is binding, in the agent's words. Not the document itself.
  evidence     text not null check (length(btrim(evidence)) between 3 and 300),
  actor_label  text not null check (length(btrim(actor_label)) between 1 and 120),
  request_id   uuid not null unique,
  created_at   timestamptz not null default now(),

  constraint rift_transactions_journey_same_agent
    foreign key (journey_id, agent_id) references public.rift_journeys (id, agent_id) on delete cascade,
  constraint rift_transactions_home_on_journey
    foreign key (home_id, journey_id) references public.rift_shortlist_homes (id, journey_id) on delete cascade,
  constraint rift_transactions_id_journey unique (id, journey_id)
);
create index rift_transactions_journey_idx on public.rift_transactions (journey_id, created_at desc);

create table public.rift_transaction_outcomes (
  id              uuid primary key default gen_random_uuid(),
  agent_id        uuid not null references public.rift_agents(id) on delete restrict,
  journey_id      uuid not null,
  -- One ending per attempt. A second is a unique violation, not an overwrite.
  transaction_id  uuid not null unique,
  outcome         text not null check (outcome in ('closed', 'terminated')),
  reason          text not null check (length(btrim(reason)) between 3 and 500),
  actor_label     text not null check (length(btrim(actor_label)) between 1 and 120),
  created_at      timestamptz not null default now(),

  constraint rift_transaction_outcomes_journey_same_agent
    foreign key (journey_id, agent_id) references public.rift_journeys (id, agent_id) on delete cascade,
  constraint rift_transaction_outcomes_on_journey
    foreign key (transaction_id, journey_id) references public.rift_transactions (id, journey_id) on delete cascade
);

create table public.rift_journey_events (
  id              uuid primary key default gen_random_uuid(),
  agent_id        uuid not null references public.rift_agents(id) on delete restrict,
  journey_id      uuid not null,
  -- One sequence per journey across both kinds: the version a writer expects.
  seq             integer not null check (seq >= 1),
  kind            text not null check (kind in ('stage', 'status')),
  from_value      text not null,
  to_value        text not null,
  reason          text not null check (length(btrim(reason)) between 3 and 500),
  evidence        text check (evidence is null or length(btrim(evidence)) between 1 and 300),
  -- Set when the change came from recording or ending a contract.
  transaction_id  uuid,
  actor_label     text not null check (length(btrim(actor_label)) between 1 and 120),
  request_id      uuid not null unique,
  created_at      timestamptz not null default now(),

  constraint rift_journey_events_journey_same_agent
    foreign key (journey_id, agent_id) references public.rift_journeys (id, agent_id) on delete cascade,
  constraint rift_journey_events_transaction_on_journey
    foreign key (transaction_id, journey_id) references public.rift_transactions (id, journey_id) on delete cascade,
  -- Two people changing the stage at once: one wins, the other is told to reload.
  constraint rift_journey_events_seq unique (journey_id, seq),
  constraint rift_journey_events_values check (
    (kind = 'stage'
      and from_value in ('prepare', 'search', 'tour', 'offer', 'under-contract', 'close', 'own')
      and to_value in ('prepare', 'search', 'tour', 'offer', 'under-contract', 'close', 'own'))
    or (kind = 'status'
      and from_value in ('active', 'paused', 'completed', 'cancelled')
      and to_value in ('active', 'paused', 'completed', 'cancelled'))
  ),
  constraint rift_journey_events_moves check (from_value <> to_value),
  -- Under contract and Own are reached only through a contract record.
  constraint rift_journey_events_contract_stages check (
    kind <> 'stage' or to_value not in ('under-contract', 'own') or transaction_id is not null
  )
);
create index rift_journey_events_journey_idx on public.rift_journey_events (journey_id, seq);

create table public.rift_workstream_updates (
  id              uuid primary key default gen_random_uuid(),
  agent_id        uuid not null references public.rift_agents(id) on delete restrict,
  journey_id      uuid not null,
  transaction_id  uuid not null,
  workstream      text not null check (workstream in
                    ('earnest-money', 'inspection', 'financing', 'appraisal', 'title', 'insurance', 'repairs', 'closing')),
  seq             integer not null check (seq >= 1),
  state           text not null check (state in
                    ('not-started', 'in-progress', 'waiting', 'blocked', 'reported', 'confirmed', 'not-applicable')),
  owner           text not null check (owner in ('client', 'agent', 'other')),
  owner_name      text check (owner_name is null or length(btrim(owner_name)) between 1 and 160),
  -- Who the status came from, and the day they said it.
  source          text check (source is null or length(btrim(source)) between 1 and 160),
  confirmed_on    date,
  note            text check (note is null or length(btrim(note)) between 1 and 500),
  actor_kind      text not null check (actor_kind in ('agent', 'client')),
  member_id       uuid,
  actor_label     text not null check (length(btrim(actor_label)) between 1 and 120),
  request_id      uuid not null unique,
  created_at      timestamptz not null default now(),

  constraint rift_workstream_updates_journey_same_agent
    foreign key (journey_id, agent_id) references public.rift_journeys (id, agent_id) on delete cascade,
  constraint rift_workstream_updates_transaction_on_journey
    foreign key (transaction_id, journey_id) references public.rift_transactions (id, journey_id) on delete cascade,
  constraint rift_workstream_updates_member_on_journey
    foreign key (member_id, journey_id) references public.rift_journey_members (id, journey_id) on delete cascade,
  constraint rift_workstream_updates_seq unique (transaction_id, workstream, seq),
  constraint rift_workstream_updates_other_is_named check (owner <> 'other' or owner_name is not null),
  constraint rift_workstream_updates_confirmed_has_source
    check (state <> 'confirmed' or (source is not null and confirmed_on is not null)),
  constraint rift_workstream_updates_blocked_says_why check (state not in ('blocked', 'not-applicable') or note is not null),
  -- A client reports; they never confirm (REQ-UX-02).
  constraint rift_workstream_updates_client_reports
    check ((actor_kind = 'client') = (member_id is not null) and (actor_kind <> 'client' or state = 'reported'))
);
create index rift_workstream_updates_transaction_idx on public.rift_workstream_updates (transaction_id, workstream, seq);

-- History is never edited. UPDATE only: a delete must still cascade when a
-- journey is erased (handoff 9b).
create or replace function public.rift_progress_is_history() returns trigger
language plpgsql as $$
begin
  raise exception '% is history and cannot be edited; record a new row', tg_table_name
    using errcode = 'check_violation';
end $$;

create trigger rift_transactions_are_history before update on public.rift_transactions
  for each row execute function public.rift_progress_is_history();
create trigger rift_transaction_outcomes_are_history before update on public.rift_transaction_outcomes
  for each row execute function public.rift_progress_is_history();
create trigger rift_journey_events_are_history before update on public.rift_journey_events
  for each row execute function public.rift_progress_is_history();
create trigger rift_workstream_updates_are_history before update on public.rift_workstream_updates
  for each row execute function public.rift_progress_is_history();

do $$
declare t text;
begin
  foreach t in array array['rift_transactions', 'rift_transaction_outcomes', 'rift_journey_events', 'rift_workstream_updates'] loop
    execute format('alter table public.%I enable row level security', t);
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
      execute format('grant select, insert, update, delete on public.%I to service_role', t);
    end if;
  end loop;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke execute on function public.rift_progress_is_history() from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke execute on function public.rift_progress_is_history() from authenticated;
  end if;
end $$;

comment on table public.rift_journey_events is
  'Each stage or status change of a journey, with reason, evidence and who recorded it. The latest of each kind is current.';
comment on table public.rift_transactions is
  'A contract attempt on one home. Its ending is in rift_transaction_outcomes; the attempt stays either way.';
comment on table public.rift_transaction_outcomes is
  'How a contract attempt ended, once: closed or terminated, and why.';
comment on table public.rift_workstream_updates is
  'Each update to one under-contract workstream, one row per update. A client can only report; confirming needs a named source and date.';

commit;
