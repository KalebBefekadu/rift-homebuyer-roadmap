-- ============================================================================
-- A lead is never filed under a session every storage-less browser shares.
--
-- lib/rift/session.ts sends the constant "anon" when sessionStorage is
-- blocked ("ssr" if it ever runs on the server). Capture, save-my-plan and
-- the offer form stored that constant as the lead's session, and erasure
-- deletes by session: forget() and, through a saved plan's lead,
-- forgetByPlan() remove every lead, consent, event and attribution carrying
-- it. So one such visitor deleting their plan erased everybody else's.
--
-- The routes stopped storing placeholders (lib/db/guard.ts visitorSession)
-- and /api/forget refuses one. This clears the ones already stored, so no
-- existing lead can carry the shared id into an erasure. Only the two known
-- placeholders and the empty string: a real id of any other shape keeps its
-- handle. Nothing else about the lead changes; retention still removes it on
-- schedule, and a person can still be erased by their plan link or by hand.
-- ============================================================================

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

update public.rift_leads
   set session_id = null
 where session_id in ('anon', 'ssr', '');

commit;
