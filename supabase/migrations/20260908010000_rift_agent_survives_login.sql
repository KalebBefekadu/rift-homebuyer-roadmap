-- ============================================================================
-- Deleting a login must not delete the business.
--
-- `rift_agents.auth_user_id` cascaded from `auth.users`. Every other table
-- cascades from `rift_agents`. So removing one row in Supabase's Authentication
-- panel — a routine admin action, and an easy misclick — would have deleted
-- every assessment, lead, consent record, readout, figure, enrolment and event
-- in the product.
--
-- Consent records are the part that makes this unrecoverable rather than merely
-- catastrophic: they are the evidence that contacting those people was lawful,
-- and they cannot be reconstructed from a backup of anything else.
--
-- A login is a way in. The book of business is not attached to it.
--
-- SET NULL leaves the agent row unlinked, which the sign-in path already treats
-- correctly — `currentAgent()` returns null for a user with no agent row, and
-- the bootstrap re-links with --auth-user-id.
-- ============================================================================

alter table rift_agents drop constraint if exists rift_agents_auth_user_id_fkey;

alter table rift_agents
  add constraint rift_agents_auth_user_id_fkey
  foreign key (auth_user_id) references auth.users(id) on delete set null;

comment on column rift_agents.auth_user_id is
  'The login. Null if that login was deleted — the agent and everything belonging to them survives. Re-link with scripts/bootstrap-rift.mjs --auth-user-id.';
