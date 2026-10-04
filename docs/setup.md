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

## 3. One trap, and it will cost you an afternoon

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

## 4. Bring up a database

The schema and its constraints are validated against a real Postgres, not by
eye. To run those suites locally:

```bash
docker run -d --name rift-pg -e POSTGRES_PASSWORD=pw -p 55432:5432 postgres:16-alpine
```

`npm test` picks it up automatically. Without it the database suites **skip**
rather than fail — a contributor with no Docker still gets a meaningful signal.
A migration that fails to apply is a real failure and says so; only an
unreachable database is a skip.

## 5. Bootstrap the agent

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

## 6. Configure the services

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

## 7. Accounts to create

Existing: **Supabase** (`uxcflubscmkbibepjmqj`), **Sentry**
(`ziid-development/value-first-realestate`), **Brevo** (free), **Vercel**
(`rift-homebuyer-roadmap`), **Calendar**.

Still to open, with lead times worth knowing now:

- **SMS provider.** Twilio or equivalent. US A2P traffic needs **10DLC brand registration**,
  which takes days rather than minutes — start it well before phase 7.
- **E-signature.** Dropbox Sign (~$20/mo) or DocuSign (~$25/mo).
- **A mortgage-rate source.** Not an account so much as a decision. Every monthly figure in
  the product currently rests on a hard-coded 6.5%. See [integrations.md](integrations.md) §7.

## 8. Running the whole thing locally

```bash
scripts/local/up.sh                       # Postgres + PostgREST + a /rest/v1 proxy
scripts/local/run.sh npx next start       # refuses unless the database is local
npm run verify:queries
npm run test:e2e:operations              # Operations in a browser, signed in, against this stack
scripts/local/down.sh
```

`test:e2e:operations` opens every Operations page as the local agent with the demo book
(`npm run local:seed-demo`) on desktop and phone, and fails on a page that says a read failed
or scrolls sideways. CI runs it on every push. Locally, `PW_CHANNEL=chrome` uses an installed
Chrome instead of Playwright's own browser download.

A local stand-in for Supabase: it applies every migration, seeds the registry, creates the
agent row, and prints the environment to run the app against it.

It exists because everything had been verified in pieces — SQL against Postgres, query syntax
against PostgREST, the UI against fixtures — and running the **actual application** against a
database immediately found three defects none of those could have:

- `NEXT_PUBLIC_` variables are inlined at build time, so server code reading
  `NEXT_PUBLIC_SUPABASE_URL` talks to whatever project the bundle was compiled against,
  whatever the runtime environment says.
- `currentAgentId()` cached a null result permanently, so an instance that started before the
  bootstrap answered "no agent row exists yet" until it was restarted.
- The nurture runner reported touches it could not send as "held for the agent", sending
  somebody to look for a task that did not exist.

To see Studio, which is behind a login, mint a session cookie for the local user:

```bash
node -e '
const c=require("crypto"),S="rift-local-test-secret-at-least-32-chars-long",U="cccc0000-0000-4000-8000-000000000001",n=Math.floor(Date.now()/1e3);
const b=o=>Buffer.from(JSON.stringify(o)).toString("base64url");
const h=b({alg:"HS256",typ:"JWT"}),p=b({sub:U,aud:"authenticated",role:"authenticated",email:"kaleb@example.com",iat:n,exp:n+86400});
const jwt=h+"."+p+"."+c.createHmac("sha256",S).update(h+"."+p).digest("base64url");
console.log("sb-localhost-auth-token=base64-"+Buffer.from(JSON.stringify({access_token:jwt,token_type:"bearer",expires_in:86400,expires_at:n+86400,refresh_token:"local",user:{id:U,aud:"authenticated",role:"authenticated",email:"kaleb@example.com",app_metadata:{},user_metadata:{},created_at:new Date(0).toISOString()}})).toString("base64url"));'
```

Set that as a cookie for localhost. It renders Studio with real data; it does not exercise the
magic-link round trip, which needs a real GoTrue.

No auth verification, no RLS enforcement, no TLS. Local development only.

### A full demo book (local only)

An empty database shows every Operations page in its empty state, which is the least useful
way to look at them. To see them with a realistic book of business:

```bash
npm run local:seed-demo
```

It loads about thirty-five invented Atlanta-area people into the `postgres` database inside
the `rift-pg` container: buyers, sellers, one household buying and selling at once, buyers
from abroad, leads in every band (answered, unanswered, gone quiet, archived), and journeys at
every stage on both sides, with search briefs, shortlists, tours, offers and counters,
contracts with dated deadlines and workstreams in every state, listings with showings and
weekly reviews, pricing and proceeds versions, released offers and a seller's choice, outbox
alerts in every state, campaigns, program checks that need review, a failing job, rates and
some decided and some undecided settings. Everything is dated relative to the moment it runs,
so running it again makes the book fresh again.

It is re-runnable and touches only its own rows: every row it writes has an id starting
`de30` (sessions start `demo-`, and the settings it decides are signed "Kaleb Befekadu
(demo)"), and it deletes exactly those, in the same transaction, before inserting. Rows other
tools or test runs left in the local database stay, and show up alongside the demo book.

`scripts/local/seed-demo.mjs` generates the SQL by importing the app's own `lib/core`
functions (scoring, the outbox content hash, the Matrix package, saved plans, deadline
resolution), so stored values match what the pages compute. `node scripts/local/seed-demo.mjs`
prints the SQL instead of loading it.

**Never run it against a hosted database.** The script only ever pipes into the local
container, and nothing in it is a real person.

## 9. Verifying the query syntax

The riskiest code in the data layer is the part TypeScript cannot see. Embedded selects like
`rift_leads(name,email)` and `rift_touches(step_id)` are **strings** — the compiler does not
check them, the build does not check them, and a broken one fails at runtime with a message
about a schema cache, taking a page down rather than a query.

```bash
npm run verify:queries
```

Runs every query the data layer uses against a real PostgREST, through the real supabase-js
query builder. Setup instructions are at the top of `scripts/verify-queries.mjs`; it needs the
Postgres from §4 plus a PostgREST container.

This found a live defect on its first run: the test setup was applying two of three
migrations, so a table existed in the repository and not in the database under test.

## 10. Continuous integration

`.github/workflows/ci.yml` runs typecheck, lint, tests and build on every push and pull
request, against a **real Postgres 16 service**.

The last step is the one worth keeping: it fails the run if any test skipped. The database
suites skip rather than fail when no Postgres is reachable — correct locally, catastrophic in
CI, where a skip means the constraints were never exercised and the suite passed while
proving nothing. That has already happened once in this repository.

## 11. Before the first customer-facing deploy

Non-negotiable, and each one is cheap now and expensive later:

- [ ] **A Georgia attorney has read the TCPA consent wording** in `lib/core/privacy.ts`.
      It is written, unticked by default, specific, separate, and versioned — and it is
      marked in-product as not reviewed by counsel.
- [ ] **The broker has confirmed the client-record retention period.** It is the one business
      rule with a legal floor, currently defaulted to 5 years.
- [ ] **Sentry alerts exist** on readout delivery and consent recording.
- [ ] **Every table has an RLS policy.** Check, do not assume.
- [ ] **The deletion job runs and actually deletes.** `/api/retention/sweep`, scheduled daily
      in `vercel.json`, plus `/api/forget` for a person who asks now. Deletion is deletion —
      not a flag, not an anonymised row — and `lib/db/flow.test.ts` proves it. **Still needs
      `CRON_SECRET` set in production, or the endpoint refuses to run.**

      This was ticked and it was not true. The job was correct, the secret was set, the
      tests passed, and the route exported `POST` while Vercel Cron sends GET — so it had
      never run once. Fixed, and the health check now reports whether anything is actually
      past its deletion date rather than whether the secret exists. **Leave this unticked
      until `checks.retention` has read `clear` on a day when there was something to
      delete** — the tick is for observed behaviour, not for shipped code.
- [ ] **The rate assumption has a source and a date** displayed with every figure it touches.
- [ ] **Fair-housing check on the lead model.** The scoring inputs in `lib/core/lead.ts`
      are documented as the complete list, with no proxy for a protected class. Confirm that
      is still true of whatever ships.

## 11b. Is it working?

```bash
curl -s https://<host>/api/health | jq
```

Reports **readiness**, not just liveness. A process that is running but cannot reach its
database, or has no agent row, is up and useless — and every write degrades silently and
honestly in that state, which is correct behaviour and also means nobody finds out. This is
where somebody finds out.

```json
{ "ok": true, "checks": {
  "database": "reachable", "agent": "ready",
  "email": "ready", "calendar": "missing",
  "scheduler": "configured", "monitoring": "configured",
  "rate": "stale (never recorded)",
  "retention": "clear", "schema": "current",
  "jobs": "nurture-run ok, retention-sweep ok, rates-refresh ok, daily-summary ok, program-check ok" } }
```

503 only when the database or the agent row is missing, because those stop the product doing
its job. Everything else degrades honestly and says so on screen — paging somebody at 3am
because SMS is not wired yet is how alerts get muted.

It names what is **missing**, never what is configured: no URLs, no key fragments, no
versions. A health endpoint that describes the stack is a reconnaissance endpoint, and this
one is public because a monitor needs it to be.

`scheduler` reports the secret; **`retention` reports the outcome**, and it is the one to
watch. `clear` means nothing is sitting past its deletion date. `overdue` means the sweep
has stopped, however it stopped — which is the point, because the way it actually stopped
was one nobody had predicted. It is yes or no and never a count: this endpoint is public,
and how many people are in the funnel is not a figure to hand to whoever asks. The answer
is cached for five minutes per instance so the check cannot be used as an amplifier.

**`schema`** says whether production has the newest migration this code was built with
(`lib/db/schema-version.ts`, checked against the `rift_schema_migrations` ledger the apply
script writes). `behind` means a deploy went out ahead of its migration: the pages that read
the missing column will say "not migrated yet", and this is the line that names the cause.

## 12. Deployment

Vercel, project `rift-homebuyer-roadmap`. Set the same variables in the Vercel dashboard;
`SENTRY_AUTH_TOKEN` there enables source-map upload, and without it `next.config.ts` disables
upload rather than failing the build.

**Deploy with `npm run deploy`** (`scripts/deploy.sh`), never a bare `vercel deploy`. The
project is not connected to GitHub, so `vercel deploy` uploads whatever folder it is run in:
untracked files, another session's unfinished work, commits a rejected push never delivered.
The script refuses unless HEAD is exactly `origin/main` and CI has passed that commit (it waits
while CI runs), then deploys a clean checkout of it and prints the health status. Connecting
the Vercel project to the repository (deploy on push to `main`, CI as a required check) would
replace it.

Supabase migrations apply with `scripts/apply-sql-migration.sh`. It reads
`SUPABASE_ACCESS_TOKEN` from the environment or `.env.local`, and records each migration in
`rift_schema_migrations` in the same request, which `/api/health` compares with the code.
After adding a migration, move `LATEST_MIGRATION` in `lib/db/schema-version.ts`; a test fails
until you do. `scripts/bootstrap-supabase.sh`
provisions a project from scratch — useful for a staging environment, and worth having one
before there is real client data in production.

**Without a connection string**, `output/pending-migrations.sql` is every migration the
production database is still owed, concatenated in order, ready to paste into the Supabase
SQL editor. It is idempotent — running it twice is safe — and it has been applied twice in a
row against a copy of the production schema. Regenerate it by concatenating whichever files
under `supabase/migrations/` have not been applied; delete it once they have.

## 13. Repository map

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
