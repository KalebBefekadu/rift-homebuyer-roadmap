-- Read-only summary links (ACCESS-02, Blueprint v5 §7.2): a household member
-- sends a parent, a lender or a friend a view of chosen parts of the move,
-- without inviting them into the household.
--
-- The link's token is never stored: only its SHA-256, so a copy of this
-- table opens nothing. Each link names its parts explicitly, expires, and can
-- be revoked; a revoked or expired link opens nothing and says so. No money
-- figures are ever in a summary in this first version.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table if not exists public.rift_summary_links (
  id              uuid primary key default gen_random_uuid(),
  agent_id        uuid not null references public.rift_agents(id) on delete restrict,
  journey_id      uuid not null,
  created_by      uuid not null,
  token_hash      text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  parts           text[] not null check (
    cardinality(parts) between 1 and 3 and parts <@ array['stage', 'dates', 'homes']::text[]
  ),
  -- Who it is for, in the member's words, so they can tell their links apart.
  label           text not null check (length(btrim(label)) between 1 and 80),
  expires_at      timestamptz not null,
  revoked_at      timestamptz,
  created_at      timestamptz not null default now(),
  -- The creator must be a member of this same journey.
  constraint rift_summary_links_member_same_journey
    foreign key (created_by, journey_id) references public.rift_journey_members (id, journey_id) on delete cascade,
  constraint rift_summary_links_journey_same_agent
    foreign key (journey_id, agent_id) references public.rift_journeys (id, agent_id) on delete cascade,
  constraint rift_summary_links_expiry check (expires_at > created_at and expires_at <= created_at + interval '91 days')
);
create index if not exists rift_summary_links_member_idx on public.rift_summary_links (created_by, created_at desc);

alter table public.rift_summary_links enable row level security;

drop policy if exists rift_summary_links_agent on public.rift_summary_links;
create policy rift_summary_links_agent on public.rift_summary_links
  for all to public
  using (agent_id = (select public.rift_my_agent_id()))
  with check (agent_id = (select public.rift_my_agent_id()));

commit;
