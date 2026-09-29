-- ============================================================================
-- Nobody makes themselves the agent.
--
-- `rift_agents_self` was `for all using (auth_user_id = auth.uid()) with check
-- (auth_user_id = auth.uid())`, and rift_agents never had its default Supabase
-- grants revoked. So any login could insert the row that says "this login is
-- an agent", straight through PostgREST with the public anon key and its own
-- JWT. Logins are not scarce here: invitations need sign-ups switched on, so
-- the Auth API will mint one for anybody with an email address.
--
-- What that row buys is the whole product. lib/db/session.ts turns any row in
-- this table into a Studio session; every other policy trusts
-- rift_my_agent_id(), which reads this table; and lib/db/service.ts refuses
-- to pick an agent once there are two rows, which by itself stops every
-- public capture from being stored.
--
-- The agent row is written by scripts/bootstrap-rift.mjs with the service
-- role and by nothing else, so the policy becomes read-only and the write
-- grants go. The agent can still read their own row through a session;
-- nothing in the application needs even that, but it costs nothing and keeps
-- the policy honest about what a session may see.
-- ============================================================================

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

drop policy if exists rift_agents_self on public.rift_agents;
create policy rift_agents_self on public.rift_agents
  for select using (auth_user_id = auth.uid());

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.rift_agents from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on public.rift_agents from authenticated;
    grant select on public.rift_agents to authenticated;
  end if;
end $$;

commit;
