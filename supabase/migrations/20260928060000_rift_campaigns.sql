-- ============================================================================
-- Campaign landing pages (Blueprint v5 §5.10; CAMP-01 to CAMP-03).
--
--   rift_campaigns              a campaign: its address (/c/<slug>) and name.
--   rift_campaign_revisions     each saved recipe of approved blocks, never
--                               edited; the version counts up per campaign.
--   rift_campaign_publications  publish, roll back, unpublish: which revision
--                               is live, and who said so. History only.
--
-- A recipe is jsonb of approved blocks, validated in lib/core/campaign.ts
-- before it is stored; nothing in it is ever run or rendered as markup. The
-- public page reads through the service role on the server; no anonymous
-- grant exists. The only writer is lib/db/campaigns.ts.
-- ============================================================================

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table if not exists public.rift_campaigns (
  id           uuid primary key default gen_random_uuid(),
  agent_id     uuid not null references public.rift_agents (id) on delete cascade,
  slug         text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  name         text not null check (length(btrim(name)) between 3 and 120),
  actor_label  text not null check (length(btrim(actor_label)) between 1 and 120),
  created_at   timestamptz not null default now()
);

create table if not exists public.rift_campaign_revisions (
  id           uuid primary key default gen_random_uuid(),
  agent_id     uuid not null references public.rift_agents (id) on delete cascade,
  campaign_id  uuid not null references public.rift_campaigns (id) on delete cascade,
  version      integer not null check (version >= 1),
  recipe       jsonb not null check (jsonb_typeof(recipe -> 'blocks') = 'array' and jsonb_array_length(recipe -> 'blocks') between 1 and 8),
  note         text check (note is null or length(btrim(note)) between 1 and 300),
  actor_label  text not null check (length(btrim(actor_label)) between 1 and 120),
  request_id   uuid not null,
  created_at   timestamptz not null default now(),
  constraint rift_campaign_revisions_request unique (agent_id, request_id),
  constraint rift_campaign_revisions_version unique (campaign_id, version)
);

create table if not exists public.rift_campaign_publications (
  id           uuid primary key default gen_random_uuid(),
  agent_id     uuid not null references public.rift_agents (id) on delete cascade,
  campaign_id  uuid not null references public.rift_campaigns (id) on delete cascade,
  action       text not null check (action in ('publish', 'rollback', 'unpublish')),
  version      integer,
  actor_label  text not null check (length(btrim(actor_label)) between 1 and 120),
  request_id   uuid not null,
  created_at   timestamptz not null default now(),
  constraint rift_campaign_publications_request unique (agent_id, request_id),
  constraint rift_campaign_publications_version check ((action = 'unpublish') = (version is null)),
  constraint rift_campaign_publications_revision foreign key (campaign_id, version)
    references public.rift_campaign_revisions (campaign_id, version) on delete cascade
);
create index if not exists rift_campaign_publications_idx on public.rift_campaign_publications (campaign_id, created_at);

create or replace function public.rift_campaigns_history() returns trigger
language plpgsql as $$
begin
  raise exception '% is history and cannot be edited; save a new revision', tg_table_name
    using errcode = 'check_violation';
end $$;

do $$
declare t text;
begin
  foreach t in array array['rift_campaigns', 'rift_campaign_revisions', 'rift_campaign_publications'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_history', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.rift_campaigns_history()', t || '_history', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_agent', t);
    execute format(
      'create policy %I on public.%I for all to public using (agent_id = (select public.rift_my_agent_id())) with check (agent_id = (select public.rift_my_agent_id()))',
      t || '_agent', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on public.%I from anon', t);
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('revoke all on public.%I from authenticated', t);
      execute format('grant select on public.%I to authenticated', t);
    end if;
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format('grant select, insert on public.%I to service_role', t);
    end if;
  end loop;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke execute on function public.rift_campaigns_history() from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke execute on function public.rift_campaigns_history() from authenticated;
  end if;
end $$;

comment on table public.rift_campaigns is 'A campaign landing page at /c/<slug>.';
comment on table public.rift_campaign_revisions is 'Each saved recipe of approved blocks for a campaign. Never edited.';
comment on table public.rift_campaign_publications is 'Publish, roll back, unpublish: which campaign revision is live. History only.';

commit;
