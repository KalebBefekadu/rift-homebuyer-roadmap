-- Decision Rooms.
--
-- docs/benchmark.md scores criterion 4.3 at 0 in production. Not weak —
-- absent. The prototype has /app/decisions and a decision room; the shipped
-- product had no surface at all, and the criterion asks for rooms "at the
-- moments where clients actually stall, with scenarios and recorded outcomes".

create table if not exists rift_decisions (
  id          uuid primary key default gen_random_uuid(),
  agent_id    uuid not null references rift_agents(id) on delete cascade,
  lead_id     uuid not null references rift_leads(id) on delete cascade,

  kind        text not null default 'other'
              check (kind in ('affordability','offers','property','timing','other')),

  -- Written for the client to read, like a plan item. Bounded because it
  -- renders as a heading on their page and a paragraph in a heading slot is a
  -- paragraph nobody reads.
  question    text not null check (length(btrim(question)) between 5 and 200),

  -- The agent's framing. Optional, because a room with two clearly labelled
  -- options sometimes needs no preamble, and requiring one produces preamble.
  context     text check (context is null or length(btrim(context)) > 0),

  decide_by   date,

  -- Prepare-then-approve, criterion 2.2. NULL means the client cannot see it.
  -- Not a boolean: when it was released is the part that matters afterwards.
  released_at timestamptz,

  -- The recorded outcome. An outcome is a fact, not a state — which option,
  -- when, and in whose words.
  decided_at       timestamptz,
  chosen_option_id uuid,
  outcome_note     text,

  created_at  timestamptz not null default now()
);

create table if not exists rift_decision_options (
  id            uuid primary key default gen_random_uuid(),
  agent_id      uuid not null references rift_agents(id) on delete cascade,
  decision_id   uuid not null references rift_decisions(id) on delete cascade,

  label         text not null check (length(btrim(label)) between 1 and 120),
  detail        text,

  -- CENTS. These are money and a float is not money; the rest of this schema
  -- stores money the same way for the same reason.
  --
  -- NULL is meaningful and is not zero: "sell first, then buy" has no figure,
  -- and lib/core/decision.ts refuses to release a room where some options
  -- carry one and others do not, because side by side an option with no number
  -- reads as one that costs nothing.
  amount_cents  bigint,

  -- What that number IS: "would reach you", "a month", "at the table". Two
  -- options labelled differently are different quantities in the same column,
  -- and canRelease() refuses that too.
  amount_label  text,

  upside        text,
  downside      text,

  -- The agent's order. Never the amount: the largest number is not the best
  -- option, which is the entire point of headlineTrap in lib/core/offers.ts.
  sort          integer not null default 0,

  created_at    timestamptz not null default now()
);

-- A figure needs to say what it is. A bare number in a comparison column is
-- the reader's guess about what they are comparing.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'rift_decision_options_amount_is_labelled') then
    alter table rift_decision_options add constraint rift_decision_options_amount_is_labelled
      check (amount_cents is null or length(btrim(coalesce(amount_label,''))) > 0);
  end if;
end $$;

-- The chosen option must belong to this decision.
--
-- A plain foreign key to rift_decision_options would let a decision be
-- recorded against an option from a DIFFERENT room — which renders as a
-- perfectly ordinary outcome naming an option the reader cannot see. The
-- composite key makes that unrepresentable.
create unique index if not exists rift_decision_options_scoped_idx
  on rift_decision_options (id, decision_id);

-- ON DELETE RESTRICT, and the alternative is worth recording because it was
-- written first and is a trap.
--
-- `on delete set null` here does NOT null only chosen_option_id. A composite
-- foreign key sets EVERY column in the key to null, and the second column of
-- this one is rift_decisions.id — the primary key. Deleting an option that a
-- decision named failed with "null value in column id violates not-null
-- constraint", which is the good outcome; the bad one was available on
-- Postgres 15+ as `set null (chosen_option_id)`, and writing version-specific
-- syntax into a migration applied by hand to a database whose version nobody
-- has checked is how a migration half-applies.
--
-- RESTRICT is also the better rule. An option a recorded decision names is
-- part of the record of what was decided, and quietly removable evidence is
-- not evidence. Reopen the decision first — which clears the reference — and
-- then the option can go.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'rift_decisions_chosen_is_ours') then
    alter table rift_decisions add constraint rift_decisions_chosen_is_ours
      foreign key (chosen_option_id, id)
      references rift_decision_options (id, decision_id)
      on delete restrict
      deferrable initially deferred;
  end if;
end $$;

-- An outcome has a time and an option, or it has neither. Half an outcome is
-- a room that says a decision was made without saying what it was.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'rift_decisions_outcome_is_whole') then
    alter table rift_decisions add constraint rift_decisions_outcome_is_whole
      check ((decided_at is null) = (chosen_option_id is null));
  end if;
end $$;

create index if not exists rift_decisions_lead_idx
  on rift_decisions (lead_id, created_at desc);

-- The client's own read: released rooms for one relationship.
create index if not exists rift_decisions_released_idx
  on rift_decisions (lead_id, released_at) where released_at is not null;

create index if not exists rift_decision_options_decision_idx
  on rift_decision_options (decision_id, sort);

alter table rift_decisions        enable row level security;
alter table rift_decision_options enable row level security;

drop policy if exists rift_decisions_owner on rift_decisions;
create policy rift_decisions_owner on rift_decisions
  for all using (agent_id = rift_my_agent_id()) with check (agent_id = rift_my_agent_id());

drop policy if exists rift_decision_options_owner on rift_decision_options;
create policy rift_decision_options_owner on rift_decision_options
  for all using (agent_id = rift_my_agent_id()) with check (agent_id = rift_my_agent_id());

comment on column rift_decisions.released_at is
  'NULL means the client cannot see this room. Prepare-then-approve, benchmark 2.2.';

comment on column rift_decision_options.amount_cents is
  'NULL is "this option has no figure", which is not zero. See canRelease() in lib/core/decision.ts.';
