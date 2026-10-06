-- Emails telling a client something new is waiting in their portal (manual
-- review WS11.5).
--
-- Nothing told a client that a home, an offer to answer, their priorities or
-- a pricing opinion had been shared, so they had to remember to look. Each
-- notice is a row: who it went to, what it was about, and whether it was
-- sent. The rows are also the throttle: one email per person per kind of
-- thing in a window (lib/core/notice.ts), so adding six homes in a row is one
-- email, not six.
--
-- No content: the email names the kind of thing and links to the portal,
-- never an address or a price, so nothing here is more than "we told them".
-- History, never edited; erased with the journey.
create table if not exists public.rift_client_notices (
  id          uuid primary key default gen_random_uuid(),
  agent_id    uuid not null references public.rift_agents (id) on delete cascade,
  journey_id  uuid not null references public.rift_journeys (id) on delete cascade,
  member_id   uuid not null references public.rift_journey_members (id) on delete cascade,
  kind        text not null check (kind in ('home', 'offer', 'priorities', 'pricing', 'proceeds')),
  outcome     text not null check (outcome in ('sent', 'skipped', 'failed')),
  created_at  timestamptz not null default now()
);
create index if not exists rift_client_notices_member_idx on public.rift_client_notices (member_id, kind, created_at desc);

drop trigger if exists rift_client_notices_are_history on public.rift_client_notices;
create trigger rift_client_notices_are_history before update on public.rift_client_notices
  for each row execute function public.rift_offers_are_history();

alter table public.rift_client_notices enable row level security;
drop policy if exists rift_client_notices_agent on public.rift_client_notices;
create policy rift_client_notices_agent on public.rift_client_notices for all to public
  using (agent_id = (select public.rift_my_agent_id()))
  with check (agent_id = (select public.rift_my_agent_id()));

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.rift_client_notices from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on public.rift_client_notices from authenticated;
    grant select on public.rift_client_notices to authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert, delete on public.rift_client_notices to service_role;
  end if;
end $$;

-- The client's own switch. Default on: they were invited to follow their own
-- move. Off is respected for every kind; the account page sets it.
alter table public.rift_journey_members add column if not exists notices boolean not null default true;

comment on table public.rift_client_notices is
  'An email telling a household member something new is in their portal (manual review WS11.5). Kind only, never content.';
