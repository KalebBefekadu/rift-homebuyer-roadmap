# Rift — Integrations

Every external service Rift touches: what it is for, what it costs, **what happens when it
is missing**, and which build phase wires it.

The last of those matters most. A prototype degrades honestly or it lies, and the difference
is decided by the person writing the integration, not by the person using it. The rule for
this whole file:

> **A missing integration must produce a visible, named, degraded state — never a silent
> success and never a crash.** `lib/brevo/sync.ts` is the reference implementation: no API
> key returns `{ ok: true, skipped: true, reason }`, and the caller can tell the difference
> between "sent" and "not configured".

The prototype at `/prototype` needs **none** of these. It runs on an empty `.env` file.

---

## 1. What is wired today

| Service | Purpose | Status | Code |
| --- | --- | --- | --- |
| **Supabase** | Auth, Postgres, RLS, file storage | Project live, schema is the retired MVP's | `lib/supabase/*`, `lib/auth/*`, `supabase/migrations/` |
| **Sentry** | Errors, tracing, source maps | Wired and deployed | `next.config.ts`, `instrumentation*.ts`, `lib/monitoring/capture.ts` |
| **Brevo** | Transactional email, contact attributes | Client written, one caller | `lib/brevo/sync.ts`, `app/actions/brevo.ts` |
| **Vercel** | Hosting, edge, cron | Project linked (`rift-homebuyer-roadmap`) | `.vercel/project.json` |

## 2. What is specified but has nothing behind it

| Need | Specified in | Consequence of the gap |
| --- | --- | --- |
| **Calendar booking** | `/prototype/book` | The confirmation screen is a `setState`. Speed-to-lead is not real until a stranger can take a slot with no human in the path |
| **SMS** | `nurture.ts` text steps, `privacy.ts` TCPA consent | Every text step downgrades to email forever. The consent gate — the hard, legally load-bearing part — is already built and currently protects nothing |
| **E-signature** | `clients.ts` `rep` field, `seam.ts` `canPublish` | Representation gates the journey and blocks publishing, against a status somebody sets by hand |
| **Live mortgage rates** | `compute.ts` `ratePct` | Every monthly figure rests on a hard-coded 6.5%. See §7 |

---

## 3. Supabase

**Project:** `uxcflubscmkbibepjmqj` · **Cost:** free tier, then $25/mo Pro.

Used for four things, and it is worth naming them separately because they fail differently:

1. **Auth** — `lib/auth/index.ts` already switches between Supabase and a localStorage
   fallback based on whether keys are present. Keep that switch. It is what lets the
   product be developed on a plane.
2. **Postgres + RLS** — the data layer. See [schema.md](schema.md) for the model to build.
3. **Storage** — client documents. Not yet used; phase 6.
4. **Realtime** — not needed yet. Do not reach for it before there is a second concurrent
   viewer of anything.

### The migration situation, stated plainly

`supabase/migrations/` contains three applied migrations that create `agents_settings`,
`clients`, `roadmaps`, and `dpa_programs` — **the retired portal MVP's model, not Rift's.**
They are kept because they are applied to the live project and deleting applied migrations
desynchronises the history.

The build's first schema migration is therefore additive and Rift-shaped, and the old tables
are dropped only once nothing reads them. **Do not repurpose `roadmaps` for Rift plans.**
It is a different shape with a different lifecycle, and the rename will cost more than the
table saves.

### Rules
- Every table ships with an RLS policy in the **same migration**. A table without a policy is
  either wide open or unreadable, and both are found in production.
- The service-role key never reaches the browser and is never `NEXT_PUBLIC_`.
- The anon key is public by design. RLS is the protection; treat the key as a URL.

---

## 4. Sentry

**Org/project:** `ziid-development` / `value-first-realestate` · **Cost:** free tier.

Configured in `next.config.ts` with `tunnelRoute: "/monitoring"` so ad-blockers do not
silently eat the envelope — which is the whole failure mode of client-side error reporting.

`captureOpError(error, { op, extra })` is the one entry point. Use it for every integration
failure rather than `console.error`, because benchmark 2.5 requires that **nothing fails
silently**, and an operator cannot act on a log line nobody reads.

### What to add during the build
- A tag for the build phase, so an error in a half-built surface is triageable.
- Alerts on the two operations where a silent failure costs a client rather than a page
  view: **readout delivery** and **consent recording**.
- Do not send PII in `extra`. `lib/brevo/sync.ts` shows the pattern — it sends
  `hasEmail: boolean`, never the address.

---

## 5. Brevo

**Cost:** free tier, 300 emails/day. That ceiling is a real constraint on the nurture
cadence and is the reason §6 exists.

`syncContactToBrevo()` upserts a contact with four custom attributes: `STAGE`,
`TIME_TO_BUY`, `RIFT_CLIENT_ID`, `RIFT_EVENT`. Bootstrap them once with
`npm run brevo:ensure-attributes`.

### The wire-contract rule
`TimeToBuy` and `ClientStage` are now declared **inside** `lib/brevo/sync.ts` rather than
imported from the product's domain types. This is deliberate. Attribute values already sitting
in Brevo are a wire contract with an external system; coupling them to whatever the product
currently calls a stage means a product-side rename silently orphans every existing contact.
Widen them on purpose, and migrate existing contacts in the same change.

### What the build adds
- **Transactional templates** for the readout delivery and each automatic nurture step.
- **Bounce handling.** A bounced email must become an agent task — it is a `STOPS` condition
  in `nurture.ts` (`bounced`) and it is specified as a Today-queue item. A bounce that only
  reaches a dashboard is a silent failure wearing a chart.
- **Unsubscribe**, honoured immediately and across every channel.

---

## 5b. The scheduler

`/api/nurture/run` sends what the cadence owes. Vercel Cron calls it daily at
14:00 UTC — `vercel.json`. Once a day is deliberate: the sequences are defined
in days, so a more frequent run would add chances to send something twice
without making any touch arrive sooner.

It refuses to run without `CRON_SECRET`. An unauthenticated endpoint that sends
email on demand is a way to have your sending reputation destroyed by a stranger
with curl.

Only **automatic** steps are sent. Calls and steps marked "needs him" stay in
the queue for the agent — a product that auto-dials on somebody's behalf has
decided something that was not its to decide.

The order is claim, send, record. A crash between sending and recording would
otherwise resend on the next run, and the person receiving it has no way to know
it was a bug rather than a company that does not pay attention. The claim is a
unique constraint on (enrolment, step), which is the only thing that survives two
workers racing.

### Retention

`/api/retention/sweep` enforces the schedule in `lib/core/privacy.ts`, daily at 03:00 UTC.
It reports exactly what it removed, because a deletion job that runs silently is one nobody
notices has stopped — and the failure mode of a stopped retention job is a growing pile of
strangers' finances that the readout promises has already been deleted.

Two things it deliberately does not touch, and says so in its own output: client records,
whose period has a legal floor and is the broker's to set; and consent records, which outlive
the relationship because they are what proves the contact was lawful.

## 6. Calendar — built, pending credentials

`lib/db/calendar.ts`, written against an interface rather than a vendor because the vendor is
the least durable thing here. Cal.com is the implementation; swapping it should touch that one
file. Set `CAL_API_KEY`, `CAL_EVENT_TYPE_ID` and optionally `RIFT_TIMEZONE`.

**The rule that survives any provider: never offer a slot that is not real.** With no
credentials the booking screen asks for a rough preference instead of showing times, and says
which state it is in. Three states, three screens:

| State | What the visitor sees |
| --- | --- |
| `calendar` | Real openings. Taking one holds it |
| `unconfigured` | "Live booking is not switched on yet — tell us roughly when suits" |
| `error` | "The calendar is not responding, so we are not going to show you times that might not exist" |

Inventing four plausible times to paper over either of the last two is a promise the product
cannot keep, and the person discovers it only after choosing one — at the exact moment they
had decided to trust it.

Two requirements that survived the integration and are easy to lose in a refactor:

- **The call is about their blocker.** `?topic=` carries the readout's computed blocker into
  the booking title. It is one query parameter and it is why the screen converts.
- **Consent is captured at booking, not after.** The TCPA checkbox blocks submission when a
  phone number is present, and the phone is only passed to the calendar when it is ticked. A
  vendor's own booking widget would not carry that gate, which is the argument for the API
  over the embed.

Holding the slot happens after the lead is stored and is reported separately. A calendar
outage must not lose the relationship — the contact details are the durable part; a time can
be rearranged.

---

## 7. Not yet chosen

### SMS
Needed by the `now` and `soon` nurture sequences. **Twilio** is the default recommendation
(~$0.0079/message plus ~$1.15/mo for a number; a 10DLC brand registration is required for
A2P traffic in the US and takes days, not minutes — start it early).

Until it exists, `resolveChannel()` in `nurture.ts` downgrades every text step to email and
**says so on screen**. That is the correct degraded state and it should not be "fixed" by
sending the text anyway or by dropping the touch.

The consent side is already done and is the part with legal teeth: unticked by default,
specific, separate, versioned, and stored with its exact wording (`privacy.ts`). Do not let
an SMS integration introduce a second, looser consent path.

> Not reviewed by counsel. Have a Georgia attorney read the consent wording before the first
> message sends.

### E-signature
**Dropbox Sign** (~$20/mo) or **DocuSign** (~$25/mo). Needed for buyer agency and listing
agreements. The product already treats representation as a lifecycle gate with five states
(`None / Prepared / Sent / Signed / Expired`) — that vocabulary maps cleanly onto any
provider's webhooks, so build to the five states and let the vendor fill them.

### Mortgage rates — built, needs a weekly habit

Was the largest unstated assumption in the product: `ratePct` was a literal with no source and
no date, and every monthly figure, gap and timeline depends on it.

`rift_rate_snapshots` stores the rate with its source and the date it was true. The readout
applies the stored rate and prints it beside the figures it produced, labelled **Current**,
**Ageing** (over 7 days) or **Not recent** (over 21 days). With nothing recorded it falls back
to the same 6.5% the engine always used — but says so, as "a starting assumption at no
recorded date" rather than dressing it up as an observation.

Snapshots rather than one mutable row, because a readout is an immutable record of what
somebody was told. When a plan later disagrees with their readout, "the rate moved from 6.5%
on 19 Aug to 6.75% on 6 Sep" is the explanation — and it only exists if the old value was kept.

```bash
npm run rift:rate -- 6.72 --source "Freddie Mac PMMS" --as-of 2026-09-04
```

**Deliberately a weekly command, not a scraper.** Free rate APIs are unreliable and their
terms change, and a wrong rate pulled automatically is worse than a right one typed weekly
because nobody is watching the automatic one. Replace the argument with a fetch when there is
a licensed feed; everything else stays.

---

## 7b. Rate limiting

The public endpoints write to the database without an account, which is the product's central
promise and also its most obvious abuse surface. Somebody with curl and a loop can fill
`rift_events` in an afternoon, and the damage is not the storage bill — it is that the funnel
report becomes fiction and the agent makes decisions from it without knowing.

`lib/core/ratelimit.ts` is a fixed-window limiter keyed on client IP. Two honest limitations,
stated rather than discovered:

- **In-memory**, so each serverless instance keeps its own count and the real limit is the
  configured one times the number of instances. Enough to stop a script, useless against a
  distributed attacker — the correct trade at this scale, since a Redis dependency to defend
  against an adversary nobody has is a worse deal.
- **Fixed window**, so a burst straddling a boundary gets double the allowance.

When either stops being acceptable, swap the map for a shared store and keep the interface.

A refusal returns 429 with `Retry-After` and does **not** name the threshold. An error message
that states the limit is a tuning guide for whoever is trying to get around it.

### Deadlines

The readout is the revenue path and it renders from two database reads. A read that **fails**
already falls back — to the built-in registry, which is real verified data, and to the
documented starting rate. A read that **hangs** had no answer at all: nothing has failed yet,
so the page waits until the platform kills the function and the visitor sees nothing.

A slow database is a likelier outage than a broken one, and it was the only kind this path
could not survive.

Both reads now run against a 2-second deadline, chosen against the visitor rather than the
database: past about two seconds on a phone people leave, so waiting longer for a better
answer trades a certainty for a possibility. A timeout is reported to Sentry, because a
product that degrades invisibly looks healthy on every dashboard.

Applied to every read on a public page. Verified by freezing PostgREST entirely and hitting
all five:

| Page | Frozen database |
| --- | --- |
| `/buy` | 200 in 0.03s |
| `/buy/programs` | 200 in 0.04s |
| `/buy/start` | 200 in 2.1s — the built-in funnel, fully usable |
| `/book` | 200 in 1.2s |
| `/buy/results` | 200 in 2.2s — correct figures, programmes from the built-in registry |

The assessment was the last one to hang, for thirty seconds, and it was the only read still
unbounded. Its fallback is the built-in funnel — the definition the compute engine was
designed against — so a hang had an obviously right answer and was producing a blank page
instead.

The shared readout is the exception with no fallback: there is no built-in version of
somebody's own numbers. Its deadline converts a hang into the honest "we cannot open this
right now" the page already knew how to show.

Writes have their own deadline of **6 seconds**, and a different rule. There is no fallback
worth rushing to, but an unbounded write is not a patient one — it holds a serverless function
open until the platform kills it, which exhausts concurrency, is billed the whole time, and
leaves the browser with nothing either way.

A write that misses its deadline reports **failure**. Never success: the one thing worse than
a slow write is a fast lie about one.

Frozen database, with a warm agent cache so the bounded lookup is skipped:

```
POST /api/events    200 in 6.0s   {"ok":false,"error":"the events did not write in time"}
POST /api/capture   200 in 8.0s   {"ok":false,"error":"we could not save that just now"}
```

Both return 200 because instrumentation must never break a funnel and a capture failure is
not the visitor's problem — but the body says plainly that nothing was stored, and Sentry
carries the reason.

The lookup that gates every write is bounded too. It is a read, not a write, and an unbounded
one in front of a write means a hung database holds every request open — which was exactly the
state before this: `/studio` and both write endpoints hung for the full 25-second client
timeout while every public page survived.

### Request size

Rate limiting caps requests per minute and says nothing about the size of each. The readout
endpoint stores whatever `inputs` and `figures` it is given as jsonb, so ten megabytes ten
times a minute fills a database quickly and quietly.

Every public endpoint reads its body through `readJson`, which refuses anything over **64KB**
with a 413. That is far more than any real payload — the largest is a readout with three
tracked figures and a matched programme list, well under 8KB — and far less than anything
worth storing by accident.

It checks `Content-Length` first because that is free, then counts what actually arrives: a
declared length is a claim, and a chunked request need not make one at all. The count is in
bytes rather than characters, because a body of emoji is roughly four times its character
count and the limit is about storage.

## 8. What NOT to add

Stated so nobody spends a sprint on it:

- **No LLM in the front-end value path.** Every customer-facing number is computed
  (`compute.ts`) or matched from a verified registry (`registry.ts`). This is what makes the
  front end free to run, impossible to hallucinate, and impossible to inflate through abuse.
  It is contract 3.1 in [handoff.md](handoff.md) and it is the load-bearing decision of the
  whole product.
- **No third-party analytics on the funnel.** `telemetry.ts` is first-party and stores
  question ids and timings, never answers. A vendor script on the assessment ships intent
  data about somebody's finances to a company they never heard of.
- **No CDN scripts on customer surfaces.** Everything self-hosted. One less party to trust
  and one less thing to go down.
- **No CRM beyond Brevo yet.** Studio is the CRM. Adding a second system of record before
  there is a first one is how a solo agent ends up with two half-populated pipelines.
