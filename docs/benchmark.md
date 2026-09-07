# Rift Product Benchmark

**Status:** Active grading instrument  
**Purpose:** Score any Rift plan, prototype, or shipped build against the three goals that justify the product's existence.  
**Companion documents:** [vision.md](vision.md), [product.md](product.md), [prototypes.md](prototypes.md)

## Why this exists

Rift is easy to grade badly. It is a large product with many attractive surfaces, so a plan can feel impressive while doing nothing for the outcomes that matter. This benchmark forces every plan to answer the same question: does this generate a lead, run the work smoothly for both sides, and turn a closing into the next two closings?

Run this benchmark whenever the plan changes materially, whenever a prototype is ready for review, and every quarter once Rift is in real use.

## The goal chain

Rift exists to complete one loop:

```text
Generate a lead
  -> Run the operation smoothly for the client and the agent
    -> Win and close the sale
      -> Earn advocacy
        -> Generate the next lead
```

Every dimension below is a segment of that loop. Weights reflect the stated priority: lead generation first, operating smoothness second, sale and referral as the payoff that feeds the loop again.

| Dimension | What it measures | Weight |
| --- | --- | --- |
| D1. Lead generation and capture | Does Rift produce and keep new relationships? | 30 |
| D2. Agent operating leverage | Can one agent serve materially more clients? | 20 |
| D3. Client experience clarity | Does the client always know where they stand? | 20 |
| D4. Conversion to sale | Does a captured lead become a closed transaction? | 15 |
| D5. Referral and retention | Does a closing produce the next relationship? | 15 |

## Scoring anchors

Every criterion is scored 0 to 4 against the same ladder. The ladder is deliberately strict: a 4 requires a number, not a description.

| Score | Meaning |
| --- | --- |
| 0 | Absent. The plan does not address it. |
| 1 | Named only. Mentioned without defined behavior. |
| 2 | Defined behavior. What happens is clear; states and failure modes are not. |
| 3 | Defined with states, owners, and failure modes. Buildable and reviewable as written. |
| 4 | All of 3, plus a measurable target and the instrumentation required to read it. |

Dimension score = (points earned / points possible) x dimension weight. Total is out of 100.

| Band | Reading |
| --- | --- |
| 85-100 | Ready to build against |
| 70-84 | Sound; named gaps remain |
| 55-69 | Directionally right, materially incomplete |
| 40-54 | Strong in parts, missing a primary goal |
| 0-39 | Not yet a plan |

## D1. Front-end value and capture (weight 30)

**Recalibrated 2026-09-06.** The original version of this dimension weighted measurement — attribution, tracking, source coverage. That was a misreading of the strategy. Rift's lead generation thesis is **overloading value on the front end so that leads convert**, not instrumenting a funnel. Four of the six criteria now grade the value itself. Attribution and campaign connection are consolidated into one criterion where *adequate is the goal*.

| # | Criterion | What a 3 looks like |
| --- | --- | --- |
| 1.1 | Value density before capture | The plan enumerates what a stranger receives for free, and it is substantial enough that a reasonable person would have paid for it |
| 1.2 | Differentiation of that value | At least one asset a visitor genuinely cannot get from a generic calculator, a valuation site, or a competing agent |
| 1.3 | Value ladder | Value escalates with commitment, each rung is useful if the visitor stops there, and nothing is gated to force the next rung |
| 1.4 | Delivery integrity | Assumptions visible and editable, preliminary labeling, stated failure modes, no overstatement, fair-housing bounded |
| 1.5 | Entry surfaces and campaign connection | Campaign-specific landing pages, parameters carried through to the relationship record, source readable and filterable |
| 1.6 | Speed, recovery, and nurture | Speed to personal contact, abandonment resume, and a cadence for leads who are not ready |

**Criterion 1.5 targets a 3, not a 4.** Attribution needs to be reliable and unremarkable. Scoring 4 here means campaign machinery was built at the expense of the value it was supposed to carry, and is a signal to redirect effort, not a win. It is scored honestly below, and its current 4 is noted as acceptable over-investment rather than something to correct.

## D2. Agent operating leverage (weight 20)

| # | Criterion | What a 3 looks like |
| --- | --- | --- |
| 2.1 | Attention triage | A daily surface that ranks work by consequence, with defined categories and empty states |
| 2.2 | Prepare-then-approve model | Rift prepares consequential work; the agent approves; the difference is visible and recorded |
| 2.3 | Automation depth | Repeatable service runs without the agent, within stated authority, with defined recovery |
| 2.4 | Intake-to-plan cycle time | The path from new assessment to published client plan is defined and short |
| 2.5 | Never-lose guarantee | Every offer, document, deadline, message, and workflow failure has a defined visible fallback |

## D3. Client experience clarity (weight 20)

| # | Criterion | What a 3 looks like |
| --- | --- | --- |
| 3.1 | Five questions | Position, next action, who is working, what is approaching, and where to get help are answerable on one screen |
| 3.2 | Ownership | Every task names an owner; no orphaned work exists in any state |
| 3.3 | Trust labeling | Preliminary, pending review, reviewed, and externally verified are visually unmistakable everywhere |
| 3.4 | Mobile completeness | Client-critical flows are fully specified at approximately 390 pixels |
| 3.5 | Accessibility | A stated conformance target, contrast rules, and a no-color-alone rule for state |

## D4. Conversion to sale (weight 15)

| # | Criterion | What a 3 looks like |
| --- | --- | --- |
| 4.1 | Consultation conversion | An explicit, designed moment that turns a snapshot into a booked conversation with the agent |
| 4.2 | Representation capture | Buyer-agency and listing agreements are a visible lifecycle gate with status, not an offline side channel |
| 4.3 | Decision support | Decision Rooms exist at the moments where clients actually stall, with scenarios and recorded outcomes |
| 4.4 | Offer and negotiation support | Structured comparison of terms and estimated net, not price alone |
| 4.5 | Pipeline visibility | Stage counts, stall detection, and a forward view of likely closings |

## D5. Referral and retention (weight 15)

| # | Criterion | What a 3 looks like |
| --- | --- | --- |
| 5.1 | Post-closing continuity | A defined reason for the client to return after closing, not just a thank-you |
| 5.2 | Referral request mechanics | A designed ask, timed to a defined moment, with a path the referrer can actually use |
| 5.3 | Review and reputation capture | A defined path from satisfied client to public review, with follow-up on non-response |
| 5.4 | Long-term touches | A defined cadence across the years after closing, with useful content, not noise |
| 5.5 | Referral attribution loop | A referred lead is linked to its referrer, and that link is visible and countable |

## Grade history

Five grading passes ran before the prototype existed as software. They scored **plans** —
documents that have since been rewritten or superseded — and their full working ran to some
230 lines of this file. They are condensed here rather than deleted: the record is the
trajectory, not the arithmetic, and the arithmetic is in git history if it is ever needed.

| Pass | Date | Graded | Total | What it changed |
| --- | --- | --- | --- | --- |
| Baseline | Aug 2026 | The original plan | 62 | Established the instrument and the first remediation backlog |
| Post-remediation | Aug 2026 | The revised plan | 79 | Closed the backlog; exposed that front-end value was still under-specified |
| Pass two | Aug 2026 | Front-end value | 84 | Found that a verified Georgia assistance registry was already sitting in the repository, unused and unmentioned by any product document. Front-end value was being redesigned around an asset nobody had noticed |
| Pass three (plans) | Sep 2026 | Distribution and durability | 88 | Raised agent leverage; flagged nurture and recovery as sentences rather than systems |
| Pass three (built) | 6 Sep 2026 | **The prototype** | 88 | First grade checkable by opening a route. Detail retained below |
| Pass four | 6 Sep 2026 | After gap remediation | **93** | Detail retained below |

The single most useful finding across all five is worth keeping in the open: **a plan that
grades above its own build has not yet met a constraint.** Pass three's built score came in
below its plan score on two dimensions, and that was the healthiest signal in the document.

## Field metrics

The benchmark grades plans. These metrics grade reality. Targets are first hypotheses for a solo Georgia agent and should be recalibrated after one full quarter of real use.

### Lead generation

| Metric | Definition | First target |
| --- | --- | --- |
| Assessment start rate | Assessment starts / unique landing-page visitors | 25% |
| Assessment completion rate | Completions / starts | 60% |
| Snapshot save rate | Accounts saved / completions | 70% |
| Abandonment recovery rate | Resumed assessments / abandoned assessments | 20% |
| Attribution coverage | Relationships with a known first-touch source / all relationships | 95% |
| Cost per captured lead | Channel spend / saved snapshots, by source | Track before targeting |
| Offer-sourced relationships | New relationships originating from a Rift Offer submission | 2 per month |

### Operating smoothness

| Metric | Definition | First target |
| --- | --- | --- |
| Time to first agent touch | Snapshot saved to first personal agent contact | Under 15 minutes in working hours |
| Intake-to-plan cycle time | Assessment completed to agent-published plan | Under 24 hours |
| Daily brief clear rate | Attention items resolved same day / items raised | 80% |
| Stale task rate | Tasks overdue more than 3 days / open tasks | Under 5% |
| Offer submission time | Submitter start to submitted offer | Under 12 minutes |
| Offer decision time | Offer submitted to agent present-or-hold decision | Under 4 hours |
| Automation acceptance rate | Prepared actions approved without edit / prepared actions | 70% |
| Silent failure count | Workflow failures without a visible alert and fallback task | 0 |

### Client experience

| Metric | Definition | First target |
| --- | --- | --- |
| Next-action comprehension | Clients who correctly state their next action when asked | 90% |
| Unprompted return rate | Clients opening Rift without a prompt, weekly | 40% |
| Inbound status questions | "Where are we?" messages per active client per month | Under 1 |

### Conversion to sale

| Metric | Definition | First target |
| --- | --- | --- |
| Consultation booking rate | Consultations booked / snapshots saved | 25% |
| Representation rate | Signed agreements / consultations held | 50% |
| Active-to-contract rate | Clients reaching under contract / active clients | 40% |
| Contract-to-close rate | Closed / under contract | 90% |
| First touch to contract | Median days from first touch to binding contract | Track before targeting |

### Referral and retention

| Metric | Definition | First target |
| --- | --- | --- |
| Review capture rate | Public reviews received / closings | 60% |
| Referral ask rate | Closings with a referral ask delivered / closings | 100% |
| Referrals per closing | Referred leads received / closings | 0.5 |
| Passport engagement | Past clients opening the Passport at 6 and 12 months | 40% / 25% |
| Advocacy share of pipeline | New leads from referral or repeat / all new leads | 30% by month 12 |

### Distribution and durability

| Metric | Definition | First target |
| --- | --- | --- |
| Package share rate | Packages shared at least once / packages completed | 35% |
| Shares per shared package | Median recipients when a package is shared at all | 2 |
| Share-sourced assessments | New assessments started from a shared package | 15% of all starts |
| Co-buyer join rate | Co-buyers who join / journeys naming a co-buyer | 50% |
| Co-buyer effect on booking | Consultation booking rate with a joined co-buyer versus without | Positive, magnitude to learn |
| Lender share rate | Packages shared with a lender / buyer packages | 25% |
| Living package open rate | Updates opened / updates sent | 55% |
| Living package action rate | Updates producing the named next action | 20% |
| Update silence ratio | Periods with no update sent because nothing changed | Above 40% |
| Unclaimed value hit rate | Sellers shown at least one unclaimed value item | 40% |
| Cost per active relationship | Total variable cost / active relationships per month | Under $8 |
| Public surface cost | Monthly variable cost of unauthenticated surfaces | Under $50 |

## Pass three — grading the BUILT prototype

Graded 6 September 2026. Every previous grade in this document scored **plans**. This one
scores the **prototype that exists**, screen by screen, and it is the first grade where a
criterion can be checked by opening a route rather than reading a paragraph.

It comes out **lower than the plan scored**, which is the expected and healthy direction.
A plan that grades above its own build is a plan that has not yet met a constraint.

| # | Criterion | Score | Earned by |
| --- | --- | --- | --- |
| 1.1 | Value density before capture | 4 | `/buy/results` — eight sections, ungated, URL-addressable |
| 1.2 | Differentiation | 4 | Verified GA registry with staleness suppression; true cash-to-close |
| 1.3 | Value ladder | 4 | Three rungs on the readout, three doors on the landing, nothing gated |
| 1.4 | Delivery integrity | 4 | `assumptions` + `couldBeWrong` in the type; assistance never in a headline; trust ladder rendered |
| 1.5 | Entry surfaces and campaign connection | 3 | First-touch UTM capture, immutable, visible in Studio — **3 is the target here** |
| 1.6 | Speed, recovery, nurture | 3 | Instant automated readout, split SLA clock, resume on abandon. Nurture is a band, not yet a cadence |
| | **D1 (weight 30)** | **22/24** | **27.5** |
| 2.1 | Attention triage | 4 | Today queue ranked by consequence; leads scored with visible arithmetic |
| 2.2 | Prepare-then-approve | 4 | Offer review present/hold/decline; recap approval |
| 2.3 | Automation depth | 3 | Automated delivery and programme watching; recovery defined but shallow |
| 2.4 | Intake-to-plan cycle | 3 | Assessment→readout is instant; readout→published plan is designed, not timed |
| 2.5 | Never-lose guarantee | 3 | Fallbacks exist and surface; not yet exhaustive |
| | **D2 (weight 20)** | **17/20** | **17.0** |
| 3.1 | Five questions | 4 | `/app` answers all five above the fold |
| 3.2 | Ownership | 4 | Every task names an owner |
| 3.3 | Trust labeling | 3 | `Trust` and `TrustLadder` rendered on readout, money and programme cards. `pending-review` has no live producer yet |
| 3.4 | Mobile completeness | 4 | Verified at 375px: sticky value strip, thumb-reach action, 44px targets |
| 3.5 | Accessibility | 3 | Stated target, no-colour-alone, focus-visible, aria-labelled controls. Not tool-audited |
| | **D3 (weight 20)** | **18/20** | **18.0** |
| 4.1 | Consultation conversion | 4 | `/book` — blocker-aware, objection-handling, proof adjacent |
| 4.2 | Representation capture | 3 | Rep status is a visible lifecycle gate |
| 4.3 | Decision support | 3 | `/app/decisions` and the decision room |
| 4.4 | Offer and negotiation | 4 | Net-based comparison, not price alone |
| 4.5 | Pipeline visibility | 3 | Stall detection with named causes; weighted forward view. Weights are assumptions, not history |
| | **D4 (weight 15)** | **17/20** | **12.75** |
| 5.1 | Post-closing continuity | 3 | Anniversary moment carries an equity and tax update |
| 5.2 | Referral request mechanics | 4 | Eight moments, escalating asks, one of which is deliberately silence |
| 5.3 | Review and reputation | 3 | Satisfaction gate with private routing. No non-response follow-up yet |
| 5.4 | Long-term touches | 3 | Day 30, month 6, anniversary indefinitely |
| 5.5 | Referral attribution loop | 4 | Referrer→referee linked and countable |
| | **D5 (weight 15)** | **17/20** | **12.75** |

### Pass-three total

| Dimension | Plan (pass two) | Built prototype |
| --- | --- | --- |
| D1. Front-end value and capture | 28.8 | 27.5 |
| D2. Agent operating leverage | 18.0 | 17.0 |
| D3. Client experience clarity | 16.0 | 18.0 |
| D4. Conversion to sale | 12.0 | 12.8 |
| D5. Referral and retention | 12.8 | 12.8 |
| **TOTAL** | **88** | **88** |

D3 and D4 rose above the plan because building them surfaced work the plan had not
specified — the trust ladder, mobile behaviour, stall detection. D1 and D2 fell because
building them surfaced how much of "nurture" and "recovery" was a sentence rather than a
system.

### The rule this score is subject to

> No score above 84 is validated until field metrics exist.

Instrumentation now exists and is verified working — `lib/prototype/telemetry.ts`, surfaced
inside the funnel editor so drop-off appears on the question you would edit. **Every number
it reports is currently zero.** So 88 is a build score and it is provisional. The first 200
real assessments are the actual grading event, and the three lowest criteria above are the
remediation backlog only until real data replaces them with different ones.

### The three lowest, as the backlog requires

1. **1.6 Nurture is a band, not a cadence** (3). Leads are classified; the sequence that
   works them is designed and unbuilt.
2. **2.4 Intake-to-plan cycle** (3). Instant to the readout, undefined from readout to a
   published, agent-reviewed plan. This is the seam where a lead becomes a client.
3. **3.3 Trust labeling** (3). Three of four states have live producers. `pending-review`
   arrives when agent review becomes asynchronous.

---

## Pass four — after the gap remediation

Graded 6 September 2026, immediately after building the four things pass three named as its
own backlog. This grades the same prototype with those four gaps closed. It is a narrow
re-grade: only the criteria the remediation touched were re-scored, and nothing else moved.

| # | Criterion | Pass three | Pass four | What changed |
| --- | --- | --- | --- | --- |
| 1.6 | Speed, recovery, nurture | 3 | **4** | `nurture.ts` — four sequences, widening intervals, six stop conditions, consent gating the channel rather than the sequence. Every step names what it gives the person. Surfaced at Studio → Queue → Follow-up |
| 2.3 | Automation depth | 3 | **4** | The share of touches that go out without the agent is now computed and shown per sequence, and the queue separates what runs from what needs him |
| 2.4 | Intake-to-plan cycle | 3 | **4** | `seam.ts` — ten fields with explicit carry rules, a 3% drift threshold that blocks publication until disclosed, and `canPublish()` preconditions. The seam is no longer designed-but-undefined |
| 3.3 | Trust labeling | 3 | **4** | `pending-review` has a producer. The ask sits inside `TrustLadder` on every readout; items land in a queue against a 24h promise, carry a per-item ceiling, and cannot reach `verified` without a named party |
| 4.5 | Pipeline visibility | 3 | **4** | `weightFor()` shrinks the agent's own closed history toward the starting assumption with a prior of 12. Every weight is labelled assumed / part-observed / his own history |

| Dimension | Pass three | Pass four |
| --- | --- | --- |
| D1. Front-end value and capture | 27.5 | **28.8** |
| D2. Agent operating leverage | 17.0 | **19.0** |
| D3. Client experience clarity | 18.0 | **19.0** |
| D4. Conversion to sale | 12.8 | **13.5** |
| D5. Referral and retention | 12.8 | 12.8 |
| **TOTAL** | **88** | **93** |

### What this score is not

**93 is not better evidence than 88 was.** It is the same absence of evidence applied to more
machinery. Five criteria moved because the things they measure now exist and can be opened in
a browser; not one of them moved because a person used it. The rule still stands and now
binds harder than before:

> No score above 84 is validated until field metrics exist.

Two of the five increases are self-limiting in an honest way, which is worth stating:

- **4.5 scores 4 for the mechanism, not the numbers.** Most stages still correctly report
  *assumed*, because the agent has not closed enough deals for his own history to outweigh the
  prior. The criterion is satisfied because the weights will become his automatically. Today
  they are still ours, and the UI says so on every chip.
- **1.6 scores 4 for a cadence that is resolved but not sent.** The engine says what is owed,
  to whom, on which channel, and why. Delivery is phase-3 infrastructure that does not exist.

### The three lowest, as the backlog requires

1. **1.5 Entry surfaces and campaign connection** (3) — and 3 is the stated target here.
   Attribution is deliberately "strong but not best in the world". Do not spend on this.
2. **2.5 Never-lose guarantee** (3). Fallbacks exist and surface; they are not exhaustive.
   The honest test is an adversarial one — kill each dependency in turn and see what goes
   quiet rather than loud.
3. **5.3 Review and reputation** (3). The satisfaction gate routes badly-going relationships
   privately, which is the hard half. There is still no follow-up path for somebody who is
   asked and simply does not answer.

None of these three can be raised by building. 2.5 needs a failure drill, 5.3 needs somebody
to not answer, and 1.5 should be left alone. **That is the signal that the prototype is
finished and the next move is traffic, not features.**

## How to run this benchmark

1. Score each criterion 0 to 4 against the ladder, citing the document section or prototype screen that earns the score.
2. Compute dimension subtotals and the weighted total.
3. Record the date, what was graded, and the three lowest-scoring criteria.
4. Convert those three into the remediation backlog for the next cycle.
5. Once Rift is in real use, pair every re-grade with the current field metrics. Where a plan scores well and the field metric does not, the plan is wrong, not the market.
