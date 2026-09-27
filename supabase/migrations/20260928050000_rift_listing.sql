-- ============================================================================
-- Listing, showings and weekly reviews for a sale (Blueprint v5 §9;
-- journey contracts S06, S07, S08, S09).
--
--   rift_listing_events    the launch checklist and what happened to the
--                          listing: photos, measurements, copy, disclosures,
--                          access arranged, live on the MLS (with the link and
--                          who confirmed it), syndication, a price change,
--                          withdrawn, relisted. History only.
--   rift_listing_showings  each showing of the home: requested, confirmed,
--                          done or cancelled, and feedback only when the
--                          showing agent actually gave it. History only; the
--                          latest row per showing is its state.
--   rift_listing_reviews   the weekly account: what the agent read from
--                          licensed metrics, the showings and feedback counted
--                          with their denominator, and the seller's decision
--                          to keep or change the strategy. Never edited.
--
-- Access instructions never leave the agent's side: the checklist records
-- that access is arranged, not how. A syndication delay is not a failed MLS
-- listing, and no feedback is not good feedback. The rules are
-- lib/core/listing.ts; the only writer is lib/db/listing.ts.
-- ============================================================================

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table if not exists public.rift_listing_events (
  id           uuid primary key default gen_random_uuid(),
  agent_id     uuid not null references public.rift_agents (id) on delete cascade,
  journey_id   uuid not null references public.rift_journeys (id) on delete cascade,
  kind         text not null check (kind in ('photos', 'measurements', 'copy', 'disclosures', 'access', 'mls-live', 'syndicated', 'price-change', 'withdrawn', 'relisted')),
  detail       text not null check (length(btrim(detail)) between 3 and 300),
  url          text check (url is null or (url ~ '^https://' and length(url) <= 500)),
  price_cents  bigint check (price_cents is null or price_cents between 1000000 and 2000000000),
  actor_label  text not null check (length(btrim(actor_label)) between 1 and 120),
  request_id   uuid not null,
  created_at   timestamptz not null default now(),
  constraint rift_listing_events_request unique (agent_id, request_id),
  -- Live on the MLS is a fact with a link; a price change has a price.
  constraint rift_listing_events_live_link check (kind <> 'mls-live' or url is not null),
  constraint rift_listing_events_price check ((kind = 'price-change') = (price_cents is not null))
);
create index if not exists rift_listing_events_idx on public.rift_listing_events (journey_id, created_at);

create table if not exists public.rift_listing_showings (
  id                uuid primary key default gen_random_uuid(),
  agent_id          uuid not null references public.rift_agents (id) on delete cascade,
  journey_id        uuid not null references public.rift_journeys (id) on delete cascade,
  showing_key       uuid not null,
  starts_at         timestamptz not null,
  state             text not null check (state in ('requested', 'confirmed', 'done', 'cancelled')),
  showing_agent     text check (showing_agent is null or length(btrim(showing_agent)) between 1 and 160),
  -- Only when the showing agent gave it. Null is "no feedback", never "fine".
  feedback          text check (feedback is null or length(btrim(feedback)) between 1 and 1000),
  interest          text check (interest is null or interest in ('none', 'some', 'strong', 'offer-likely')),
  actor_label       text not null check (length(btrim(actor_label)) between 1 and 120),
  request_id        uuid not null,
  created_at        timestamptz not null default now(),
  constraint rift_listing_showings_request unique (agent_id, request_id),
  constraint rift_listing_showings_feedback_after check (feedback is null or state = 'done'),
  constraint rift_listing_showings_interest_with_feedback check (interest is null or feedback is not null)
);
create index if not exists rift_listing_showings_idx on public.rift_listing_showings (journey_id, showing_key, created_at);

create table if not exists public.rift_listing_reviews (
  id            uuid primary key default gen_random_uuid(),
  agent_id      uuid not null references public.rift_agents (id) on delete cascade,
  journey_id    uuid not null references public.rift_journeys (id) on delete cascade,
  week_of       date not null,
  -- What the agent read from licensed sources, in their words, with the source.
  metrics       text check (metrics is null or length(btrim(metrics)) between 3 and 1000),
  summary       text not null check (length(btrim(summary)) between 10 and 1500),
  decision      text not null check (decision in ('keep', 'change', 'undecided')),
  decision_note text check (decision_note is null or length(btrim(decision_note)) between 3 and 500),
  actor_label   text not null check (length(btrim(actor_label)) between 1 and 120),
  request_id    uuid not null,
  created_at    timestamptz not null default now(),
  constraint rift_listing_reviews_request unique (agent_id, request_id),
  constraint rift_listing_reviews_change_says_what check (decision <> 'change' or decision_note is not null)
);
create index if not exists rift_listing_reviews_idx on public.rift_listing_reviews (journey_id, week_of);

do $$
declare t text;
begin
  foreach t in array array['rift_listing_events', 'rift_listing_showings', 'rift_listing_reviews'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_seller', t);
    execute format('create trigger %I before insert on public.%I for each row execute function public.rift_seller_only()', t || '_seller', t);
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
end $$;

comment on table public.rift_listing_events is 'A sale''s launch checklist and listing history: photos, copy, disclosures, access arranged, MLS live with its link, syndication, price changes. History only.';
comment on table public.rift_listing_showings is 'Each showing of a home for sale; feedback only when the showing agent gave it. History only; the latest row per showing is its state.';
comment on table public.rift_listing_reviews is 'The weekly account of a listing and the seller''s decision to keep or change the strategy. Never edited.';

commit;
