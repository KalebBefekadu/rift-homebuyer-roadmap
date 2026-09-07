# Rift — Setup

Everything needed to go from a fresh clone to a running development environment, and
everything that must exist before the first production surface ships.

---

## 1. Run the specification — zero configuration

```bash
npm install
npm run dev
```

Open **http://localhost:3000/prototype**. No Supabase, no `.env`, no accounts. If this needs
configuration, something has been wired wrong.

Entry points:

| Route | What |
| --- | --- |
| `/prototype/buy` | Buyer product — landing, assessment, readout |
| `/prototype/sell` | Seller product |
| `/prototype/studio` | The agent surface |
| `/prototype/studio/queue` | Follow-up cadence, review queue, publishing seam |
| `/prototype/app` | Client portal |
| `/prototype/kaleb` | The agent's public site |

## 2. Verify before touching anything

```bash
npx tsc --noEmit    # must be clean
npm test            # contract, schema and docs-drift suites — must pass
npm run build       # must compile
```

If any of these fail on a fresh clone, fix that before starting work. All three pass today.

`npm test` includes `lib/core/docs.test.ts`, which fails when this documentation drifts
from the code it describes. If it fails, one of the two is wrong — and unless the code is
actually broken, it is the documentation.

## 2b. One trap, and it will cost you an afternoon

`npm run dev` uses **turbopack**; `npm run build` uses **webpack**. They share `.next`, and
running one after the other leaves it in a state that fails in ways that do not look like a
build problem:

- sometimes a 500 with `Cannot find module '../chunks/ssr/[turbopack]_runtime.js'`, which at
  least names itself;
- sometimes — and this is the expensive one — **the page renders perfectly and nothing on it
  responds to a click.** React hydrates the layout and stops. No console error, no failed
  request, no clue. It looks exactly like a bug in your own component.

If interactivity disappears for no reason, this is why. Run:

```bash
npm run dev:clean
```

It was diagnosed once, from scratch, by bisecting a component that turned out to be fine.
Do not repeat that.

## 2c. Bring up a database

The schema and its constraints are validated against a real Postgres, not by
eye. To run those suites locally:

```bash
docker run -d --name rift-pg -e POSTGRES_PASSWORD=pw -p 55432:5432 postgres:16-alpine
```

`npm test` picks it up automatically. Without it the database suites **skip**
rather than fail — a contributor with no Docker still gets a meaningful signal.
A migration that fails to apply is a real failure and says so; only an
unreachable database is a skip.

## 2d. Bootstrap the agent

Nothing is recorded until an agent row exists. Every write reports
"no agent row exists yet" and skips — honestly, but completely.

```bash
npm run rift:bootstrap
```

It is deliberately manual and not triggered by signup. Provisioning an agent
because somebody registered would hand the book of business to whoever got
there first, and in a single-agent product that mistake has no recovery.

Link it to a real login once the Supabase auth user exists:

```bash
node --env-file=.env.local scripts/bootstrap-rift.mjs --auth-user-id <uuid>
```

## 3. Configure the services

```bash
cp .env.example .env.local
```

`.env.example` documents every variable, grouped by service, with what happens when each is
absent. `.env.local` is gitignored and must stay that way — it has never been committed and
that record should hold.

| Service | Needed for | Blocking? |
| --- | --- | --- |
| Supabase | Anything with an account or a database | **Phase 1** |
| Sentry | Error capture | **Phase 1** — failures must surface from the first deploy |
| Brevo | Email delivery, contact sync | Phase 3 |
| Calendar | Real consultation booking | Phase 3 |
| SMS | Text steps in the nurture cadence | Phase 7 — degrades to email until then |
| E-signature | Representation agreements | Phase 5 |

Details, costs, and degradation behaviour: [integrations.md](integrations.md).

## 4. Accounts to create

Existing: **Supabase** (`uxcflubscmkbibepjmqj`), **Sentry**
(`ziid-development/value-first-realestate`), **Brevo** (free), **Vercel**
(`rift-homebuyer-roadmap`), **Calendar**.

Still to open, with lead times worth knowing now:

- **SMS provider.** Twilio or equivalent. US A2P traffic needs **10DLC brand registration**,
  which takes days rather than minutes — start it well before phase 7.
- **E-signature.** Dropbox Sign (~$20/mo) or DocuSign (~$25/mo).
- **A mortgage-rate source.** Not an account so much as a decision. Every monthly figure in
  the product currently rests on a hard-coded 6.5%. See [integrations.md](integrations.md) §7.

## 5. Before the first customer-facing deploy

Non-negotiable, and each one is cheap now and expensive later:

- [ ] **A Georgia attorney has read the TCPA consent wording** in `lib/core/privacy.ts`.
      It is written, unticked by default, specific, separate, and versioned — and it is
      marked in-product as not reviewed by counsel.
- [ ] **The broker has confirmed the client-record retention period.** It is the one business
      rule with a legal floor, currently defaulted to 5 years.
- [ ] **Sentry alerts exist** on readout delivery and consent recording.
- [ ] **Every table has an RLS policy.** Check, do not assume.
- [x] **The deletion job runs and actually deletes.** `/api/retention/sweep`, scheduled daily
      in `vercel.json`, plus `/api/forget` for a person who asks now. Deletion is deletion —
      not a flag, not an anonymised row — and `lib/db/flow.test.ts` proves it. **Still needs
      `CRON_SECRET` set in production, or the endpoint refuses to run.**
- [ ] **The rate assumption has a source and a date** displayed with every figure it touches.
- [ ] **Fair-housing check on the lead model.** The scoring inputs in `lib/core/lead.ts`
      are documented as the complete list, with no proxy for a protected class. Confirm that
      is still true of whatever ships.

## 5b. Continuous integration

`.github/workflows/ci.yml` runs typecheck, lint, tests and build on every push and pull
request, against a **real Postgres 16 service**.

The last step is the one worth keeping: it fails the run if any test skipped. The database
suites skip rather than fail when no Postgres is reachable — correct locally, catastrophic in
CI, where a skip means the constraints were never exercised and the suite passed while
proving nothing. That has already happened once in this repository.

## 6. Deployment

Vercel, project `rift-homebuyer-roadmap`. Set the same variables in the Vercel dashboard;
`SENTRY_AUTH_TOKEN` there enables source-map upload, and without it `next.config.ts` disables
upload rather than failing the build.

Supabase migrations apply with `scripts/apply-sql-migration.sh`. `scripts/bootstrap-supabase.sh`
provisions a project from scratch — useful for a staging environment, and worth having one
before there is real client data in production.

## 7. Repository map

```
app/
  page.tsx           development index — replaced by the real landing in phase 2
  prototype/         THE SPECIFICATION — 30 routes, no dependencies
  auth/callback/     Supabase auth callback
  actions/           server actions
components/rift/     the specification's component kit
lib/
  prototype/         domain logic — pure, I/O-free, unit-tested
  auth/              Supabase auth with a localStorage fallback
  supabase/          client, server, middleware
  brevo/             contact sync
  monitoring/        Sentry capture
supabase/
  migrations/        applied — currently the RETIRED MVP's schema, see schema.md
  seed/
scripts/             supabase bootstrap, migration apply, brevo attributes
docs/                read in the order given in AGENTS.md
```
