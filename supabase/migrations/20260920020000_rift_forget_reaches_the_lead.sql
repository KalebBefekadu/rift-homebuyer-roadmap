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
