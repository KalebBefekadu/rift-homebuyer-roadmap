-- Whether an offer that came in through the form has been answered, and by
-- when it must be.
--
-- Operations inferred "Replied" from the lead behind the offer having any
-- human reply since it arrived. An offer answered by phone, or from an
-- address the form never matched to a lead, stayed "Needs a reply" for ever,
-- and nothing recorded the sender's response deadline at all, so the board
-- could not put the urgent one first.
--
-- History, like the offers themselves: never edited. The newest row for an
-- offer is its state, and the rows before it say who changed it and when.
-- Removing the offer removes its rows (a person's "delete all of it").
create table if not exists public.rift_offer_answers (
  id          uuid primary key default gen_random_uuid(),
  agent_id    uuid not null references public.rift_agents (id) on delete cascade,
  offer_id    uuid not null references public.rift_offers (id) on delete cascade,
  answered    boolean not null,
  respond_by  date,
  actor_label text not null check (length(actor_label) between 1 and 200),
  created_at  timestamptz not null default now()
);
create index if not exists rift_offer_answers_offer_idx on public.rift_offer_answers (offer_id, created_at desc);

drop trigger if exists rift_offer_answers_are_history on public.rift_offer_answers;
create trigger rift_offer_answers_are_history before update on public.rift_offer_answers
  for each row execute function public.rift_offers_are_history();

alter table public.rift_offer_answers enable row level security;
drop policy if exists rift_offer_answers_agent on public.rift_offer_answers;
create policy rift_offer_answers_agent on public.rift_offer_answers for all to public
  using (agent_id = (select public.rift_my_agent_id()))
  with check (agent_id = (select public.rift_my_agent_id()));

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.rift_offer_answers from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on public.rift_offer_answers from authenticated;
    grant select on public.rift_offer_answers to authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert, delete on public.rift_offer_answers to service_role;
  end if;
end $$;
