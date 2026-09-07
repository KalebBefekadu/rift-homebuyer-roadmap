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
