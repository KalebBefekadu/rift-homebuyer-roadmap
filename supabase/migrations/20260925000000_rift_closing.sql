-- ============================================================================
-- Closing and possession (blueprint v4 W11; journey contracts B17, B18; AT34).
--
-- Two more workstreams on a contract:
--
--   walkthrough   the final walkthrough, so what was found before closing has
--                 a place and an unresolved finding shows as a blocker.
--   possession    keys and occupancy, apart from the closing: they are
--                 different events, and a seller may stay on after closing.
--                 It is the one workstream that can still be updated once the
--                 contract has closed (lib/core/progress.ts AFTER_CLOSING).
--
-- Widens the two workstream checks; nothing else changes. Additive: older
-- code never writes the new values.
-- ============================================================================

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.rift_workstream_updates drop constraint if exists rift_workstream_updates_workstream_check;
alter table public.rift_workstream_updates add constraint rift_workstream_updates_workstream_check
  check (workstream in ('earnest-money', 'inspection', 'financing', 'appraisal', 'title', 'insurance', 'repairs',
                        'walkthrough', 'closing', 'possession'));

alter table public.rift_deadlines drop constraint if exists rift_deadlines_workstream_check;
alter table public.rift_deadlines add constraint rift_deadlines_workstream_check
  check (workstream is null or workstream in ('earnest-money', 'inspection', 'financing', 'appraisal', 'title', 'insurance',
                                              'repairs', 'walkthrough', 'closing', 'possession'));

commit;
