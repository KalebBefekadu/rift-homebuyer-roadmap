-- ============================================================================
-- Rift — clear the test data before launch.
--
-- Paste into the Supabase SQL editor (Project → SQL Editor → New query).
--
-- Everything below is test traffic from 8 and 18 September plus one probe of
-- mine: one fake lead ("jihad@test.com"), ten assessments that never recorded
-- a county, and fourteen attribution rows that are wrong by construction —
-- they were written by the bug that recorded rift as the referrer for every
-- visitor, so none of them says anything true about where anybody came from.
--
-- KEPT deliberately: the agent row, the programme registry, the published
-- funnel and its questions, and the mortgage rate recorded on 20 September.
-- ============================================================================

delete from rift_touches;
delete from rift_enrolments;
delete from rift_lead_notes;
delete from rift_review_items;
delete from rift_figures;
delete from rift_leads;
delete from rift_consents;
delete from rift_readouts;
delete from rift_answers;
delete from rift_assessments;
delete from rift_events;
delete from rift_attributions;

-- What should be left.
select 'agents' t, count(*) n from rift_agents
union all select 'programs',  count(*) from rift_programs
union all select 'funnels',   count(*) from rift_funnels
union all select 'questions', count(*) from rift_questions
union all select 'rates',     count(*) from rift_rate_snapshots
union all select 'leads',     count(*) from rift_leads
union all select 'events',    count(*) from rift_events;
