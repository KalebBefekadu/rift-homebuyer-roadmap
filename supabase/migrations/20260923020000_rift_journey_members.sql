-- ============================================================================
-- Who may take part in a journey (blueprint v4, W02; decision D03 confirmed:
-- email sign-in for private client pages).
--
-- A member row starts as an INVITATION: an address, a role, the scopes the
-- agent chose, and the SHA-256 of a one-time link. It becomes a MEMBERSHIP
-- when somebody signed in with that exact verified address opens the link.
-- Signing in never creates a membership on its own, and nothing here trusts
-- profile metadata a user can edit (REQ-ACCESS-01).
--
-- Revocation is a timestamp, not a delete: the record of who could see what,
-- and when, outlives the access itself. Every read and write on the client
-- side checks `revoked_at is null` at the moment it runs, so revoking takes
-- effect on the next request (AT05).
--
-- No client-side policy. Client pages read through the server, which checks
-- membership explicitly; direct table access stays agent-only until a
-- membership policy is designed and tested (first-migration-proposal §limits).
-- ============================================================================

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table public.rift_journey_members (
  id                 uuid primary key default gen_random_uuid(),
  agent_id           uuid not null references public.rift_agents(id) on delete restrict,
  journey_id         uuid not null,
  email              text not null
                       check (email = lower(btrim(email)) and length(email) between 3 and 254
                              and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  display_name       text check (display_name is null or length(btrim(display_name)) between 1 and 120),
  role               text not null check (role in ('buyer', 'co-buyer', 'viewer')),
  scopes             text[] not null
                       check (cardinality(scopes) >= 1 and scopes <@ array['search', 'homes', 'money']::text[]),
  invite_token_hash  text unique check (invite_token_hash is null or invite_token_hash ~ '^[0-9a-f]{64}$'),
  invite_expires_at  timestamptz,
  auth_user_id       uuid references auth.users(id) on delete set null,
  invited_at         timestamptz not null default now(),
  accepted_at        timestamptz,
  revoked_at         timestamptz,

  constraint rift_journey_members_journey_same_agent
    foreign key (journey_id, agent_id)
    references public.rift_journeys (id, agent_id)
    on delete cascade,
  constraint rift_journey_members_id_journey unique (id, journey_id),

  -- A login is attached only by accepting. (A deleted login nulls the id and
  -- leaves the acceptance on record, which is the history, not access.)
  constraint rift_journey_members_user_means_accepted
    check (auth_user_id is null or accepted_at is not null),
  -- An invitation still waiting has a link and an expiry.
  constraint rift_journey_members_pending_has_link
    check (accepted_at is not null or revoked_at is not null
           or (invite_token_hash is not null and invite_expires_at is not null)),
  -- An accepted membership has no live link left to forward.
  constraint rift_journey_members_accepted_link_spent
    check (accepted_at is null or invite_token_hash is null)
);

-- One live row per address and per login on a journey. A second invitation to
-- the same address reissues the link on the existing row.
create unique index rift_journey_members_one_live_email
  on public.rift_journey_members (journey_id, email) where revoked_at is null;
create unique index rift_journey_members_one_live_user
  on public.rift_journey_members (journey_id, auth_user_id)
  where revoked_at is null and auth_user_id is not null;
-- "Which journeys can this signed-in person see": the client's first read.
create index rift_journey_members_user_idx
  on public.rift_journey_members (auth_user_id)
  where auth_user_id is not null and revoked_at is null;

alter table public.rift_journey_members enable row level security;

create policy rift_journey_members_agent
  on public.rift_journey_members
  for all to public
  using (agent_id = (select public.rift_my_agent_id()))
  with check (agent_id = (select public.rift_my_agent_id()));

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.rift_journey_members from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on public.rift_journey_members from authenticated;
    grant select on public.rift_journey_members to authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert, update, delete on public.rift_journey_members to service_role;
  end if;
end $$;

comment on table public.rift_journey_members is
  'Invitations and memberships for one journey. A row is an invitation until a '
  'person signed in with the same verified address accepts it. Revoked, never deleted.';
comment on column public.rift_journey_members.invite_token_hash is
  'SHA-256 of the one-time invitation link. The link itself is never stored.';
comment on column public.rift_journey_members.scopes is
  'search: the brief. homes: the shortlist. money: price and fee criteria.';

commit;
