-- ============================================================================
-- The buyer's search brief and the Matrix search it becomes (blueprint v4,
-- W03 and W04; decision D10: buyer search is the first slice, and D04: the
-- agent approves every external action).
--
--   rift_search_revisions  The brief, versioned. A revision is never edited;
--                          a change is a new revision, numbered in order.
--   rift_search_responses  A household member confirming a revision, or
--                          asking for changes to it.
--   rift_search_packages   The agent's approval of one exact revision as a
--                          Matrix search, and then his record of setting it
--                          up there. Rift has no write access to Matrix, so
--                          "active" means the agent said so, with a reference.
--
-- Two functions carry the rules that must hold under concurrency and retries:
--   rift_approve_search_package   only the LATEST revision can be approved
--   rift_confirm_search_package   an approval whose revision has since been
--                                 superseded cannot be confirmed (AT12), and
--                                 the same request twice records once (AT13)
-- ============================================================================

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- ---------------------------------------------------------------------------
-- Revisions
-- ---------------------------------------------------------------------------

create table public.rift_search_revisions (
  id               uuid primary key default gen_random_uuid(),
  agent_id         uuid not null references public.rift_agents(id) on delete restrict,
  journey_id       uuid not null,
  revision         integer not null check (revision >= 1),
  schema_version   smallint not null check (schema_version >= 1),
  criteria         jsonb not null
                     check (jsonb_typeof(criteria) = 'array' and jsonb_array_length(criteria) <= 40),
  questions        jsonb not null default '[]'::jsonb
                     check (jsonb_typeof(questions) = 'array' and jsonb_array_length(questions) <= 10),
  note             text check (note is null or length(note) <= 2000),
  author_kind      text not null check (author_kind in ('agent', 'client')),
  -- Deliberately not a foreign key. A revision is a record of what somebody
  -- said; a later change to their membership must never rewrite it.
  author_member_id uuid,
  author_label     text not null check (length(btrim(author_label)) between 1 and 120),
  created_at       timestamptz not null default now(),

  constraint rift_search_revisions_journey_same_agent
    foreign key (journey_id, agent_id)
    references public.rift_journeys (id, agent_id)
    on delete cascade,
  constraint rift_search_revisions_one_number unique (journey_id, revision),
  constraint rift_search_revisions_id_journey unique (id, journey_id),
  constraint rift_search_revisions_author
    check ((author_kind = 'agent') = (author_member_id is null))
);

create or replace function public.rift_search_revision_rules() returns trigger
language plpgsql as $$
declare latest integer;
begin
  if tg_op = 'UPDATE' then
    raise exception 'search revision % is a record and cannot be edited; save a new revision', old.revision
      using errcode = 'check_violation';
  end if;
  -- In order, no gaps: revision N+1 is only ever written on top of N.
  select coalesce(max(revision), 0) into latest
    from public.rift_search_revisions where journey_id = new.journey_id;
  if new.revision <> latest + 1 then
    raise exception 'revision % is out of order; the latest is %', new.revision, latest
      using errcode = 'serialization_failure';
  end if;
  return new;
end $$;

create trigger rift_search_revision_rules
  before insert or update on public.rift_search_revisions
  for each row execute function public.rift_search_revision_rules();

-- ---------------------------------------------------------------------------
-- Household responses
-- ---------------------------------------------------------------------------

create table public.rift_search_responses (
  id           uuid primary key default gen_random_uuid(),
  agent_id     uuid not null references public.rift_agents(id) on delete restrict,
  journey_id   uuid not null,
  revision_id  uuid not null,
  member_id    uuid not null,
  response     text not null check (response in ('confirmed', 'changes-requested')),
  note         text check (note is null or length(btrim(note)) between 1 and 1000),
  created_at   timestamptz not null default now(),

  constraint rift_search_responses_journey_same_agent
    foreign key (journey_id, agent_id) references public.rift_journeys (id, agent_id) on delete cascade,
  constraint rift_search_responses_revision_on_journey
    foreign key (revision_id, journey_id) references public.rift_search_revisions (id, journey_id) on delete cascade,
  constraint rift_search_responses_member_on_journey
    foreign key (member_id, journey_id) references public.rift_journey_members (id, journey_id) on delete cascade,
  constraint rift_search_responses_changes_say_why
    check (response = 'confirmed' or note is not null)
);
create index rift_search_responses_revision_idx on public.rift_search_responses (revision_id, created_at);

-- ---------------------------------------------------------------------------
-- Packages: approval, then the agent's record of setting it up
-- ---------------------------------------------------------------------------

create table public.rift_search_packages (
  id                 uuid primary key default gen_random_uuid(),
  agent_id           uuid not null references public.rift_agents(id) on delete restrict,
  journey_id         uuid not null,
  revision_id        uuid not null,
  destination        text not null check (destination = 'matrix'),
  cadence            text not null check (cadence in ('instant', 'daily', 'weekly')),
  package            jsonb not null check (jsonb_typeof(package) = 'object'),
  package_hash       text not null check (package_hash ~ '^[0-9a-f]{64}$'),
  approved_at        timestamptz not null default now(),
  approved_by        text not null check (length(btrim(approved_by)) between 1 and 120),
  request_id         uuid not null unique,
  status             text not null default 'manual-action-needed'
                       check (status in ('manual-action-needed', 'active-confirmed', 'paused', 'superseded', 'cancelled')),
  external_ref       text check (external_ref is null or length(btrim(external_ref)) between 1 and 200),
  external_url       text check (external_url is null or (external_url ~ '^https?://' and length(external_url) <= 500)),
  confirmed_at       timestamptz,
  confirm_note       text check (confirm_note is null or length(confirm_note) <= 1000),
  confirm_request_id uuid unique,
  ended_at           timestamptz,
  ended_reason       text check (ended_reason is null or length(ended_reason) <= 300),

  constraint rift_search_packages_journey_same_agent
    foreign key (journey_id, agent_id) references public.rift_journeys (id, agent_id) on delete cascade,
  constraint rift_search_packages_revision_on_journey
    foreign key (revision_id, journey_id) references public.rift_search_revisions (id, journey_id) on delete cascade,
  -- Active or paused means the agent recorded it, with something to find it by.
  constraint rift_search_packages_confirmed_has_evidence
    check (status not in ('active-confirmed', 'paused')
           or (confirmed_at is not null and (external_ref is not null or external_url is not null))),
  constraint rift_search_packages_ended_is_whole
    check ((status in ('superseded', 'cancelled')) = (ended_at is not null))
);

-- One approval waiting, and one search in Matrix, per journey and destination.
create unique index rift_search_packages_one_waiting
  on public.rift_search_packages (journey_id, destination) where status = 'manual-action-needed';
create unique index rift_search_packages_one_live
  on public.rift_search_packages (journey_id, destination) where status in ('active-confirmed', 'paused');
create index rift_search_packages_agent_idx
  on public.rift_search_packages (agent_id, status);

-- What was approved is fixed. Only the lifecycle columns move.
create or replace function public.rift_search_package_is_fixed() returns trigger
language plpgsql as $$
begin
  if new.package is distinct from old.package or new.package_hash is distinct from old.package_hash
     or new.revision_id is distinct from old.revision_id or new.cadence is distinct from old.cadence
     or new.destination is distinct from old.destination or new.approved_at is distinct from old.approved_at
     or new.approved_by is distinct from old.approved_by or new.request_id is distinct from old.request_id
     or new.journey_id is distinct from old.journey_id or new.agent_id is distinct from old.agent_id then
    raise exception 'an approved search package cannot be changed; approve a new one'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

create trigger rift_search_package_is_fixed
  before update on public.rift_search_packages
  for each row execute function public.rift_search_package_is_fixed();

-- ---------------------------------------------------------------------------
-- Commands
-- ---------------------------------------------------------------------------

create or replace function public.rift_approve_search_package(
  p_agent uuid, p_journey uuid, p_revision uuid, p_cadence text,
  p_package jsonb, p_hash text, p_by text, p_request uuid
) returns uuid
language plpgsql as $$
declare
  existing uuid;
  latest uuid;
  made uuid;
begin
  -- The same request twice is one approval.
  select id into existing from public.rift_search_packages where request_id = p_request;
  if existing is not null then return existing; end if;

  perform 1 from public.rift_journeys where id = p_journey and agent_id = p_agent for update;
  if not found then
    raise exception 'that journey is not in your book' using errcode = 'insufficient_privilege';
  end if;

  select id into latest from public.rift_search_revisions
   where journey_id = p_journey order by revision desc limit 1;
  if latest is distinct from p_revision then
    raise exception 'the brief changed while you were reviewing it; review the latest revision'
      using errcode = 'serialization_failure';
  end if;

  update public.rift_search_packages
     set status = 'cancelled', ended_at = now(), ended_reason = 'replaced by a newer approval'
   where journey_id = p_journey and destination = 'matrix' and status = 'manual-action-needed';

  insert into public.rift_search_packages
    (agent_id, journey_id, revision_id, destination, cadence, package, package_hash, approved_by, request_id)
  values
    (p_agent, p_journey, p_revision, 'matrix', p_cadence, p_package, p_hash, p_by, p_request)
  returning id into made;
  return made;
end $$;

create or replace function public.rift_confirm_search_package(
  p_agent uuid, p_package uuid, p_ref text, p_url text, p_note text, p_request uuid
) returns uuid
language plpgsql as $$
declare
  existing uuid;
  pkg record;
  latest uuid;
begin
  select id into existing from public.rift_search_packages where confirm_request_id = p_request;
  if existing is not null then return existing; end if;

  select * into pkg from public.rift_search_packages
   where id = p_package and agent_id = p_agent for update;
  if not found then
    raise exception 'that search is not in your book' using errcode = 'insufficient_privilege';
  end if;
  if pkg.status <> 'manual-action-needed' then
    raise exception 'this approval is %, so there is nothing to record against it', pkg.status
      using errcode = 'check_violation';
  end if;

  select id into latest from public.rift_search_revisions
   where journey_id = pkg.journey_id order by revision desc limit 1;
  if latest is distinct from pkg.revision_id then
    raise exception 'the brief changed after you approved this search; review and approve the latest revision first'
      using errcode = 'serialization_failure';
  end if;

  update public.rift_search_packages
     set status = 'superseded', ended_at = now(), ended_reason = 'replaced by a newer search'
   where journey_id = pkg.journey_id and destination = pkg.destination
     and status in ('active-confirmed', 'paused');

  update public.rift_search_packages
     set status = 'active-confirmed',
         external_ref = nullif(btrim(p_ref), ''),
         external_url = nullif(btrim(p_url), ''),
         confirm_note = nullif(btrim(p_note), ''),
         confirmed_at = now(),
         confirm_request_id = p_request
   where id = p_package;
  return p_package;
end $$;

-- ---------------------------------------------------------------------------
-- Access
-- ---------------------------------------------------------------------------

alter table public.rift_search_revisions enable row level security;
alter table public.rift_search_responses enable row level security;
alter table public.rift_search_packages  enable row level security;

create policy rift_search_revisions_agent on public.rift_search_revisions
  for all to public
  using (agent_id = (select public.rift_my_agent_id()))
  with check (agent_id = (select public.rift_my_agent_id()));
create policy rift_search_responses_agent on public.rift_search_responses
  for all to public
  using (agent_id = (select public.rift_my_agent_id()))
  with check (agent_id = (select public.rift_my_agent_id()));
create policy rift_search_packages_agent on public.rift_search_packages
  for all to public
  using (agent_id = (select public.rift_my_agent_id()))
  with check (agent_id = (select public.rift_my_agent_id()));

-- The commands take an agent id as an argument, so nobody but the server may
-- call them: a signed-in user passing somebody else's id must get nothing.
revoke all on function public.rift_approve_search_package(uuid, uuid, uuid, text, jsonb, text, text, uuid) from public;
revoke all on function public.rift_confirm_search_package(uuid, uuid, text, text, text, uuid) from public;

do $$
declare t text;
begin
  foreach t in array array['rift_search_revisions', 'rift_search_responses', 'rift_search_packages'] loop
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on public.%I from anon', t);
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('revoke all on public.%I from authenticated', t);
      execute format('grant select on public.%I to authenticated', t);
    end if;
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format('grant select, insert, update, delete on public.%I to service_role', t);
    end if;
  end loop;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.rift_approve_search_package(uuid, uuid, uuid, text, jsonb, text, text, uuid) to service_role;
    grant execute on function public.rift_confirm_search_package(uuid, uuid, text, text, text, uuid) to service_role;
  end if;
end $$;

comment on table public.rift_search_revisions is
  'A buyer''s search brief, one row per version. Never edited; see lib/core/search.ts for the criterion contract.';
comment on table public.rift_search_packages is
  'An approved revision as a Matrix search. active-confirmed means the AGENT recorded setting it up; Rift has no write access to Matrix.';

commit;
