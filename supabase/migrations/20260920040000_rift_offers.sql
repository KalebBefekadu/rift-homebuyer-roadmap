-- ============================================================================
-- Offers, compared by what actually reaches the seller.
--
-- The argument is the same one the rest of the product makes, applied to the
-- last decision in the transaction: a list price is not what reaches you, and
-- neither is a headline offer. Concessions, a repair credit and a rate buy-down
-- all come out of the same number, and the offer that looked $8,000 higher can
-- arrive $3,000 lower.
--
-- NOTHING REACHES THE SELLER UNTIL IT IS RELEASED. `released_at` is null by
-- default and the client's page reads only released rows. An offer arrives
-- while the agent is driving; presenting it unreviewed is how somebody replies
-- to a number before anybody has read the terms under it.
--
-- Money is stored in CENTS. Every other money column in this schema is numeric
-- and that has been survivable, but an offer comparison subtracts six figures
-- from six figures and then ranks the differences, which is precisely where a
-- binary float puts a dollar in the wrong place and changes which offer wins.
-- ============================================================================

create table if not exists rift_offers (
  id            uuid primary key default gen_random_uuid(),
  agent_id      uuid not null references rift_agents(id) on delete cascade,
  -- The seller. An offer belongs to the person selling, not to the buyer.
  lead_id       uuid not null references rift_leads(id) on delete cascade,

  -- As the seller would say it. Not a legal party name.
  offered_by    text not null check (length(btrim(offered_by)) between 2 and 120),

  price_cents         bigint not null check (price_cents > 0),
  -- What the buyer asks the seller to give back. Both non-negative: a negative
  -- concession is money flowing the wrong way and is not a thing.
  concessions_cents   bigint not null default 0 check (concessions_cents >= 0),
  repair_credit_cents bigint not null default 0 check (repair_credit_cents >= 0),
  earnest_cents       bigint not null default 0 check (earnest_cents >= 0),

  financing     text not null check (financing in ('cash','conventional','fha','va','usda','other')),
  close_on      date,
  contingencies text[] not null default '{}',

  -- Whether the buyer supplied proof they can pay. Facts about the paperwork,
  -- never a judgement about the buyer.
  preapproval    boolean not null default false,
  proof_of_funds boolean not null default false,

  -- The agent's words to the seller, shown only once released.
  note          text check (note is null or length(note) <= 2000),

  released_at   timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists rift_offers_lead_idx on rift_offers (lead_id, created_at desc);
create index if not exists rift_offers_released_idx
  on rift_offers (lead_id) where released_at is not null;

comment on table rift_offers is
  'One offer on a seller''s property. Ranked by net to seller, never by headline price. Invisible to the client until released_at is set.';
comment on column rift_offers.released_at is
  'Null until the agent releases it. The client''s page at /plan/<token> reads only released rows.';

alter table rift_offers enable row level security;

drop policy if exists rift_offers_owner on rift_offers;
create policy rift_offers_owner on rift_offers for all
  using (agent_id in (select id from rift_agents where auth_user_id = auth.uid()))
  with check (agent_id in (select id from rift_agents where auth_user_id = auth.uid()));

-- The seller's own fixed costs, so the offer table and their readout cannot
-- disagree about the same house. Nullable: unknown until somebody says.
alter table rift_leads add column if not exists payoff_cents bigint check (payoff_cents is null or payoff_cents >= 0);
alter table rift_leads add column if not exists commission_pct numeric(5,3) check (commission_pct is null or (commission_pct >= 0 and commission_pct <= 20));

comment on column rift_leads.payoff_cents is
  'What this seller still owes. Feeds the offer comparison. Null means nobody has said, and the comparison says so rather than assuming zero.';
