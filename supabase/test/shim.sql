-- Minimal stand-ins for what Supabase provides, so migrations can be validated
-- against a real Postgres before they touch a live project.
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key default gen_random_uuid());
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
