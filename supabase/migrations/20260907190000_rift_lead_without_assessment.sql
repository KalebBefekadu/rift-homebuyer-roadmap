-- ============================================================================
-- A lead can exist without an assessment.
--
-- `rift_leads.assessment_id` was NOT NULL, which assumed every lead comes from
-- a completed assessment. Two real paths do not:
--
--   * somebody who asks for their readout by email from a page reached by a
--     share link, having never taken the assessment themselves;
--   * somebody who books a call from the landing page.
--
-- The capture failed outright rather than storing the lead without the link —
-- so the most valuable moment in the funnel, a stranger volunteering their
-- address, lost the lead entirely.
-- ============================================================================

alter table rift_leads alter column assessment_id drop not null;
