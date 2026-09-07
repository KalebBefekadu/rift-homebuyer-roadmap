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
