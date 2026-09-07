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

Open **[http://localhost:3000/prototype](http://localhost:3000/prototype)**. No Supabase, no
environment variables, no accounts.

If you are about to write code, read **[AGENTS.md](AGENTS.md)** first, then
**[docs/handoff.md](docs/handoff.md)**.

## What state this is in

The repository holds two things, and telling them apart matters more than anything else here.

**The specification** — `app/prototype`, `components/rift`, `lib/prototype`. 30 routes,
complete and reviewed, running with no configuration. It is the agreed product expressed as
working software rather than a wireframe, and it encodes the product's rules in executable
form: value is computed rather than generated, stale assistance programmes are suppressed
from matching, unapproved assistance is never folded into a headline figure, and an agent
editing the public questions cannot break the calculations behind them.

**The plumbing** — `lib/supabase`, `lib/auth`, `lib/brevo`, `lib/monitoring`, and the applied
Supabase migrations. Real, deployed, and reusable.

**The production product is not built yet.** Closing that distance is the work.

The first release is deliberately narrow: **buyer landing → assessment → readout → capture,
consent and booking**, with instrumentation from day one and the minimum of Studio needed to
answer the people it produces. Seller, portal, referral, and offers are specified and
deferred. [docs/handoff.md](docs/handoff.md) §2 defines the cut and the traffic gate that
opens the next phase.

## Documentation

| Document | What it answers |
| --- | --- |
| [AGENTS.md](AGENTS.md) | How to work in this repository. Read first |
| [docs/agent-kickoff.md](docs/agent-kickoff.md) | The kickoff prompt for an AI coding agent |
| [docs/handoff.md](docs/handoff.md) | **What ships first**, build order, contracts that must not drift, tests to write first |
| [docs/setup.md](docs/setup.md) | Clone to running, accounts to open, the pre-launch checklist |
| [docs/schema.md](docs/schema.md) | The data model and the five decisions that shape it |
| [docs/integrations.md](docs/integrations.md) | Every external service, and what happens when it is missing |
| [docs/calculations.md](docs/calculations.md) | The compute contract and its reference case |
| [docs/architecture.md](docs/architecture.md) | Technical model, security boundary, engineering rules |
| [docs/vision.md](docs/vision.md) | Why Rift exists and what it refuses to do |
| [docs/product.md](docs/product.md) | The full product and operating model |
| [docs/prototypes.md](docs/prototypes.md) | Route map of the specification |
| [docs/benchmark.md](docs/benchmark.md) | The instrument that grades all of it |

## Commands

```bash
npm run dev                    # prototype at /prototype
npm test                       # vitest — the compute contract
npm run build                  # must pass before any handoff
npm run brevo:ensure-attributes # one-time Brevo custom-attribute bootstrap
```

## Current grade

**93 against [docs/benchmark.md](docs/benchmark.md), and provisional.** The benchmark's own
rule is that no score above 84 is validated until field metrics exist. Instrumentation is
built and verified working, and **every number it reports is currently zero**. The first 200
real assessments are the actual grading event.
