-- ============================================================================
-- Align the question-type constraint with the domain.
--
-- The constraint allowed 'number' and 'money', which `FieldType` does not have,
-- and rejected 'select' and 'boolean', which it does. So publishing the
-- built-in funnel failed on its very first question — the county select — and
-- the failure was swallowed by a caller that did not check the error.
--
-- Two lessons, both already learned once in this schema and worth the comment
-- so they are not learned a third time: a constraint written from memory rather
-- than from the type it mirrors will drift, and an insert whose error nobody
-- reads is an insert that has not happened.
-- ============================================================================

alter table rift_questions drop constraint if exists rift_questions_type_check;

alter table rift_questions add constraint rift_questions_type_check
  check (type in ('choice', 'slider', 'select', 'text', 'boolean'));
