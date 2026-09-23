-- ============================================================================
-- The shared shortlist (blueprint v4, W05; journey contract B05).
--
-- Homes the agent or the buyer added by link, with the facts somebody typed
-- in and where they came from. No listing feed: Rift has no licensed MLS data
-- access for this account, so a home here is a link and a few facts with a
-- source and a date, never a scraped copy of a listing (REQ-SEARCH-05/09).
--
-- Reactions are one row per person per change and never edited, so "Sam
-- passed, then came back to maybe" is history rather than an overwrite, and
-- two people disagreeing about one house both stay visible (AT14). A reaction
-- does not touch the search brief; changing the search is a new revision the
-- agent approves (REQ-SEARCH-06).
-- ============================================================================

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table public.rift_shortlist_homes (
  id               uuid primary key default gen_random_uuid(),
  agent_id         uuid not null references public.rift_agents(id) on delete restrict,
  journey_id       uuid not null,
  address          text not null check (length(btrim(address)) between 3 and 200),
  url              text check (url is null or (url ~ '^https?://' and length(url) <= 500)),
  facts            jsonb not null default '{}'::jsonb check (jsonb_typeof(facts) = 'object'),
  facts_source     text not null check (length(btrim(facts_source)) between 1 and 200),
  facts_as_of      date not null,
  added_by_kind    text not null check (added_by_kind in ('agent', 'client')),
  added_by_member  uuid,
  added_by_label   text not null check (length(btrim(added_by_label)) between 1 and 120),
  created_at       timestamptz not null default now(),
  -- Withdrawn listings leave the active list and stay in the history.
  withdrawn_at     timestamptz,
  withdrawn_reason text check (withdrawn_reason is null or length(btrim(withdrawn_reason)) between 1 and 300),

  constraint rift_shortlist_homes_journey_same_agent
    foreign key (journey_id, agent_id) references public.rift_journeys (id, agent_id) on delete cascade,
  constraint rift_shortlist_homes_id_journey unique (id, journey_id),
  constraint rift_shortlist_homes_added_by
    check ((added_by_kind = 'agent') = (added_by_member is null)),
  constraint rift_shortlist_homes_withdrawn_is_whole
    check ((withdrawn_at is null) = (withdrawn_reason is null))
);
create index rift_shortlist_homes_journey_idx
  on public.rift_shortlist_homes (journey_id, created_at desc);

create table public.rift_home_reactions (
  id          uuid primary key default gen_random_uuid(),
  agent_id    uuid not null references public.rift_agents(id) on delete restrict,
  journey_id  uuid not null,
  home_id     uuid not null,
  -- Null when the agent recorded it on somebody's behalf, and then the label says whose.
  member_id   uuid,
  actor_label text not null check (length(btrim(actor_label)) between 1 and 120),
  reaction    text not null check (reaction in ('interested', 'maybe', 'pass', 'tour-requested')),
  reason      text check (reason is null or length(btrim(reason)) between 1 and 500),
  created_at  timestamptz not null default now(),

  constraint rift_home_reactions_journey_same_agent
    foreign key (journey_id, agent_id) references public.rift_journeys (id, agent_id) on delete cascade,
  constraint rift_home_reactions_home_on_journey
    foreign key (home_id, journey_id) references public.rift_shortlist_homes (id, journey_id) on delete cascade,
  constraint rift_home_reactions_member_on_journey
    foreign key (member_id, journey_id) references public.rift_journey_members (id, journey_id) on delete cascade
);
create index rift_home_reactions_home_idx on public.rift_home_reactions (home_id, created_at);

create or replace function public.rift_home_reaction_is_history() returns trigger
language plpgsql as $$
begin
  raise exception 'a reaction is history and cannot be edited; record a new one'
    using errcode = 'check_violation';
end $$;

create trigger rift_home_reaction_is_history
  before update on public.rift_home_reactions
  for each row execute function public.rift_home_reaction_is_history();

alter table public.rift_shortlist_homes enable row level security;
alter table public.rift_home_reactions  enable row level security;

create policy rift_shortlist_homes_agent on public.rift_shortlist_homes
  for all to public
  using (agent_id = (select public.rift_my_agent_id()))
  with check (agent_id = (select public.rift_my_agent_id()));
create policy rift_home_reactions_agent on public.rift_home_reactions
  for all to public
  using (agent_id = (select public.rift_my_agent_id()))
  with check (agent_id = (select public.rift_my_agent_id()));

do $$
declare t text;
begin
  foreach t in array array['rift_shortlist_homes', 'rift_home_reactions'] loop
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
end $$;

comment on table public.rift_shortlist_homes is
  'Homes on a buyer''s shortlist: a link and hand-entered facts with their source and date. Not a listing feed.';
comment on table public.rift_home_reactions is
  'Each person''s reaction to a home, one row per change. The latest per person is current.';

commit;
