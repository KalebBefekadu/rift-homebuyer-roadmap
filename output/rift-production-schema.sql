-- ============================================================
-- Rift — complete schema, in order.
-- Paste into the Supabase SQL editor and run. Idempotent.
-- Generated 2026-09-08T05:10:41Z
-- ============================================================


-- ---------- 20260907000000_rift_core.sql ----------

-- ============================================================================
-- Rift core schema — phase 1
--
-- Additive. The retired portal MVP's tables (clients, roadmaps, dpa_programs,
-- agents_settings) are applied to this project and are left alone; Rift's
-- tables live alongside them under the rift_ prefix until the old ones can be
-- dropped. Nothing here reads or writes them.
--
-- Everything in docs/schema.md that is load-bearing is enforced here rather
-- than in application code, because each of these fails as a WRONG NUMBER in
-- front of a person rather than as an error:
--
--   * a custom funnel question can never feed a calculation
--   * first touch is written once and never updated
--   * a figure cannot be "verified" without a named party
--   * a telemetry event can never carry an answer value
--
-- Every table gets its RLS policy in this same migration. A table shipped
-- without one is either wide open or unreadable, and both are found in
-- production.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Identity and configuration
-- ---------------------------------------------------------------------------

create table if not exists rift_agents (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid unique references auth.users(id) on delete cascade,
  name          text not null,
  brokerage     text,
  license       text,
  email         text not null,
  phone         text,
  service_area  text[] not null default '{}',
  created_at    timestamptz not null default now()
);

-- The six decisions that are the business owner's, not engineering's.
-- `decided_at` is null while a rule is still on its default: a rule somebody
-- chose and a rule nobody has looked at must be distinguishable.
create table if not exists rift_business_rules (
  agent_id    uuid not null references rift_agents(id) on delete cascade,
  key         text not null,
  value       jsonb not null,
  decided_at  timestamptz,
  decided_by  text,
  updated_at  timestamptz not null default now(),
  primary key (agent_id, key)
);

-- ---------------------------------------------------------------------------
-- The funnel
-- ---------------------------------------------------------------------------

create table if not exists rift_funnels (
  id          uuid primary key default gen_random_uuid(),
  agent_id    uuid not null references rift_agents(id) on delete cascade,
  side        text not null check (side in ('buy','sell')),
  version     integer not null default 1,
  created_at  timestamptz not null default now(),
  unique (agent_id, side)
);

-- Published versions are immutable. Editing produces a new row, never an
-- update, because a lead is pinned to the version it actually answered and a
-- retroactive edit would rewrite what a person was asked.
create table if not exists rift_funnel_versions (
  id           uuid primary key default gen_random_uuid(),
  funnel_id    uuid not null references rift_funnels(id) on delete cascade,
  version      integer not null,
  published_at timestamptz not null default now(),
  changed_by   text,
  change_note  text,
  unique (funnel_id, version)
);

create table if not exists rift_questions (
  id                 uuid primary key default gen_random_uuid(),
  funnel_version_id  uuid not null references rift_funnel_versions(id) on delete cascade,
  key                text not null,
  kind               text not null check (kind in ('core','custom')),
  -- The compute input this question feeds. Core questions name one; custom
  -- questions must not, and the constraint below is why an agent can invent
  -- questions without being able to break anybody's numbers.
  bound              text,
  type               text not null check (type in ('choice','number','slider','text','money')),
  title              text not null,
  description        text,
  field_label        text,
  unit               text,
  options            jsonb not null default '[]'::jsonb,
  required           boolean not null default false,
  enabled            boolean not null default true,
  sort_order         integer not null default 0,
  unique (funnel_version_id, key),
  constraint custom_questions_are_inert check (kind = 'core' or bound is null),
  constraint core_questions_are_bound  check (kind = 'custom' or bound is not null)
);

-- ---------------------------------------------------------------------------
-- Assessment and capture
-- ---------------------------------------------------------------------------

create table if not exists rift_assessments (
  id                 uuid primary key default gen_random_uuid(),
  agent_id           uuid not null references rift_agents(id) on delete cascade,
  session_id         text not null,
  side               text not null check (side in ('buy','sell')),
  funnel_version_id  uuid references rift_funnel_versions(id) on delete set null,
  started_at         timestamptz not null default now(),
  completed_at       timestamptz,
  -- Abandoned assessments are most of the value here, so they are first-class
  -- rows rather than rows we forgot to delete.
  abandoned_at       timestamptz,
  county             text,
  created_at         timestamptz not null default now()
);
create index if not exists rift_assessments_agent_idx   on rift_assessments (agent_id, started_at desc);
create index if not exists rift_assessments_session_idx on rift_assessments (session_id);

create table if not exists rift_answers (
  id             uuid primary key default gen_random_uuid(),
  assessment_id  uuid not null references rift_assessments(id) on delete cascade,
  question_key   text not null,
  value          jsonb not null,
  answered_at    timestamptz not null default now(),
  unique (assessment_id, question_key)
);

-- Telemetry lives apart from answers, permanently, with its own retention.
-- The moment one query can join an event to the value that was typed, funnel
-- analytics becomes a dossier — so the payload is forbidden from carrying one.
create table if not exists rift_events (
  id             bigserial primary key,
  agent_id       uuid not null references rift_agents(id) on delete cascade,
  session_id     text not null,
  name           text not null,
  side           text check (side in ('buy','sell')),
  question_key   text,
  dwell_ms       integer,
  payload        jsonb not null default '{}'::jsonb,
  at             timestamptz not null default now(),
  constraint events_carry_no_answer check (
    not (payload ? 'value' or payload ? 'answer' or payload ? 'input')
  )
);
create index if not exists rift_events_agent_idx    on rift_events (agent_id, at desc);
create index if not exists rift_events_session_idx  on rift_events (session_id);
create index if not exists rift_events_question_idx on rift_events (question_key, name);

-- First touch never moves. Enforced by trigger rather than by application
-- code: an agent who re-attributes a referral to the retargeting ad that
-- caught it on the way back will keep buying retargeting and stop asking for
-- referrals. Referring HOST only — no path, no IP, no fingerprint.
create table if not exists rift_attributions (
  session_id        text primary key,
  agent_id          uuid not null references rift_agents(id) on delete cascade,
  first_source      text,
  first_medium      text,
  first_campaign    text,
  first_referrer    text,
  first_landing     text,
  first_at          timestamptz not null default now(),
  last_source       text,
  last_medium       text,
  last_campaign     text,
  last_referrer     text,
  last_landing      text,
  last_at           timestamptz not null default now(),
  visits            integer not null default 1
);

create or replace function rift_reject_first_touch_change()
returns trigger language plpgsql as $$
begin
  if new.first_source   is distinct from old.first_source
  or new.first_medium   is distinct from old.first_medium
  or new.first_campaign is distinct from old.first_campaign
  or new.first_referrer is distinct from old.first_referrer
  or new.first_landing  is distinct from old.first_landing
  or new.first_at       is distinct from old.first_at then
    raise exception 'first touch is immutable (session %)', old.session_id;
  end if;
  return new;
end $$;

drop trigger if exists rift_first_touch_immutable on rift_attributions;
create trigger rift_first_touch_immutable
  before update on rift_attributions
  for each row execute function rift_reject_first_touch_change();

-- The wording is stored, not referenced. Wording changes; what somebody
-- agreed to does not.
create table if not exists rift_consents (
  id             uuid primary key default gen_random_uuid(),
  agent_id       uuid not null references rift_agents(id) on delete cascade,
  assessment_id  uuid references rift_assessments(id) on delete set null,
  kind           text not null check (kind in ('email','phone')),
  wording        text not null,
  version        text not null,
  granted        boolean not null,
  ip             inet,
  user_agent     text,
  at             timestamptz not null default now()
);
create index if not exists rift_consents_agent_idx on rift_consents (agent_id, at desc);

-- ---------------------------------------------------------------------------
-- Programme registry
-- ---------------------------------------------------------------------------

create table if not exists rift_programs (
  id                uuid primary key default gen_random_uuid(),
  slug              text unique not null,
  name              text not null,
  administrator     text not null,
  type              text not null check (type in ('grant','forgivable','deferred','second-lien')),
  funding_state     text not null default 'open' check (funding_state in ('open','waitlist','closed')),
  amount_min        integer not null,
  amount_max        integer not null,
  -- Null means statewide. One county per row, mirroring `AssistanceProgram` in
  -- lib/core/registry.ts exactly: a text[] here would model reality slightly
  -- better and would buy a permanent mapping layer between the database and the
  -- engine that reads it. One shape, one truth. Widen it deliberately if a
  -- programme genuinely needs a list, and widen the domain type in the same
  -- change.
  county            text,
  first_time_only   boolean not null default false,
  -- When a closed or waitlisted programme is expected to reopen. Shown to the
  -- customer WITH its state rather than hidden, because somebody planning
  -- around money that is not currently available needs to know.
  reopens           text,
  source_note       text not null default '',
  income_limit_note text not null,
  price_cap_note    text not null,
  conditions        text[] not null default '{}',
  source_url        text,
  verified_on       date not null,
  verified_by       text not null,
  active            boolean not null default true,
  created_at        timestamptz not null default now(),
  constraint amounts_ordered check (amount_max >= amount_min)
);
create index if not exists rift_programs_verified_idx on rift_programs (verified_on desc);

create table if not exists rift_program_verifications (
  id          uuid primary key default gen_random_uuid(),
  program_id  uuid not null references rift_programs(id) on delete cascade,
  verified_on date not null,
  verified_by text not null,
  note        text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Value delivered
-- ---------------------------------------------------------------------------

-- A readout is an immutable snapshot. `figures` is what they were SHOWN;
-- `inputs` is what produced it, kept so a plan can recompute and disclose the
-- difference rather than silently replacing a number somebody has already told
-- their partner.
create table if not exists rift_readouts (
  id             uuid primary key default gen_random_uuid(),
  agent_id       uuid not null references rift_agents(id) on delete cascade,
  assessment_id  uuid not null references rift_assessments(id) on delete cascade,
  side           text not null check (side in ('buy','sell')),
  share_token    text unique not null,
  inputs         jsonb not null,
  figures        jsonb not null,
  matched        jsonb not null default '[]'::jsonb,
  created_at     timestamptz not null default now()
);
create index if not exists rift_readouts_assessment_idx on rift_readouts (assessment_id);

-- Trust state belongs to a figure, not to a record: a plan routinely holds a
-- lender-verified pre-approval next to a preliminary repair estimate, and a
-- single column on the parent forces one lie or the other.
create table if not exists rift_figures (
  id             uuid primary key default gen_random_uuid(),
  agent_id       uuid not null references rift_agents(id) on delete cascade,
  readout_id     uuid references rift_readouts(id) on delete cascade,
  label          text not null,
  value_cents    bigint not null,
  trust_state    text not null default 'preliminary'
                   check (trust_state in ('preliminary','pending-review','reviewed','verified')),
  ceiling        text not null default 'verified'
                   check (ceiling in ('preliminary','pending-review','reviewed','verified')),
  assumptions    jsonb not null default '[]'::jsonb,
  could_be_wrong text not null,
  confirmed_by   text,
  created_at     timestamptz not null default now(),
  -- A green chip with nobody behind it is the exact false confidence the
  -- trust ladder exists to prevent.
  constraint verified_needs_a_name check (trust_state <> 'verified' or confirmed_by is not null),
  -- Every figure carries its assumptions and its failure mode.
  constraint figures_state_their_assumptions check (jsonb_array_length(assumptions) > 0),
  constraint figures_state_their_failure_mode check (length(could_be_wrong) > 20)
);
create index if not exists rift_figures_readout_idx on rift_figures (readout_id);

-- ---------------------------------------------------------------------------
-- Leads
-- ---------------------------------------------------------------------------

create table if not exists rift_leads (
  id                 uuid primary key default gen_random_uuid(),
  agent_id           uuid not null references rift_agents(id) on delete cascade,
  assessment_id      uuid not null references rift_assessments(id) on delete cascade,
  name               text,
  email              text,
  phone              text,
  side               text not null check (side in ('buy','sell')),
  -- Pins what they were actually asked, so an edit cannot rewrite history.
  funnel_version_id  uuid references rift_funnel_versions(id) on delete set null,
  score              integer,
  band               text check (band in ('now','soon','later','nurture')),
  -- The breakdown, not just the total. An agent who cannot audit a ranking
  -- stops trusting it inside a week.
  signals            jsonb not null default '[]'::jsonb,
  human_replied_at   timestamptz,
  created_at         timestamptz not null default now()
);
create index if not exists rift_leads_agent_idx on rift_leads (agent_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table rift_agents               enable row level security;
alter table rift_business_rules       enable row level security;
alter table rift_funnels              enable row level security;
alter table rift_funnel_versions      enable row level security;
alter table rift_questions            enable row level security;
alter table rift_assessments          enable row level security;
alter table rift_answers              enable row level security;
alter table rift_events               enable row level security;
alter table rift_attributions         enable row level security;
alter table rift_consents             enable row level security;
alter table rift_programs             enable row level security;
alter table rift_program_verifications enable row level security;
alter table rift_readouts             enable row level security;
alter table rift_figures              enable row level security;
alter table rift_leads                enable row level security;

-- Helper: the agent row belonging to the caller.
create or replace function rift_my_agent_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from rift_agents where auth_user_id = auth.uid() limit 1;
$$;

drop policy if exists rift_agents_self on rift_agents;
create policy rift_agents_self on rift_agents
  for all using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());

-- Agent-owned tables: one policy shape, applied consistently.
do $$
declare t text;
begin
  foreach t in array array[
    'rift_business_rules','rift_assessments','rift_events','rift_attributions',
    'rift_consents','rift_readouts','rift_figures','rift_leads','rift_funnels'
  ] loop
    execute format('drop policy if exists %I on %I', t || '_owner', t);
    execute format(
      'create policy %I on %I for all using (agent_id = rift_my_agent_id()) with check (agent_id = rift_my_agent_id())',
      t || '_owner', t);
  end loop;
end $$;

-- Child tables inherit ownership through their parent.
drop policy if exists rift_funnel_versions_owner on rift_funnel_versions;
create policy rift_funnel_versions_owner on rift_funnel_versions for all
  using (exists (select 1 from rift_funnels f where f.id = funnel_id and f.agent_id = rift_my_agent_id()))
  with check (exists (select 1 from rift_funnels f where f.id = funnel_id and f.agent_id = rift_my_agent_id()));

drop policy if exists rift_questions_owner on rift_questions;
create policy rift_questions_owner on rift_questions for all
  using (exists (
    select 1 from rift_funnel_versions v join rift_funnels f on f.id = v.funnel_id
    where v.id = funnel_version_id and f.agent_id = rift_my_agent_id()))
  with check (exists (
    select 1 from rift_funnel_versions v join rift_funnels f on f.id = v.funnel_id
    where v.id = funnel_version_id and f.agent_id = rift_my_agent_id()));

drop policy if exists rift_answers_owner on rift_answers;
create policy rift_answers_owner on rift_answers for all
  using (exists (select 1 from rift_assessments a where a.id = assessment_id and a.agent_id = rift_my_agent_id()))
  with check (exists (select 1 from rift_assessments a where a.id = assessment_id and a.agent_id = rift_my_agent_id()));

-- The registry is public information, and the customer-facing match runs
-- before any account exists.
drop policy if exists rift_programs_public_read on rift_programs;
create policy rift_programs_public_read on rift_programs for select using (true);

drop policy if exists rift_program_verifications_read on rift_program_verifications;
create policy rift_program_verifications_read on rift_program_verifications for select using (true);

-- Writes to the registry, to answers, to events and to attribution go through
-- the service role only. No client-side insert path exists, or the funnel
-- numbers can be poisoned from a browser console.

-- ---------- 20260907120000_rift_nurture_review.sql ----------

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

-- ---------- 20260907180000_rift_rates.sql ----------

-- ============================================================================
-- The mortgage rate assumption, given a source and a date.
--
-- BUYER_DEFAULTS.ratePct was 6.5 — a literal with no provenance that every
-- monthly figure, every gap and every timeline in the product depends on. A
-- rate that is silently four months old is precisely the "wrong number rather
-- than an error" failure this codebase exists to prevent: nothing breaks, the
-- arithmetic stays correct, and the answer is wrong.
--
-- Snapshots rather than a single mutable row, because the readout is an
-- immutable record of what somebody was told. When a plan later disagrees with
-- their readout, "the rate moved from 6.5% on 19 Aug to 6.75% on 6 Sep" is the
-- explanation, and it only exists if the old value was kept.
-- ============================================================================

create table if not exists rift_rate_snapshots (
  id          uuid primary key default gen_random_uuid(),
  rate_pct    numeric(5,3) not null,
  term_years  integer not null default 30,
  product     text not null default 'conventional-30-fixed',
  source      text not null,
  source_url  text,
  as_of       date not null,
  created_at  timestamptz not null default now(),
  -- A rate outside this band is a data-entry error, not a market event. The
  -- US 30-year has not left it in living memory, and accepting 0.65 for 6.5
  -- would understate somebody's monthly payment by hundreds of dollars.
  constraint rate_is_plausible check (rate_pct > 1 and rate_pct < 20),
  unique (product, as_of)
);
create index if not exists rift_rate_latest_idx on rift_rate_snapshots (product, as_of desc);

alter table rift_rate_snapshots enable row level security;

-- Public read: the rate is displayed to every visitor as an assumption beside
-- the figures it produces, and that happens before any account exists.
drop policy if exists rift_rates_public_read on rift_rate_snapshots;
create policy rift_rates_public_read on rift_rate_snapshots for select using (true);

-- ---------- 20260907190000_rift_lead_without_assessment.sql ----------

-- ============================================================================
-- A lead can exist without an assessment.
--
-- `rift_leads.assessment_id` was NOT NULL, which assumed every lead comes from
-- a completed assessment. Two real paths do not:
--
--   * somebody who asks for their readout by email from a page reached by a
--     share link, having never taken the assessment themselves;
--   * somebody who books a call from the landing page.
--
-- The capture failed outright rather than storing the lead without the link —
-- so the most valuable moment in the funnel, a stranger volunteering their
-- address, lost the lead entirely.
-- ============================================================================

alter table rift_leads alter column assessment_id drop not null;

-- ---------- 20260907200000_rift_lead_inputs.sql ----------

-- ============================================================================
-- Store what the score was computed FROM, not only what it came to.
--
-- `score` and `signals` were written once at capture and never revisited. One
-- of the six signals is recency, and recency decays — so a lead captured three
-- weeks ago kept the 100 it earned on the day and went on outranking somebody
-- who arrived this morning.
--
-- The ranking is the entire argument for Studio. A ranking that silently goes
-- stale is worse than none: it still costs the agent attention, and it spends
-- it on the wrong people while looking exactly as authoritative as it did when
-- it was right.
--
-- Keeping the inputs lets the score be recomputed on read. The stored score
-- stays as the value at capture, which is worth having — it is what the lead
-- looked like when it arrived, and the difference between the two is itself
-- information.
-- ============================================================================

alter table rift_leads add column if not exists lead_input jsonb;

comment on column rift_leads.lead_input is
  'The LeadInput the score was computed from. Recomputed on read so recency decays; see lib/db/leads.ts.';
comment on column rift_leads.score is
  'The score AT CAPTURE. Studio recomputes for display — do not treat this as current.';

-- ---------- 20260907210000_rift_question_types.sql ----------

-- ============================================================================
-- Align the question-type constraint with the domain.
--
-- The constraint allowed 'number' and 'money', which `FieldType` does not have,
-- and rejected 'select' and 'boolean', which it does. So publishing the
-- built-in funnel failed on its very first question — the county select — and
-- the failure was swallowed by a caller that did not check the error.
--
-- Two lessons, both already learned once in this schema and worth the comment
-- so they are not learned a third time: a constraint written from memory rather
-- than from the type it mirrors will drift, and an insert whose error nobody
-- reads is an insert that has not happened.
-- ============================================================================

alter table rift_questions drop constraint if exists rift_questions_type_check;

alter table rift_questions add constraint rift_questions_type_check
  check (type in ('choice', 'slider', 'select', 'text', 'boolean'));

-- ---------- 20260907220000_rift_review_figure.sql ----------

-- ============================================================================
-- Link a review item to the figure it is about.
--
-- The trust ladder was described end to end and connected at neither end.
-- Promoting a review item changed the ITEM; the figure the customer is looking
-- at stayed "preliminary" forever, so "Kaleb has been through this" was a fact
-- recorded in Studio and invisible to the only person it was for.
--
-- With the link, advancing an item advances the figure, and a shared readout
-- can show which of its numbers somebody has actually checked.
-- ============================================================================

alter table rift_review_items
  add column if not exists figure_id uuid references rift_figures(id) on delete set null;

create index if not exists rift_review_figure_idx on rift_review_items (figure_id);

comment on column rift_review_items.figure_id is
  'The figure this review is about. Null for a request that predates figure tracking, or one about something not stored as a figure.';

-- ---------- 20260907230000_rift_one_live_assessment.sql ----------

-- ============================================================================
-- One live assessment per session, per side.
--
-- `startAssessment` checked for an existing row and inserted if it found none.
-- Between the check and the insert, another request can do the same — and the
-- assessment page fires this on mount, so a double-render, a fast refresh, or a
-- flaky connection retrying is enough.
--
-- Measured before the fix: six concurrent starts produced six assessments for
-- one visitor. Nothing failed. The consequences are all quiet ones — the agent
-- sees six abandoned people where there was one, five sets of answers are
-- orphaned against ids the client discarded, and any completion rate computed
-- from assessments is wrong by whatever the retry rate happens to be.
--
-- A check-then-insert cannot be made safe in application code. Only the
-- database can refuse the second one.
-- ============================================================================

-- Deduplicate before adding the constraint: keep the oldest live assessment
-- per session and side, and delete the rest. Answers cascade with them, which
-- is correct — they are attached to rows the client already abandoned.
delete from rift_assessments a
using rift_assessments b
where a.completed_at is null
  and b.completed_at is null
  and a.agent_id = b.agent_id
  and a.session_id = b.session_id
  and a.side = b.side
  and a.started_at > b.started_at;

create unique index if not exists rift_one_live_assessment
  on rift_assessments (agent_id, session_id, side)
  where completed_at is null;

comment on index rift_one_live_assessment is
  'A visitor has one live assessment per side. startAssessment relies on this to make its check-then-insert safe under concurrency.';

-- ---------- 20260908000000_rift_lead_survives_assessment.sql ----------

-- ============================================================================
-- A lead is not a side effect of its assessment.
--
-- `rift_leads.assessment_id` cascaded on delete, so the retention sweep — whose
-- stated job is deleting an assessment nobody came back to — silently took the
-- LEAD with it: the person's contact details, their score, their enrolment,
-- every touch already sent, and the link to their consent record.
--
-- Nobody chose that. It was a foreign key default doing something the retention
-- policy never described, and it would have removed relationships the agent was
-- still working.
--
-- The column is already nullable — a lead can exist without an assessment,
-- because somebody opening a shared readout never took one. So SET NULL is both
-- available and correct: the assessment goes on schedule, the person remains,
-- and deleting a person becomes a deliberate act rather than a consequence.
-- ============================================================================

alter table rift_leads drop constraint if exists rift_leads_assessment_id_fkey;

alter table rift_leads
  add constraint rift_leads_assessment_id_fkey
  foreign key (assessment_id) references rift_assessments(id) on delete set null;

comment on column rift_leads.assessment_id is
  'Null when the assessment has been deleted by retention, or when the lead never had one. Deleting a lead is deliberate — see lib/db/retention.ts.';

-- ---------- 20260908010000_rift_agent_survives_login.sql ----------

-- ============================================================================
-- Deleting a login must not delete the business.
--
-- `rift_agents.auth_user_id` cascaded from `auth.users`. Every other table
-- cascades from `rift_agents`. So removing one row in Supabase's Authentication
-- panel — a routine admin action, and an easy misclick — would have deleted
-- every assessment, lead, consent record, readout, figure, enrolment and event
-- in the product.
--
-- Consent records are the part that makes this unrecoverable rather than merely
-- catastrophic: they are the evidence that contacting those people was lawful,
-- and they cannot be reconstructed from a backup of anything else.
--
-- A login is a way in. The book of business is not attached to it.
--
-- SET NULL leaves the agent row unlinked, which the sign-in path already treats
-- correctly — `currentAgent()` returns null for a user with no agent row, and
-- the bootstrap re-links with --auth-user-id.
-- ============================================================================

alter table rift_agents drop constraint if exists rift_agents_auth_user_id_fkey;

alter table rift_agents
  add constraint rift_agents_auth_user_id_fkey
  foreign key (auth_user_id) references auth.users(id) on delete set null;

comment on column rift_agents.auth_user_id is
  'The login. Null if that login was deleted — the agent and everything belonging to them survives. Re-link with scripts/bootstrap-rift.mjs --auth-user-id.';

-- ---------- 20260908020000_rift_funnel_report.sql ----------

-- ============================================================================
-- Aggregate the funnel report in the database.
--
-- It was fetching every matching event and counting distinct sessions in
-- JavaScript. At a year of traffic that is 45,000 rows over the wire to produce
-- seven numbers, on every Studio load. At five years it is a page that times
-- out, and the failure arrives exactly when the data finally means something.
--
-- The window matters more than the speed. The report had no time bound, so it
-- mixed last year's funnel with this week's — and the whole point of measuring
-- drop-off is to change a question and see whether it helped. Averaged against
-- twelve months of the old wording, it never will.
-- ============================================================================

create or replace function rift_funnel_report(
  p_agent uuid,
  p_side text,
  p_days integer default 90
)
returns table (
  question_key text,
  reached integer,
  answered integer,
  median_dwell_ms integer
)
language sql
stable
security definer
set search_path = public
as $$
  with windowed as (
    select session_id, name, question_key, dwell_ms
    from rift_events
    where agent_id = p_agent
      and side = p_side
      and at >= now() - (p_days || ' days')::interval
      and name in ('question_view', 'question_answer')
      and question_key is not null
  )
  select
    w.question_key,
    count(distinct w.session_id) filter (where w.name = 'question_view')::integer,
    count(distinct w.session_id) filter (where w.name = 'question_answer')::integer,
    /* The median, not the mean. One person who left a tab open for an hour
       would otherwise turn "they read it and declined" into "they bounced off
       it" for everybody else — and those two want opposite remedies. */
    coalesce(
      percentile_cont(0.5) within group (order by w.dwell_ms)
        filter (where w.name = 'question_answer' and w.dwell_ms is not null),
      0
    )::integer
  from windowed w
  group by w.question_key;
$$;

create or replace function rift_funnel_starts(
  p_agent uuid,
  p_side text,
  p_days integer default 90
)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(distinct session_id)::integer
  from rift_events
  where agent_id = p_agent
    and side = p_side
    and at >= now() - (p_days || ' days')::interval
    and name = 'assessment_start';
$$;

-- The report reads a narrow slice by agent, side and recency. Without this it
-- is a sequential scan over every event ever recorded.
create index if not exists rift_events_report_idx
  on rift_events (agent_id, side, at desc)
  where question_key is not null;

-- Granted only to roles that exist. Supabase provides `anon` and
-- `authenticated`; the local test harness has neither by default, and a
-- migration that cannot run locally is a migration nobody tests.
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('grant execute on function rift_funnel_report(uuid, text, integer) to %I', r);
      execute format('grant execute on function rift_funnel_starts(uuid, text, integer) to %I', r);
    end if;
  end loop;
end $$;

-- ---------- 20260909000000_rift_manage_real_people.sql ----------

-- ============================================================================
-- Managing people who never took an assessment.
--
-- Everything built so far assumes a lead ARRIVES: somebody completes a funnel,
-- /api/capture writes the row, and the score explains why they matter. That is
-- the only door into rift_leads, which means an agent with ten existing
-- relationships has no way to put them in the product that exists to manage
-- them.
--
-- Three things were missing, and none of them are the funnel's fault:
--
--   A STAGE. `band` is computed urgency — now/soon/later/nurture — derived
--   from answers and recency. It is not where somebody IS. A person under
--   contract and a person who filled in a form this morning can both be
--   'now', and an agent cannot run a business off that.
--
--   A RECORD OF CONTACT. rift_touches is bound to an enrolment and unique per
--   step, because its job is guaranteeing an automated sequence never sends
--   twice. It physically cannot hold "called Tuesday, she is pre-approved to
--   340" — and that sentence is the most valuable data in a solo practice.
--
--   A BASIS FOR CONTACTING THEM. A lead from the funnel consented on the way
--   in, and that consent is recorded. A lead typed in by hand has no such
--   record, and "I know them" is not a thing the system should infer on the
--   agent's behalf. It is asked for and stored.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Where somebody actually is
-- ---------------------------------------------------------------------------

alter table rift_leads add column if not exists stage text;
alter table rift_leads add column if not exists stage_since timestamptz;
alter table rift_leads add column if not exists source text not null default 'funnel';
alter table rift_leads add column if not exists contact_basis text;
alter table rift_leads add column if not exists archived_at timestamptz;
alter table rift_leads add column if not exists archived_reason text;

-- The stage vocabulary is closed. A lead sitting in 'Under Contract' while the
-- board filters for 'Under contract' does not error and does not appear — it
-- silently stops being part of the business. That is the exact failure mode
-- this codebase keeps finding, so the database refuses the typo instead.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'rift_leads_stage_check') then
    alter table rift_leads add constraint rift_leads_stage_check check (
      stage is null or stage in (
        'Exploring','Building readiness','Preparing the property','Financing',
        'Ready to shop','Searching','Reviewing offers','Under contract','Closing',
        'Closed','Lost'
      )
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'rift_leads_source_check') then
    alter table rift_leads add constraint rift_leads_source_check
      check (source in ('funnel','manual','referral','import'));
  end if;
end $$;

-- A stage without a date is a stage that cannot go stale, and stall detection
-- is the whole reason the stage exists. They are set together or not at all.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'rift_leads_stage_dated') then
    alter table rift_leads add constraint rift_leads_stage_dated
      check ((stage is null) = (stage_since is null));
  end if;
end $$;

-- Somebody typed in by hand has no assessment to justify contacting them, so
-- the basis is required at the point of entry rather than assumed later.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'rift_leads_manual_needs_basis') then
    alter table rift_leads add constraint rift_leads_manual_needs_basis
      check (source = 'funnel' or contact_basis is not null);
  end if;
end $$;

-- Reaching anybody needs a way to reach them. A funnel lead always has an
-- email; a hand-entered one must have at least one of the two, or the record
-- is a note to self wearing a person's name.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'rift_leads_reachable') then
    alter table rift_leads add constraint rift_leads_reachable
      check (source = 'funnel' or email is not null or phone is not null);
  end if;
end $$;

create index if not exists rift_leads_stage_idx
  on rift_leads (agent_id, stage, stage_since)
  where archived_at is null;

-- ---------------------------------------------------------------------------
-- What was said, and when
-- ---------------------------------------------------------------------------

create table if not exists rift_lead_notes (
  id         uuid primary key default gen_random_uuid(),
  lead_id    uuid not null references rift_leads(id) on delete cascade,
  agent_id   uuid not null references rift_agents(id) on delete cascade,
  -- What kind of contact this was. 'note' is a thought, the rest happened.
  kind       text not null check (kind in ('note','call','email','text','meeting','stage')),
  body       text not null check (length(btrim(body)) > 0),
  -- Set only on kind='stage', so the history explains its own movements
  -- rather than leaving an agent to infer them from timestamps.
  from_stage text,
  to_stage   text,
  at         timestamptz not null default now()
);

create index if not exists rift_lead_notes_lead_idx
  on rift_lead_notes (lead_id, at desc);

-- A note cannot be edited or deleted through the app. The value of a contact
-- record is that it is what was actually written at the time; one that can be
-- tidied up later is a record of the agent's current opinion instead.
comment on table rift_lead_notes is
  'Append-only from the application. What was said, when, on which channel.';

-- ---------------------------------------------------------------------------
-- Row level security, matching every other table
-- ---------------------------------------------------------------------------

alter table rift_lead_notes enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'rift_lead_notes' and policyname = 'rift_lead_notes_own'
  ) then
    create policy rift_lead_notes_own on rift_lead_notes
      using (agent_id = rift_my_agent_id())
      with check (agent_id = rift_my_agent_id());
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant select, insert on rift_lead_notes to authenticated;
  end if;
end $$;

-- ---------- 20260910000000_rift_next_action.sql ----------

-- ============================================================================
-- The next thing you owe them, and when.
--
-- The board says who has gone quiet. It cannot say what you decided to do about
-- it, so the decision lives in the agent's head between sessions — which is
-- exactly where it gets lost. "Call Marcus Thursday" is the smallest unit of
-- account management and there was nowhere to put it.
--
-- One open action per person, deliberately. A queue of six things owed to the
-- same client is a queue nobody works; the next call is the only one that
-- matters and the rest are notes. Completing an action writes to the history,
-- so what was owed and when it was done stays auditable.
-- ============================================================================

alter table rift_leads add column if not exists next_action text;
alter table rift_leads add column if not exists next_due date;

-- An action with no date is a wish, and a date with no action is an alarm
-- nobody can act on. They travel together or not at all.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'rift_leads_next_action_dated') then
    alter table rift_leads add constraint rift_leads_next_action_dated
      check ((next_action is null) = (next_due is null));
  end if;
end $$;

-- Ordered by what is owed soonest, and only for people still being worked.
create index if not exists rift_leads_due_idx
  on rift_leads (agent_id, next_due)
  where next_due is not null and archived_at is null;

comment on column rift_leads.next_action is
  'The one thing owed to this person next. Cleared when done; the completion is written to rift_lead_notes.';

-- ---------- seed ----------

-- GENERATED by scripts/generate-program-seed.mjs — do not edit by hand.
-- Source of truth: lib/core/registry.ts
-- Regenerate after any registry change, or the engine and the database will
-- disagree about a number a stranger is shown.
--
-- 8 programmes. Amounts are estimated RANGES with conditions
-- attached, never approvals.

insert into rift_programs (
  slug, name, administrator, type, funding_state,
  amount_min, amount_max, county, first_time_only, reopens, source_note,
  income_limit_note, price_cap_note, conditions, verified_on, verified_by
) values
  ('ga-dream', 'Georgia Dream Homeownership Program', 'Georgia Department of Community Affairs', 'deferred', 'open', 10000, 12500, null, true, null, 'DCA program page and participating lender confirmation', 'Household income limits apply and vary by county and household size.', 'Purchase price caps apply and are updated periodically.', array['Must use a participating Georgia Dream lender','Homebuyer education course required before closing','Must occupy the home as a primary residence','Minimum credit score and liquid asset limits apply']::text[], '2026-08-19', 'Kaleb'),
  ('atlanta-hob', 'Atlanta Housing Opportunity Bond down payment assistance', 'Invest Atlanta', 'forgivable', 'open', 10000, 20000, 'Fulton', true, null, 'Invest Atlanta program listing', 'Tiered by income band as a percentage of area median income.', 'Property must be inside the City of Atlanta limits.', array['Property must be within City of Atlanta boundaries','Forgiven over a residency period — leaving early can trigger repayment','Buyer contribution required from own funds','Homebuyer education required']::text[], '2026-08-19', 'Kaleb'),
  ('dekalb-whd', 'DeKalb County Workforce Enhancement / homebuyer assistance', 'DeKalb County Community Development', 'forgivable', 'open', 7500, 10000, 'DeKalb', true, null, 'County community development office, phone confirmation', 'Income at or below a set percentage of area median income.', 'Maximum purchase price set by the county and revised annually.', array['Property must be in unincorporated DeKalb or a participating city','Five-year residency requirement for full forgiveness','Counseling certificate required']::text[], '2026-07-28', 'Kaleb'),
  ('gwinnett-hap', 'Gwinnett County Homestretch down payment assistance', 'Gwinnett County', 'deferred', 'closed', 7500, 10000, 'Gwinnett', true, 'Expected to reopen when the next allocation is released', 'County housing office notice', 'Income limits by household size.', 'Purchase price cap applies.', array['Funding is allocated in rounds and is currently exhausted','Property must be located in Gwinnett County','Homebuyer education required']::text[], '2026-08-30', 'Kaleb'),
  ('cobb-dpa', 'Cobb County down payment assistance', 'Cobb County Community Development', 'forgivable', 'waitlist', 5000, 10000, 'Cobb', true, 'Applications accepted to a waiting list', 'County program page', 'Income limits by household size.', 'Purchase price cap applies.', array['Property must be in Cobb County','Residency period applies','Counseling required']::text[], '2026-08-11', 'Kaleb'),
  ('fhlb-atl', 'FHLB Atlanta First-time Homebuyer Product', 'Federal Home Loan Bank of Atlanta, via member lenders', 'grant', 'open', 12500, 15000, null, true, null, 'Member lender confirmation', 'At or below 80% of area median income.', 'No separate price cap; lender underwriting applies.', array['Must be originated through a participating FHLB member lender','Matched savings requirement — buyer funds are matched at a set ratio','Retention period applies','Funds are released on a first-come basis each program year']::text[], '2026-08-19', 'Kaleb'),
  ('employer-gift', 'Employer assisted housing and gift funds', 'Employer or family, via lender gift letter', 'grant', 'open', 2000, 8000, null, false, null, 'Lender guidance — general', 'No income limit; depends entirely on the source.', 'None.', array['Gift funds require a documented gift letter acceptable to the lender','Some employers offer forgivable housing benefits that go unclaimed','Source of funds must be seasoned or documented']::text[], '2026-06-02', 'Kaleb'),
  ('stale-example', 'Legacy county assistance pilot', 'Regional housing authority', 'forgivable', 'open', 5000, 8000, 'DeKalb', true, null, 'Original program announcement', 'Income limits apply.', 'Price cap applies.', array['Pilot program with limited allocation']::text[], '2026-04-02', 'Kaleb')
on conflict (slug) do update set
  name = excluded.name,
  administrator = excluded.administrator,
  type = excluded.type,
  funding_state = excluded.funding_state,
  amount_min = excluded.amount_min,
  amount_max = excluded.amount_max,
  county = excluded.county,
  first_time_only = excluded.first_time_only,
  reopens = excluded.reopens,
  source_note = excluded.source_note,
  income_limit_note = excluded.income_limit_note,
  price_cap_note = excluded.price_cap_note,
  conditions = excluded.conditions,
  verified_on = excluded.verified_on,
  verified_by = excluded.verified_by;
