-- ============================================================================
-- Rift — everything the production database is still owed, in one paste.
--
-- Run this in the Supabase SQL editor (Project → SQL Editor → New query).
-- It is idempotent: running it twice is safe and does nothing the second time.
--
-- Three migrations, oldest first. Each is also a file under
-- supabase/migrations/ — this is the same SQL, concatenated so it can be
-- applied without a connection string.
--
--   1. 20260910000000  rift_next_action     — follow-up reminders. Until this
--      runs, Studio shows "Nothing scheduled" instead of the agent's own
--      reminders. It does not error; it is simply never able to store one.
--
--   2. 20260920000000  attribution_sweep_index — the index the retention sweep
--      has always needed. Harmless now, load-bearing on the first day the
--      24-month analytics window fires against real traffic.
--
--   3. 20260920010000  events_allowlist     — turns the telemetry CHECK
--      constraint from a blocklist into an allowlist, and deletes the payload
--      keys the blocklist let through. The application-side fix already
--      shipped, so nothing new is being collected either way; this removes
--      what was collected and makes the database the backstop it was
--      documented as being.
--
--   4. 20260920020000  forget_reaches_the_lead — gives rift_leads and
--      rift_consents their own session_id. Until this runs, "delete all of
--      it" cannot reach a lead captured without an assessment (the abroad
--      readout, or /book from a landing page), and the code that now tries
--      to will find nothing and report success. THIS IS THE ONE TO RUN
--      FIRST if you only run one.
-- ============================================================================



-- ─── 20260910000000_rift_next_action.sql ───────────────────────────────────

-- ============================================================================
-- The next thing you owe them, and when.
--
-- The board says who has gone quiet. It cannot say what you decided to do about
-- it, so the decision lives in the agent's head between sessions — which is
-- exactly where it gets lost. "Call Marcus Thursday" is the smallest unit of
-- account management and there was nowhere to put it.
--
-- One open action per person, deliberately. A queue of six things owed to the
-- same client is a queue nobody works; the next call is the only one that
-- matters and the rest are notes. Completing an action writes to the history,
-- so what was owed and when it was done stays auditable.
-- ============================================================================

alter table rift_leads add column if not exists next_action text;
alter table rift_leads add column if not exists next_due date;

-- An action with no date is a wish, and a date with no action is an alarm
-- nobody can act on. They travel together or not at all.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'rift_leads_next_action_dated') then
    alter table rift_leads add constraint rift_leads_next_action_dated
      check ((next_action is null) = (next_due is null));
  end if;
end $$;

-- Ordered by what is owed soonest, and only for people still being worked.
create index if not exists rift_leads_due_idx
  on rift_leads (agent_id, next_due)
  where next_due is not null and archived_at is null;

comment on column rift_leads.next_action is
  'The one thing owed to this person next. Cleared when done; the completion is written to rift_lead_notes.';

-- ─── 20260920000000_rift_attribution_sweep_index.sql ───────────────────────────────────

-- The index the retention sweep has always needed and never had.
--
-- `rift_attributions` is keyed on session_id, which serves every read in the
-- product except one: the sweep deletes by (agent_id, first_at), and the
-- health check asks the same question to find out whether the sweep is still
-- running. Both are sequential scans today.
--
-- It does not hurt yet, because the analytics window is twenty-four months and
-- the table is small. It starts hurting on the first day that window fires
-- against a table with real traffic in it, which is exactly the day nobody
-- will be watching the retention job — and a deletion job that times out is a
-- deletion job that silently stops keeping the promise printed at the bottom
-- of every readout.
--
-- No RLS change: the policy on this table is unchanged and still the one from
-- 20260907000000_rift_core.sql. An index is not a grant.
create index if not exists rift_attributions_sweep_idx
  on rift_attributions (agent_id, first_at);

-- ─── 20260920010000_rift_events_allowlist.sql ───────────────────────────────────

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



-- ─── 20260920020000_rift_forget_reaches_the_lead.sql ───────────────────────

-- ============================================================================
-- "Delete all of it" did not reach the person.
--
-- `forget()` deletes the assessment, the events and the attribution for a
-- session, and its own docblock says it "is the same deletion the sweep
-- performs, triggered by the person rather than by time". That was true when
-- it was written: rift_leads.assessment_id cascaded, so deleting the
-- assessment took the lead with it.
--
-- 20260908000000 changed that cascade to SET NULL, for a good and carefully
-- argued reason — the retention sweep was destroying relationships the agent
-- was still working, as a side effect of a foreign key default. That fix is
-- right and stays. What nobody noticed is that `forget()` shares the
-- mechanism: from that migration onwards, a person clicking "Delete all of
-- it" had their assessment removed and their NAME, EMAIL, PHONE and CONSENT
-- RECORD left behind, while the page told them "Nothing about this visit is
-- left on this device or on our side."
--
-- The sweep was updated to delete leads explicitly. `forget()` was not.
--
-- Two problems here, and this file is the half that needs the database:
--
--   1. A lead captured with no assessment — from the abroad readout, or from
--      /book on a landing page — has no link to a session at all, so nothing
--      could find it even after the code is fixed. rift_leads gets its own
--      session_id.
--
--   2. Same for the consent record, which hangs off the assessment and is
--      SET NULL for the same reason.
--
-- Nullable, because every lead already in the table predates this and there
-- is no honest value to backfill. A null session_id means "captured before
-- this existed, or captured by something that had no session" — and the one
-- thing that must never happen is inventing a session id that would make an
-- unrelated person's delete request destroy this row.
-- ============================================================================

alter table rift_leads     add column if not exists session_id text;
alter table rift_consents  add column if not exists session_id text;

create index if not exists rift_leads_session_idx
  on rift_leads (session_id) where session_id is not null;

create index if not exists rift_consents_session_idx
  on rift_consents (session_id) where session_id is not null;

comment on column rift_leads.session_id is
  'The browser session that produced this lead. Nullable for rows captured before 20260920020000. Used by lib/db/retention.ts forget() so that erasure reaches a lead with no assessment behind it.';

comment on column rift_consents.session_id is
  'As rift_leads.session_id. A consent record is evidence that contact was lawful; when the person it is about is erased, there is nobody left for it to be evidence about, so it goes with them.';
