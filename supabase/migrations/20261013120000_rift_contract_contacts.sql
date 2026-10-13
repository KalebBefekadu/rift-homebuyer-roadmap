-- Who to ask about a contract's workstream, and check-ins through the
-- outbox (audit portals-2026-10, decision 3).
--
-- "Draft the check-in" opened the agent's own mail with an empty "To",
-- because no lender's or attorney's address was stored anywhere. One row per
-- address given for a workstream on a contract; the newest is current. Never
-- edited: a changed address is a new row, like the workstream updates.
--
-- An address here is a professional's work address, given by the agent. It
-- is never shown to the household (lib/db/portal.ts selects nothing from
-- this table) and it is erased with the journey.
create table if not exists public.rift_contract_contacts (
  id             uuid primary key default gen_random_uuid(),
  agent_id       uuid not null references public.rift_agents (id) on delete cascade,
  journey_id     uuid not null references public.rift_journeys (id) on delete cascade,
  transaction_id uuid not null references public.rift_transactions (id) on delete cascade,
  workstream     text not null check (workstream in (
    'earnest-money', 'inspection', 'financing', 'appraisal', 'title', 'insurance',
    'repairs', 'walkthrough', 'closing', 'possession')),
  name           text check (name is null or length(btrim(name)) between 1 and 160),
  email          text not null check (length(email) between 3 and 200 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  created_at     timestamptz not null default now()
);
create index if not exists rift_contract_contacts_tx_idx on public.rift_contract_contacts (transaction_id, workstream, created_at desc);

drop trigger if exists rift_contract_contacts_are_history on public.rift_contract_contacts;
create trigger rift_contract_contacts_are_history before update on public.rift_contract_contacts
  for each row execute function public.rift_offers_are_history();

alter table public.rift_contract_contacts enable row level security;
drop policy if exists rift_contract_contacts_agent on public.rift_contract_contacts;
create policy rift_contract_contacts_agent on public.rift_contract_contacts for all to public
  using (agent_id = (select public.rift_my_agent_id()))
  with check (agent_id = (select public.rift_my_agent_id()));

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.rift_contract_contacts from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on public.rift_contract_contacts from authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert, delete on public.rift_contract_contacts to service_role;
  end if;
end $$;

-- A check-in is the outbox's second purpose. It has no lead: it goes to a
-- professional, so the last check before sending is the opt-out list and
-- the approval, not the client's replies.
alter table public.rift_outbox drop constraint if exists rift_outbox_purpose_check;
alter table public.rift_outbox add constraint rift_outbox_purpose_check
  check (purpose in ('program-alert', 'check-in'));

comment on table public.rift_contract_contacts is
  'A professional''s address for a contract workstream, given by the agent, for check-ins through the outbox. Never shown to the household.';
