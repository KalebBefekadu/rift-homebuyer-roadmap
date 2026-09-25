-- AI cost controls, AUTO-06 and decision D16 (Blueprint v5 §10.2).
--
-- One row per AI call, written BEFORE the call as a reservation at its worst
-- case and settled afterwards at what it actually cost. The monthly limit is
-- the sum of this table for the month, reservations included, so two calls
-- racing each other cannot both spend the last of the money. Running out
-- means the page offers manual entry; nothing is ever lost because the budget
-- is spent (AT38).
--
-- Model and prompt version are recorded on every row so any output can be
-- traced to what produced it. No document content, no extracted values and no
-- personal data are stored here: only what the call cost.

create table if not exists public.rift_ai_usage (
  id              uuid primary key default gen_random_uuid(),
  agent_id        uuid not null references public.rift_agents(id) on delete restrict,
  workflow        text not null check (workflow ~ '^[a-z][a-z0-9-]{1,40}$'),
  model           text not null check (length(model) between 3 and 80),
  prompt_version  text not null check (length(prompt_version) between 1 and 40),
  status          text not null check (status in ('reserved', 'spent', 'failed')),
  -- US cents, fractional: a small call costs well under one cent.
  reserved_cents  numeric(12, 4) not null check (reserved_cents >= 0),
  cost_cents      numeric(12, 4) check (cost_cents is null or cost_cents >= 0),
  input_tokens    integer check (input_tokens is null or input_tokens >= 0),
  output_tokens   integer check (output_tokens is null or output_tokens >= 0),
  created_at      timestamptz not null default now(),
  settled_at      timestamptz
);

create index if not exists rift_ai_usage_month_idx on public.rift_ai_usage (agent_id, created_at);

alter table public.rift_ai_usage enable row level security;

-- The agent can see what AI has cost; only the server writes (service role).
drop policy if exists rift_ai_usage_agent_read on public.rift_ai_usage;
create policy rift_ai_usage_agent_read on public.rift_ai_usage
  for select to public
  using (agent_id = (select public.rift_my_agent_id()));
