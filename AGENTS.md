# Working in this repository

Read this before writing code. It is short on purpose.

## What this repository is

Rift is a client-experience and agent-operating platform for residential real estate, built
for **one Georgia agent**. Its lead-generation thesis is *overloading value on the front end
so leads convert*: a stranger gets a complete, computed, honest readout of their situation
for free, before any account, and keeps it whether or not they ever speak to the agent.

Everything else exists to make that promise survivable at scale for one person.

## The two halves

| Half | Where | What it is |
| --- | --- | --- |
| **Specification** | `app/prototype`, `components/rift`, `lib/prototype` | The agreed product, running. No accounts, no database, no env vars. Complete and reviewed |
| **Plumbing** | `lib/supabase`, `lib/auth`, `lib/brevo`, `lib/monitoring`, `supabase/` | Real, deployed, reusable |

**The production product is not built yet.** Building it is the job.

## Before you write any code — the review gate

**Your first deliverable is findings, not a migration.**

Read the documents, run the prototype, then report: the phase-1 plan, the first migration as
SQL, **everything you found ambiguous or contradictory, and anything you would push back on.**
Then stop. Do not apply a migration and do not start product routes until those findings have
been accepted, rejected, or parked in `docs/handoff.md` §8.

This exists because the failure mode is not refusing to report problems — it is reporting them
and starting to code in the same breath, so nobody reads them until the decision is already
cast in a schema. A review pass that arrives alongside the thing it was supposed to review is
not a review.

Six documentation defects were found this way and fixed before the first migration, including
a retention period stated as 13 months in `docs/schema.md` and 24 months in the code rendered
to the customer. An engineer building the deletion job from the document would have shipped a
product that breaks a promise made on screen, and nothing would have failed.

`npm test` now includes `lib/core/docs.test.ts`, which fails when the docs and the code
disagree about a number that matters. It does not check prose. Keep finding the rest.

## Read in this order

1. **[docs/handoff.md](docs/handoff.md)** — **§2 is what ships first**, then the build order,
   the contracts that must not drift, and the acceptance tests to write first. Start here
   every session. The MVP is phases 1–3, buyers only; phase 4 is behind a traffic gate.
2. **[docs/schema.md](docs/schema.md)** — the data model, and the five decisions that shape it.
3. **[docs/integrations.md](docs/integrations.md)** — every external service and what happens
   when it is missing.
4. **[docs/calculations.md](docs/calculations.md)** — the compute contract and its reference case.
5. **[docs/vision.md](docs/vision.md)** / **[docs/product.md](docs/product.md)** — why and what.
6. **[docs/prototypes.md](docs/prototypes.md)** — route map of the specification.

## The eleven rules

These are in [handoff.md](docs/handoff.md) §4 in full, with the reasoning. Compressed:

1. **Front-end value is computed, never generated.** Every customer-facing number comes from
   `lib/core/compute.ts` or `registry.ts`. **No number is ever produced by a language
   model.** This is the load-bearing decision of the entire product.
2. **Every figure carries its assumptions and its failure mode.** Enforced in the type.
3. **Unapproved assistance is never folded into a headline.** `buyerReadout()` requires
   `assistance: 0`.
4. **A readout is an immutable snapshot.** Never rewrite what somebody was shown.
5. **Custom funnel questions can never reach a compute input.**
6. **Telemetry stores question ids and timings, never answer values.**
7. **First touch is immutable.** Later visits update last touch only.
8. **A sequence stops the moment a human replies.**
9. **Nothing reaches `verified` without a named party.**
10. **Never colour alone.** Every state carries an icon and a word.
11. **A stated timeline is compared against the computed one.** Collecting an answer and
    never showing the person what it means against their own numbers is the polite version
    of hiding it.

## How to work

- **Kickoff before product code.** A new implementation thread pastes `docs/agent-kickoff.md`
  (everything below the rule) and **does not write schema, product routes, or persistence
  until items 3 and 4 have been reviewed**. A capable agent will otherwise implement around
  problems in a confident spec rather than report them. The tiebreaker is already named:
  the prototype wins; `docs/handoff.md` §8 covers what is not the engineer's call.
- **Match the surrounding code.** This codebase comments *why*, not *what*, and the comments
  carry real reasoning. Keep that. A comment restating the line below it is noise; a comment
  explaining why the obvious approach is wrong is the most valuable line in the file.
- **The domain layer is I/O-free.** No fetch, no client, no `process.env` under
  `lib/prototype/`. It is why the contracts are testable.
- **Write the acceptance test before the feature.** The list is in handoff.md §7. The harness
  runs: `npm test` — contract, schema and documentation-drift suites.
- **A missing integration degrades visibly and says so.** Never a silent success, never a
  crash. `lib/brevo/sync.ts` is the reference.
- **Every table ships with its RLS policy in the same migration.**
- **Change the contract doc and its test in the same commit** as the code. If
  `docs.test.ts` fails, the code is the source of truth and the document is what needs
  changing — unless the code is genuinely wrong, in which case fix both.

## What not to do

- Do not put an LLM anywhere in the customer-facing value path.
- Do not add third-party analytics to the funnel. Telemetry is first-party for a reason.
- Do not extend the prototype instead of building the product. If the change belongs in the
  specification, change it there and say so; if it belongs in the product, build it properly.
- Do not repurpose the retired MVP's `roadmaps` table for Rift plans.
- Do not delete a prototype screen until its production replacement is live and checked
  against it.
- If a page renders but nothing responds to a click, it is almost certainly a stale `.next`
  from mixing `next build` with `next dev --turbopack`. Run `npm run dev:clean` **before**
  suspecting your own code. See docs/setup.md §2b.
- Do not "fix" a deliberate degraded state. A text step that downgraded to email because
  there is no phone consent is working correctly.

## Commands

```bash
npm run dev      # prototype at /prototype — needs no configuration at all
npm run dev:clean # use after any `npm run build` — see docs/setup.md §2b
npm test         # vitest
npm run build    # must pass before any handoff
npx tsc --noEmit # must be clean
```

## When something is ambiguous

The prototype is the specification. If this document and `lib/prototype/*.ts` disagree, **the
prototype wins**. If the prototype is genuinely silent on something, it is one of the open
decisions in handoff.md §8 — surface it rather than guessing, because most of those are
decisions the business owner is not allowed to delegate.
