-- ============================================================================
-- A lead is not a side effect of its assessment.
--
-- `rift_leads.assessment_id` cascaded on delete, so the retention sweep — whose
-- stated job is deleting an assessment nobody came back to — silently took the
-- LEAD with it: the person's contact details, their score, their enrolment,
-- every touch already sent, and the link to their consent record.
--
-- Nobody chose that. It was a foreign key default doing something the retention
-- policy never described, and it would have removed relationships the agent was
-- still working.
--
-- The column is already nullable — a lead can exist without an assessment,
-- because somebody opening a shared readout never took one. So SET NULL is both
-- available and correct: the assessment goes on schedule, the person remains,
-- and deleting a person becomes a deliberate act rather than a consequence.
-- ============================================================================

alter table rift_leads drop constraint if exists rift_leads_assessment_id_fkey;

alter table rift_leads
  add constraint rift_leads_assessment_id_fkey
  foreign key (assessment_id) references rift_assessments(id) on delete set null;

comment on column rift_leads.assessment_id is
  'Null when the assessment has been deleted by retention, or when the lead never had one. Deleting a lead is deliberate — see lib/db/retention.ts.';
