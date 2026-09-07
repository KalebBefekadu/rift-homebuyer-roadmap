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

## 6. Calendar — phase 3

You have an account. Wire it against this interface, not against the vendor:

```ts
interface Booking {
  slots(topic: string, within: Days): Promise<Slot[]>;
  hold(slot: Slot, who: Contact): Promise<HoldId>;   // never book without a hold
  confirm(id: HoldId): Promise<Confirmed>;
  cancel(id: HoldId, reason: string): Promise<void>;
}
```

Two requirements the prototype already assumes, both easy to lose:

- **The call is about their blocker, not a generic slot.** `/prototype/book` passes
  `?topic=` from the readout's computed blocker. Keep it — it is why the booking screen
  converts, and it is one query parameter.
- **Consent is captured at booking, not after.** The TCPA checkbox blocks submission when a
  phone number is present. That gate must survive the integration; a vendor's own booking
  widget will not carry it, which is an argument for the API over the embed.

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

### Mortgage rates
**The largest unstated assumption in the product.** `BUYER_DEFAULTS.ratePct` is 6.5% and
every monthly figure, every gap, and every timeline depends on it. It is currently a literal
with no source and no date.

Minimum acceptable answer for launch: a **weekly** rate, stored with its date and source, and
displayed as an assumption on every figure it touches — which `Computed.assumptions` already
supports. A rate that is silently four months old is exactly the "wrong number rather than an
error" failure this codebase is built to prevent.

---

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
