-- ============================================================================
-- Nurture enrolments, sent touches, and the review queue.
--
-- Additive to 20260907000000_rift_core.sql.
--
-- Two rules are enforced here rather than in application code, because both
-- fail as something a person receives rather than as an error:
--
--   * a touch is recorded once per step per enrolment, so a retry, a double
--     cron fire, or two workers cannot send the same email twice;
--   * nothing reaches `verified` without a named party.
-- ============================================================================

create table if not exists rift_enrolments (
  id           uuid primary key default gen_random_uuid(),
  agent_id     uuid not null references rift_agents(id) on delete cascade,
  lead_id      uuid not null references rift_leads(id) on delete cascade,
  band         text not null check (band in ('now','soon','later','nurture')),
  entered_at   timestamptz not null default now(),
  -- Set the moment any stop condition fires. A live enrolment has none.
  stopped_at   timestamptz,
  stop_reason  text check (stop_reason in ('replied','booked','converted','declined','unsubscribed','bounced')),
  -- Written phone consent gates the channel, never the sequence.
  phone_consent boolean not null default false,
  constraint stop_needs_a_reason check ((stopped_at is null) = (stop_reason is null)),
  -- One live enrolment per lead. Two would send everything twice.
  unique (lead_id)
);
create index if not exists rift_enrolments_due_idx on rift_enrolments (agent_id, stopped_at, entered_at);

create table if not exists rift_touches (
  id            uuid primary key default gen_random_uuid(),
  enrolment_id  uuid not null references rift_enrolments(id) on delete cascade,
  step_id       text not null,
  -- The channel actually used, which may differ from the step's when consent
  -- is missing. The reason is data, not a log line an operator has to go and find.
  channel       text not null check (channel in ('email','text','call','task')),
  downgraded_reason text,
  sent_at       timestamptz not null default now(),
  outcome       text not null default 'sent' check (outcome in ('sent','skipped','failed')),
  detail        text,
  -- The idempotency guarantee. A retry or a second cron worker cannot send the
  -- same step twice, and this is the only place that can promise it.
  unique (enrolment_id, step_id)
);

create table if not exists rift_review_items (
  id           uuid primary key default gen_random_uuid(),
  agent_id     uuid not null references rift_agents(id) on delete cascade,
  readout_id   uuid references rift_readouts(id) on delete set null,
  who          text not null,
  kind         text not null check (kind in ('figure','document','program','plan')),
  what         text not null,
  claim        text not null,
  state        text not null default 'pending-review'
                 check (state in ('preliminary','pending-review','reviewed','verified')),
  ceiling      text not null default 'verified'
                 check (ceiling in ('preliminary','pending-review','reviewed','verified')),
  raised_by    text not null check (raised_by in ('client','agent','system')),
  to_advance   text not null,
  confirmed_by text,
  raised_at    timestamptz not null default now(),
  resolved_at  timestamptz,
  constraint review_verified_needs_a_name check (state <> 'verified' or confirmed_by is not null)
);
create index if not exists rift_review_open_idx on rift_review_items (agent_id, state, raised_at);

alter table rift_enrolments  enable row level security;
alter table rift_touches     enable row level security;
alter table rift_review_items enable row level security;

drop policy if exists rift_enrolments_owner on rift_enrolments;
create policy rift_enrolments_owner on rift_enrolments for all
  using (agent_id = rift_my_agent_id()) with check (agent_id = rift_my_agent_id());

drop policy if exists rift_review_items_owner on rift_review_items;
create policy rift_review_items_owner on rift_review_items for all
  using (agent_id = rift_my_agent_id()) with check (agent_id = rift_my_agent_id());

drop policy if exists rift_touches_owner on rift_touches;
create policy rift_touches_owner on rift_touches for all
  using (exists (select 1 from rift_enrolments e where e.id = enrolment_id and e.agent_id = rift_my_agent_id()))
  with check (exists (select 1 from rift_enrolments e where e.id = enrolment_id and e.agent_id = rift_my_agent_id()));
