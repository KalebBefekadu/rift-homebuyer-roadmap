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
