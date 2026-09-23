-- ============================================================================
-- The referral engine, given somewhere to remember things.
--
-- `lib/core/referral.ts` has described eight moments, their triggers and the
-- private satisfaction gate since before any of this was built, and until now
-- nothing read it. docs/benchmark.md gives referral and retention a weight of
-- 15 out of 100 (a seventh of the product's own grade) and the shipped
-- product scored approximately nothing on it, because a closing produced a
-- commission and no next relationship.
--
-- THE RULE THIS SCHEMA EXISTS TO ENFORCE.
--
-- Nothing public is asked for before a private check. Every moment that would
-- put a client in front of strangers: the closing-day review, the six-month
-- ask, the anniversary: is gated behind one private question, and an unhappy
-- client is routed to Kaleb rather than to a review form. That is not review
-- gating to manufacture ratings: somebody who says they are unhappy is never
-- asked for a public rating at all, and the private route exists so the
-- complaint gets answered.
--
-- `mood` is the column that check writes to, and it is deliberately nullable
-- with no default. Unanswered is its own state and must not be mistaken for
-- fine: a default of 'good' would ask the entire back catalogue for reviews
-- on the first deployment.
-- ============================================================================

-- The private satisfaction check. Null means nobody has asked yet.
alter table rift_leads add column if not exists mood text
  check (mood is null or mood in ('good', 'mixed', 'bad'));
alter table rift_leads add column if not exists mood_at timestamptz;

comment on column rift_leads.mood is
  'Answer to the private satisfaction check. NULL means unasked, which is not the same as fine: no public ask may go out on a NULL. See gate() in lib/core/referral.ts.';

-- The closing date, as its own fact.
--
-- `stage_since` was nearly good enough: a lead sitting in 'Closed' entered it
-- on the closing day. Nearly, because stage_since is rewritten by any later
-- stage change, and the whole post-closing cadence: thirty days, six months,
-- every anniversary indefinitely: is counted from this date. A correction to
-- somebody's stage two years later would silently move all of their
-- anniversaries, and the only visible symptom would be a message arriving on
-- the wrong day.
alter table rift_leads add column if not exists closed_on date;

comment on column rift_leads.closed_on is
  'The closing date. Every post-closing moment is counted from here rather than from stage_since, which a later stage edit would move.';

-- D5.5, the referral attribution loop: a referred lead linked to its referrer,
-- visible and countable. One column, self-referencing.
--
-- ON DELETE SET NULL rather than CASCADE. Somebody exercising their right to
-- be forgotten must not take the people they referred with them: those are
-- separate relationships who consented separately, and deleting them would be
-- doing a second thing to a third party on the strength of one person's
-- request. The referred lead survives with no referrer, which is the honest
-- record of what is left.
alter table rift_leads add column if not exists referred_by uuid
  references rift_leads(id) on delete set null;

create index if not exists rift_leads_referred_by_idx
  on rift_leads (referred_by) where referred_by is not null;

comment on column rift_leads.referred_by is
  'The relationship that sent this one. SET NULL on delete: erasing a referrer must not erase the people they referred.';

create table if not exists rift_referral_moments (
  id          uuid primary key default gen_random_uuid(),
  agent_id    uuid not null references rift_agents(id) on delete cascade,
  lead_id     uuid not null references rift_leads(id) on delete cascade,

  moment_id   text not null check (moment_id in (
                'value_delivered', 'plan_published', 'financing_secured',
                'under_contract', 'closing_day', 'day_30', 'month_6', 'anniversary')),

  -- Which time round. Zero for the seven moments that happen once.
  --
  -- The anniversary repeats every year on the closing date, indefinitely. A
  -- record keyed on the moment alone would mark the first anniversary sent and
  -- then suppress every anniversary after it: a cadence that quietly stops
  -- after year one while every screen goes on showing it as running. That is
  -- this product's recurring failure shape, and one integer removes it.
  occurrence  integer not null default 0 check (occurrence >= 0),

  state       text not null check (state in
                ('waiting', 'due', 'sent', 'acted', 'declined', 'held')),

  -- Why, in the agent's own words. Held-back moments are the ones worth
  -- explaining to yourself six months later.
  note        text check (note is null or length(note) <= 500),

  decided_at  timestamptz not null default now(),
  created_at  timestamptz not null default now(),

  -- One decision per moment per occurrence. This is what makes recording a
  -- decision idempotent, so a retried request cannot produce two answers about
  -- the same moment and leave the reader to pick.
  unique (lead_id, moment_id, occurrence)
);

create index if not exists rift_referral_moments_lead_idx
  on rift_referral_moments (lead_id, moment_id, occurrence);

comment on table rift_referral_moments is
  'A decision Kaleb has taken about one referral moment. Absence means undecided: the state is then derived from lifecycle data by momentsFor() rather than stored, so a moment becomes due on its own.';

alter table rift_referral_moments enable row level security;

drop policy if exists rift_referral_moments_owner on rift_referral_moments;
create policy rift_referral_moments_owner on rift_referral_moments for all
  using (agent_id in (select id from rift_agents where auth_user_id = auth.uid()))
  with check (agent_id in (select id from rift_agents where auth_user_id = auth.uid()));
