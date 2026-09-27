-- ============================================================================
-- Seller pricing and proceeds (Blueprint v5 §9; journey contracts S04, S16).
--
--   rift_pricing_opinions   the agent's approved value opinion, versioned: a
--                           list price, a range, the comparables chosen and
--                           why, and when it will be reviewed. Never edited.
--   rift_pricing_responses  what a seller in the household said to a
--                           version: agree to launch at it, or talk first.
--   rift_seller_figures     the seller's net, in versions from planning to
--                           official: price, what is owed and whether that is
--                           a balance or a payoff statement, commission as
--                           agreed, credits, and for the official version the
--                           settlement statement's own net. Never edited.
--
-- No generated valuation, no prediction of days to sell, no standard
-- commission: every figure is entered by the agent with its source. The
-- rules are lib/core/pricing.ts and lib/core/proceeds.ts; the only writer is
-- lib/db/seller.ts.
-- ============================================================================

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table if not exists public.rift_pricing_opinions (
  id                uuid primary key default gen_random_uuid(),
  agent_id          uuid not null references public.rift_agents (id) on delete cascade,
  journey_id        uuid not null references public.rift_journeys (id) on delete cascade,
  version           integer not null check (version >= 1),
  list_price_cents  bigint not null check (list_price_cents between 1000000 and 2000000000),
  low_cents         bigint not null,
  high_cents        bigint not null,
  comps             jsonb not null check (jsonb_typeof(comps) = 'array' and jsonb_array_length(comps) between 1 and 12),
  rationale         text not null check (length(btrim(rationale)) between 10 and 1500),
  review_on         date not null,
  actor_label       text not null check (length(btrim(actor_label)) between 1 and 120),
  request_id        uuid not null,
  created_at        timestamptz not null default now(),
  constraint rift_pricing_opinions_request unique (agent_id, request_id),
  constraint rift_pricing_opinions_version unique (journey_id, version),
  constraint rift_pricing_opinions_range check (low_cents <= list_price_cents and list_price_cents <= high_cents)
);

create table if not exists public.rift_pricing_responses (
  id           uuid primary key default gen_random_uuid(),
  agent_id     uuid not null references public.rift_agents (id) on delete cascade,
  opinion_id   uuid not null references public.rift_pricing_opinions (id) on delete cascade,
  member_id    uuid not null references public.rift_journey_members (id) on delete cascade,
  response     text not null check (response in ('agree', 'discuss')),
  note         text check (note is null or length(btrim(note)) between 1 and 500),
  created_at   timestamptz not null default now()
);
create index if not exists rift_pricing_responses_idx on public.rift_pricing_responses (opinion_id, created_at);

create table if not exists public.rift_seller_figures (
  id                 uuid primary key default gen_random_uuid(),
  agent_id           uuid not null references public.rift_agents (id) on delete cascade,
  journey_id         uuid not null references public.rift_journeys (id) on delete cascade,
  kind               text not null check (kind in ('planning', 'offer', 'revised', 'official')),
  price_cents        bigint not null check (price_cents between 1000000 and 2000000000),
  owed_cents         bigint not null check (owed_cents between 0 and 2000000000),
  owed_source        text not null check (owed_source in ('balance', 'payoff-statement', 'none')),
  commission_pct     numeric(4,2) check (commission_pct is null or commission_pct between 0 and 10),
  credits_cents      bigint not null default 0 check (credits_cents between 0 and 2000000000),
  official_net_cents bigint,
  source             text not null check (length(btrim(source)) between 3 and 160),
  as_of              date not null,
  note               text check (note is null or length(btrim(note)) between 1 and 500),
  actor_label        text not null check (length(btrim(actor_label)) between 1 and 120),
  request_id         uuid not null,
  created_at         timestamptz not null default now(),
  constraint rift_seller_figures_request unique (agent_id, request_id),
  -- Only the settlement statement carries an official net, and it must.
  constraint rift_seller_figures_official check ((kind = 'official') = (official_net_cents is not null)),
  -- "Owed" from a balance is an estimate; the official version needs the payoff statement.
  constraint rift_seller_figures_payoff check (kind <> 'official' or owed_source <> 'balance')
);
create index if not exists rift_seller_figures_journey_idx on public.rift_seller_figures (journey_id, created_at);

-- Only a selling journey has pricing or proceeds.
create or replace function public.rift_seller_only() returns trigger
language plpgsql as $$
begin
  if not exists (select 1 from public.rift_journeys where id = new.journey_id and side = 'sell' and agent_id = new.agent_id) then
    raise exception 'pricing and proceeds belong to one of the agent''s selling journeys'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists rift_pricing_opinions_seller on public.rift_pricing_opinions;
create trigger rift_pricing_opinions_seller before insert on public.rift_pricing_opinions
  for each row execute function public.rift_seller_only();
drop trigger if exists rift_seller_figures_seller on public.rift_seller_figures;
create trigger rift_seller_figures_seller before insert on public.rift_seller_figures
  for each row execute function public.rift_seller_only();

create or replace function public.rift_seller_money_history() returns trigger
language plpgsql as $$
begin
  raise exception '% is history and cannot be edited; record a new version', tg_table_name
    using errcode = 'check_violation';
end $$;

do $$
declare t text;
begin
  foreach t in array array['rift_pricing_opinions', 'rift_pricing_responses', 'rift_seller_figures'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_history', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.rift_seller_money_history()', t || '_history', t);
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
    revoke execute on function public.rift_seller_money_history() from anon;
    revoke execute on function public.rift_seller_only() from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke execute on function public.rift_seller_money_history() from authenticated;
    revoke execute on function public.rift_seller_only() from authenticated;
  end if;
end $$;

comment on table public.rift_pricing_opinions is 'The agent''s approved value opinion for a sale, versioned, with comparables and a review date. Never generated.';
comment on table public.rift_pricing_responses is 'A seller''s answer to a pricing version: agree to launch at it, or talk first.';
comment on table public.rift_seller_figures is 'The seller''s net in versions from planning to official, each with its source. History only.';

commit;
