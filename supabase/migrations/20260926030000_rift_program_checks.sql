-- ============================================================================
-- Keeping the Georgia assistance records current (Blueprint v5 §6.5).
--
--   rift_program_checks   each reading of a program's official page: whether it
--                         was reachable, a fingerprint of what it said, and the
--                         readable text so a person can see what changed.
--   rift_program_reviews  a named person's answer to a flagged reading: the
--                         record is still right, or it needs updating.
--
-- Both are history: a reading or a review is never edited, only followed by a
-- newer one. The rules are lib/core/program-check.ts; the only writer is
-- lib/db/program-checks.ts. Neither belongs to an agent: official pages are
-- the same for everyone, so, like rift_job_runs, only the server reads or
-- writes them.
--
-- Also widens the job check on rift_job_runs for the new weekly job.
-- Additive: nothing already deployed reads or writes these tables.
-- ============================================================================

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table if not exists public.rift_program_checks (
  id           uuid primary key default gen_random_uuid(),
  source_url   text not null check (source_url like 'https://%'),
  checked_at   timestamptz not null default now(),
  outcome      text not null check (outcome in ('baseline', 'unchanged', 'changed', 'unreachable')),
  http_status  integer,
  -- A hash of the readable text, or of the bytes for a PDF. Null when nothing
  -- was read.
  fingerprint  text check (fingerprint is null or length(fingerprint) = 64),
  body         text check (body is null or length(body) <= 60000),
  -- A short reason when the page could not be read, never a payload.
  detail       text check (detail is null or length(detail) <= 200),
  constraint rift_program_checks_read_or_not check (
    (outcome = 'unreachable') = (fingerprint is null)
  )
);
create index if not exists rift_program_checks_source_idx on public.rift_program_checks (source_url, checked_at desc);

create table if not exists public.rift_program_reviews (
  id           uuid primary key default gen_random_uuid(),
  -- One answer per flagged reading. A second opinion is a later reading.
  check_id     uuid not null unique references public.rift_program_checks (id) on delete restrict,
  outcome      text not null check (outcome in ('still-right', 'needs-update')),
  -- Nothing is confirmed without a named party (handoff §4.13).
  reviewed_by  text not null check (length(btrim(reviewed_by)) > 0 and length(reviewed_by) <= 120),
  note         text check (note is null or length(note) <= 500),
  reviewed_at  timestamptz not null default now()
);

create or replace function public.rift_program_history() returns trigger
language plpgsql as $$
begin
  raise exception '% is history and cannot be edited; record a new row', tg_table_name
    using errcode = 'check_violation';
end $$;

drop trigger if exists rift_program_checks_are_history on public.rift_program_checks;
create trigger rift_program_checks_are_history before update or delete on public.rift_program_checks
  for each row execute function public.rift_program_history();
drop trigger if exists rift_program_reviews_are_history on public.rift_program_reviews;
create trigger rift_program_reviews_are_history before update or delete on public.rift_program_reviews
  for each row execute function public.rift_program_history();

do $$
declare t text;
begin
  foreach t in array array['rift_program_checks', 'rift_program_reviews'] loop
    execute format('alter table public.%I enable row level security', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on public.%I from anon', t);
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('revoke all on public.%I from authenticated', t);
    end if;
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format('grant select, insert on public.%I to service_role', t);
    end if;
  end loop;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke execute on function public.rift_program_history() from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke execute on function public.rift_program_history() from authenticated;
  end if;
end $$;

alter table public.rift_job_runs drop constraint if exists rift_job_runs_job_check;
alter table public.rift_job_runs add constraint rift_job_runs_job_check
  check (job in ('nurture-run', 'retention-sweep', 'rates-refresh', 'daily-summary', 'program-check'));

comment on table public.rift_program_checks is 'Each reading of an assistance program''s official page. Changed or unreachable readings are flagged for review.';
comment on table public.rift_program_reviews is 'A named person''s answer to a flagged reading: still right, or needs updating.';

commit;
