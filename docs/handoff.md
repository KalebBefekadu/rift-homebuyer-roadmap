# Rift — Engineering Handoff

**Status:** MVP built. Phases 1–3 complete. Phase 4 is behind the traffic gate in §2.
**Date:** 6 September 2026
**Prototype:** `/prototype` — 30 routes, no accounts, no database, no configuration.
**Grades against:** [benchmark.md](benchmark.md) — built prototype scores **93** after gap remediation, provisional.

This document is the bridge between the prototype and the real build. It says what to
build, in what order, which contracts must not drift, and what is deliberately fake.

Read [AGENTS.md](../AGENTS.md) first if you are writing code, then this. [vision.md](vision.md)
is why, [product.md](product.md) is what, [schema.md](schema.md) is the data model,
[integrations.md](integrations.md) is every external service, and [setup.md](setup.md) takes a
fresh clone to a running environment.

### What is already in the repository

Two things that did not exist at the first handoff, both of which change where you start:

- **A test harness that runs.** `npm test`. The compute contract and the readout's timing rule in
  `lib/core/compute.test.ts`, the schema's constraints against a real Postgres in
  `lib/db/schema.test.ts`, and a drift guard in `lib/core/docs.test.ts` that fails when this
  documentation disagrees with the code.
  The rest of §7 is written against that harness, not from scratch.
- **Working plumbing.** Supabase auth with a localStorage fallback, Sentry with a tunnel
  route, and a Brevo client that degrades honestly. It came from the portal MVP that Rift
  replaced; that MVP's product surface has been deleted and its schema is documented as
  history in [schema.md](schema.md). **Do not build on its tables.**

---

## 1. The one-paragraph brief

Rift is a residential real-estate client-experience platform for a single Georgia agent.
Its lead generation thesis is **overloading value on the front end so leads convert** —
a stranger receives a complete, computed, honest readout of their situation for free,
before any account, and keeps it whether or not they ever speak to the agent. Everything
else in the product exists to make that promise survivable at scale for one person.

---

## 2. What ships first, and what waits

Read this before the build order. The order below tells you the sequence; **this section
tells you where to stop and put it in front of real people.**

### The cut

**The MVP is phases 1–3, buyers only.** It ships to real traffic on its own.

| In the MVP | Why it cannot wait |
| --- | --- |
| Schema, compute engine, programme registry | Nothing is real without them |
| Telemetry and first-touch attribution | The event you forgot to emit cannot be recovered retrospectively. It ships in phase 1 or the first quarter of data does not exist |
| Buyer landing → assessment → readout, ungated and shareable | This *is* the product thesis. Everything else is downstream of a stranger getting something valuable for free |
| Email capture, TCPA consent, real booking | A readout nobody can act on is a demo |
| Studio: the ranked lead list and the review queue | The minimum an agent needs to answer the people the readout produces. Not the whole of Studio |
| Automatic email nurture steps | The `now` and `soon` sequences, email only. No SMS — it degrades honestly and is already built to |

| Deferred, and it is safe to defer | Why |
| --- | --- |
| **Seller product** | Same engine, different questions. Genuinely cheap once phase 2 exists, and it is the **first thing built after the MVP** |
| Client portal | Serves clients who do not exist yet |
| Referral engine | A closing produces a referral. There are no closings yet |
| Rift Offer, Decision Rooms, Playbooks, Meeting-to-Plan, Document-to-Journey | Operating depth for a book of business the MVP is trying to create |
| Funnel editor | The funnel does not need tuning until there is drop-off data to tune against |
| SMS, e-signature | Both have real lead times. Start the accounts now; the MVP does not block on them |

### Why the cut is here and not later

The benchmark's own conclusion after four grading passes was that the three lowest-scoring
criteria **cannot be raised by building** — they need a failure drill, somebody to not answer
a referral request, and a channel that should be left alone. That is the signal that the
specification is finished and the constraint has moved.

**Every number the instrumentation reports is currently zero.** The score of 93 is explicitly
provisional under the benchmark's own rule that nothing above 84 is validated without field
metrics. Building phases 4–7 before phase 3 meets traffic adds six months of work to a product
whose central claim — *that a free, honest, computed readout converts strangers* — has never
been tested on one stranger.

The first 200 real assessments are worth more than the next 2,000 lines of code.

### What "shipped" means for the MVP

- A stranger arriving from an ad reaches a complete readout with no account.
- They can keep it, share it, and book a call about their actual blocker.
- Consent is captured lawfully and stored with its wording.
- The agent sees them ranked, with the arithmetic visible, inside the reply target.
- Drop-off per question is measurable from day one.
- Nothing on screen is a number the engine did not compute.

### The gate before phase 4

Do not start the seller product until the MVP has produced **200 completed assessments** or
**60 days of live traffic**, whichever comes first, and the funnel report has been read. If
the readout does not convert strangers, building a second one that also does not convert them
is the most expensive possible mistake — and the instrumentation exists precisely so that
this is a measurement rather than an argument.

---

## 3. Build order

The sequence matters. Each phase produces something usable, and each depends on the one
before it. **Do not build the agent surface first** — without live traffic through the
funnel, the operating tools have nothing to operate on and will be built against guesses.

Phases 1–3 are the MVP. Phase 4 begins only after the gate above.

| Phase | Ship | Why here | Done when |
| --- | --- | --- | --- |
| **1** ✅ | Schema + compute engine + program registry + telemetry | Nothing downstream is real without these. Telemetry belongs in phase one because the event you forgot to emit cannot be recovered retrospectively. | `calculations.md` reference case passes (it already does); every table has an RLS policy; a programme can be inserted with a verification date and a stale one is suppressed from matching; events land. **No admin UI** — that arrives with Studio in phase 5, and the migration must not wait on a screen |
| **2** ✅ | Buyer product end to end — landing, assessment, readout | The revenue path. One product fully working beats two half working. | A stranger can go from ad click to a shareable readout without an account |
| **3** ✅ | Capture, consent, and booking — calendar adapter built, awaiting credentials | Turns a readout into a relationship. Consent is a phase-3 gate, not a later fix. | Email capture, TCPA-compliant phone consent, and a real calendar booking |
| **4** | Seller product | Same engine, different questions and outputs. Cheap once phase 2 exists. | Seller parity with buyer |
| **5** | Studio — the rest of it: clients, offers, calendar | The ranked lead list and review queue already shipped with the MVP. This is the depth. | Agent can run a week from Studio alone |
| **6** | Client portal | Post-conversion experience. | Client can answer the five questions on one screen |
| **7** | Referral engine and funnel editor | Compounding, and self-service tuning. | Moments fire; edits go live and are versioned |

---

## 4. Contracts that must not drift

These are the load-bearing rules. Each one exists because breaking it produces a wrong
number rather than an error, which is the only class of bug this product cannot survive.

### 4.1 Front-end value is computed, never generated
Every customer-facing figure originates in `lib/core/compute.ts` or is matched from
`lib/core/registry.ts`. No number is ever authored text, and no number is ever produced
by a language model. This is what makes the front end free to run, impossible to hallucinate,
and impossible to inflate through abuse.

### 4.2 Every figure carries its assumptions and its failure mode
`Computed` requires `assumptions` and `couldBeWrong`. Keep this in the type, not in review.
A figure that renders without them is a defect regardless of whether it is correct.

### 4.3 Unapproved assistance is never folded into a headline
`buyerReadout()` requires `assistance: 0`. The gap, timeline and status are computed on
savings alone; matched assistance is displayed beside them as conditional upside with a
lender named as the decider. **Violating this tells someone they are ready to buy when they
are not.** There is a test case for it in §6.

### 4.4 Stale programme data is suppressed, and the customer is told that it was
`isStale()` removes anything unverified for longer than the configured window from
customer-facing matching. **The window is a business rule** — `registryDays`, default 90 days
— not a constant. `STALE_AFTER_DAYS` reads it, and so should anything else; hard-coding 90
means the setting exists and changes nothing, which is worse than not having it. The registry
ships with one deliberately stale fixture so the rule stays demonstrable.

**This contract was reversed after the code shipped disagreeing with it.** It previously said
suppression was silent to the customer. The built readout tells them — *"2 further programs
were withheld because we have not re-verified them in 90 days"* — and on reflection the code
was right and the contract was wrong.

Silence has one failure that outweighs the tidiness it buys. A customer in a county where
every programme has gone stale sees an empty list and concludes **no help exists for them**.
That is false, it is the most discouraging thing this product could tell somebody, and they
have no way to find out otherwise. One sentence prevents it.

It is also the only version consistent with the rest of the product. `/buy/programs` shows
stale entries marked as such for the same reason: a page that claims verified data and hides
its own gaps has made the claim untrue. Admitting the gap is what makes the verification
rule read as real rather than as marketing.

### 4.5 Core funnel questions are bound; custom ones are inert
A question with a `bound` field writes to a compute input. Its wording, order and option
*labels* are the agent's; its option *values* and binding are not. Custom questions never
feed a calculation. See `lib/core/funnel.ts`.

### 4.6 A lead is pinned to the funnel version it answered
Every lead stores `funnelVersion`. A readout produced under v3 keeps making sense after v5
ships. Never reinterpret stored answers against a newer question set.

### 4.7 Telemetry records the question, never the answer
Events carry question id, step, dwell and session id. They never carry what was typed.
This is what makes measuring the funnel defensible at all.

### 4.8 Fair housing bounds the inputs
No proxy for a protected class enters lead scoring, matching, or routing. No name analysis,
no neighbourhood scoring, no language inference, no photo. `lib/core/lead.ts` documents
the complete input list; treat additions to it as a compliance change, not a feature.

### 4.9 Nothing public is requested before a private check
Every public review request passes the satisfaction gate. Someone who reports a bad
experience is routed to the agent and is not asked for a rating, then or later.

### 4.10 First touch never moves
Attribution stores first touch immutably. Later visits update last touch only.

---

### 4.11 A sequence stops the moment a human replies
Not after the current step, not at the end of the day. `STOPS` in `nurture.ts` is the complete
list. Software that keeps sending after somebody answered proves there was never a person on
this end, and it is unrecoverable in a referral business.

### 4.12 Consent gates the channel, never the sequence
No written phone consent downgrades a text step to email. It does not send the text anyway and
it does not silently drop the touch. `resolveChannel()` owns this and returns the reason, so
the agent sees why a channel changed.

### 4.13 Nothing reaches `verified` without a named party
`promote()` rejects a verification with no name attached. A green chip with nobody behind it is
the exact false confidence the trust ladder exists to prevent, and enforcing it in the UI alone
means the second surface skips it.

### 4.14 Publishing a plan may change numbers, but never quietly
A recomputed figure that differs from the person's readout snapshot by ≥ `DRIFT_PCT` blocks
publication until it has been shown with its cause. Publishing also never advances a trust
state: `preliminary` stays `preliminary` after it is inside a plan.

### 4.15 A stated timeline is compared against the computed one, not stored and ignored
`buyerReadout()` returns a `tension` whenever what somebody *said* collides with what the
arithmetic says. The comparison is made on savings alone, like every other headline figure —
assistance may appear in the body as conditional upside and never above it. Silence is
correct only when they named no deadline ("Just exploring"), and a one-month overrun is not a
collision. Crying wolf on a nine-month answer that computes to ten is how the whole panel
gets ignored.

---

## 5. What is deliberately fake in the prototype

Do not port any of this. It exists to make the interaction model reviewable.

| Faked | Real build needs |
| --- | --- |
| `localStorage` for funnel edits, attribution, events | Per-tenant rows; events to a real sink |
| Fixture clients, leads, offers, referral state | Database, with the stage transition log as the source of `daysInStage` |
| `PROTO_TODAY` frozen at 2026-09-06 | Real clock; re-check every staleness and deadline calculation against it |
| Booking slots as a static array | Real calendar availability, timezone-correct, with holds |
| `DAYS_IN_STAGE` constant map | Derived from the stage transition log so it cannot drift |
| Pipeline stage weights | Start with these as stated assumptions, replace with the agent's own history at ~30 closings |
| Email/SMS sending | Real provider, with the bounce path in §5 |
| Document understanding, meeting transcription | Out of scope until phase 7+ |

---

## 6. Requirements that are easy to miss

1. **TCPA.** Prior express *written* consent before any autodialled or prerecorded marketing
   call or text. Unticked, specific, separate from all other agreements, and the exact wording
   stored with the record and versioned. `lib/core/privacy.ts` holds the wording.
   **It has not been reviewed by counsel. Do that before it collects a real number.**
2. **Retention.** Four rules, stated in `privacy.ts` and shown to the customer at the bottom
   of every readout. A deletion request must actually delete, not soft-delete.
3. **Speed to lead.** The automated first response is the readout itself — no human in the
   path. The human reply is a separate, slower clock. Do not conflate the two: doing so hides
   the fact that the valuable half already happened.
4. **Failure paths are visible.** A bounced email becomes an agent task. A workflow that fails
   surfaces. Nothing fails silently — see benchmark 2.5.
5. **Mobile is the primary surface for the funnel.** Paid traffic is mostly phones. The live
   value panel must stay on screen, the primary action must stay in thumb reach, and touch
   targets are 44px. Verified at 375px; verify again on real hardware.
6. **Never colour alone.** Every state carries an icon and a word. The trust ladder is the
   most important instance — see `components/rift/Trust.tsx`.

---

## 7. Acceptance tests to write first

These encode the rules above. Write them before the features.

The `compute` block below is **already written and passing** in
`lib/core/compute.test.ts` — it is left here so the list stays complete, and so the
shape of what a good test in this codebase looks like is visible before writing the rest.

```
compute
  cash to close returns every line, and earnest money is credited back
  a zero rate uses loan/n and never produces NaN
  the gap floors at zero and reports fullyCovered instead of a negative
  reference case in calculations.md passes exactly

lead
  the full signal set scores materially higher than a partial one
  `value` is a purchase price, never cash to close
  the scoring inputs are the complete list — no proxy for a protected class

readout
  a buyer with $9,000 saved on a $380,000 home is NOT described as ready   [rule 4.3]
  a stated timing shorter than the computed one produces a tension         [rule 4.15]
  "Just exploring" produces none, because no deadline was named            [rule 4.15]
  a one-month overrun is not reported as a collision                       [rule 4.15]
  the headline gap equals the gap with assistance set to zero              [rule 4.3]
  matched assistance appears only as conditional upside

registry
  a programme unverified for 91 days does not appear in matched
  it DOES appear in suppressed
  a closed programme is shown with its state, never hidden

funnel
  removing a required core question is rejected
  renaming a core option label does not change its value                   [rule 4.5]
  saving bumps the version and appends a change entry                      [rule 4.6]
  a custom question never reaches a compute input

telemetry
  no event payload contains an answer value                                [rule 4.7]
  reached counts distinct sessions, not timestamps

consent
  booking with a phone number is blocked until consent is ticked           [§6.1]
  the stored record carries the exact wording and its version

nurture
  a reply stops the sequence before the next due step                      [rule 4.11]
  a text step with no phone consent resolves to email, with a reason       [rule 4.12]
  intervals widen across a sequence; none repeats at a fixed spacing
  every step has a non-empty `gives`

review
  asking from a readout creates an item in `pending-review`
  a repair-estimate item can never be promoted past `reviewed`
  promoting to `verified` without a name is rejected                       [rule 4.13]
  a rung cannot be skipped

pipeline
  a stage with fewer than 4 outcomes reports basis "assumed"
  a stage with 12+ outcomes reports basis "observed"
  the blended weight always sits between the assumption and the observed rate

docs
  every retention period in schema.md matches RETENTION in privacy.ts
  the registry window is documented as a setting, never as a bare 90 days
  the stated test count is not smaller than the suite

seam
  a figure that moved 3% or more blocks publishing until disclosed         [rule 4.14]
  publishing does not advance any trust state                              [rule 4.14]
  a custom funnel answer crosses as context and never as a compute input
```

---

## 8. Open decisions — these need the business owner, not engineering

Every one of these used to be a literal in a source file, which is the worst
of both worlds: the owner could not change it and the engineer was not allowed
to. **A decision that lives in a constant has already been made by whoever typed
the constant.** They are now settings in Studio → Settings → Business rules,
each carrying its own consequence and the name of whose call it is, and the
surface distinguishes *decided* from *still on the default*.

| # | Decision | Default | Whose call | Why it blocks something |
| --- | --- | --- | --- | --- |
| 1 | Commission assumption in the forecast | 2.5% | Kaleb | Drives the only revenue number in the product |
| 2 | Readout emailed automatically, or only on request | On request | Kaleb | Changes the consent surface and the speed-to-lead model |
| 3 | Who verifies programme data | Kaleb | Kaleb | The suppression rule is worthless without an owner |
| 4 | Programme re-check window | 90 days | Kaleb | Longer means stale offers reach people |
| 5 | Client record retention after closing | 5 years | **The broker** | The one setting with a legal floor — confirm before anything deletes on it |
| 6 | Marketing to unrepresented buyers in a Rift Offer deal | No | **The broker, with counsel** | A conflict question before it is a marketing one |

`registryDays` and `commissionPct` are read by `registry.ts` and `pipeline.ts`
respectively, so changing the rule changes what customers are actually shown and
what the forecast actually says. The remaining four are declared and surfaced but
not yet load-bearing — wire them as their features land.

---

## 9. What the built MVP actually is

Verified against a real Postgres and a real PostgREST, with the application
running, not in pieces.

**Works end to end**

| | |
| --- | --- |
| Landing → assessment → readout | Server-computed figures, ungated, URL-addressable |
| Attribution | First touch immutable by trigger; referring host only, landing path without its query |
| Telemetry | Question ids and dwell; answer values stripped before the write and rejected by a constraint if they get through |
| Capture | Scored with the full six signals, both consent records stored with their exact wording |
| Consent gate | A phone number without the box ticked is refused outright |
| Enrolment | Automatic on capture, carrying phone consent |
| Snapshot + share link | Numbers rendered as saved, never recomputed. What *does* update is how sure anybody is about them |
| Trust ladder | Connected end to end: a request from the readout creates a review item against a specific figure, and advancing it in Studio changes the chip the customer sees |
| Scheduled jobs | Both reject an unauthenticated call and report honestly |
| Retention | Deletion is deletion; "delete all of it" reachable from the readout |
| Studio | Ranked leads with their arithmetic and their figures, review queue, follow-up, abandoned, drop-off, stale programmes, stale rate |

**Not yet true**

- **No traffic.** Every number the instrumentation reports is zero. The score in
  [benchmark.md](benchmark.md) remains provisional under its own rule.
- **Sign-in itself has never been exercised.** Studio's authenticated view *has* now been
  rendered against real data — ranked leads with their figures, the review queue, the
  follow-up queue, the stale-rate and stale-programme tasks — using a session cookie minted
  locally. What is untested is the magic-link round trip, which needs a real GoTrue.
- **Email has never actually sent.** The path is exercised and degrades honestly; no message
  has left the building. `BREVO_FROM_EMAIL` must be a verified sender.
- **The calendar has never returned a real slot.** Same shape: adapter built, credentials
  absent, and the UI says so rather than inventing times.
- **SMS does not exist**, so every text step permanently downgrades to email. The consent
  machinery that makes texting lawful is built and currently protects nothing.
- **The rate is a manual weekly habit.** Studio nags when it lapses, which is the best that
  can be done without a licensed feed.

**Six defects that only running it could have found**, each of which produced a plausible
result rather than an error — recorded because the pattern matters more than the list:

1. `NEXT_PUBLIC_` variables are inlined at build time, so server code read a stale URL.
2. A null agent lookup was cached permanently, surviving the bootstrap that fixed it.
3. The readout sent half the lead signals — the same person scored 100 or 46.
4. Email capture from the readout failed on every submission.
5. Abandonment fired once per tab switch rather than once per session.
6. The nurture runner reported unsendable touches as agent tasks.

## 9b. Known gaps, honestly

Scored against [benchmark.md](benchmark.md); nothing below is a surprise.

### Closed since the first handoff

- **Nurture is now a cadence engine, not a band.** `lib/core/nurture.ts` — four
  sequences, escalating intervals, per-step *what this gives them*, six stop conditions, and
  consent gating the channel rather than the sequence. Surfaced at Studio → Queue → Follow-up.
- **`pending-review` has a producer.** `lib/core/review.ts` and the control now inside
  `TrustLadder`. A person can ask for a figure to be checked from any readout; it lands in
  Studio → Queue → Review against a 24h promise. Two constraints hold it honest: every item
  has a **ceiling** (a repair estimate can never reach `verified`), and promoting to
  `verified` **requires the name of who confirmed it** — enforced in `promote()`, not in the UI.
- **Pipeline weights learn.** `weightFor()` shrinks the agent's own closed history toward the
  starting assumption with a prior of 12, and every weight is labelled *assumed* /
  *part observed* / *his own history* wherever it is displayed.
- **The readout → plan seam is defined.** `lib/core/seam.ts` — ten fields with an explicit
  carry rule, a 3% drift threshold above which a changed figure must be disclosed before
  publishing, and `canPublish()` preconditions. Surfaced at Studio → Queue → Publishing.

### Still open

- **No field data.** Instrumentation exists and is verified working, but every funnel number
  is currently zero. Per the benchmark's own rule, **the score is provisional and
  unvalidated until real traffic runs through it.** Treat the first 200 assessments as the
  real grading event.
- **The learned weights have no real history behind them yet.** The mechanism is built and the
  seeded history is deliberately thin and uneven, so most stages correctly report *assumed*.
  This gap now closes by itself as closings accumulate, which is the point of the change.
- **Four of the six business rules are declared but not yet load-bearing.** `autoEmailReadout`,
  `clientRetentionYears`, `marketUnrepresented` and `registryOwner` are surfaced and stored;
  they change nothing until the features they govern exist.
- **Nurture sequences are not connected to a sending system.** The engine resolves what is
  owed and to whom; actually delivering it is phase 3 infrastructure.
