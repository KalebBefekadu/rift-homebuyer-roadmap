-- Blueprint v5 §5.1: the lead side is now separate values (small tools), and
-- completion is measured per value without recording answers. One key is
-- added to the telemetry allowlist: `tool`, the id of the value (for example
-- "cash" or "assistance"). It names which tool, never what was answered. Not
-- `value`: that key is the one an answer would travel under, and the schema
-- test proves it is refused.
--
-- The application list is ALLOWED_META in lib/core/telemetry.ts; the two are
-- held equal by lib/core/telemetry.test.ts.

alter table rift_events drop constraint if exists events_carry_no_answer;

alter table rift_events add constraint events_carry_no_answer check (
  payload - array[
    'page','qid','step','of','from','via',
    'answered','matched','source','band','prefilled','live',
    'hasTopic','delivered','consent','slot','tool'
  ] = '{}'::jsonb
);
