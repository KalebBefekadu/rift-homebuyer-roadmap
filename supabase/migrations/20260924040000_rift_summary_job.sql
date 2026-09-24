-- ============================================================================
-- The morning summary is a scheduled job (blueprint v4 W12; decision D07), so
-- its runs are recorded like the others. Widens the job check on
-- rift_job_runs; nothing else changes. Additive: older code never writes the
-- new value.
-- ============================================================================

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.rift_job_runs drop constraint if exists rift_job_runs_job_check;
alter table public.rift_job_runs add constraint rift_job_runs_job_check
  check (job in ('nurture-run', 'retention-sweep', 'rates-refresh', 'daily-summary'));

commit;
