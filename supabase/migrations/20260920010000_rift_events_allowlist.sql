-- Telemetry: an allowlist in the database, and a clean-up of what the
-- blocklist let through.
--
-- `events_carry_no_answer` rejected three literal key names — value, answer,
-- input — and was described in the code as the only real guarantee behind the
-- rule that telemetry stores question ids and timings, never answer values.
-- It was a blocklist, and a blocklist fails open.
--
-- What went through it: the buyers-abroad landing page sent the visitor's
-- residency situation (citizen / resident / ITIN / no U.S. status) under the
-- key `status`, on every page view. Residency status is about as close a
-- proxy for national origin as this product could collect, national origin is
-- a protected class under the Fair Housing Act, and rift_events is keyed on a
-- session that joins to a lead. The page was designed to target a situation
-- rather than an ethnicity and then logged the situation.
--
-- Two things here, in this order, because the second cannot be added while the
-- first is still true of existing rows.

-- 1. Remove what should never have been collected.
--
--    Rewrites every payload to contain only allowed keys. This is deletion,
--    not masking: the values are gone from the row rather than hidden behind
--    a flag, which is the same standard the retention job is held to.
update rift_events e
   set payload = coalesce(
         (select jsonb_object_agg(k, v)
            from jsonb_each(e.payload) as t(k, v)
           where k = any (array[
             'page','qid','step','of','from','via',
             'answered','matched','source','band','prefilled','live',
             'hasTopic','delivered','consent','slot'
           ])),
         '{}'::jsonb)
 where exists (
       select 1
         from jsonb_object_keys(e.payload) as k
        where k <> all (array[
          'page','qid','step','of','from','via',
          'answered','matched','source','band','prefilled','live',
          'hasTopic','delivered','consent','slot'
        ])
 );

-- 2. Make it impossible to write again.
--
--    `payload - array[...]` removes every allowed key; if anything is left,
--    the row carried a key nobody approved and it is rejected. Adding a key
--    to telemetry now requires a migration, which is precisely the moment
--    somebody should have to decide whether it is an answer.
--
--    The list is kept identical to ALLOWED_META in lib/core/telemetry.ts, and
--    lib/core/telemetry.test.ts fails when the two drift apart.
alter table rift_events drop constraint if exists events_carry_no_answer;

alter table rift_events add constraint events_carry_no_answer check (
  payload - array[
    'page','qid','step','of','from','via',
    'answered','matched','source','band','prefilled','live',
    'hasTopic','delivered','consent','slot'
  ] = '{}'::jsonb
);

-- No RLS change. The policy on rift_events is unchanged and still the one from
-- 20260907000000_rift_core.sql; a constraint is not a grant.
