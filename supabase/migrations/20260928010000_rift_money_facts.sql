-- ============================================================================
-- Money v2: recorded money facts (Blueprint v5 §10.1, MONEY-01, MONEY-03).
--
--   rift_money_facts   an amount the agent recorded for a journey, from a
--                      named source on a stated day: the contract price, the
--                      earnest money, the lender's closing costs, a seller
--                      credit, assistance once approved, the cash to close on
--                      the closing disclosure. History only; the latest of
--                      each kind is the one in use.
--
-- Amounts are whole cents and never negative: a credit is a credit because of
-- its kind. The rules are lib/core/ledger.ts; the only writer is
-- lib/db/money.ts. Deleting the journey deletes its facts.
-- ============================================================================

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table if not exists public.rift_money_facts (
  id           uuid primary key default gen_random_uuid(),
  agent_id     uuid not null references public.rift_agents (id) on delete cascade,
  journey_id   uuid not null references public.rift_journeys (id) on delete cascade,
  kind         text not null check (kind in (
                 'price', 'earnest', 'inspection', 'appraisal', 'closing-costs', 'prepaids',
                 'seller-credit', 'assistance-approved', 'moving', 'official-cash-to-close')),
  amount_cents bigint not null check (amount_cents between 0 and 2000000000),
  source       text not null check (length(btrim(source)) between 3 and 160),
  as_of        date not null,
  actor_label  text not null check (length(btrim(actor_label)) between 1 and 120),
  request_id   uuid not null,
  created_at   timestamptz not null default now(),
  constraint rift_money_facts_request unique (agent_id, request_id),
  constraint rift_money_facts_not_future check (as_of <= (created_at at time zone 'America/New_York')::date)
);
create index if not exists rift_money_facts_journey_idx on public.rift_money_facts (journey_id, created_at);

create or replace function public.rift_money_facts_history() returns trigger
language plpgsql as $$
begin
  raise exception 'rift_money_facts is history and cannot be edited; record the new amount'
    using errcode = 'check_violation';
end $$;

drop trigger if exists rift_money_facts_are_history on public.rift_money_facts;
create trigger rift_money_facts_are_history before update on public.rift_money_facts
  for each row execute function public.rift_money_facts_history();

alter table public.rift_money_facts enable row level security;
drop policy if exists rift_money_facts_agent on public.rift_money_facts;
create policy rift_money_facts_agent on public.rift_money_facts for all to public
  using (agent_id = (select public.rift_my_agent_id())) with check (agent_id = (select public.rift_my_agent_id()));

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.rift_money_facts from anon;
    revoke execute on function public.rift_money_facts_history() from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on public.rift_money_facts from authenticated;
    grant select on public.rift_money_facts to authenticated;
    revoke execute on function public.rift_money_facts_history() from authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert on public.rift_money_facts to service_role;
  end if;
end $$;

comment on table public.rift_money_facts is 'Money amounts the agent recorded for a journey, each from a named source on a stated day. History only; the latest per kind is in use.';

commit;
