# Working in this repository

Read this before writing code. It is short on purpose.

## What this repository is

Rift is a client-experience and agent-operating platform for residential real estate, built
for **one Georgia agent**. Its lead-generation thesis is *overloading value on the front end
so leads convert*: a stranger gets a complete, computed, honest readout of their situation
for free, before any account, and keeps it whether or not they ever speak to the agent.

Everything else exists to make that promise survivable at scale for one person.

## What state it is in (12 October 2026)

**Built and live.** The public site (the values, saved plans, programs, booking, privacy),
the client portal (invitation sign-in, the buyer's journey) and Operations (the agent's
workspace) all run in production against Supabase. What is left before real traffic is
mostly not code: email deliverability, the broker's sign-off, counsel, the Amharic review,
backups, and the pilot itself. The list, with owners, is
[docs/audit/full-audit-2026-10-12.md](docs/audit/full-audit-2026-10-12.md) §5.

| Where | What it is |
| --- | --- |
| `app/(rift)`, `app/(campaign)` | The public site |
| `app/(client)` | The client portal, behind invitation sign-in |
| `app/(operations)` | Operations, the agent's workspace, behind sign-in |
| `app/api` | Route handlers: capture, plan save, crons, health |
| `lib/core` | The domain: compute, rules, wording. Pure: no React, no I/O |
| `lib/db` | The data layer, server-only, every call returning a `DbResult` |
| `lib/rift` | Browser helpers for the public site (answers, telemetry, session) |
| `supabase/migrations` | The schema, with its row-level security, one file per change |
| `app/styles/rift.css` | The one stylesheet every surface uses |
| `app/prototype`, `lib/prototype` | The September specification. 404 in production, reference only |

## Read in this order

0. **[docs/blueprint-v5/README.md](docs/blueprint-v5/README.md)**: the only source of truth for
   what Rift is and what gets built next. Where it and anything below disagree about plans, it
   wins.
1. **[docs/audit/full-audit-2026-10-12.md](docs/audit/full-audit-2026-10-12.md)**: the latest
   walk through the whole product, what is left before production, and what to cut.
2. **[docs/handoff.md](docs/handoff.md)**: the engineering record. **§4 (the contracts that
   must not drift) and §6 still bind.** Its phase order and traffic gate (§2, §3) were set aside
   by blueprint decisions D08 and D21.
3. **[docs/schema.md](docs/schema.md)**: the data model, and the decisions that shape it.
4. **[docs/integrations.md](docs/integrations.md)**: every external service and what happens
   when it is missing.
5. **[docs/calculations.md](docs/calculations.md)**: the compute contract and its reference case.
6. **[docs/architecture.md](docs/architecture.md)** and **[docs/setup.md](docs/setup.md)**: how
   it fits together, and clone to running.

Report anything ambiguous or contradictory in the same change that builds around it, in the
commit or the blueprint, so it is written down where the next person will look.

`npm test` includes `lib/core/docs.test.ts`, which fails when the docs and the code disagree
about a number that matters. It does not check prose. Keep finding the rest.

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
6. **Telemetry stores question ids and timings, never answer values.** Enforced by an
   **allowlist** in `lib/core/telemetry.ts` and an identical one in the `rift_events` CHECK
   constraint, not a blocklist, which is what both of them were until a landing page sent
   the visitor's residency status through all three layers unnoticed. Adding a key needs a
   migration, on purpose.
7. **First touch is immutable.** Later visits update last touch only.
8. **A sequence stops the moment a human replies.**
9. **Nothing reaches `verified` without a named party.**
10. **Never colour alone.** Every state carries an icon and a word.
11. **A stated timeline is compared against the computed one, and "you said" requires that
    they said it.** A default applied because a parameter was missing is a planning
    assumption, not a quote. A question opens empty rather than pre-filled with the default.
    Collecting an answer and never showing the person what it means against their own
    numbers is the polite version of hiding it.

## How to work

- **Match the surrounding code.** This codebase comments *why*, not *what*, and the comments
  carry real reasoning. Keep that. A comment restating the line below it is noise; a comment
  explaining why the obvious approach is wrong is the most valuable line in the file.
- **The domain layer is I/O-free.** No fetch, no database client, no browser storage, no React under
  `lib/core/`. It is why the contracts are testable; `lib/core/layers.test.ts` checks it.
- **Write the acceptance test before the feature.**
- **A missing integration degrades visibly and says so.** Never a silent success, never a
  crash. `DbResult` in `lib/db/result.ts` (`ok`, `skipped`, or `failed`) is the reference, and
  a `skipped` must reach the person as words, not as "Saved."
- **Every table ships with its RLS policy in the same migration.**
- **Change the contract doc and its test in the same commit** as the code. If
  `docs.test.ts` fails, the code is the source of truth and the document is what needs
  changing, unless the code is genuinely wrong, in which case fix both.
- **A new public page goes on the phone suite** (`e2e/phone.spec.ts`), answered and
  unanswered. The one page missing from it scrolled sideways for weeks.
- **No em dashes**, in the product or the docs.

## What not to do

- Do not put an LLM anywhere in the customer-facing value path.
- Do not add third-party analytics to the funnel. Telemetry is first-party for a reason.
- Do not extend the prototype. It is the September specification, kept for reference, and
  every screen in it has a live replacement. Build in the product.
- Do not repurpose the retired MVP's tables (`clients`, `roadmaps`, `dpa_programs`,
  `agents_settings`). They are history.
- If a page renders but nothing responds to a click, it is almost certainly a stale `.next`
  from mixing `next build` with `next dev --turbopack`. Run `npm run dev:clean` **before**
  suspecting your own code. See docs/setup.md §3.
- Do not "fix" a deliberate degraded state. A text step that downgraded to email because
  there is no phone consent is working correctly.
- Do not add features ahead of the pilot without a decision in blueprint §11. The product
  already has more surface than users.

## Commands

```bash
npm run verify    # typecheck, lint, test, build: run this before every commit
npm run dev       # the site at http://localhost:3000; degrades honestly with no configuration
npm run dev:clean # use after any `npm run build`; see docs/setup.md §3
npm test          # vitest
npm run lint      # eslint .
npm run test:e2e  # Playwright, against a production build with no database
```

## When something is ambiguous

Blueprint v5 decides plans; the code and its tests decide behaviour. If the blueprint is
silent, it is one of the open decisions in its §11 and §12: surface it rather than guessing,
because most of those are decisions the business owner is not allowed to delegate.
