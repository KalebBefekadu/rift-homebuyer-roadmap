-- ============================================================================
-- The offer room: the agent's take on a seller's offers, and the seller's
-- choice between them. Benchmark 2.2, prepare-then-approve.
--
-- One row per seller. Two halves, each written whole or not at all:
--
--   THE TAKE. `prepared` is Rift's draft exactly as it stood when the agent
--   approved; `take` is what he approved; `approved_for` is the set of released
--   offers it was written about. Stored together so the difference between
--   what the software drafted and what the agent said is a recorded fact
--   rather than a claim — which is what 2.2 asks for.
--
--   THE CHOICE. Which released offer the seller said they want, when, and a
--   snapshot of what they were shown (computed on the server, never sent by
--   the browser). Not an acceptance — the page says so — but a record that
--   survives the question "which one did they tell you they wanted?"
-- ============================================================================

-- The target of the composite key below. `id` is already unique; this pairs it
-- with its seller so a choice can only name an offer ON THIS SELLER.
create unique index if not exists rift_offers_id_lead_key on rift_offers (id, lead_id);

create table if not exists rift_offer_rooms (
  lead_id      uuid primary key references rift_leads(id) on delete cascade,
  agent_id     uuid not null references rift_agents(id) on delete cascade,

  prepared     text check (prepared is null or length(prepared) <= 4000),
  take         text check (take is null or length(btrim(take)) between 1 and 2000),
  approved_at  timestamptz,
  approved_for uuid[],

  chosen_offer_id uuid,
  chosen_at       timestamptz,
  chosen_seen     jsonb,
  client_note     text check (client_note is null or length(client_note) <= 1000),

  updated_at   timestamptz not null default now()
);

do $$
begin
  -- An approval is the take, the draft it came from, the moment and the offers
  -- it covers. Any one without the others is a take nobody can audit.
  if not exists (select 1 from pg_constraint where conname = 'rift_offer_rooms_approval_is_whole') then
    alter table rift_offer_rooms add constraint rift_offer_rooms_approval_is_whole
      check (
        (approved_at is null) = (take is null)
        and (approved_at is null) = (prepared is null)
        and (approved_at is null) = (approved_for is null)
      );
  end if;

  if not exists (select 1 from pg_constraint where conname = 'rift_offer_rooms_choice_is_whole') then
    alter table rift_offer_rooms add constraint rift_offer_rooms_choice_is_whole
      check (
        (chosen_offer_id is null) = (chosen_at is null)
        and (chosen_at is null) = (chosen_seen is null)
        and (client_note is null or chosen_offer_id is not null)
      );
  end if;

  -- COMPOSITE, and NO ACTION rather than SET NULL or RESTRICT.
  --
  -- Composite so the choice cannot name an offer on somebody else's house.
  -- Not SET NULL, because on a composite key that nulls every column in it —
  -- including lead_id, the primary key (the decisions migration learned that).
  -- Not RESTRICT, which is checked mid-cascade: forgetting a seller deletes
  -- both their offers and this row, and RESTRICT can fire between the two.
  -- NO ACTION is checked at the end of the statement, after the cascade.
  if not exists (select 1 from pg_constraint where conname = 'rift_offer_rooms_chosen_is_theirs') then
    alter table rift_offer_rooms add constraint rift_offer_rooms_chosen_is_theirs
      foreign key (chosen_offer_id, lead_id)
      references rift_offers (id, lead_id)
      on delete no action;
  end if;
end $$;

-- A seller can only choose what they can see.
create or replace function rift_offer_room_choice_is_released() returns trigger
language plpgsql as $$
begin
  if new.chosen_offer_id is not null
     and new.chosen_offer_id is distinct from coalesce(old.chosen_offer_id, '00000000-0000-0000-0000-000000000000'::uuid)
     and not exists (
       select 1 from rift_offers where id = new.chosen_offer_id and released_at is not null
     ) then
    raise exception 'offer % has not been released to the seller', new.chosen_offer_id
      using errcode = 'check_violation';
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists rift_offer_room_choice_is_released on rift_offer_rooms;
create trigger rift_offer_room_choice_is_released
  before insert or update on rift_offer_rooms
  for each row execute function rift_offer_room_choice_is_released();

-- And an offer they chose cannot quietly vanish from their page. Withdrawing
-- it would leave a recorded choice pointing at something the seller can no
-- longer see; the agent reopens the choice first, on purpose.
create or replace function rift_offer_chosen_stays_released() returns trigger
language plpgsql as $$
begin
  if old.released_at is not null and new.released_at is null
     and exists (select 1 from rift_offer_rooms where chosen_offer_id = old.id) then
    raise exception 'the seller chose this offer; reopen their choice before withdrawing it'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists rift_offer_chosen_stays_released on rift_offers;
create trigger rift_offer_chosen_stays_released
  before update of released_at on rift_offers
  for each row execute function rift_offer_chosen_stays_released();

create index if not exists rift_offer_rooms_chosen_idx
  on rift_offer_rooms (agent_id, chosen_at desc) where chosen_offer_id is not null;

alter table rift_offer_rooms enable row level security;

drop policy if exists rift_offer_rooms_owner on rift_offer_rooms;
create policy rift_offer_rooms_owner on rift_offer_rooms
  for all using (agent_id = rift_my_agent_id()) with check (agent_id = rift_my_agent_id());

comment on table rift_offer_rooms is
  'The agent''s approved take on a seller''s released offers, and the seller''s recorded choice. Benchmark 2.2.';
comment on column rift_offer_rooms.prepared is
  'Rift''s draft as it stood at approval. Never shown to the client; kept so the edit is auditable.';
comment on column rift_offer_rooms.chosen_seen is
  'What the seller was shown when they chose, computed server-side. Not an acceptance.';
