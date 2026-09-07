# Rift Architecture Reference

## Where this repository actually is

Two things live here, and confusing them is the fastest way to build the wrong thing.

1. **The specification** — `app/prototype`, `components/rift`, `lib/prototype`. Complete,
   reviewed, and running. No accounts, no database, no environment variables. It is the
   agreed product, expressed as working software instead of a wireframe.
2. **The plumbing** — `lib/supabase`, `lib/auth`, `lib/brevo`, `lib/monitoring`,
   `supabase/migrations`, the Sentry config. Real, deployed, and reusable. It came from the
   portal MVP that Rift replaces.

**Nothing production-facing is built yet.** That is the work, and [handoff.md](handoff.md)
is its order.

### What was removed, and why it is not coming back

The portal MVP (`app/portal`, `app/login`, `app/signup`, `RoadmapWorkspace`, `lib/roadmap`,
`lib/store`) was deleted once Rift superseded its product surface. It is recoverable from git
history. Two consequences worth stating so nobody rediscovers them the hard way:

- `supabase/migrations/` still creates that MVP's tables (`clients`, `roadmaps`,
  `dpa_programs`). They are **applied to the live project**, so the migrations stay; the
  first Rift migration is additive. Do not repurpose `roadmaps` for Rift plans — see
  [schema.md](schema.md).
- `app/layout.tsx` no longer wraps the tree in an auth provider, because nothing consumes a
  session yet. `lib/auth/*` is intact. Re-introduce the provider in phase 3.

## System shape

```text
Browser
  -> Next.js App Router (React 19, TypeScript)
  -> lib/core/*             pure, deterministic domain logic — no I/O, no env
  -> lib/db/*               server-only data access (service role, RLS bypassed)
  -> lib/auth + lib/supabase  Supabase Auth and Postgres behind RLS
  -> lib/brevo              contact and transactional email projection
  -> lib/monitoring         Sentry, for anything that fails
```

### Three layers, and the rule between them

| Layer | Where | May import |
| --- | --- | --- |
| **Domain** | `lib/core/` | Nothing but itself. No React, no fetch, no `process.env` |
| **Data** | `lib/db/` | `lib/core`, Supabase. `server-only` — importing it from a client component is a build error |
| **Surface** | `app/`, `components/` | Both |

Dependencies point one way. The domain layer was promoted out of `lib/prototype/` for exactly
this reason: the specification and the production build must share **one** compute engine, or
they will disagree about a number a stranger is shown and both will look correct in isolation.
`lib/prototype/` now holds only what is genuinely prototype-shaped — fixtures, and the
localStorage stand-ins for persistence.

A cycle across this boundary is not theoretical. `TrustState` briefly lived in a React
component that two domain modules imported, and when the component came to need one of them
back, the readout page stopped hydrating with no error anywhere.

The domain layer is deliberately I/O-free. `compute.ts`, `results.ts`, `lead.ts`,
`pipeline.ts`, `nurture.ts`, `review.ts` and `seam.ts` are pure functions over plain data:
they can be unit-tested without a database, a network, or a browser, and
`lib/core/compute.test.ts` is the proof. **Keep it that way.** The moment a domain module
imports a Supabase client, the contracts in handoff.md stop being testable.

Rift owns pipeline state. Brevo owns messaging. Do not create a second place to edit a stage.

## Application areas

| Area | Location | Responsibility |
| --- | --- | --- |
| Development index | `app/page.tsx` | Placeholder root. Replaced by the real landing in phase 2 |
| Specification prototype | `app/prototype`, `components/rift`, `lib/prototype` | The agreed product, running |
| Auth | `lib/auth`, `lib/supabase`, `app/auth/callback` | Supabase Auth with a localStorage fallback |
| Messaging | `lib/brevo/sync.ts`, `app/actions/brevo.ts` | Contact upsert and event projection |
| Observability | `lib/monitoring`, `instrumentation*.ts`, `sentry.*.config.ts` | Capture failures without PII |
| Domain | `lib/core` | The compute engine and every product rule, pure and tested |
| Data access | `lib/db` | Server-only reads and writes. Every call returns `DbResult` |
| API | `app/api` | Telemetry and attribution intake |
| Schema | `supabase/migrations`, `supabase/seed` | The database, versioned |
| Session refresh | `middleware.ts` | Scoped to exclude `/prototype` and `/` |

## Persistence

`lib/auth/index.ts` switches between Supabase and a localStorage implementation depending on
whether keys are present. **Preserve that switch.** It is what lets the product be developed
without a network, and it is one `isSupabaseConfigured()` call.

The data model to build is in [schema.md](schema.md). The authoritative schema is always the
SQL in `supabase/migrations/`; a model change requires a migration, a mapping update, and a
documentation update in the same commit.

## Security model

- Row Level Security is the boundary. Route guards are experience, not authorization.
- Agent data is scoped `agent_id = auth.uid()`. Client access is limited to their own record
  and their own plan.
- The service-role key never reaches the browser and is never `NEXT_PUBLIC_`.
- Monitoring carries operational context, never buyer PII or raw intake. `lib/brevo/sync.ts`
  shows the pattern: it reports `hasEmail: boolean`, never the address.
- Telemetry stores question ids and timings, **never answer values**, and lives in a
  different table from the answers with different retention.

## Calculation

`lib/core/compute.ts` is the source of truth for every customer-facing figure. It is
framework-free, pure, and unit-tested. Components display its output and must never duplicate
the maths. The contract and its reference case are in [calculations.md](calculations.md), and
its executable half is `lib/core/compute.test.ts` — **change them in the same commit.**

## Messaging and monitoring

When `BREVO_API_KEY` is present, Rift upserts a contact with name, phone, stage, time-to-buy,
client id, and a named event. Missing credentials produce an explicit no-op that reports
itself as skipped; a real API failure returns a failure result and is captured in Sentry.
Provision the custom attributes once with `npm run brevo:ensure-attributes`.

Sentry is the backstop for unhandled errors and integration failures. A user-facing flow must
always present a recoverable message alongside the capture. See
[integrations.md](integrations.md).

## Configuration

Every supported variable is documented in [.env.example](../.env.example), grouped by
service, each with what happens when it is absent. The prototype requires none of them.

## Design prototypes

The prototypes defined in [prototypes.md](prototypes.md) are built and live under `/prototype`:
mock fixtures, no authentication, no database, no Brevo, no Sentry, no production code path.

They were originally described as throwaway. **They are not.** They are the specification the
build is measured against, they encode product rules in executable form, and they stay in the
repository until the real surface that replaces a given screen has shipped and been checked
against it. A screen is deleted from `/prototype` when its production equivalent is live —
one at a time, not as a tree.

| Location | Contents |
| --- | --- |
| `app/prototype/rift.css` | Scoped design system. Every token lives under `.rift` so nothing collides with the production palette in `app/globals.css`. `.buy` and `.sell` redefine `--brand` to give the two products separate identities from one stylesheet |
| `app/prototype/layout.tsx` | `.rift` wrapper, Fontshare `<link>`, demo bar |
| `app/prototype/buy/`, `sell/` | Two standalone products: landing, assessment, readout, reference pages |
| `app/prototype/kaleb/` | The agent's own site |
| `app/prototype/app/` | Client portal — overview, plan, money, decisions, documents, messages, share |
| `app/prototype/studio/` | Agent surface — today, leads and clients, offers, calendar, settings |
| `app/prototype/offer/` | Account-free offer submission |
| `components/rift/ProductShell.tsx` | Buy/sell shell, nav and footer, identity-aware |
| `components/rift/Shell.tsx` | Client and studio shells, demo bar, command palette host |
| `components/rift/Ask.tsx` | The assessment kit. `Field` renders any question from the funnel definition |
| `components/rift/Readout.tsx` | The readout kit — verdict, sections, blocker, steps, question sheet, conversion ladder, capture |
| `components/rift/FunnelEditor.tsx` | The agent-facing funnel editor |
| `lib/core/compute.ts` | Deterministic value engine — every customer-facing figure originates here |
| `lib/core/registry.ts` | Verified assistance-program registry with verification dates and suppression |
| `lib/core/results.ts` | Derives the readout — verdict, blocker, ordered steps, question sheet — from computed values only |
| `lib/core/lead.ts` | Lead scoring, with the signal breakdown as part of the output rather than a tooltip |
| `lib/core/funnel.ts` | Question schema, default funnels, and the core/custom split that keeps editing safe |
| `lib/prototype/funnelStore.ts` | localStorage persistence so editor changes drive the live funnel |
| `lib/prototype/telemetry.ts` | Funnel instrumentation. Question ids, dwell and session id — never answers |
| `lib/prototype/attribution.ts` | First-touch capture. First touch is immutable; later visits update last touch only |
| `lib/core/privacy.ts` | Retention rules and versioned TCPA consent wording — data the server stores and the browser renders |
| `lib/prototype/privacy.ts` | The browser-side half: acting on a deletion request, reporting what is on this device |
| `lib/core/referral.ts` | Eight referral moments with escalating asks and the satisfaction gate |
| `lib/core/pipeline.ts` | Stage rules, stall detection with named causes, weighted forward view. Weights shrink toward the agent's own closed history and are labelled with their basis |
| `lib/core/nurture.ts` | The cadence engine. Four sequences, widening intervals, six stop conditions, consent gating the channel rather than the sequence |
| `lib/core/review.ts` | The producer for `pending-review`. Per-item ceilings, and `verified` requires a named party — enforced in `promote()`, not in the UI |
| `lib/core/seam.ts` | The readout→plan crossing. Ten carry rules, a 3% drift threshold, and the preconditions on publishing |
| `lib/core/settings.ts` | The six business decisions that used to be literals, each with its consequence and whose call it is |
| `components/rift/Trust.tsx` | The four-state trust ladder, rendered. Never colour alone |
| `lib/prototype/fixtures.ts`, `clients.ts` | Demonstration people, tasks, offers, meetings, documents, playbooks |

### Editable funnels without breakable maths

The agent can reword, reorder, hide and extend the public questions. The constraint that makes
this safe is a split in `lib/core/funnel.ts`:

- **Core** questions carry a `bound` field name that the compute engine reads. Wording, order,
  help text and option *labels* are the agent's. Option *values* and the binding are locked,
  because `cashToClose()` and `matchPrograms()` read them — a rename would silently change
  someone's numbers rather than fail loudly. A required core question cannot be deleted.
- **Custom** questions are anything the agent invents. They land on the lead record and are shown
  in Studio, and they never feed a calculation. Keeping the escape hatch inert is what makes it
  an escape hatch rather than a hole.

### Measurement sits beside the thing it indicts

Per-question drop-off is rendered inside the funnel editor, on the row the agent would edit,
rather than on a separate analytics screen. Two readings that a drop-off percentage alone
cannot separate: a high drop with a long dwell is a question people understood and declined
to answer; a high drop with a short dwell is one they bounced off. The first wants a reason
attached, the second wants rewording. `diagnose()` in `telemetry.ts` makes that call.

### Assistance is upside, never a balance

`buyerReadout()` requires `assistance` to be zero. The headline gap, timeline and status are all
computed on savings alone; matched assistance is displayed beside them as conditional upside with
a lender named as the decider. Folding an unapproved program midpoint into the headline would tell
someone they are ready to buy when they are not, which is the most damaging thing this product
could do to a person — and it is exactly what the arithmetic does if nobody stops it.

### Rules the prototype enforces in code

These are not decorative. Four product rules from [product.md](product.md) are implemented rather than described:

1. **Computed, never generated.** Every figure a visitor sees is produced by `lib/core/compute.ts` or matched from `lib/core/registry.ts`. No number anywhere in the prototype is authored text.
2. **No bare numbers.** The `Computed` type in `lib/core/compute.ts` requires an
   `assumptions` list and a `couldBeWrong` statement on every figure it produces. Keeping
   this in the type rather than in review is the point: a figure that renders without them is
   a defect regardless of whether it happens to be correct.
3. **Stale data is suppressed.** `isStale()` removes any program unverified for longer than
   the configured window (`STALE_AFTER_DAYS`, driven by `settings.ts`) from customer-facing matching. `matchPrograms()` returns suppressed programs separately so the agent can be told; customers are never shown them. The registry deliberately contains one stale fixture so the rule is demonstrable.
4. **Never colour alone.** Every badge in the kit carries an icon and a word alongside its colour, so state survives monochrome and colourblindness.

Funding exhaustion is a first-class state, not a hide: a closed or waitlisted program is shown **with** its state rather than removed, because a buyer planning around money that is not currently available needs to know.

### Running the prototypes

```bash
npm run dev
```

Then open `/prototype`. Nothing needs to be configured — no Supabase, no environment variables, no accounts. The prototypes work with the repository as cloned.

### What the prototypes must not do

- Import from `lib/auth`, `lib/supabase`, or `lib/brevo`.
- Write to anything but `localStorage`.
- Depend on environment variables.
- Be extended with new features instead of the real product. If a change belongs in the
  specification, change it here; if it belongs in the product, build it properly.

## Engineering rules

1. **Calculations live in `lib/core/compute.ts`.** Never inline mortgage maths in a
   component, and never let a second module compute the same figure a different way.
2. **The domain layer stays I/O-free.** Pure functions over plain data. No fetch, no client,
   no `process.env` below `lib/prototype/`.
3. **Preserve the auth switch** so local and cloud modes expose the same behaviour.
4. **A readout is a snapshot.** Never overwrite what a person was shown; store the inputs
   alongside it for recompute. See [schema.md](schema.md), decision 1.
5. **Stage changes are recorded, not just set.** `stage_transitions` is the truth and
   `clients.stage` is a cache of it.
6. **Add tests with any change to a calculation or a contract.** The list to write first is in
   [handoff.md](handoff.md) §7; the harness already runs.
7. **Prefer a clear, recoverable failure to a background retry that hides data loss.**
8. **Every table ships with its RLS policy in the same migration.**
