-- Only the server may run the search commands, as 20260923030000 intended.
--
-- That migration revoked EXECUTE from `public`, but Supabase also grants
-- EXECUTE on every new function in `public` to `anon` and `authenticated`
-- directly (default privileges), and a revoke from `public` does not touch a
-- direct grant. Checked on production after applying it: both roles could
-- execute both functions.
--
-- Nothing could come of it: the functions run with the caller's rights, and
-- neither role may update rift_journeys or insert into rift_search_packages,
-- so a call with the public key fails before it changes anything. The grant
-- should still say what the comment says.

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke execute on function public.rift_approve_search_package(uuid, uuid, uuid, text, jsonb, text, text, uuid) from anon;
    revoke execute on function public.rift_confirm_search_package(uuid, uuid, text, text, text, uuid) from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke execute on function public.rift_approve_search_package(uuid, uuid, uuid, text, jsonb, text, text, uuid) from authenticated;
    revoke execute on function public.rift_confirm_search_package(uuid, uuid, text, text, text, uuid) from authenticated;
  end if;
end $$;
