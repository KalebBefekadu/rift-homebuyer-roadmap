-- ============================================================================
-- Buyer offers and documents (blueprint v4, W08; journey contracts B08 to
-- B10; REQ-DEC-01 to 03, REQ-DOC-01; AT22 to AT25).
--
--   rift_documents      a file that passed the checks in lib/core/document.ts.
--                       The bytes are in the private Storage bucket
--                       'rift-documents'; this row is the record of them,
--                       with the SHA-256 of the original. A file that fails
--                       the checks never gets a row and its upload is
--                       deleted.
--   rift_bids           an offer on one home on the shortlist.
--   rift_bid_steps      each step of it: a version of the terms (ours or a
--                       counter received), asking the household, prepared,
--                       signed, submitted, and how it ended.
--   rift_bid_responses  a household member's instruction on ONE version of
--                       the terms. An instruction is never a signature, an
--                       acceptance or a delivery (REQ-DEC-03).
--
-- The rules are lib/core/bid.ts and lib/core/document.ts; the only writers are
-- lib/db/bids.ts and lib/db/documents.ts. Everything here is history, never
-- edited. Rows cascade when a journey is erased; the files are removed by
-- lib/db/retention.ts `forget` BEFORE the rows, so no file outlives its
-- record. Whether the broker must hold offers longer (F16) is open.
-- ============================================================================

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table public.rift_documents (
  id            uuid primary key default gen_random_uuid(),
  agent_id      uuid not null references public.rift_agents(id) on delete restrict,
  journey_id    uuid not null,
  family        text not null check (family in ('offer', 'counter', 'contract', 'disclosure', 'inspection', 'appraisal', 'lender', 'other')),
  label         text not null check (length(btrim(label)) between 2 and 160),
  filename      text not null check (length(btrim(filename)) between 1 and 120),
  kind          text not null check (kind in ('pdf', 'jpeg', 'png')),
  bytes         integer not null check (bytes between 1 and 20971520),
  sha256        text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  storage_path  text not null unique check (storage_path ~ '^clean/'),
  actor_label   text not null check (length(btrim(actor_label)) between 1 and 120),
  created_at    timestamptz not null default now(),

  constraint rift_documents_journey_same_agent
    foreign key (journey_id, agent_id) references public.rift_journeys (id, agent_id) on delete cascade,
  constraint rift_documents_id_journey unique (id, journey_id)
);
create index rift_documents_journey_idx on public.rift_documents (journey_id, created_at desc);

create table public.rift_bids (
  id           uuid primary key default gen_random_uuid(),
  agent_id     uuid not null references public.rift_agents(id) on delete restrict,
  journey_id   uuid not null,
  home_id      uuid not null,
  actor_label  text not null check (length(btrim(actor_label)) between 1 and 120),
  created_at   timestamptz not null default now(),

  constraint rift_bids_journey_same_agent
    foreign key (journey_id, agent_id) references public.rift_journeys (id, agent_id) on delete cascade,
  constraint rift_bids_home_on_journey
    foreign key (home_id, journey_id) references public.rift_shortlist_homes (id, journey_id) on delete cascade,
  constraint rift_bids_id_journey unique (id, journey_id)
);
create index rift_bids_journey_idx on public.rift_bids (journey_id, created_at desc);

create table public.rift_bid_steps (
  id            uuid primary key default gen_random_uuid(),
  agent_id      uuid not null references public.rift_agents(id) on delete restrict,
  journey_id    uuid not null,
  bid_id        uuid not null,
  seq           integer not null check (seq >= 1),
  kind          text not null check (kind in ('terms', 'ask', 'prepared', 'signed', 'submitted', 'accepted', 'rejected', 'expired', 'withdrawn')),
  version       integer not null check (version >= 1),
  terms         jsonb,
  origin        text check (origin in ('ours', 'theirs')),
  -- For 'ask': the members whose say is needed, fixed when asked.
  required      jsonb not null default '[]'::jsonb check (jsonb_typeof(required) = 'array'),
  document_ids  uuid[] not null default '{}',
  note          text check (note is null or length(btrim(note)) between 1 and 500),
  actor_label   text not null check (length(btrim(actor_label)) between 1 and 120),
  request_id    uuid not null unique,
  created_at    timestamptz not null default now(),

  constraint rift_bid_steps_journey_same_agent
    foreign key (journey_id, agent_id) references public.rift_journeys (id, agent_id) on delete cascade,
  constraint rift_bid_steps_bid_on_journey
    foreign key (bid_id, journey_id) references public.rift_bids (id, journey_id) on delete cascade,
  -- Two people recording the next step at once: one wins, the other reloads.
  constraint rift_bid_steps_seq unique (bid_id, seq),
  constraint rift_bid_steps_terms_carry_terms
    check ((kind = 'terms') = (terms is not null) and (kind = 'terms') = (origin is not null)),
  constraint rift_bid_steps_terms_are_an_object check (terms is null or jsonb_typeof(terms) = 'object'),
  constraint rift_bid_steps_first_is_ours check (seq <> 1 or (kind = 'terms' and origin = 'ours' and version = 1)),
  constraint rift_bid_steps_ask_names_people check (kind <> 'ask' or jsonb_array_length(required) > 0),
  constraint rift_bid_steps_evidence
    check (kind not in ('signed', 'submitted', 'accepted', 'rejected', 'expired', 'withdrawn') or note is not null)
);
create index rift_bid_steps_bid_idx on public.rift_bid_steps (bid_id, seq);

create table public.rift_bid_responses (
  id            uuid primary key default gen_random_uuid(),
  agent_id      uuid not null references public.rift_agents(id) on delete restrict,
  journey_id    uuid not null,
  bid_id        uuid not null,
  version       integer not null check (version >= 1),
  member_id     uuid not null,
  instruction   text not null check (instruction in ('proceed', 'change', 'stop')),
  note          text check (note is null or length(btrim(note)) between 1 and 500),
  -- Set when the agent recorded it from a call or message: how they said it.
  told_agent    text check (told_agent is null or length(btrim(told_agent)) between 3 and 200),
  actor_label   text not null check (length(btrim(actor_label)) between 1 and 120),
  request_id    uuid not null unique,
  created_at    timestamptz not null default now(),

  constraint rift_bid_responses_journey_same_agent
    foreign key (journey_id, agent_id) references public.rift_journeys (id, agent_id) on delete cascade,
  constraint rift_bid_responses_bid_on_journey
    foreign key (bid_id, journey_id) references public.rift_bids (id, journey_id) on delete cascade,
  constraint rift_bid_responses_member_on_journey
    foreign key (member_id, journey_id) references public.rift_journey_members (id, journey_id) on delete cascade,
  constraint rift_bid_responses_not_proceed_says_why check (instruction = 'proceed' or note is not null)
);
create index rift_bid_responses_bid_idx on public.rift_bid_responses (bid_id, version, created_at);

create or replace function public.rift_offers_are_history() returns trigger
language plpgsql as $$
begin
  raise exception '% is history and cannot be edited; record a new row', tg_table_name
    using errcode = 'check_violation';
end $$;

do $$
declare t text;
begin
  foreach t in array array['rift_documents', 'rift_bids', 'rift_bid_steps', 'rift_bid_responses'] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.rift_offers_are_history()', t || '_are_history', t);
    execute format('alter table public.%I enable row level security', t);
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
      execute format('grant select, insert, update, delete on public.%I to service_role', t);
    end if;
  end loop;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke execute on function public.rift_offers_are_history() from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke execute on function public.rift_offers_are_history() from authenticated;
  end if;

  -- The private bucket. No policies on storage.objects for it: only the
  -- service role (the server) reads or writes, and people get a signed link
  -- that lasts a minute. The bucket itself refuses anything but the three
  -- types, and anything over 20 MB, before the file checks even run.
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('rift-documents', 'rift-documents', false, 20971520, array['application/pdf', 'image/jpeg', 'image/png'])
    on conflict (id) do nothing;
  end if;
end $$;

comment on table public.rift_documents is
  'A file that passed the structural checks (not a virus scan), kept in the private rift-documents bucket. SHA-256 of the original.';
comment on table public.rift_bids is 'A buyer''s offer on one home. Its steps and the household''s instructions are the history.';
comment on table public.rift_bid_steps is 'Each step of an offer: terms versions, asking the household, prepared, signed, submitted, and the ending.';
comment on table public.rift_bid_responses is
  'A household member''s instruction on one version of the terms. Not a signature, acceptance or delivery.';

commit;
