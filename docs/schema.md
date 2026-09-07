# Rift — Data Model

The model the build targets. Derived from the prototype's TypeScript types, which are the
specification; where this document and `lib/prototype/*.ts` disagree, **the prototype wins**
and this document is wrong.

**Built.** `supabase/migrations/20260907000000_rift_core.sql` implements everything below,
validated against a real Postgres 16, with `lib/db/schema.test.ts` proving each constraint
actually rejects the row it is supposed to.

Tables are prefixed `rift_`. The retired portal MVP's tables are applied to the same project
and are left untouched; nothing here reads or writes them.

---

## The five decisions that shape everything else

Read these before the tables. Each one is a place where the obvious design produces a
wrong number instead of an error.

### 1. A readout is an immutable snapshot, not a view
`readouts` stores the **rendered figures**, not just the inputs. Recomputing a stranger's
readout from stored inputs six weeks later gives a different answer — rates moved, a
programme closed — and the promise made was "you keep this". Store the inputs too, for
recompute, but never overwrite what they were shown. See `lib/core/seam.ts`.

### 2. Trust state belongs to a figure, not to a record
`preliminary / pending-review / reviewed / verified` attaches to an individual number.
A plan routinely holds a lender-verified pre-approval next to a preliminary repair estimate.
A trust column on `plans` forces one lie or the other.

### 3. Answers are separated from telemetry, permanently
`answers` holds what somebody said. `events` holds that a question was reached, how long it
took, and whether it was abandoned — **and never the answer value**. They are different
tables with different retention and different deletion rules, because the moment one query
can join them, funnel analytics becomes a dossier.

### 4. Stage is stored once, and days-in-stage is derived
`stage_transitions` is the truth; `clients.stage` is a cached read of its latest row. The
prototype's own board had drifted from its client records for exactly this reason, and the
fix was deriving instead of storing twice.

### 5. First touch is written once and never updated
Enforce it in the database, not in application code. A `BEFORE UPDATE` trigger that rejects
a change to `first_touch_*` is three lines and removes an entire class of attribution bug.

---

## Entities

### Identity and configuration

| Table | Holds | Notes |
| --- | --- | --- |
| `agents` | The agent. One row today | Multi-tenant later; put `agent_id` on everything now so it is not a migration later |
| `business_rules` | The six owner decisions | `lib/core/settings.ts`. Store `value`, `decided_at`, `decided_by` — a rule still on its default must be distinguishable from one someone chose |

### The funnel

| Table | Holds | Notes |
| --- | --- | --- |
| `funnels` | One per side (`buy` / `sell`), current version pointer | |
| `funnel_versions` | Immutable published versions | Never edit in place. `leads.funnel_version` points here |
| `questions` | Question text, kind, options, order | `kind` is `core` or `custom`; `bound` names the compute field for core questions and is `null` for custom |
| `funnel_changes` | Audit: what changed, when, by whom | |

**The constraint that matters:** a `custom` question can never reach a compute input.
Enforce it with `CHECK (kind = 'core' OR bound IS NULL)` so no application path can violate
it, and keep the corresponding test from [handoff.md](handoff.md) §7.

### Assessment and capture

| Table | Holds | Notes |
| --- | --- | --- |
| `assessments` | One attempt at a funnel: session id, side, version, started/completed | Survives abandonment — the abandoned ones are most of the value |
| `answers` | Question id → value, per assessment | Deleted by a "forget me" request |
| `events` | Telemetry: name, question id, dwell ms, session id | **Never a value.** Separate retention |
| `attributions` | First touch, last touch, visit count | First touch immutable by trigger. Referring **host** only, no path, no IP, no fingerprint |
| `consents` | Kind, exact wording, version, timestamp, IP | Store the wording, not a reference to it — wording changes, and what they agreed to does not |

### Leads and clients

| Table | Holds | Notes |
| --- | --- | --- |
| `leads` | A completed-or-abandoned assessment with a way to reach them | `funnel_version` pins what they were actually asked |
| `lead_scores` | Score, band, and the six signals with their points | Store the breakdown, not just the total. An agent who cannot audit the ranking stops trusting it |
| `clients` | A converted relationship | `stage` cached from `stage_transitions` |
| `stage_transitions` | Every stage change with its timestamp | The truth behind stall detection and pipeline weights |
| `household_members` | Co-buyers, spouses, co-owners | The prototype treats a co-decider as a first-class signal |

### Value delivered

| Table | Holds | Notes |
| --- | --- | --- |
| `readouts` | Immutable snapshot: rendered figures + the inputs that produced them | Decision 1 |
| `plans` | The published client plan | `published_at`, `agreement_id`, and the disclosed drift set |
| `figures` | One number: label, value, trust state, ceiling, assumptions, could-be-wrong | Decision 2. Polymorphic over readout / plan |
| `programs` | The assistance registry | `verified_on`, `verified_by`, `funding_state` |
| `program_verifications` | Every re-check | Suppression is computed from the latest, not stored |

### Work

| Table | Holds | Notes |
| --- | --- | --- |
| `review_items` | The `pending-review` queue | `ceiling`, and `confirmed_by` is **required** when state is `verified` — enforce with a `CHECK` |
| `enrolments` | Who is in which nurture sequence, days in, stop reason | |
| `touches` | Each step sent: channel actually used, and why if downgraded | The downgrade reason is data, not a log line |
| `tasks` | Owner, due date, state | Owner is a person, always. An unowned task is a wish |
| `referral_moments` | Fired moments, mood, gate outcome | |
| `offers`, `offer_terms` | Rift Offer | Compared on net, never on price |
| `documents` | Supabase Storage pointers + extracted dates | Phase 6 |

---

## Constraints worth writing into the schema

These are the ones that fail as a wrong number rather than an error, so application-level
validation is not enough.

```sql
-- Trust: nothing is verified without a named party.
alter table figures add constraint verified_needs_a_name
  check (trust_state <> 'verified' or confirmed_by is not null);

-- Trust: a figure can never exceed the ceiling set for its kind.
alter table review_items add constraint within_ceiling
  check (rung(state) <= rung(ceiling));

-- Funnel: a custom question can never feed a calculation.
alter table questions add constraint custom_is_inert
  check (kind = 'core' or bound is null);

-- Attribution: first touch is written once.
create trigger first_touch_is_immutable before update on attributions
  for each row execute function reject_first_touch_change();

-- Consent: the wording is stored, not referenced.
alter table consents alter column wording set not null;

-- Telemetry: no answer values, ever. Belt and braces alongside the app rule.
alter table events add constraint no_answer_payload
  check (payload ? 'value' = false);
```

---

## Cascades, audited

Every `on delete cascade` in this schema was checked for the same class of accident: a
foreign-key default doing something no policy describes.

Most are genuine parent-child — an answer has no meaning without its assessment, a figure none
without its readout. Two were not:

- **`rift_leads.assessment_id`** cascaded, so the retention sweep took the person with the
  assessment. Now `SET NULL`.
- **`rift_agents.auth_user_id`** cascaded from `auth.users`, and every table cascades from
  `rift_agents`. **Deleting one row in Supabase's Authentication panel would have deleted the
  entire book of business** — every assessment, lead, consent record, readout, enrolment and
  event. Consent records are what make that unrecoverable rather than merely catastrophic:
  they are the evidence that contacting those people was lawful, and they cannot be
  reconstructed from a backup of anything else. Now `SET NULL`; the bootstrap re-links a new
  login with `--auth-user-id`.

The remaining agent-scoped cascades are deliberate: deleting the agent row means deleting the
tenant, and that is now something only a person with the service key can do on purpose.

## Row-level security

Single-agent today, so the policies are simple — which is exactly why they should be written
now, while they are simple.

- **Everything agent-scoped** gets `agent_id = auth.uid()` on select, insert, update, delete.
- **Clients read their own row and their own plan**, nothing else. The retired MVP's third
  migration already demonstrates this pattern for `clients` and `roadmaps`; reuse its shape.
- **`programs` is world-readable.** It is public information and the customer-facing match
  runs before any account exists.
- **`events`, `answers`, `attributions` are agent-read, service-write.** No client-side
  insert path, or the funnel numbers can be poisoned from a console.

Every table gets its policy in the same migration that creates it. A table shipped without
one is either wide open or unreadable, and both are discovered in production.

**Exercised, not assumed.** `lib/db/rls.test.ts` runs as a real authenticated role with a JWT
claim — not as the table owner, who bypasses RLS entirely. A first version of that test passed
for exactly that reason while proving nothing.

Two agents, and the assertions that matter: one cannot read the other's leads, cannot update
or delete their rows, and **cannot insert a row on their behalf** — the dangerous direction,
because scoping reads without scoping writes lets somebody plant a row they are then allowed
to read. An anonymous visitor reads nothing belonging to anybody, and *can* read the programme
registry, which is public by design: if that policy ever failed, the landing page would
silently tell every visitor there is no help available.

Until this existed, every policy in the product had been written, shipped, and never once
enforced against a request — the application uses the service role, which bypasses them, and
the local harness disables RLS so the query tests can focus on syntax.

---

## Retention

Mirrors `lib/core/privacy.ts`, which is displayed to the customer. The database is where
it becomes true.

**This table must match `RETENTION` in `lib/core/privacy.ts` exactly**, because that array
is what is rendered to the customer at the bottom of every readout. It is a promise, not a
configuration value. `lib/core/docs.test.ts` fails if the two drift apart.

| Data | Kept | Why |
| --- | --- | --- |
| Unconverted assessment | 18 months | A buyer on a "9 to 18 months" answer is still inside their own stated timeline |
| Part-finished assessment, no contact details | 30 days | Long enough to resume on the same device, short enough that it is not a collection of strangers' finances |
| Client record | Per `business_rules.clientRetentionYears` | **Has a legal floor.** Confirm with the broker before anything deletes |
| Funnel telemetry | 24 months | Question ids and dwell only, never answers. Aggregated counts survive; individual event rows do not |
| Consent record | The relationship, then five years | The only evidence the contact was lawful. Stores the exact wording, not a reference to it |

**A lead is not a side effect of its assessment.** `rift_leads.assessment_id` is `SET NULL`,
not `CASCADE`. It cascaded once, so the sweep that deletes an 18-month-old assessment silently
took the person with it — contact details, score, enrolment, every touch already sent — as a
foreign key default doing something this policy never described. Deleting a person is now the
only thing the sweep does deliberately, and only for leads with no recorded reply and no live
sequence: somebody the agent has spoken to, or is still following up, is a relationship rather
than an expired record, whatever its age.

**"Delete all of it" must actually delete.** Not a soft-delete flag, not an anonymised row.
A scheduled job enforces the windows above; write it in phase 1 alongside the tables, because
a retention rule with no job behind it is a paragraph.
