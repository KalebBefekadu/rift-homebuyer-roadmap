# First migration proposal — journey identity

**REVIEW ONLY. Not applied. Not executable migration history. Not database-tested.**

This document satisfies the repository's requirement to make the first proposed schema change reviewable before implementation. The application and existing migrations are unchanged by this package. After the relevant decisions are accepted or parked in handoff §8, create the real migration through the repository's Supabase workflow and test it against the actual baseline.

## Why this comes first

Buyer search needs somewhere to belong. Attaching all search state to `rift_leads.stage` repeats the assumption that a relationship has one goal forever. A small journey header lets one existing relationship buy, sell, pause, or return later without throwing away its identity.

The first migration adds **only journey identity**. It does not add a second client table, stage enum, workflow engine, search configuration, membership policy, or broad JSON bag. Search revisions and authenticated membership follow in W02/W03. Lifecycle truth follows through a dedicated event contract in W07; no stage cache is invented here.

### Decisions embodied in this proposal

1. `rift_leads` is the existing relationship anchor during the transition, despite its name.
2. One relationship can have multiple journeys; no unique constraint on `(origin_lead_id, side)`.
3. Every relationship/journey link must belong to the same tenant, including service-role writes.
4. New journeys have no anonymous or client access until explicit membership rules ship.
5. Deletion is explicit and policy-aware; it cannot silently cascade through a future transaction file.
6. No existing rows are auto-converted. An agent reviews the mapping for active relationships.

The choice to retain `origin_lead_id` as a required transitional anchor should be revisited when a canonical person/relationship model is introduced. It is intentionally not a claim that a lead row is a complete household identity system.

## SQL for review

Prerequisites: current Rift migrations applied, `rift_agents`, `rift_leads`, and `rift_my_agent_id()` present; Supabase roles exist. Existing data/deployment history must be checked before execution. For a large relationship table, assess index build locking and stage the unique index separately using the approved production migration method.

```sql
begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- The composite key protects the parent link even when a service role bypasses RLS.
create unique index rift_leads_id_agent_for_journeys_uidx
  on public.rift_leads (id, agent_id);

create table public.rift_journeys (
  id              uuid primary key default gen_random_uuid(),
  agent_id        uuid not null references public.rift_agents(id)
                    on delete restrict,
  origin_lead_id  uuid not null,
  side            text not null check (side in ('buy', 'sell')),
  label           text not null
                    check (length(btrim(label)) between 1 and 160),
  created_at      timestamptz not null default now(),

  constraint rift_journeys_relationship_same_agent
    foreign key (origin_lead_id, agent_id)
    references public.rift_leads (id, agent_id)
    on delete restrict,

  constraint rift_journeys_id_agent_unique unique (id, agent_id)
);

-- The agent list and the relationship's journey list are the first two reads.
create index rift_journeys_agent_created_idx
  on public.rift_journeys (agent_id, created_at desc, id);
create index rift_journeys_origin_lead_idx
  on public.rift_journeys (origin_lead_id, created_at desc, id);

alter table public.rift_journeys enable row level security;

create policy rift_journeys_agent_select
  on public.rift_journeys
  for select to authenticated
  using (agent_id = (select public.rift_my_agent_id()));

create policy rift_journeys_agent_insert
  on public.rift_journeys
  for insert to authenticated
  with check (agent_id = (select public.rift_my_agent_id()));

create policy rift_journeys_agent_update
  on public.rift_journeys
  for update to authenticated
  using (agent_id = (select public.rift_my_agent_id()))
  with check (agent_id = (select public.rift_my_agent_id()));

-- Explicit grants: RLS does not itself grant table access.
-- Only the label is editable through the authenticated role in this first seam.
revoke all on public.rift_journeys from public, anon, authenticated;
grant select on public.rift_journeys to authenticated;
grant insert (agent_id, origin_lead_id, side, label)
  on public.rift_journeys to authenticated;
grant update (label) on public.rift_journeys to authenticated;

-- Deletion remains behind an authenticated, tenant-checked retention command.
-- The service role is server-only; a table grant is not end-user authorization.
grant select, insert, update, delete on public.rift_journeys to service_role;

comment on table public.rift_journeys is
  'One buying or selling goal linked to an existing Rift relationship. '
  'Identity only: lifecycle events, client membership and search revisions '
  'ship through separately reviewed migrations.';

comment on column public.rift_journeys.origin_lead_id is
  'Transitional relationship anchor. Deletion is explicit so retention '
  'cannot accidentally remove a future transaction file.';

commit;
```

### Why the proposed SQL has no `IF NOT EXISTS`

A versioned migration should fail if its intended schema already exists unexpectedly; otherwise a partially different table/index can look like a successful deployment. Review the applied migration inventory first. Do not repeatedly paste this proposal into a live SQL editor.

### Limits of these constraints

The composite foreign key enforces same-tenant attachment, not who may initiate a command. A service-role caller still needs server authorization and scoped queries. The grant limits authenticated edits, but privileged backend code can still change identity fields: the repository layer must treat them as immutable, and a later transfer/merge capability requires a separate audited design.

There is no client SELECT policy, no direct DELETE policy, and no client membership table yet. This is intentional for the identity-only migration; the UI cannot expose private journey data until W02 ships.

## Required acceptance tests before application

Use a disposable database containing the full current migration baseline and actual database roles. Never point the destructive test harness at a development or production data store.

1. Agent A can insert/read their journey; agent B and an anonymous role cannot read it.
2. B cannot insert a row under A's `agent_id`.
3. A cannot attach their journey to B's relationship. Repeat using a service-role path: the composite FK still rejects it.
4. An authenticated client with no agent row sees zero journeys.
5. Authenticated update of `label` succeeds for the owner; update of tenant, relationship, or side is denied by grants.
6. Two journeys for one relationship, including two on the same side, are permitted and independent.
7. Empty/whitespace/oversized labels and invalid side values fail.
8. Deleting a lead or agent that still has a journey is refused rather than silently cascading. The approved deletion command removes only policy-eligible dependent data in a transaction and then succeeds.
9. Existing lead, readout, plan, attribution, consent, and retention tests remain unchanged and pass before inserting pilot journeys.
10. Index/query plans are checked with realistic tenant and relationship counts; no unbounded list query is introduced.

## Deletion compatibility is a release dependency

`ON DELETE RESTRICT` deliberately changes what happens **once a journey exists**. W01 must extend the current forget/retention command and its tests before permitting any production journey insert. For a new search-only journey with no held transaction record, the approved command removes eligible child records and the journey before deleting the relationship. When transaction records later exist, broker-approved retention/hold rules determine the separate treatment and customer explanation.

Creating an empty table does not break an existing deletion; inserting journeys without this compatibility work would. Therefore “schema applied” is not “W01 ready.” Do not defer this work to the post-closing package.

## Backfill and rollback

No backfill is part of this first proposal. Produce a reviewed mapping from selected relationships to journey IDs later, with idempotent import IDs and a reconciliation report. Do not infer active contracts from a stage label alone.

Before any new records are written, rollback can remove the empty new table and its dedicated index after verifying no dependents exist. After writes begin, disable the new feature and preserve its records; use a reviewed forward migration or export/reconciliation plan. Do not ship a destructive down migration as an automatic response to an application failure.

## Next schema work

W02: membership/invitations and narrow sharing, with real-role access tests. W03: immutable search brief revisions and current-draft pointers. W04: approval and activation records. Each ships its own constraints, indexes, grants, RLS, deletion/export integration, and database tests. The entire future platform does not belong in this first migration.
