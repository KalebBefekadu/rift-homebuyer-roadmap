-- ============================================================================
-- AI may draft a campaign recipe (Blueprint v5 §5.10, CAMP-01).
--
--   rift_ai_usage.workflow  gains 'campaign-draft', so a draft is counted
--                           against the same $50 monthly limit as every
--                           other AI call (§10.2, D16). No new table, so no
--                           new policy; the table's RLS is unchanged.
--
-- Additive: older code never writes the new value.
-- ============================================================================

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.rift_ai_usage drop constraint if exists rift_ai_usage_workflow_check;
alter table public.rift_ai_usage add constraint rift_ai_usage_workflow_check
  check (workflow in ('offer-extraction', 'program-compare', 'campaign-draft'));

commit;
