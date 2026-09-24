-- ============================================================================
-- Contract dates and scheduled-job runs (blueprint v4, W09; REQ-DATE-01 to
-- 03, REQ-QUALITY-04; AT26 to AT29).
--
--   rift_deadlines            a date that matters under one contract: its name,
--                             whether it is in the contract or the agent's
--                             own target, and the workstream it belongs to.
--   rift_deadline_revisions   each version of it: the date, the time only if
--                             the document states one, the zone, how it was
--                             reached (as written, or counted by a named rule
--                             from a trigger), where it comes from, whether the
--                             agent checked it against the document, and
--                             whether it is still active, met or removed. An
--                             amendment writes all its revisions in ONE
--                             statement with one amendment name, so they land
--                             together or not at all (AT27).
--   rift_job_runs             each run of a scheduled job and how it ended, so
--                             a failed or missing run is seen (AT29).
--
-- Reminders are not stored: they are read from the latest revision, so an
-- amendment cannot leave one behind for the old date.
--
-- The rules are lib/core/deadline.ts and lib/core/jobs.ts; the only writers are
-- lib/db/deadlines.ts and lib/db/jobs.ts.
-- ============================================================================

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table public.rift_deadlines (
  id              uuid primary key default gen_random_uuid(),
  agent_id        uuid not null references public.rift_agents(id) on delete restrict,
  journey_id      uuid not null,
  transaction_id  uuid not null,
  label           text not null check (length(btrim(label)) between 3 and 120),
  kind            text not null check (kind in ('contractual', 'target')),
  workstream      text check (workstream is null or workstream in
                    ('earnest-money', 'inspection', 'financing', 'appraisal', 'title', 'insurance', 'repairs', 'closing')),
  actor_label     text not null check (length(btrim(actor_label)) between 1 and 120),
  request_id      uuid not null unique,
  created_at      timestamptz not null default now(),

  constraint rift_deadlines_journey_same_agent
    foreign key (journey_id, agent_id) references public.rift_journeys (id, agent_id) on delete cascade,
  constraint rift_deadlines_transaction_on_journey
    foreign key (transaction_id, journey_id) references public.rift_transactions (id, journey_id) on delete cascade,
  constraint rift_deadlines_id_journey unique (id, journey_id)
);
create index rift_deadlines_transaction_idx on public.rift_deadlines (transaction_id);

create table public.rift_deadline_revisions (
  id                  uuid primary key default gen_random_uuid(),
  agent_id            uuid not null references public.rift_agents(id) on delete restrict,
  journey_id          uuid not null,
  deadline_id         uuid not null,
  seq                 integer not null check (seq >= 1),
  state               text not null check (state in ('active', 'met', 'removed')),
  due_date            date not null,
  -- Only when the document states a time. A date alone has no instant (AT26).
  due_time            time,
  timezone            text not null check (length(timezone) between 3 and 64),
  due_at              timestamptz,
  rule                text not null check (rule in ('as-written', 'calendar-days-v1', 'business-days-v1')),
  trigger_label       text check (trigger_label is null or length(btrim(trigger_label)) between 1 and 120),
  trigger_date        date,
  days                integer check (days is null or days between 1 and 365),
  source_term         text not null check (length(btrim(source_term)) between 3 and 200),
  source_page         text check (source_page is null or length(btrim(source_page)) between 1 and 40),
  source_document_id  uuid,
  -- Set on every revision an amendment writes: the amendment's name.
  amendment           text check (amendment is null or length(btrim(amendment)) between 3 and 200),
  verified            boolean not null,
  note                text check (note is null or length(btrim(note)) between 1 and 500),
  actor_label         text not null check (length(btrim(actor_label)) between 1 and 120),
  request_id          uuid not null unique,
  created_at          timestamptz not null default now(),

  constraint rift_deadline_revisions_journey_same_agent
    foreign key (journey_id, agent_id) references public.rift_journeys (id, agent_id) on delete cascade,
  constraint rift_deadline_revisions_deadline_on_journey
    foreign key (deadline_id, journey_id) references public.rift_deadlines (id, journey_id) on delete cascade,
  constraint rift_deadline_revisions_document_on_journey
    foreign key (source_document_id, journey_id) references public.rift_documents (id, journey_id) on delete set null (source_document_id),
  -- Two people revising the same date at once: one wins, the other reloads.
  constraint rift_deadline_revisions_seq unique (deadline_id, seq),
  -- A time and an instant come together or not at all: no midnight is invented.
  constraint rift_deadline_revisions_time_is_whole check ((due_time is null) = (due_at is null)),
  constraint rift_deadline_revisions_counted_has_trigger check (
    (rule = 'as-written') = (trigger_date is null and days is null and trigger_label is null)
  ),
  -- A met or removed date says how; a revision from an amendment was checked against it.
  constraint rift_deadline_revisions_closing_says_how check (state = 'active' or note is not null),
  constraint rift_deadline_revisions_amendment_checked check (amendment is null or verified)
);
create index rift_deadline_revisions_deadline_idx on public.rift_deadline_revisions (deadline_id, seq);

create table public.rift_job_runs (
  id           uuid primary key default gen_random_uuid(),
  job          text not null check (job in ('nurture-run', 'retention-sweep', 'rates-refresh')),
  ok           boolean not null default false,
  -- A short reason on failure, never a payload (no addresses, no names).
  detail       text check (detail is null or length(detail) <= 200),
  started_at   timestamptz not null default now(),
  finished_at  timestamptz
);
create index rift_job_runs_job_idx on public.rift_job_runs (job, started_at desc);

create or replace function public.rift_deadlines_are_history() returns trigger
language plpgsql as $$
begin
  raise exception '% is history and cannot be edited; record a new row', tg_table_name
    using errcode = 'check_violation';
end $$;

create trigger rift_deadlines_are_history before update on public.rift_deadlines
  for each row execute function public.rift_deadlines_are_history();
create trigger rift_deadline_revisions_are_history before update on public.rift_deadline_revisions
  for each row execute function public.rift_deadlines_are_history();

do $$
declare t text;
begin
  foreach t in array array['rift_deadlines', 'rift_deadline_revisions'] loop
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

  -- Job runs belong to the deployment, not to an agent: only the server reads
  -- or writes them. A run's row is updated once, when it finishes.
  alter table public.rift_job_runs enable row level security;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.rift_job_runs from anon;
    revoke execute on function public.rift_deadlines_are_history() from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on public.rift_job_runs from authenticated;
    revoke execute on function public.rift_deadlines_are_history() from authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert, update on public.rift_job_runs to service_role;
  end if;
end $$;

comment on table public.rift_deadlines is 'A date that matters under one contract. Its revisions are the history; the latest is current.';
comment on table public.rift_deadline_revisions is
  'Each version of a contract date: the date, a time only if stated, the zone, how it was reached, its source, and whether it was checked.';
comment on table public.rift_job_runs is 'Each run of a scheduled job and how it ended. A missing or failed run is shown to the agent.';

commit;
