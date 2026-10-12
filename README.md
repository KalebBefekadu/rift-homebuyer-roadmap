# Rift

A client-experience and agent-operating platform for the complete residential real-estate
lifecycle, built for one Georgia agent.

Its lead-generation thesis is **overloading value on the front end so leads convert**: a
stranger receives a complete, computed, honest readout of their situation for free, before
any account, and keeps it whether or not they ever speak to the agent. Everything else in the
product exists to make that promise survivable at scale for one person.

## Start here

```bash
npm install
npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)**. With no environment variables every
public page still renders and says what is not connected; [docs/setup.md](docs/setup.md)
connects Supabase, Brevo, Sentry and the rest.

If you are about to write code, read **[AGENTS.md](AGENTS.md)** first.

## What state this is in (12 October 2026)

**Built and live:**
- **The public site:** a value per question (cash to close, monthly cost, timeline, what fits,
  assistance, lender questions; what a seller keeps, selling costs, what to fix, unclaimed
  money; buying from abroad), saved plans, Georgia programs, booking and privacy.
- **The client portal:** invitation sign-in and the buyer's journey.
- **Operations:** the agent's workspace, from Today to transactions, calendar and reports.

**Not yet:** real traffic and real clients. What stands between here and the pilot is mostly
not code (email deliverability, the broker's sign-off, counsel, the Amharic review, backups);
the list with owners is [docs/audit/full-audit-2026-10-12.md](docs/audit/full-audit-2026-10-12.md) §5.

The September prototype (`app/prototype`) is kept as reference, answers 404 in production, and
is not extended.

## Documentation

| Document | What it answers |
| --- | --- |
| [AGENTS.md](AGENTS.md) | How to work in this repository. Read first |
| [docs/blueprint-v5/README.md](docs/blueprint-v5/README.md) | What Rift is and what gets built next. The source of truth for plans |
| [docs/audit/full-audit-2026-10-12.md](docs/audit/full-audit-2026-10-12.md) | The latest audit: walkthrough scores, what is left, what to cut |
| [docs/handoff.md](docs/handoff.md) | The engineering record: contracts that must not drift |
| [docs/setup.md](docs/setup.md) | Clone to running, accounts to open, the pre-launch checklist |
| [docs/schema.md](docs/schema.md) | The data model and the decisions that shape it |
| [docs/integrations.md](docs/integrations.md) | Every external service, and what happens when it is missing |
| [docs/calculations.md](docs/calculations.md) | The compute contract and its reference case |
| [docs/architecture.md](docs/architecture.md) | Technical model, security boundary, engineering rules |
| [docs/testing-guide.md](docs/testing-guide.md) | How to walk the product by hand |
| [docs/vision.md](docs/vision.md) | Why Rift exists and what it refuses to do |

## Commands

```bash
npm run dev       # the site, at http://localhost:3000
npm run verify    # typecheck, lint, test, build: before every commit
npm test          # vitest: contracts, schema and documentation drift
npm run test:e2e  # Playwright, against a production build with no database
npm run deploy    # the only way to production; see docs/setup.md
```

## How it is measured

Not by a grade. The thesis is that value converts, so the numbers that matter are in
Operations, Reports: visitors, values answered, plans saved, calls booked, clients taken on.
Every one of them is zero until the pilot starts.
