-- ============================================================================
-- Read-only summary links (Blueprint v5 §7.2, ACCESS-02, decision D03).
--
-- A link shows someone outside the household where a move stands. Only the
-- SHA-256 of its token is stored; its scopes are fixed when it is made
-- (where the move stands, contract dates); it expires; and the only change
-- ever made to a row is revoking it. The rules are lib/core/summary-link.ts;
-- the only writer is lib/db/summary-links.ts.
-- ============================================================================

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table if not exists public.rift_summary_links (
  id           uuid primary key default gen_random_uuid(),
  agent_id     uuid not null references public.rift_agents (id) on delete cascade,
  journey_id   uuid not null references public.rift_journeys (id) on delete cascade,
  token_hash   text not null unique check (length(token_hash) = 64),
  -- Who it is for, in the agent's words ("Dana's mother").
  label        text not null check (length(btrim(label)) between 1 and 80),
  scopes       text[] not null check (cardinality(scopes) >= 1 and scopes <@ array['progress', 'dates']::text[]),
  expires_at   timestamptz not null,
  created_by   text not null check (length(btrim(created_by)) between 1 and 120),
  created_at   timestamptz not null default now(),
  revoked_at   timestamptz,
  revoked_by   text check (revoked_by is null or length(btrim(revoked_by)) between 1 and 120),
  constraint rift_summary_links_expiry check (expires_at > created_at and expires_at <= created_at + interval '91 days'),
  constraint rift_summary_links_revoked_by_someone check ((revoked_at is null) = (revoked_by is null))
);
create index if not exists rift_summary_links_journey_idx on public.rift_summary_links (journey_id, created_at desc);

-- Revoking is the only edit, and it cannot be undone.
create or replace function public.rift_summary_links_only_revoke() returns trigger
language plpgsql as $$
begin
  if old.revoked_at is not null
     or new.id <> old.id or new.agent_id <> old.agent_id or new.journey_id <> old.journey_id
     or new.token_hash <> old.token_hash or new.label <> old.label or new.scopes <> old.scopes
     or new.expires_at <> old.expires_at or new.created_by <> old.created_by or new.created_at <> old.created_at then
    raise exception 'a summary link can only be revoked, once'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists rift_summary_links_only_revoke on public.rift_summary_links;
create trigger rift_summary_links_only_revoke before update on public.rift_summary_links
  for each row execute function public.rift_summary_links_only_revoke();

alter table public.rift_summary_links enable row level security;
drop policy if exists rift_summary_links_agent on public.rift_summary_links;
create policy rift_summary_links_agent on public.rift_summary_links for all to public
  using (agent_id = (select public.rift_my_agent_id())) with check (agent_id = (select public.rift_my_agent_id()));

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.rift_summary_links from anon;
    revoke execute on function public.rift_summary_links_only_revoke() from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on public.rift_summary_links from authenticated;
    grant select on public.rift_summary_links to authenticated;
    revoke execute on function public.rift_summary_links_only_revoke() from authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert, update on public.rift_summary_links to service_role;
  end if;
end $$;

comment on table public.rift_summary_links is 'A read-only summary of a journey for someone outside the household: hashed token, fixed scopes, expiry, revocation.';

commit;
