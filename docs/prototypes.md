# Rift Prototype Blueprint

**Status:** Built and reviewed — 30 routes live under `/prototype`
**Superseded so far:** the buyer landing, assessment, readout, booking and the agent's lead
list now have production equivalents under `/buy`, `/book` and `/studio`. The prototype
screens stay until each replacement has been checked against them — one at a time, never as
a tree.
**Graded by:** [benchmark.md](benchmark.md) — built prototype scores 93, provisional
**Engineering handoff:** [handoff.md](handoff.md) — build order, contracts, acceptance tests
**Implementation notes:** [architecture.md](architecture.md#design-prototypes)

## Built routes

Run `npm run dev` and open `/prototype`. No configuration, no accounts, no database.

There is no "MVP prototype" and "final prototype" any more. That split produced two
documentation artifacts rather than a product, and it was replaced by three products a
person can actually use, each with its own front door, identity and shell.

### Rift for buyers — a standalone product

| Route | What it demonstrates |
| --- | --- |
| `/prototype/buy` | Answer-first landing: two questions in the hero and a matched assistance range before any scroll. Answers carry into the assessment |
| `/prototype/buy/start` | The assessment, rendered from the editable funnel definition. Picking an answer advances. Questions answered on the landing page are not asked again |
| `/prototype/buy/results` | **The payoff.** Verdict, true cash to close, named program matches, gap and levers, monthly across a price band, the blocker, ordered steps, a lender question sheet, and a three-rung conversion ladder. Ungated, URL-addressable, shareable |
| `/prototype/buy/assistance` | Every program tracked, including closed, waitlisted and suppressed ones |
| `/prototype/buy/how` | How the product works and what it will not do |
| `/prototype/book` | Booking, shared by both products. Blocker-aware, states what the call is *not*, and gates a phone number behind TCPA consent |

### Rift for sellers — a standalone product

| Route | What it demonstrates |
| --- | --- |
| `/prototype/sell` | Answer-first landing: three inputs and net proceeds, before any scroll |
| `/prototype/sell/start` | The seller assessment, same engine, its own questions |
| `/prototype/sell/results` | Net proceeds line by line, unclaimed value, repair triage, the blocker, ordered steps, questions for any agent, conversion ladder |
| `/prototype/sell/unclaimed` | Exemptions, appeals and reliefs, with who decides each |
| `/prototype/sell/how` | How the product works |

### The agent's site, the client portal, the studio, and Rift Offer

| Route | What it demonstrates |
| --- | --- |
| `/prototype/kaleb` | The only page written for a person rather than a transaction — referrals, past clients, anyone who heard the name |
| `/prototype/app` … `/app/share` | The client portal: overview, plan, money, decisions surfaced contextually, documents, messages, sharing |
| `/prototype/studio` | Agent daily brief — attention queue ranked by consequence, what Rift handled overnight, cost watch |
| `/prototype/studio/clients` | Five views: **Leads** ranked with the arithmetic exposed and a split speed-to-lead clock; **List**; **Board** with stall detection and a weighted forward view; **Sources** attribution; **Referrals**, the moment engine |
| `/prototype/studio/offers` … `/offers/room` | Agent-first offer review: present, hold, or decline to present. Decision room |
| `/prototype/studio/calendar` | Schedule, deadlines, consequence-ordered |
| `/prototype/studio/queue` | Three tabs, all of them work waiting on a person. **Follow-up** — the nurture cadence engine, what is owed today, which touches go out on their own, and where consent downgraded a channel. **Review** — the queue that produces `pending-review`, with per-item ceilings and a named-party requirement on verification. **Publishing** — the readout→plan seam, drift disclosure, and the preconditions on going live |
| `/prototype/studio/settings` | Autonomy modes, programme registry, playbooks, profile, **the funnel editor with per-question drop-off and version history**, **Business rules** — the six decisions that were literals in source files, each with its consequence and whose call it is — and **Privacy**, retention rules and versioned consent wording |
| `/prototype/offer` | Account-free offer submission for cooperating agents and unrepresented buyers |

## Purpose

This document describes the **whole target product**, prototyped end to end. Breadth was
deliberate: covering the full lifecycle laid the structural foundation and, more importantly,
let Rift be tried in real scenarios with real people. What the real world rejects is worth
more than what a narrower plan would have protected.

**Breadth here is not a release plan.** What ships first, and what waits, is defined in
[handoff.md](handoff.md) §2 — and it is a much narrower thing than this document. The
headings below that begin with "MVP" are historical: they date from a period when the
prototype itself was split into an MVP and a final version, a split that produced two
documentation artifacts rather than a product and was abandoned. Read them as describing the
prototype's scope, not the first release's.

## What these prototypes are, and are not

These were built as **design prototypes**: fast, mock data, meant to be thrown away. They are
no longer throwaway, and pretending otherwise costs the build its clearest reference.

They are **the specification**. They prove the interaction model, they encode product rules in
executable form, and the production build is measured against them. A screen leaves
`/prototype` when its production replacement is live and has been checked against it — one at
a time, never as a tree.

| These are | These are not |
| --- | --- |
| Clickable interaction models with realistic fake data | Production software |
| Wired to fixtures held in the prototype itself | Wired to Supabase, real auth, Brevo, Sentry, or any live integration |
| Free to fake any calculation, extraction, or automation | Bound by real calculation contracts or real document parsing |
| Disposable — expected to be deleted after the rebuild | A codebase to grow the real product from |
| Optimized for speed of learning | Optimized for correctness, security, or performance |

Everything lives under `/prototype` and shares nothing with production code paths. When a prototype screen is approved, it becomes a specification for the real build, not the starting point of it. The prototype folder is deleted once the real surface ships.

Because the prototypes are disposable, they may cut every corner that does not change what a reviewer understands — and may cut none that does. Fake data must be realistic Georgia data. Fake states must be reachable. Fake failures must look like real failures.

## Organization

```text
/prototype
  /buy      standalone buyer product   (vermilion identity)
  /sell     standalone seller product  (deep green identity)
  /kaleb    the agent's own site
  /app      the client portal
  /studio   the agent operating surface
  /offer    account-free offer submission
```

Each product owns its shell, navigation and footer. `ProductShell` carries the buy/sell
identity; `ClientShell` and `StudioShell` carry the two logged-in surfaces. Nothing forces a
buyer and a seller to look at each other's content, because the ad, referral or search that
sent them already knew which one they were.

## Brand and design system

The bright-precision palette described in earlier drafts was replaced after review. It read as
generated work, and the two most common giveaways were the typefaces.

| Role | Token | Use |
| --- | --- | --- |
| Ink | `--ink` `#0d0e10` | Type, dark answer panels |
| Canvas | `--canvas` `#fbfaf8` | Page ground |
| Buyer brand | `--brand` `#e8442a` | The buyer product's identity |
| Seller brand | `--brand` `#1d6a52` | The seller product's identity |
| Positive | `--pos` `#157a5b` | Verified, open funding, completion |
| Hairline | `--line` `#e5e3df` | Structure, never a box shadow where a line will do |

Type is **Switzer** for interface and **Zodiak** for display, both from Fontshare. They were
chosen partly because they are good and partly because generated work almost never uses them —
Inter, Instrument Serif, Space Grotesk, DM Sans, Plus Jakarta, Poppins and Geist all read as a
default. Both are loaded via a `<link>` in `app/prototype/layout.tsx`; a CSS `@import` is
silently stripped by the bundler, which is worth knowing before debugging it twice.

Product identity is a CSS variable swap, not a separate stylesheet. `.buy` and `.sell` redefine
`--brand`, so the two products read as siblings without duplicating a design system.

### Accessibility rules

Rift targets WCAG 2.2 AA. These rules are not decoration and apply to both prototypes.

1. **Contrast.** Body and interface text meets 4.5:1; large text and interface components meet 3:1. Rift Blue passes for text on white. Ember, Solar Yellow, and Emerald do not — use them as fills, indicators, and large accents, and use the text-safe variant whenever the color carries words.
2. **Never color alone.** Every state carries an icon and a label as well as a color. Rift's entire trust model rests on distinguishing preliminary, pending review, reviewed, and verified, and that distinction must survive monochrome, colorblindness, and a bright phone screen outdoors.
3. **Keyboard.** Every interactive element is reachable and operable by keyboard, with a visible focus state. The agent command center is keyboard-first by design.
4. **Structure.** Real headings in order, labeled form fields, and named landmarks. The assessment and Rift Offer are the two flows most likely to be completed under stress and must be the most robust.
5. **Motion.** Honor reduced-motion preferences; no state change may be conveyed only by animation.
6. **Targets.** Minimum 44 by 44 pixel touch targets on every client-facing mobile flow.

## Shared demonstration fixtures

1. An early-stage buyer who needs a readiness plan and cash-to-close clarity.
2. An active seller preparing a Georgia property and receiving multiple offers.
3. A not-yet-ready buyer captured from a named campaign, eleven months out, sitting in nurture.
3a. A first-time buyer who matches three Georgia assistance programs and discovers a $25,000 estimated range they did not know existed.
3b. A co-buyer invited into that buyer's package who answers timing differently, producing a visible disagreement for the agent.
3c. A long-tenured seller whose unclaimed value check surfaces an unfiled exemption and an assessment worth appealing.
3d. A saved buyer package that updates itself when a county program reopens funding.
4. A visitor who abandoned the assessment two-thirds through, leaving an email address.
5. A past client who closed nine months ago, left a review, and referred a friend.
6. The referred friend, arriving through a referral link, credited to the referrer.
7. A household buying and selling simultaneously in the final prototype.
8. Kaleb operating the daily brief, approvals, meetings, offers, and playbooks.
9. An outside buyer agent submitting an offer without an account.
10. An unrepresented person submitting an offer that needs agent follow-up.

All names, properties, offers, messages, deadlines, and documents are labeled demonstration data.

## MVP principles

- Keep communication practical: connected email may be shown; calls and texts remain manual.
- Use one active journey per customer.
- Use templates before advanced custom builders.
- Prepare consequential work for agent approval.
- Do not require outside professionals to create accounts.
- Make every primary action clickable; omit unfinished secondary controls.
- Demonstrate empty, waiting, overdue, approval, completed, and failed states.
- Every surface must show which part of the growth loop it serves.
- Front-end value is computed, never generated. No figure a visitor sees may be invented text — and because this prototype is the specification rather than a sketch, the rule holds here exactly as it holds in production.

## MVP public experience

### Main page

- Bright, high-confidence Rift identity.
- Clear buyer and seller paths.
- Concise promise: a smoother real-estate journey, guided by the agent.
- Direct links to buyer assessment, seller assessment, and Rift Offer.

### Buyer and seller pages

Each page works as a standalone campaign or referral destination, explains its lifecycle, offers immediate value through an assessment, and distinguishes preliminary information from agent-reviewed guidance.

### Campaign landing pages

One page per instant tool, each working as a standalone ad destination, each carrying campaign parameters through the tool and assessment into the relationship record. Show at least two live: `/buy/assistance` and `/sell/net-proceeds`.

### Proof

Public surfaces carry the agent's identity, recent closings, and genuine client reviews sourced from the referral and reputation engine. Demonstrate the empty state, before any reviews exist.

### Referral landing

A referred visitor arrives at a page that names the person who sent them, carries that credit into the assessment, and reaches the agent with the referrer already linked.

## MVP customer experience

### Instant tools

Seven single-answer tools, each usable in under a minute with no account, each its own campaign landing page, each opening into the matching assessment. They are not built to equal depth, deliberately.

| Tool | Depth in the prototype |
| --- | --- |
| Georgia assistance check | **Full.** Real seeded programs, county matching, ranges, eligibility conditions, verified-as-of dates, and a closed-funding state |
| Net proceeds estimator | **Full.** Complete Georgia cost stack, every line editable, unclaimed value check attached |
| True cash to close | Working calculation, single layout, no edge states |
| All-in monthly payment | Working calculation, single layout, no edge states |
| Rent versus buy crossover | Working calculation, single layout, no edge states |
| Repair return triage | Static demonstration against one price band |
| Buy-before-sell sequencing | Static demonstration against one scenario |

The two full tools carry the entire strategy: assistance matching is the buyer hook and net proceeds is the seller hook. The other five exist to prove the pattern and to stand as campaign destinations. Building all seven to equal depth would spread the prototype thin against its only real job, which is finding out whether the two that matter actually land.

Every tool, at whatever depth, demonstrates visible assumptions, an editable input that changes the result live, a preliminary label with an as-of date, and a plain statement of how the number could be wrong.

### Guided assessment

- Five-to-seven-minute progressive flow.
- No account required to begin.
- **Progressive revelation:** results appear and update as questions are answered, so someone who stops at question nine still leaves with something.
- The complete buyer readiness package or seller reality package, delivered in full before any save is mentioned.
- For buyers, the Georgia assistance match is shown early and prominently — it is the strongest hook in the flow.
- Password-only save after existing information is prefilled for confirmation.
- A single conversational **how did you hear about us** step when no source was captured from the link.
- Demonstrated abandonment: leaving mid-flow, returning to a resumed assessment, and the one-time resume message.

### Consultation booking

- An earned invitation tied to the client's largest identified obstacle.
- Real availability, a choice between a short call and a full planning session, and a graceful decline that keeps the plan.
- A declined snapshot visibly entering nurture rather than disappearing.

### Sharing the package

- A completed package becomes a shareable read-only link and a branded document.
- Four demonstrated recipients: co-buyer, a relative gifting funds, a lender, and a friend.
- The gifter view shows the cash requirement and the gap with income, credit, and debt detail withheld.
- The lender view carries the situation summary and the question sheet under the agent's identity.
- A recipient who runs their own assessment arrives credited to the sharer.
- Every share appears in the agent's activity feed as a buying signal.

### Co-buyer

- The early question about who else is part of the decision.
- A genuine invitation to the co-buyer, and their own view of the same journey.
- A co-buyer completing only the parts they can answer, and the package updating to reflect both people.
- **Disagreement shown as a supported state:** two different answers on timing or budget displayed side by side rather than averaged, and surfaced to the agent to resolve in conversation.

### The living package

- A saved package that updates itself, with the change and its meaning leading.
- Demonstrate four update reasons: a new county assistance program opened, a matched program's funding closed, rates moved enough to change the gap, and the customer's own savings crossed a threshold.
- Demonstrate the correct silent state: nothing changed, nothing sent.
- Each update carrying exactly one specific next action.

### Journey command center

- Current stage, one next action, and nearest deadline.
- Visual lifecycle and progress.
- Tasks with visible owners.
- Representation status as a plain-language task with its own state.
- Documents and review status.
- Appointments, Decision Rooms, recent updates, and help.

### Buyer journey

Clickable from assessment through readiness, financing preparation, search, offer, contract, closing, move-in, and initial post-closing follow-up.

### Seller journey

Clickable from assessment through preparation, pricing, launch, active listing, offer review, contract, closing, and post-sale follow-up.

## MVP agent experience

### Daily command center

- Daily brief and attention queue.
- New assessments, booked consultations, and offers awaiting a decision.
- Approvals and upcoming deadlines.
- Representation approaching expiration.
- Stalled clients, stalled nurture leads, and failed workflows.
- Work completed by Rift.

### Supporting views

- Buyer and seller pipelines.
- Client directory and relationship record, including source, referrer, and referrals given.
- Lead source view: leads and consultations by source and campaign, with unknown-source volume visible.
- Calendar, tasks, playbook activity, referral activity, and settings.
- Autonomy settings showing global mode, per-workflow authority, spending limits, and the protected always-manual list.

### Core agent scenario

1. Review a new assessment arriving from a named campaign.
2. Hold the consultation and run Meeting-to-Plan on the notes.
3. Review the proposed plan changes side by side and publish.
4. See the customer's updated journey.
5. Handle an attention-queue item.
6. Review a submitted offer and decide to present, hold, or decline to present.
7. Release a presented offer into the seller's Decision Room.
8. Approve a binding contract's extracted dates into the journey.
9. Complete a manual post-closing gift task.
10. Approve the review request and referral ask, then see a referred lead arrive credited to its referrer.

## MVP Rift Offer

1. Search any property address.
2. Show a confirmed experience for Rift-managed listings or a neutral unconfirmed-address experience.
3. Upload the signed offer PDF first.
4. Prepare fields grouped by Price, Financing, Deposits, Dates, Contingencies, Concessions, Documents, and Special Terms, each showing confidence and source.
5. Let the submitter correct fields and resolve flagged uncertainty.
6. Ask whether proof of funds or preapproval is included and allow optional upload.
7. Collect contact and representation information without an account.
8. Accept incomplete submissions and flag them for follow-up.
9. Confirm submission with a reference number and private link.
10. Place the offer in the agent review queue.

### Agent-first review, demonstrated

The prototype shows all three outcomes and their consequences:

- **Present** — released into the seller's Decision Room with agent context.
- **Hold** — retained with the agent; the submitter sees only that it was received and is under review; an attention item appears after four hours.
- **Decline to present** — not released; the agent records a reason and the seller instruction behind it; the offer remains permanently in the file.

There is no seller-visibility configuration. Agent-first review is the only behavior, and the prototype must make the recorded decision trail visible, because that record is the point.

### Required Rift Offer states

Confirmed listing, unconfirmed address, extraction succeeded, extraction low-confidence, extraction failed with manual fallback, incomplete submission accepted, duplicate submission detected, unrepresented submitter flagged, and cost ceiling reached with manual entry.

## MVP Meeting-to-Plan

Present in the MVP, because it is what makes consultation booking worth doing. One complete path:

- Typed or pasted consultation notes.
- A proposed recap separating observed statements from proposed changes.
- A before-and-after review of profile fields, milestones, tasks, and dates.
- Selective approval, publication to the client journey, and a visible client-side update.

Consented recording capture and automatic follow-up execution remain final-product scope.

## MVP Document-to-Journey

Present in the MVP, in one high-value path: a binding contract becomes proposed dates, responsibilities, and tasks.

- Prepared fields show confidence and link to their source page.
- Consequential dates require explicit agent confirmation before becoming monitored deadlines.
- A contradiction between the document and existing journey data is shown with both values.
- Extraction failure degrades to manual entry without losing the document.

Classification, addendum checks, duplicate detection, and email ingestion remain final-product scope.

## MVP Decision Rooms

- Buyer affordability and cash-to-close scenarios.
- Seller offer comparison using agent-confirmed information.
- Price, estimated net, financing, deposits, dates, contingencies, concessions, documents, and risk.
- Agent context, release control, customer questions, and recorded decision.

## MVP Lifecycle Playbooks

Show editable templates and a restrained custom-playbook setup. MVP actions create tasks, reminders, drafts, approvals, and manual vendor work.

Three templates ship as demonstrations:

1. **Nurture cadence** — readiness-step-driven touches for a lead who is not ready, with pause and stall detection.
2. **Post-closing gift** — manual fulfillment, a prepared artist email using the approved property image, scheduled follow-up, and visible completion or failure.
3. **Review and referral** — the closing-day and two-week-after moments, an agent-approved review request, one follow-up on non-response, a referral link, and a thank-you when a referral arrives.

Direct purchasing and complex branching remain final-product capabilities.

## MVP referral and reputation

- A past client record showing reviews requested and received, referrals given, and their outcomes.
- The agent-approved review request and its single follow-up.
- A dissatisfied client routed to the agent instead of to a public review request.
- A personal referral link, the referral landing page, and the credited new relationship.
- A thank-you prompt when a referral arrives and again when it closes.

## Final-product additions

### Connected journeys

- Simultaneous buyer and seller journeys.
- Dependencies between sale proceeds, financing, possession, and closing dates.
- One coordinated household home screen.

### Advanced agentic operation

- Proactive monitoring across every journey.
- Configurable autonomy and per-workflow authority in full depth.
- Universal command control.
- Versioned skills and workflow learning from approved corrections.
- Complete action, cost, and outcome history for the agent.

### Advanced Meeting-to-Plan

- Consented meeting recording and transcription.
- Automatic follow-up execution and monitoring.
- Multi-participant recaps and commitment tracking.

### Advanced Document-to-Journey

- Document classification across contracts, disclosures, inspections, and lender files.
- Addendum, amendment, and duplicate detection.
- Email attachment ingestion.
- Risk detection and missing-information requests.

### Advanced Rift Offer and Decision Room

- Property-specific offer email ingestion.
- Revision and withdrawal history.
- Extraction confidence and contradiction checks at scale.
- Multiple-offer comparison and estimated seller net sheets.
- Buyer property, offer-strategy, inspection, and closing Decision Rooms.

### Advanced lead generation

- Multi-touch attribution and channel cost reporting.
- Campaign-specific landing variants and assessment branches.
- Workshop, open house, and event capture.
- Partner and lender co-marketing surfaces with disclosed relationships.

### Professional collaboration

- Scoped workspaces for lenders, closing attorneys, transaction coordinators, inspectors, photographers, contractors, insurance agents, and vendors.
- Role-specific tasks, documents, dates, and access.
- Blocker detection and escalation to the agent.

### Advanced Lifecycle Playbooks

- Visual workflow builder.
- Conditions, branches, delays, approvals, escalations, spending limits, and vendor actions.
- Manual, assisted, and automatic modes.
- Suggested workflow improvements.
- Gift ordering and artist fulfillment with receipts and tracking.

### Rift Property Passport

- Transaction documents transferred into a permanent home record.
- Systems, appliances, warranties, manuals, receipts, inspections, improvements, vendors, and maintenance history.
- Seasonal, anniversary, tax-document, and home-care reminders where appropriate.
- Future sale preparation and transferable property history.

### Teams and growth

- Agents, assistants, transaction coordinators, and managers.
- Workload assignment and shared service standards.
- Brokerage branding, approved playbooks, and performance reporting.

## Required states

Every core workflow should demonstrate relevant examples of empty, healthy, waiting, overdue, blocked, approval required, externally verified, completed, failed with retry, manually overridden, and cost-ceiling-reached states.

## Mobile scope

Fully prototype customer journeys, assessments, consultation booking, Rift Offer, the agent daily brief, tasks, client lookup, notes, and approvals on mobile. Keep advanced workflow building, bulk review, and administration desktop-first.

## Acceptance criteria

The prototypes are ready for approval when:

1. A buyer or seller can identify status and next action immediately.
2. Preliminary, reviewed, and externally verified information are unmistakable, including without color.
2a. A visitor receives a complete, personal, useful package before any account is requested, and every number in it shows its assumptions, is editable, and states how it could be wrong.
2b. A buyer sees named Georgia assistance programs and estimated amounts, phrased as *may qualify for* and never as approval, each carrying a verified-as-of date.
2c. A package can be shared with a co-buyer, a gifting relative, a lender, and a friend, with the gifter view withholding income, credit, and debt detail.
2d. A co-buyer can join, answer their own portion, and disagree visibly without the disagreement being averaged away.
2e. A saved package updates itself when the world changes, leads with what changed, and stays silent when nothing did.
2f. A seller sees at least one item of unclaimed value framed as worth confirming, naming who actually decides.
3. Anyone can submit an offer without guidance or an account.
4. Confirmed-listing and general-address Rift Offer experiences are clearly different.
5. Every offer visibly reaches the agent first, and present, hold, and decline-to-present each leave a readable record.
6. A seller can understand competing offers without relying on price alone.
7. The agent can find and complete the day's highest-value work within minutes.
8. Every task has an owner and every consequential action has an appropriate review state.
9. Every relationship shows where it came from, and a referred lead visibly credits its referrer.
10. A snapshot converts into a booked consultation, and a declined one visibly enters nurture.
11. Representation status gates lifecycle advancement and is understandable to the client.
12. A closing produces a review request and a referral ask without the agent remembering to do it.
13. Empty, failure, waiting, overdue, and cost-ceiling states remain understandable.
14. Customer-critical mobile flows work at approximately 390 pixels wide and meet the accessibility rules above.
15. The MVP feels intentionally focused and the final product feels like a credible expansion of the same system.

## Using the prototype in the real world

Each review session should be run against real people and recorded against the benchmark. The prototype is the specification, so a finding here changes what gets built rather than only what gets redrawn.

| Session | Participant | The question being answered |
| --- | --- | --- |
| Client clarity | A real recent buyer or seller | Can they answer the five questions without help? |
| Capture | Someone genuinely early in a move | Do they finish the assessment, and do they book? |
| Offer intake | A cooperating agent | Can they submit in under twelve minutes without asking anything? |
| Agent operation | Kaleb, on a real morning | Does the brief find the right work faster than the current process? |
| Advocacy | A past client | Would they actually use the referral path? |

Record what was tried, what stalled, and what was misunderstood, then re-grade against [benchmark.md](benchmark.md). Where the prototype scores well and a real person struggles, the plan is wrong.
