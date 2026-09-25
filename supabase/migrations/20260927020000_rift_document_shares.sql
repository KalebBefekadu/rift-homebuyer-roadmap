-- Documents shared with the household (Blueprint v5 §7.2: "every document
-- shared with them in one place, not only through offers").
--
-- History, never edited: each row is one decision by the agent about one
-- document, and the latest row for a document is the one that holds.
-- 'household' is everyone on the journey; 'money' is only members who were
-- given the money scope, the same line the offers already draw; 'none'
-- withdraws a share. Withdrawing stops new links being minted; it cannot
-- recall a copy somebody already saved, and the agent's screen says so.
--
-- Cascades with the document, and the document with its journey, so "delete
-- all of it" removes these with everything else.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table if not exists public.rift_document_shares (
  id           uuid primary key default gen_random_uuid(),
  agent_id     uuid not null references public.rift_agents(id) on delete restrict,
  journey_id   uuid not null,
  document_id  uuid not null,
  audience     text not null check (audience in ('household', 'money', 'none')),
  actor_label  text not null check (length(btrim(actor_label)) between 1 and 120),
  created_at   timestamptz not null default now(),
  constraint rift_document_shares_document
    foreign key (document_id, journey_id) references public.rift_documents (id, journey_id) on delete cascade
);
create index if not exists rift_document_shares_journey_idx on public.rift_document_shares (journey_id, created_at);

create or replace function public.rift_document_share_is_history() returns trigger
language plpgsql as $$
begin
  raise exception 'a share decision is history and cannot be edited; record a new one'
    using errcode = 'check_violation';
end $$;

drop trigger if exists rift_document_share_is_history on public.rift_document_shares;
create trigger rift_document_share_is_history
  before update on public.rift_document_shares
  for each row execute function public.rift_document_share_is_history();

alter table public.rift_document_shares enable row level security;

drop policy if exists rift_document_shares_agent on public.rift_document_shares;
create policy rift_document_shares_agent on public.rift_document_shares
  for all to public
  using (agent_id = (select public.rift_my_agent_id()))
  with check (agent_id = (select public.rift_my_agent_id()));

commit;
