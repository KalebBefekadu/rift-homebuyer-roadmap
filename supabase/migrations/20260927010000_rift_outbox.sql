-- ============================================================================
-- The outbox (Blueprint v5 §10.2; AUTO-01, AUTO-02, AUTO-03; D04).
--
--   rift_outbox         a prepared message: recipient, channel, purpose and
--                       the exact words, with a SHA-256 of all of them. Never
--                       edited: a change is a new row that names the one it
--                       replaces, and the old one is cancelled.
--   rift_outbox_events  every step, append-only: prepared, approved (with the
--                       hash it approved and who), running, succeeded (with
--                       the provider's receipt), failed, unknown, cancelled.
--
-- The rules are lib/core/outbox.ts; the only writer is lib/db/outbox.ts.
-- Deleting a person deletes their drafts ("delete all of it").
-- ============================================================================

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table if not exists public.rift_outbox (
  id            uuid primary key default gen_random_uuid(),
  agent_id      uuid not null references public.rift_agents (id) on delete cascade,
  lead_id       uuid references public.rift_leads (id) on delete cascade,
  channel       text not null check (channel in ('email')),
  purpose       text not null check (purpose in ('program-alert')),
  to_address    text not null check (length(to_address) between 3 and 200),
  to_name       text check (to_name is null or length(to_name) <= 120),
  subject       text not null check (length(btrim(subject)) between 1 and 200),
  body          text not null check (length(btrim(body)) between 1 and 5000),
  content_hash  text not null check (length(content_hash) = 64),
  replaces      uuid references public.rift_outbox (id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists rift_outbox_agent_idx on public.rift_outbox (agent_id, created_at desc);

create table if not exists public.rift_outbox_events (
  id          uuid primary key default gen_random_uuid(),
  agent_id    uuid not null references public.rift_agents (id) on delete cascade,
  outbox_id   uuid not null references public.rift_outbox (id) on delete cascade,
  state       text not null check (state in ('prepared', 'approved', 'running', 'succeeded', 'failed', 'unknown', 'cancelled')),
  at          timestamptz not null default now(),
  by_name     text not null check (length(btrim(by_name)) between 1 and 120),
  -- The content hash an approval covers, required on approval (AUTO-01).
  hash        text check (hash is null or length(hash) = 64),
  detail      text check (detail is null or length(detail) <= 300),
  constraint rift_outbox_events_approval_names_content check (state <> 'approved' or hash is not null)
);
create index if not exists rift_outbox_events_idx on public.rift_outbox_events (outbox_id, at);

create or replace function public.rift_outbox_history() returns trigger
language plpgsql as $$
begin
  raise exception '% is history and cannot be edited; record a new row', tg_table_name
    using errcode = 'check_violation';
end $$;

drop trigger if exists rift_outbox_is_history on public.rift_outbox;
create trigger rift_outbox_is_history before update on public.rift_outbox
  for each row execute function public.rift_outbox_history();
drop trigger if exists rift_outbox_events_are_history on public.rift_outbox_events;
create trigger rift_outbox_events_are_history before update on public.rift_outbox_events
  for each row execute function public.rift_outbox_history();

do $$
declare t text;
begin
  foreach t in array array['rift_outbox', 'rift_outbox_events'] loop
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
    revoke execute on function public.rift_outbox_history() from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke execute on function public.rift_outbox_history() from authenticated;
  end if;
end $$;

comment on table public.rift_outbox is 'A prepared message waiting for, or past, the agent''s approval. Never edited; a change is a new row.';
comment on table public.rift_outbox_events is 'Each step of an outbox message. The latest is its state; an approval names the exact content hash it covers.';

commit;
