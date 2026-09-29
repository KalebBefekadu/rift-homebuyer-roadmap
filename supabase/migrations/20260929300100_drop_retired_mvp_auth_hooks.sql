-- ============================================================================
-- The retired portal MVP's two auth hooks go.
--
--   on_auth_user_created / handle_new_user()  gave every new login whose
--     self-chosen metadata said role "admin" a row in agents_settings. The
--     metadata is whatever the person signing up sends, and invitations need
--     sign-ups switched on, so anybody could mint one.
--   claim_my_client_records()  let any login attach unlinked rows of the
--     MVP's `clients` table to itself by email.
--
-- Rift reads neither table and calls neither function (app/auth/callback
-- stopped calling the RPC; lib/auth, which decided roles from that metadata,
-- was removed the same day). The MVP's tables and rows stay untouched: this
-- drops code, not data.
-- ============================================================================

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
drop function if exists public.claim_my_client_records();

commit;
