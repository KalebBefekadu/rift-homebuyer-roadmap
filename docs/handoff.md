# Rift — Engineering Handoff

**Status:** MVP built. Phases 1–3 complete. Phase 4 is behind the traffic gate in §2.
**Date:** 6 September 2026
**Prototype:** `/prototype` — 30 routes, no accounts, no database, no configuration.
**Grades against:** [benchmark.md](benchmark.md) — built prototype scores **93** after gap remediation, provisional.

> **Planning moved to [Blueprint v5](blueprint-v5/README.md) on 24 September 2026.** It is the
> only source of truth for what is built next. This handoff stays the engineering record of what
> is built and how it works.

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

### 4.9 A review invitation is the same for everyone
Everyone who reaches a review moment is invited the same way, whatever they said about how
it went. The private "how did it go?" check is a separate track: an unhappy or unresolved
answer raises a follow-up for the agent and never decides whether somebody is asked. Asking
only happy clients is review gating, which Google's review policy forbids. This replaced the
earlier rule ("not asked for a rating, then or later") by decision D12 (section 8.2); the
invariant is tested across every mood in `lib/core/referral-moments.test.ts`.

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

**"You said…" requires that they said it.** This is the only sentence in the product written
in the second person about something the reader told us, and for a while it was not true.
`parseReadoutParams` applies the default `"3 to 9 months"` both when the parameter is absent
and when it is unusable, but `substituted` records only the second — so a readout reached
without a `t` at all quoted somebody a statement they had never made, about their own money,
with no disclosure attached. A share link truncated by a messaging app, which is the exact
case that boundary was written for, produced it.

Both parsers now return `timingStated`, and `buyerReadout`/`sellerReadout` take it. With no
statement there is no comparison, so the block stops asserting and asks instead — the
arithmetic stays, the attribution goes. A seller who named no timeline is `exploring` rather
than whatever the default happens to spell, because the status chip is the first thing the
agent sorts by.

### 4.16 The unflattering number gets unflattering words

Showing a figure honestly and then describing it in the vocabulary of good news is not
honesty, and the seller readout did exactly that. `parseSellerParams` deliberately lets a
payoff exceed the price — its own comment says being underwater "is exactly the situation
somebody most needs an honest number for" — and `netProceeds` duly returned a negative.
Every sentence wrapped around it assumed a positive one.

What somebody $73,575 short saw: a status chip reading **Ready now**, a verdict that they
would "walk away with about -$73,575", a rider calling that **thin** equity, a glance tile
labelled **You keep**, and a plan whose third step was which repairs pay back. The one fact
that decides their year — this sale cannot close unless they bring the difference in cash or
their lender approves a short sale — appeared nowhere on the page.

The rule: when a figure crosses zero, every sentence that names it has to be re-read, not
just the formatter. Underwater now outranks the stated timeline for status, because status is
what the agent sorts the lead list by and somebody who cannot close is not ready to list; the
shortfall is stated as an amount to **find**, not a negative amount to receive; it becomes
the blocker ahead of homestead and assessment; and the plan leads with the lender.

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

### 8.1 Product re-evaluation (22 September 2026)

The [blueprint v4 review and implementation package](blueprint-v4/README.md) reviews the
supplied buyer/seller blueprint against this repository. It is a **proposal for review**,
not an applied migration or authorization to begin the new product work.

The following decisions were explicitly confirmed by Kaleb during that review:

| Decision | Confirmed direction |
| --- | --- |
| Next release | Complete the buyer journey first, with shared foundations for sellers |
| First useful slice | Buyer search: translating preferences and setting up/updating Matrix/OneHome searches |
| Existing tool stack | Matrix/OneHome, ShowingTime, Google email/calendar, Remine for GAR forms and e-signature |
| Private client access | Email sign-in for private documents and decisions; selected read-only summaries may use share links |
| New automation | Prepare drafts and internal reminders; agent approves external actions |

These answers settle the corresponding directions in the new package; they do **not**
accept every proposed implementation, resolve the old traffic-gate/build-order conflict,
or confirm that integration permissions exist. Existing nurture authority is not changed
implicitly. The [decision register](blueprint-v4/review-and-decisions.md#4-decision-register)
tracks the remaining owner/broker decisions and the
[findings](blueprint-v4/review-and-decisions.md#2-findings-requiring-explicit-resolution).
Record their acceptance, rejection, or parking here before dependent implementation.
Do not infer that unanswered active-client/migration questions mean there are no clients.

### 8.2 What the first buyer-search release accepted, and what it parked (23 September 2026)

Kaleb asked for the package to be implemented. This is the record the package asks for
before dependent work (W00): each finding accepted, rejected or parked, and what a parked
one disables. Nothing below is an engineer's default standing in for a business decision.

| Item | Disposition | What shipped, or what stays off |
| --- | --- | --- |
| F01, D01, D10 | Accepted | Buyer search is the first slice: journeys (W01), client sign-in and membership (W02), the search brief (W03), the Matrix approval and setup record (W04), the shared shortlist (W05) |
| F02 | Accepted | Existing work was extended, not replaced: `rift_leads`, readouts, `/plan/<token>`, decisions and offer rooms are untouched |
| F03, REQ-PRIV-01 | Accepted | Brief, reactions and homes are private product records. Nothing new is sent to analytics |
| F05 | Accepted | A journey points at an existing lead; one lead can hold several. No automatic household merge |
| F07, REQ-DEC-03 | Accepted | Buyer answers are "These are right" and "Something should change", never accept or sign |
| F10, F20 | Accepted | No match percentages; fit is "meets 2 of 3, 1 still to check". A Matrix search is only "set up" when the agent records it, and every screen says the confirmation is his |
| F11, D03 | Accepted | Buyers sign in by emailed link at `/app` and see a journey only through an accepted, unrevoked membership. Old plan links grant none of it |
| F12, D02 | Accepted | No Matrix, ShowingTime, Remine or Google integration. The manual path (copy criteria, record the saved search) is the product until account rights are confirmed |
| F18 | Accepted | Criteria describe homes and chosen places. Wording about who lives nearby, school rankings or crime is refused, including in free text |
| D04 | Accepted | Rift sends nothing. Invitation links are copied and sent by the agent; the only emails are Supabase sign-in links a buyer asks for |
| Review note on `/plan` referrers | Accepted | `/plan/:token*` and `/app` now send no referrer and are disallowed in robots |
| Operations naming (spec §2) | Accepted | The agent surface is labelled Operations; `/studio` URLs are unchanged |
| D05 | Decided 23 Sep | No import. Rift is not in use with real clients yet, so each client is added by hand when they start |
| D06, F13, F14 | Decided 23 Sep | Today's protections stay exactly as they are. Kaleb gets the broker's written rules (representation, offer presentation, forms, record holds, advertising consent, funds instructions) before W08 starts; nothing that depends on them is built until then |
| D07, F17 | Decided 23 Sep | Conservative pilot: business hours only, replies the same business day, one daily summary to the agent instead of instant alerts, 3 to 5 buyers, at most $50 a month on AI and integrations. Nothing promised to clients beyond that |
| D08 | Decided 23 Sep | The old traffic gate is set aside for the buyer journey. Seller expansion (W13) stays behind it until the buyer pilot shows results |
| D09 | Decided 23 Sep | First release: Georgia residential resale, financed and cash, several buyers on one deal, contracts that fall through and restart, signing done elsewhere. New construction, probate or estate, trusts and short sales are flagged as manual exceptions. To confirm with the broker alongside D06 |
| D11, F08, F09 | Decided 23 Sep | The specification's ledger and labels are adopted. W10 is built after the buyer pilot starts, keeping every saved readout exactly as it was; the current engine stays until then |
| D12, F15 | Decided 23 Sep | Review requests stop depending on how the client felt: everyone who closes gets the same neutral request, and an unhappy client gets a separate follow-up that never decides whether they are asked (Google forbids review gating) |
| F16 | Partly | "Delete all of it" removes a person's journeys with them, except a journey with a contract on it, which is held whole as the privacy page promises (W11). Which parts the broker requires, and for how long, is still the broker's answer |
| W06 | Live 23 Sep | Tours, on today's representation gate until the broker's answer on when an agreement is required (D06). Migration `20260924000000` applied |
| W07 | Live 23 Sep | Client Today, event-backed stages and the under-contract workstreams. Migration `20260924010000` applied. Seller stages wait for D08 |
| W08 | Live 24 Sep | Offers and documents, on today's rules; the broker's answers (D06) were deferred by the owner until after testing. Migration `20260924020000` applied |
| W09 | Live 24 Sep | Contract dates and scheduled-job runs, on today's rules. Migration `20260924030000` applied |
| W12 | Live 24 Sep | Sends rechecked and opt-outs honoured (AT37), manual work with no providers (AT38), phone, keyboard and zoom (AT39), the release switch drilled (AT40), the morning summary (D07), and the pilot report at `/studio/pilot` with its checks against Matrix and the documents. Migrations `20260924040000` and `20260925010000` applied. The evidence itself comes from the pilot |
| W11 | Live 24 Sep | Walkthrough and possession apart from closing, "You own your home" only after a confirmed closing, restart without inherited dates, the buyer's records page, deletion that holds a contract record and removes provider copies (AT34 to AT36). Migration `20260925000000` applied |
| W10, W13 | Not started | W10 follows the pilot (D11); W13 waits for pilot results (D08) |

Switch: `RIFT_BUYER_SEARCH=off` turns off every page and write this release added, without
deleting anything. Migrations `20260923010000` to `20260923040000` are additive.

How the journey pages write, and why. Every write on `/studio/journey/<id>` and on the
buyer's `/app` pages goes to an API route (`/api/studio/journey`, `/api/app`) and shows its
confirmation from that route's answer. The page then refreshes through
`components/rift/useRefresh.ts`, which reloads the page if the refresh has not landed within
four seconds. On a production build, about half of all updates to the journey page never
committed: the React build bundled with Next 15.5 lost the wake-up for a render it had
suspended (the full diagnosis is in that file). Server actions wait for that same update, so
a saved brief sat on "Saving…" for good. Invitation links are shown once and never stored,
so those two writes refresh without the reload. Retry the plain pattern when Next ships a
newer React.

Showings (W06, 23 September 2026). The manual ShowingTime path, the same shape as the Matrix
record: a buyer's "Would like to see it" (or the agent) records a request; the agent records
each step as it happens in ShowingTime (asked, confirmed with the time ShowingTime gave,
changed, cancelled with a reason, happened); the buyer then answers "Would you consider an
offer?" with optional reasons and a note on the search. Asking for or confirming a time
needs a signed buyer agreement in force today (lib/core/representation), checked at every
step; a confirmed showing whose agreement lapses shows as blocked with the fix, and the
buyer sees only "On hold". Once answered, the home keeps a line saying it was seen and what
they said, and a second viewing can be asked for. Nothing about access is stored. When the broker answers when an
agreement is required (D06), that rule changes in `stepError`, not in the screens.
Migration `20260924000000_rift_tours.sql`, additive.

Today and progress (W07, 23 September 2026). A buying journey's stage (Prepare, Search, Tour &
evaluate, Offer, Under contract, Close, Own) and status (active, paused, completed, cancelled)
are history: each change is a row with a reason and who recorded it, and nothing moves on its
own. Under contract and Own are reached only by recording the executed contract and how it
ended, so the stage and the attempt cannot disagree; a terminated attempt sends the journey
back to Search or Offer and stays on file. Under contract, eight workstreams run at once, each
with its own owner and history; a cash purchase marks financing and appraisal as not applying.
A buyer can only report their part done (earnest money reads "sent, not confirmed received"
until the agent records the holder's confirmation), and any open workstream with no word for
seven days reads "last confirmed ..., waiting for an update", never "on track". The buyer's
Today follows the blueprint's fixed order: blockers and their overdue items, decisions, their
own next items (every one due within a week), then what others are doing, including the
relationship's existing plan. The strip ticks only stages the journey was recorded at. The
journey stage is separate from the lead's pipeline stage and does not change it; an agent who
moves one should move the other. Moving forward past Prepare uses the pipeline's agreement
gate until D06. Retention of contract records (F16) is still open: they cascade with the
journey today. Migration `20260924010000_rift_progress.sql`, additive.

Offers and documents (W08, 23 September 2026). An offer on a home is a list of steps like a
showing: each version of the terms (ours, or a counter received), asking the household, prepared
in Remine, signed, delivered, and how it ended. An answer belongs to one version, so a counter
makes earlier answers stop counting while keeping them (AT22). Everyone whose say was asked for
must say go ahead; one yes and one no is a disagreement, and nothing can be prepared until it is
settled (AT23). Go ahead is an instruction, not a signature: prepared, signed, delivered and
accepted are separate steps with evidence, and an accepted offer creates no contract and moves
no stage; the agent records the executed contract under Where it stands (AT24). The agent can
record an answer a buyer gave by phone, with how they said it. Buyers see only versions they
were asked about, and only with the money scope. Documents: the agent's browser uploads straight
to a quarantine folder in the private `rift-documents` bucket through a one-time link (so large
PDFs never pass through a Vercel function); the server then checks the bytes (PDF, JPEG or PNG
by content; no scripts, launch actions, embedded files or passwords in a PDF) and only then
keeps the file with its SHA-256 (AT25). This is a structural check, not a virus scan, and the
screen says so; nothing reads a document's words. Files open through a link that lasts a
minute. Erasing a person removes their files from Storage before their records. Terms are typed
in by hand (no extraction yet). The local stack now runs Supabase's storage server; see
`scripts/local/up.sh`. Migration `20260924020000_rift_offers_documents.sql`, additive; it also
creates the bucket.

Contract dates and job runs (W09, 24 September 2026). Each date on an open contract is a history of
revisions: the date, a time only if the document states one, the zone, how it was reached (as
written, or counted by a named rule: calendar days, or business days skipping US federal
holidays as observed), where it comes from, and whether the agent checked it against the
document. A date without a time has no instant, in the code and in a database check, so no
midnight or 5 PM is invented and nothing counts down in hours (AT26). Only the named rules are
calculated, and the agent confirms the rule matches the contract (AT28). The buyer sees a date
only once it is checked. An amendment writes every date it changes in one statement, so they
land together or not at all, and reminders are read from the latest revision rather than
stored, so none is left for an old date (AT27). A passed date stays urgent on Studio Today
until the agent records what happened; nothing says what it means legally (AT29). Each
scheduled job now records its runs (`rift_job_runs`, through `trackedCron`); a failed or
missing run is an urgent item on Studio Today and a state on /api/health (REQ-QUALITY-04).
Which counting rule a Georgia contract uses is the broker's question (D06/D07), not the code's.
Migration `20260924030000_rift_deadlines_jobs.sql`, additive.

Release hardening (W12, 24 September 2026). The follow-up emails now honour a stop that
arrives mid-run: the queue is read once at the start, so each touch is rechecked after it is
claimed and just before it is sent, and a reply, an opt-out, a changed address or a journey
started in between stops it (AT37). Starting a journey stops the lead's sequence as "They
became a client", and the queue skips anyone with a journey regardless. The unsubscribe link
in every touch is Brevo's, so each run first reads Brevo's block list
(`GET /v3/smtp/blockedContacts`) and stops the sequence of anyone who unsubscribed, reported
spam or hard-bounced; no other channel is tried instead. If the list cannot be read, Brevo
still refuses those sends and the run says `optOuts: not checked`. Rift calls no AI service,
and no journey module calls email, calendar or anything but the database, so with every
provider down the brief, homes, showings, offers, documents and dates are still entered by
hand; every journey read and write says "skipped" with a reason when nothing is configured
(AT38, `lib/db/degradation.test.ts`). The Studio and buyer journey screens were walked at
1280, 390 and 375 pixels, at 200% and 400% zoom, by keyboard and with reduced motion (AT39):
no WCAG 2.2 AA violation, no sideways scroll, focus visible on every stop, nothing moving.
That walk found and fixed a Studio button with no fill, stage labels faded to 3:1, warning
text at 4.47:1 on shaded cards (`--warn` is now `#98600b`), an unnamed logo link, two
unlabelled fields and offer money in 10.5px type. The release switch is held by
`lib/core/release.test.ts` and was drilled (AT40), below.

**The morning summary (D07).** One email each business morning at 9 AM Eastern (13:00 UTC,
Monday to Friday; federal holidays skipped and covered the next business morning), from
`/api/summary/run`: contract dates that passed and failed scheduled jobs first, then what each
household did since the previous business morning (accepted an invitation, reacted to a home,
added one, asked to see one, answered after a showing, answered on an offer, confirmed or asked
to change the search priorities, reported a task done), then dates not yet checked or coming
up, then new people. Only what a member did counts; an answer the agent recorded for them is
not news. A day with nothing to say sends nothing. It is a scheduled job like the others, so a
failed or missed one shows on Today and /api/health, and a weekend is not a missed run.
Journeys send the agent no instant alerts. The instant alert for a new lead from the public
funnel, and the one for a seller choosing an offer, are unchanged: whether they fold into the
summary as well is the owner's call, because Studio's fifteen-minute reply target for a
"Call today" lead depends on the first one.

**Closing and after (W11, 24 September 2026).** A contract now has ten workstreams: the final
walkthrough (before closing; recording it done says in the buyer's words that it is not a legal
acceptance of the home's condition) and possession and keys (after closing, apart from it: a
seller may stay on). Possession is the one workstream still updated once the contract closed.
"You own your home" appears only at Own, which only a closed contract with the closing confirmed
by someone named can reach; the line says who confirmed it and when (AT34). At Own, Today stops
asking search and offer questions, and a next purchase is a new journey, not another contract.
A terminated contract keeps its dates and history, and the next contract starts with none of
them (AT35). The buyer has a records page (`/app/j/[id]/records`): their priorities, homes,
showings, offers, where things stand, the current contract's checked dates and the documents
shared with them, worded as their own pages word them, to print or save as a PDF (B20). "Delete
all of it" now follows the privacy page's published exception: a journey with a contract on it
is held whole with its lead, closed to sign-in, its plan link revoked and its follow-ups
stopped; everything else goes as before, and so do the copies providers hold: the buyer's
sign-in account when no other live journey uses it, and Brevo's log of the emails sent to them
(`DELETE /v3/smtp/log/{email}`; the block list stays, so an opt-out outlives the record). The
readout then says what was kept. Which parts the broker requires kept, and for how long, is the
broker's answer (D06, F16); until then the published promise is the rule. The Amharic for the
"kept" message is owed; the abroad readout shows it in English. Migration
`20260925000000_rift_closing.sql`, additive.

**The pilot report (W12).** `/studio/pilot` (Operations, Pilot) answers the two questions the
rollout plan asks of the pilot (blueprint v4 implementation plan §8, steps 4 and 7), from what is
already recorded, and prints to a PDF. First, whether the same-business-day promise (D07) is
kept: each thing a buyer did that needs the agent is paired with the first thing he recorded in
answer (a showing request with the next step on it, work reported done with his next update on
that workstream, a request to change the priorities with his next version, a proposal with his
next version or an approval, an offer answer with the next step on that offer), and counted as
answered the same business day, later, past due, or waiting and not late yet. A question asked on
a weekend or holiday is due the next business day, New York time. What is still waiting is
listed by name. Search setup is measured apart, from approval to recording the Matrix search.
Second, whether the record matches the source: for each active or paused buying journey he
records a check that the Matrix search is the approved one and the dates are the contract's
(`rift_reconciliations`, history). A difference must say what it was and stands until a later
check matches; a match goes stale, and says which, once the search or the dates change after it.
Only what the journey has can be checked, worked out on the server. Also on the page: how many
invited household members have signed in, and whether each scheduled job ran. Nothing is
compared with a time before Rift, because none was measured, and the page says so rather than
inventing a baseline. Rules in `lib/core/pilot.ts`, reads and the one writer in `lib/db/pilot.ts`.
Migration `20260925010000_rift_reconciliations.sql`, additive.

**Rolling the release back.** Set `RIFT_BUYER_SEARCH=off` on Vercel and redeploy (a variable
reaches only new deployments). Every journey page then says it is switched off and every
journey write, buyer write and document link is refused, while `/plan` and `/r` links, the
public funnel, Studio Today, the scheduled jobs and deletion keep working. Nothing is deleted.
Remove the variable and redeploy to bring it back. Drilled locally on 24 September: with the
switch off, a write left every journey table unchanged; switched back on, every record was
there, and two follow-up runs started at the same moment recorded each step once. If the code
itself is at fault, Vercel's instant rollback to the previous deployment is the faster route;
migrations are additive, so older code runs against the newer schema.

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
