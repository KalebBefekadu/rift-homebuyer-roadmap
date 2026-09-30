-- ============================================================================
-- The agent's own details, changeable, with a record of every change.
--
--   rift_agent_profile_changes   one row per field changed: what it was, what
--                                it became, who changed it. Append-only.
--   rift_update_agent_profile()  the one writer. Updates rift_agents and
--                                records the change in the same transaction.
--
-- rift_agents has had name, brokerage, license, email and phone since the
-- first migration, written once by scripts/bootstrap-rift.mjs and never again.
-- Since 20260929100000 a session can only read that table, which is right:
-- "which login is the agent" must not be self-service. It also left "what is
-- the agent's phone number" with no door but the Supabase table editor.
--
-- So the door is a function the server calls with the service role, after
-- the settings page's action has checked the session. It changes only these
-- five columns; id and auth_user_id, the columns that make a login the agent,
-- are not reachable through it.
--
-- History, because email is where every new-lead alert goes. A mistyped
-- address fails silently, and the first question afterwards is "what was it
-- before, and when did it change". The update and its record commit together
-- or not at all: a change with no record, or a record of a change that did
-- not happen, would both make the history wrong.
-- ============================================================================

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table if not exists public.rift_agent_profile_changes (
  id          uuid primary key default gen_random_uuid(),
  agent_id    uuid not null references public.rift_agents (id) on delete cascade,
  field       text not null check (field in ('name', 'email', 'phone', 'license', 'brokerage')),
  -- Null is "not recorded": a cleared phone number is a change to nothing.
  before      text check (before is null or length(before) <= 200),
  after       text check (after is null or length(after) <= 200),
  by_name     text not null check (length(btrim(by_name)) between 1 and 120),
  created_at  timestamptz not null default now(),
  constraint rift_agent_profile_changes_is_a_change check (before is distinct from after)
);
create index if not exists rift_agent_profile_changes_idx
  on public.rift_agent_profile_changes (agent_id, created_at desc);

create or replace function public.rift_agent_profile_changes_history() returns trigger
language plpgsql as $$
begin
  raise exception 'rift_agent_profile_changes is history and cannot be edited; record a new change'
    using errcode = 'check_violation';
end $$;

drop trigger if exists rift_agent_profile_changes_are_history on public.rift_agent_profile_changes;
create trigger rift_agent_profile_changes_are_history before update on public.rift_agent_profile_changes
  for each row execute function public.rift_agent_profile_changes_history();

-- Keys present in p_changes are the fields to change; a JSON null clears one.
-- Returns how many fields actually changed, so an untouched form records
-- nothing. The application validates first (lib/core/profile.ts); the checks
-- here are the floor for any other caller.
create or replace function public.rift_update_agent_profile(
  p_agent uuid, p_changes jsonb, p_by text
) returns integer
language plpgsql as $$
declare
  k text;
  v text;
  old text;
  n integer := 0;
begin
  if p_changes is null or jsonb_typeof(p_changes) <> 'object' then
    raise exception 'changes must be an object of field to value' using errcode = 'invalid_parameter_value';
  end if;

  perform 1 from public.rift_agents where id = p_agent for update;
  if not found then
    raise exception 'no such agent' using errcode = 'no_data_found';
  end if;

  for k in select jsonb_object_keys(p_changes) loop
    if k not in ('name', 'email', 'phone', 'license', 'brokerage') then
      raise exception '% is not a profile field', k using errcode = 'check_violation';
    end if;
    v := nullif(btrim(p_changes ->> k), '');
    if k in ('name', 'email') and v is null then
      raise exception '% cannot be empty', k using errcode = 'check_violation';
    end if;
    if k = 'email' and v !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
      raise exception 'that is not an email address' using errcode = 'check_violation';
    end if;
    if v is not null and length(v) > 200 then
      raise exception '% is too long', k using errcode = 'check_violation';
    end if;

    -- The column name comes from the fixed list above, never from the caller.
    execute format('select %I from public.rift_agents where id = $1', k) into old using p_agent;
    if old is not distinct from v then
      continue;
    end if;
    execute format('update public.rift_agents set %I = $1 where id = $2', k) using v, p_agent;
    insert into public.rift_agent_profile_changes (agent_id, field, before, after, by_name)
      values (p_agent, k, old, v, left(btrim(coalesce(p_by, '')), 120));
    n := n + 1;
  end loop;

  return n;
end $$;

alter table public.rift_agent_profile_changes enable row level security;
drop policy if exists rift_agent_profile_changes_agent on public.rift_agent_profile_changes;
create policy rift_agent_profile_changes_agent on public.rift_agent_profile_changes
  for select using (agent_id = (select public.rift_my_agent_id()));

-- The function takes an agent id as an argument, so nobody but the server may
-- call it: a signed-in user passing an id must get nothing. Revoked from anon
-- and authenticated by name as well as from public, because Supabase grants
-- new functions to both directly. It runs as its caller (not security
-- definer), so even a grant that slipped through would meet rift_agents'
-- read-only grants and change nothing.
revoke all on function public.rift_update_agent_profile(uuid, jsonb, text) from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.rift_agent_profile_changes from anon;
    revoke execute on function public.rift_agent_profile_changes_history() from anon;
    revoke execute on function public.rift_update_agent_profile(uuid, jsonb, text) from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on public.rift_agent_profile_changes from authenticated;
    grant select on public.rift_agent_profile_changes to authenticated;
    revoke execute on function public.rift_agent_profile_changes_history() from authenticated;
    revoke execute on function public.rift_update_agent_profile(uuid, jsonb, text) from authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert on public.rift_agent_profile_changes to service_role;
    grant execute on function public.rift_update_agent_profile(uuid, jsonb, text) to service_role;
  end if;
end $$;

comment on table public.rift_agent_profile_changes is
  'Every change to the agent''s name, email, phone, licence or brokerage: before, after, who. Append-only; written only by rift_update_agent_profile().';

commit;
