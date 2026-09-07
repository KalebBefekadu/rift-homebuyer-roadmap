-- Grants PostgREST needs to serve the Rift schema locally.
--
-- Re-applied after every schema reset, because `drop schema public cascade`
-- takes the grants with it — which surfaces as "permission denied for schema
-- public" a long way from its cause.
--
-- Local verification only. Production access is RLS plus the service role;
-- nothing here is a model for how the real project is configured.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    create role authenticator noinherit login password 'pw';
  end if;
end $$;

grant anon to authenticator;
grant usage on schema public to anon;
grant all on all tables in schema public to anon;
grant all on all sequences in schema public to anon;
alter default privileges in schema public grant all on tables to anon;

-- RLS is enabled on every Rift table and `anon` here stands in for the service
-- role, which bypasses it. Disabling RLS for the local harness keeps this test
-- about QUERY SYNTAX — the thing TypeScript cannot check — rather than about
-- policies, which lib/db/schema.test.ts covers directly.
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' and tablename like 'rift_%' loop
    execute format('alter table %I disable row level security', t);
  end loop;
end $$;
