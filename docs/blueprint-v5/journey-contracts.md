# Buyer and seller journey operating contracts

**Part of [Blueprint v5](README.md).** Carried over from blueprint v4 unchanged, except for this
header and the link below. The buyer contracts B00 to B20 are what the built client journey
follows; the seller contracts S00 to S18 are the specification for the seller journey (v5 §9).

**Status (v4 wording):** proposed mechanics for review against actual transactions. The stages cover the entire supplied blueprint; no claim is made that an unavailable integration already performs these actions. Buyer search is the first implementation slice. Full seller expansion follows the buyer release.

## 1. Rules shared by every stage

Each stage inherits the evidence, access, financial, decision, deadline, and automation requirements in [the requirements](requirements.md). Stage numbers below preserve the source document's buyer/seller numbering for traceability; they are not database enum values or a requirement for a linear wizard.

- **Entry:** an observed event, authorized user action, or confirmed source; never simply the prior screen being viewed.
- **Responsibilities:** every task has one accountable person. If a third party has not accepted it, the agent owns obtaining confirmation. “Rift” may execute a job but does not replace the accountable human.
- **Evidence:** facts identify source, version, observation time, review state, and who can verify them. Client completion claims and professional confirmation are distinct.
- **Dates:** use actual verified contract/appointment dates; preparation targets are labeled separately. Unknown dates remain unknown. Alerts cannot amend an agreement.
- **Automation:** internal preparation and reminders are permitted; external actions await the agent's approval. AI outputs are proposals. Consequential source fields require human review.
- **Communication:** prepare a client update when their action, deadline, status, or material figure changes. Existing information alone does not justify another message. Channel/consent and approval are checked at send time.
- **Failure:** retain current valid state, show the missing evidence or failed integration, assign a recovery owner, and provide a manual path. Never infer successful delivery, receipt, signature, or professional approval.
- **Exit:** record who confirmed the exit evidence. A paused journey retains active contractual obligations. Stage change history is retained; undo is a compensating event with a reason.

### Standard workstream statuses

`not-started → in-progress → waiting → confirmed-complete`, with independent `blocked`, `cancelled`, and `not-applicable` states. “Overdue” is derived from an unresolved verified obligation, not another mutually exclusive status. Completion, cancellation, or not-applicable status requires actor, reason/evidence, and time.

### Exception classes present throughout

Household disagreement; participant/access change; agent unavailability; expired representation; stale data; provider outage; withdrawn property; changed budget; concurrent edits; duplicate event; cancelled appointment; revised contract; disputed fact; and client pause. Severe or unfamiliar transaction conditions create a manual exception workstream with a named professional, not an invented automated process.

## 2. Buyer stages

### B00: Discovery and readout (source §5; public)

- **Entry / required information:** visitor chooses a tool. Collect only bound computation inputs; keep defaults distinguishable from answers. **Client:** enter/edit inputs and inspect results. **Agent:** maintain registry/rate assumptions. **Third party:** none required for value delivery.
- **Output / evidence:** immutable dated readout, assumptions, conditional program matches, limitations, optional save/review/booking. **Primary action:** “Get my numbers,” then an earned optional next step. No account or marketing consent required to see the result.
- **Exit / exceptions:** saving claims the snapshot to a relationship; consultation begins B01. Abandonment supports local resume. Missing/stale external data is explained. Unknown savings rate never becomes “ready now.”

### B01: Consultation and initial plan (source §6; Prepare)

- **Entry:** consultation requested or agent adds an existing buyer. Reuse readout/preferences and ask what changed. **Client:** confirm goals, timing, comfort, decision makers, and existing representation. **Agent:** identify blockers and proposed responsibilities. **Third parties:** lender introduction only if chosen and approved.
- **Output:** reviewed plan draft with owners and source-linked facts. Typed notes can produce suggested changes; recording is not required. **Primary action:** “Confirm your priorities.” Appointment times come from real confirmations or a visibly pending request.
- **Exit:** client/agent have a usable plan and named next action; B02/B03 may proceed in parallel. Missing financial facts remain requests. An existing brokerage relationship becomes an agent review item, not automated outreach.

### B02: Representation and working agreement (source §7; Prepare)

- **Entry:** service needs an applicable agreement. **Agent:** select the broker-approved document and scope in Remine. **Client:** review official terms and sign through that system. **Third party:** brokerage/e-sign process supplies completion evidence.
- **Output:** agreement family, parties, effective/expiry dates, scope, document version, and status. Plain-language explanation links to the governing agreement. **Primary action:** “Review agreement.” Prepared, sent, signed, declined, expired, and disputed are distinguishable.
- **Exit:** agent verifies coverage for the proposed activity. Future-effective, limited-scope, expired, or incomplete agreements do not become blanket permission. Preserve the existing production gate until approved action-specific rules replace it.

### B03: Financing and buying budget (source §8; Prepare)

- **Entry:** money needs confirmation. **Client:** set comfort ceiling and reserve preference; provide needed data directly to lender where possible. **Agent:** coordinate. **Lender:** establish qualification, program terms, verified figures, and validity period; cash buyers supply appropriate evidence through reviewed channels.
- **Output:** separate comfort budget, lender-reported approval, planning scenarios, cash timing, and open questions. Store minimum evidence, not a duplicate underwriting file. **Primary action:** “Review my buying budget.”
- **Exit:** enough reviewed information exists for the intended search/tour/offer activity, without implying a final loan commitment. Changed finances, stale letters, and conditional approvals create explicit blockers or refresh requests. Loan work continues through closing.

### B04: Search brief and activation (source §9 and §4.1; Search)

- **Entry:** buyer confirms initial priorities. **Client:** classify requirements versus preferences. **Agent:** review translated criteria and exceptions. **External system:** Matrix/OneHome remains search/delivery destination; write permissions must be verified.
- **Output:** versioned brief, hard/preference/undecided criteria, property-only rationale, unsupported filters, copyable setup package, approved notification cadence, and activation receipt/manual confirmation. **Primary action:** client “Confirm search priorities”; agent “Review search setup.”
- **Exit:** search is confirmed active or explicitly manual-action-needed. A failed write retains the previous active configuration. No assumption that a listing API can create contacts or auto-emails. This is the first vertical slice.

### B05: Discovery and shared shortlist (source §10; Search)

- **Entry:** authorized listing data or buyer/agent property link is added. **Client:** react and optionally explain. **Agent:** review fit/unknowns and questions. **Provider:** supplies permitted listing facts and freshness where connected.
- **Output:** shared shortlist with individual reactions and transparent fit reasons. Private MLS remarks never enter client cards. **Primary action:** “Review homes” or “Request a tour.” No arbitrary percentage match.
- **Exit:** shortlist leads to B06/B07; ongoing search stays active. Unavailable inventory becomes an honest no-match/missing-feed state. Budget/area changes require a revised brief and approved external update; browsing behavior does not silently change criteria.

### B06: Tour planning and feedback (source §11; Tour & evaluate)

- **Entry:** buyer requests a tour. **Agent:** check coverage, availability, access, travel feasibility, and request in ShowingTime. **Client:** confirm availability and give feedback. **Listing side/ShowingTime:** confirms or changes the appointment.
- **Output:** requested versus confirmed itinerary, property brief, current status, and concise post-tour feedback. Access/lockbox details remain restricted. **Primary action:** “Review tour plan,” then “Share feedback.”
- **Exit:** completed/cancelled tours have an outcome. Shortlist proceeds to B07 or preferences return to B04 for review. A calendar entry alone is not showing confirmation. Offline notes may remain drafts but do not silently change the external appointment.

### B07: Before-you-offer review (source §12; Tour & evaluate)

- **Entry:** serious interest in a property. **Agent:** assemble permitted comps, disclosures, known property facts, and unresolved questions. **Client:** assess tradeoffs. **Lender/other professional:** confirm relevant financing or property questions.
- **Output:** property facts with source/as-of, payment/cash scenario, missing information, budget differences, and agent context. **Primary action:** “Discuss an offer.” Unknown roof age, HOA, permits, or flood information stays unknown; no unsupported neighborhood judgment.
- **Exit:** buyer decides to prepare an offer, investigate, or pass. A missing fact is documented with owner and effect; it is not silently filled by AI. Agent verifies any value opinion before release.

### B08: Offer strategy (source §13; Offer)

- **Entry:** buyer wants an offer. **Client:** choose priorities/terms with agent. **Agent:** prepare price, deposits, financing, contingencies, credits, closing/possession, and permitted alternatives. **Lender/attorney:** resolves questions within their authority.
- **Output:** versioned term sheet and deterministic financial effects; factual tradeoffs rather than winning probability. **Primary action:** “Review strategy with my agent.” All decision makers and authority are recorded.
- **Exit:** current terms have client instruction and agent review sufficient for document preparation. Strategy approval neither signs nor sends an offer. Incomplete terms or household disagreement keep the proposal unresolved.

### B09: Prepare, sign, and submit offer (source §14; Offer)

- **Entry:** reviewed strategy. **Agent:** prepare current licensed forms in Remine, check parties/exhibits, request signatures explicitly, then deliver through approved channel. **Client:** review/sign official documents. **Other side:** receives the offer.
- **Output:** original executed offer, version, signature evidence, delivery receipt or agent-recorded submission evidence, response deadline if sourced. **Primary action:** “Review official offer,” then “Waiting for response.”
- **Exit:** confirmed submission starts B10. Drafted, signed, submitted, and received remain distinct. Delivery failure creates urgent recovery; a retry cannot duplicate an uncertain send without reconciliation.

### B10: Negotiation and counters (source §15; Offer)

- **Entry:** response, counter, expiry, withdrawal request, or multiple-offer notice. **Agent:** verify changes against actual documents. **Client:** instruct agent on the current version. **Other side:** sends its response.
- **Output:** changed terms, recomputed money, sourced deadline, superseded versions, options and tradeoffs. **Primary action:** “Tell my agent how to proceed.” Never an ambiguous contract-acceptance button.
- **Exit:** rejected/expired/withdrawn attempts return to B04/B08; agent-confirmed binding evidence creates B11. Late responses to old versions are rejected. An apparent acceptance with missing execution/delivery evidence remains pending confirmation.

### B11: Under-contract kickoff (source §16; Under contract)

- **Entry:** agent confirms governing executed agreement and binding event. **Agent:** verify extracted/entered terms and dates, participants, responsibilities, and applicable workstreams. **Client:** understand immediate obligations. **Lender/closing professional:** receives approved documents as needed.
- **Output:** transaction attempt, verified critical dates, parallel workstreams B12–B16, accountable owners, and client Today update. **Primary action:** earliest verified client obligation, often earnest money or inspection scheduling.
- **Exit:** required workstreams are initialized, not necessarily completed. Missing dates become urgent verification tasks. Amendments create new reviewed versions; no countdown is invented from a generic closing duration.

### B12: Earnest money (source §17; concurrent)

- **Entry:** verified deposit obligation. **Client:** use approved external instructions and report submission. **Agent:** coordinate evidence. **Named holder:** confirms receipt. Store amount, holder, due date/source, submitted-at and received-at separately.
- **Output:** clear obligation, verified professional contact path, submitted/receipt state. **Primary action:** “Confirm instructions with the holder” or “View receipt status.” Funds are not moved in Rift.
- **Exit:** holder-confirmed receipt or professionally resolved exception. Screenshot/upload alone is not receipt. Late/missing funds escalate to the agent; the system never declares a contractual consequence or generates replacement bank details.

### B13: Inspections and due diligence (source §18; concurrent)

- **Entry:** verified investigation period and property needs. **Client/agent:** select and coordinate relevant inspections. **Inspectors/specialists:** inspect and supply reports. An unchosen inspection is optional/undecided, not implicitly completed.
- **Output:** appointments, original reports, source-linked issue list, agent-reviewed categories, and investigation deadline. **Primary action:** “Review findings.” AI cannot replace professional diagnosis or fabricate repair costs.
- **Exit:** client/agent choose additional investigation, acceptance of condition, or B14 strategy before the governing deadline. Missing reports, serious findings, and disputed categories remain visible. A summary never hides access to the full report.

### B14: Repair negotiation (source §19; concurrent)

- **Entry:** selected issues need a response. **Client:** give instructions. **Agent:** prepare request/counter in approved forms, confirm execution, and track obligations. **Seller/vendors:** respond or perform agreed work.
- **Output:** issue → requested resolution → seller response → executed agreement → completion evidence. Costs distinguish quotes from estimates. **Primary action:** “Review repair response.”
- **Exit:** agreement/other professionally handled outcome is confirmed; agreed items become walkthrough checks. A requested repair is not an agreed obligation. Termination decisions and notices remain professional actions with evidence, not issue-board buttons.

### B15: Financing, underwriting, and appraisal (source §20; concurrent)

- **Entry:** loan/appraisal work underway, when applicable. **Lender/appraiser:** supply their own statuses and conclusions. **Client:** satisfy requests in professional channels. **Agent:** obtain updates, resolve coordination blockers, verify relevant contract implications.
- **Output:** source/time for each status, client requests, expiry and contingency dates when verified, separate appraisal outcome. **Primary action:** the actual client request; otherwise “No action currently assigned to you.”
- **Exit:** professional confirmation required for readiness. Stale or absent updates say “Waiting for confirmation.” Low appraisal or financing failure creates an agent decision; no automated renegotiation or inference that a clear-to-close status ends all risk.

### B16: Insurance, title, and closing preparation (source §21; concurrent)

- **Entry:** approaching scheduled closing with verified date. **Client:** arrange insurance, review required figures/documents, prepare utilities/possession. **Agent:** coordinate unresolved work. **Lender/closing attorney/title professionals:** confirm their deliverables.
- **Output:** required versus optional readiness items, actual missing blockers, official document versions, estimate-to-official reconciliation. **Primary action:** highest-priority unmet requirement. Do not use “82% ready.”
- **Exit:** required confirmations permit closing preparation to advance; no blanket “ready” while title/funds/financing evidence is missing. Rescheduled closing updates dependent appointments/tasks for review and invalidates outdated notices.

### B17: Final walkthrough (source §22; Close)

- **Entry:** walkthrough scheduled before closing/possession as appropriate to the agreement. **Buyer/agent:** inspect agreed repairs/items and changes. **Seller/vendors:** provide relevant evidence or access.
- **Output:** mobile checklist linked to exact agreed obligations, photos/notes, completed-at, unresolved issues and agent disposition. **Primary action:** “Record walkthrough findings.”
- **Exit:** agent/buyer have addressed findings through the appropriate process. Checking all boxes is not legal acceptance of property condition. Incomplete access, damage, missing items, or unresolved repair evidence creates a closing blocker/decision for professional handling.

### B18: Closing and possession (source §23; Close)

- **Entry:** scheduled closing. **Client:** follow official signing/funds instructions. **Agent:** coordinate and confirm outcome. **Closing professional/lender:** governs signing, funds, and completion evidence.
- **Output:** verified time/location/contact, official figures, signed records, completion confirmation, and separate possession/keys status. **Primary action:** relevant closing instruction, then “View your home handoff.”
- **Exit:** “You own your home” appears only after appropriate confirmed completion, not the scheduled time. Delayed funding, deferred possession, or failed closing stays explicit. Post-close occupancy creates continuing obligations with dates/owners.

### B19: Move-in and immediate follow-through (source §24; Own)

- **Entry:** confirmed close; possession may still be pending. **Client:** utilities, keys/security, address changes, selected home tasks. **Agent:** finish handoff and unresolved promises. **Providers/HOA:** supply relevant contacts and records.
- **Output:** concise personalized handoff, retained documents, outstanding obligations, county-specific questions with verified source/date. **Primary action:** next useful move-in task.
- **Exit:** immediate obligations are complete or transferred with owners. Tax/homestead dates come from maintained official sources for the actual county, not generic annual assumptions. Do not tie service recovery to eligibility for public reviews.

### B20: Ownership continuity (source §25; Own)

- **Entry:** transaction handoff complete. **Client:** optionally maintain home records/preferences. **Agent:** provide approved useful follow-up. **Professionals/vendors:** confirm advice or service when requested.
- **Output:** R1 provides exportable records, explicit remaining tasks, and communication controls. Later releases add maintenance/warranty records and sourced reminders. **Primary action:** the relevant obligation, or no action.
- **Exit:** a future move opens a new linked journey. Closing history stays intact. Do not promise infinite vault retention, unattended value monitoring, or equity forecasts; permissions, data rights, retention, and budgets must support the promise.

## 3. Seller stages: specified now, implemented later

These inherit the same common contracts and share transactions, parties, decisions, dates, tasks, document evidence, and money infrastructure. Seller-specific pricing/launch functionality does not enter the buyer-first release merely because its schema could be shared.

### S00: Discovery (source §27)

**Entry:** seller uses a net tool. **Seller:** supplies scenario price/payoff; address is optional until property context is needed. **Agent:** maintains transparent assumptions. **Output/CTA:** ungated scenario proceeds → “Save or review my seller plan.” **Exit:** consultation requested. Unknown value is not an automated valuation; underwater results name the shortfall.

### S01: Consultation (source §28)

**Entry:** inquiry or existing seller. **Seller:** confirms ownership, occupancy, timing, priorities, and next-move dependency. **Agent:** verifies goals and proposes work. **Output/CTA:** versioned seller plan → “Confirm priorities.” **Exit:** agreed next actions. Multiple owners, tenants, estate/trust authority, and disputed ownership create professional review rather than assumed signing authority.

### S02: Property record (source §29)

**Entry:** property identified. **Agent/seller:** assemble permitted records and corrections; county/HOA/other sources provide evidence. **Output/CTA:** facts with source, date, and conflicts → “Resolve missing details.” **Exit:** sufficient verified facts for next action. Different square-footage claims are preserved, not averaged; title/legal ownership is confirmed through the appropriate professional.

### S03: Listing relationship and disclosures (source §30)

**Entry:** representation/listing preparation. **Agent:** selects current licensed documents in Remine; **seller:** supplies disclosures and signs; **broker/provider:** supplies policy and signature evidence. **Output/CTA:** scoped agreement and disclosure status → “Review required documents.” **Exit:** applicable coverage and required documents verified. AI cannot answer disclosure questions on the seller's behalf or assume “no” for missing facts.

### S04: Pricing strategy (source §31)

**Entry:** property evidence and seller priorities available. **Agent:** chooses relevant comps and approves a value opinion; **seller:** chooses launch strategy. **Output/CTA:** scenario price/net/tradeoffs → “Discuss launch price.” **Exit:** approved price/version and review plan. No sale-price prediction, unsupported adjustment, “standard” commission, or fake days-to-sell certainty. Compensation and costs are explicit inputs.

### S05: Preparation (source §32)

**Entry:** walkthrough/strategy identifies useful work. **Agent:** proposes priorities; **seller:** approves spend and timing; **vendors:** quote/perform work. **Output/CTA:** scoped prep items with cost source, owner, dependency, and receipt → “Approve selected work.” **Exit:** launch-critical items verified or explicitly waived by responsible people. No autonomous purchases or fabricated renovation ROI.

### S06: Listing assets (source §33)

**Entry:** prep sufficient for media. **Agent/vendors:** coordinate photos, measurements, copy, disclosures, access instructions. **Seller:** reviews factual details and permissions. **Output/CTA:** launch checklist and preview → “Review listing materials.” **Exit:** agent confirms accuracy, rights, and readiness. Client approval of copy does not itself publish; restricted access instructions never enter public marketing.

### S07: Launch (source §34)

**Entry:** approved price/materials/coverage. **Agent:** publishes through authorized MLS workflow; **providers:** confirm listing status and permitted distribution. **Output/CTA:** confirmed live listing/links and scheduled review → “View the live listing.” **Exit:** publication verified. A syndication delay is distinct from failed MLS publication; no fictional “live everywhere” claim.

### S08: Showings (source §35)

**Entry:** showing request. **Seller/agent:** coordinate constraints/access; **ShowingTime/listing side:** confirms appointments; **showing agents:** supply feedback where available. **Output/CTA:** requested/confirmed schedule → “Review showing arrangements.” **Exit:** completed/cancelled outcome. Feedback counts use actual respondents and denominator; lack of feedback is not positive sentiment. Respect occupant privacy and restricted access details.

### S09: Performance review (source §36)

**Entry:** agreed review date or meaningful market event. **Agent:** interprets licensed metrics and feedback; **seller:** decides whether to review strategy. **Output/CTA:** concise sourced weekly account → “Discuss the strategy.” **Exit:** keep/change decision recorded. Missing syndication statistics are unknown; AI cannot attribute lack of offers to price or recommend a reduction as a fact.

### S10: Offer received (source §37)

**Entry:** actual offer received. **Agent:** verifies source terms and handles presentation under broker obligations; **seller:** reviews released terms. **Output/CTA:** comparable price/net/terms/unknowns → “Review offers with my agent.” **Exit:** decision/instruction moves to S11. Preserve every submission; software must not automatically discard, rank by protected traits, or delay legally required presentation through a product gate.

### S11: Negotiation (source §38)

**Entry:** seller instruction/counter. **Agent:** prepares and delivers reviewed official documents; **seller:** signs where required; **other side:** responds. **Output/CTA:** exact-version diff and revised net → “Record instructions for my agent.” **Exit:** agent-confirmed binding evidence or return to market/offers. Old choices expire when terms change; selection is not acceptance.

### S12: Under-contract kickoff (source §39)

**Entry:** governing agreement verified. **Agent:** confirms dates/workstreams; **seller:** understands obligations; **closing/lending parties:** provide permitted status. **Output/CTA:** seller-specific Today and timeline → earliest real seller action. **Exit:** workstreams established. Seller sees relevant buyer-financing milestones, never the buyer's private financial file. Amendments are reviewed, versioned, and propagated.

### S13: Inspection response (source §40)

**Entry:** buyer request/report. **Seller:** instructs; **agent:** explains and prepares response; **vendors:** quote or perform agreed work. **Output/CTA:** requested versus agreed items, cost evidence → “Review response options.” **Exit:** executed resolution and responsibilities. Severity categories are reviewable; unagreed requests do not become seller obligations. Deadlines remain contract-derived.

### S14: Appraisal, financing, title (source §41)

**Entry:** external work progresses. **Agent:** obtains permitted updates; **lender/closing professionals:** confirm outcomes; **seller:** handles assigned requests. **Output/CTA:** current status/source and exceptions → actual requested action. **Exit:** required professional confirmations. “No action assigned” is allowed; “everything is on track” without current evidence is not. Do not expose confidential buyer information.

### S15: Closing preparation (source §42)

**Entry:** verified upcoming closing. **Seller:** repairs, receipts, move-out, keys; **agent:** coordinates; **closing professional:** confirms payoff/document requirements. **Output/CTA:** owned obligations and possession plan → next unresolved requirement. **Exit:** confirmations sufficient for closing. Occupancy extensions and delayed moves require explicit documented handling; calendar changes alone cannot modify possession rights.

### S16: Final proceeds (source §43)

**Entry:** revised deal terms or official settlement figures. **Agent:** reconciles estimates; **closing professional:** supplies official figures; **seller:** reviews questions. **Output/CTA:** planning → offer → revised → official versions with differences → “Review final figures.” **Exit:** unresolved discrepancies assigned/resolved. A mortgage balance is not an official payoff; rate/date/per-diem differences remain visible. No projected proceeds spent as certain cash.

### S17: Walkthrough and closing (source §44)

**Entry:** final access and scheduled close. **Seller/agent:** prepare agreed condition/items; **buyer:** walkthrough; **closing professional:** confirms completion/disbursement. **Output/CTA:** final obligations and verified outcome → “View closing details.” **Exit:** actual closing plus separate possession/handoff confirmation. Scheduled closing, signing, funding, and keys are not the same event.

### S18: Post-sale (source §45)

**Entry:** confirmed sale. **Seller:** exports records, completes move, controls contact preferences; **agent:** closes remaining promises and optionally links a next-home journey. **Output/CTA:** retained records and useful follow-through → next real action. **Exit:** obligations resolved or transferred. Neutral review requests do not depend on satisfaction; records follow approved retention rather than “permanent” storage marketing.

## 4. Workstream completion matrix

| Workstream | Evidence required to call complete | Who confirms | Important unresolved state |
| --- | --- | --- | --- |
| Search activation | Approved brief revision + actual activation evidence | Agent or authorized provider receipt | Approved but not active |
| Representation | Applicable signed agreement, scope, dates, parties | Agent under broker policy | Signed but future-effective / expired / out of scope |
| Earnest money | Holder receipt, amount, transaction match | Named holder; agent records evidence | Submitted but not received |
| Inspection | Required reports received and decisions recorded | Client/agent, sourced to inspectors | Inspection complete, response unresolved |
| Financing | Applicable lender milestone/document | Lender | Old status, pending conditions |
| Appraisal | Applicable result and any issue disposition | Appraiser/lender; agent coordinates | Result present, strategy unresolved |
| Title/closing documents | Appropriate professional confirmation | Closing attorney / responsible professional | Request sent, no confirmation |
| Agreed repairs | Exact obligation + completion evidence/review | Responsible parties, agent records | Invoice present, work disputed |
| Funds | Appropriate professional confirmation | Holder/closing professional | Instructions or transfer unverified |
| Closing | Appropriate completion evidence | Closing professional; agent records | Signed but completion unconfirmed |
| Possession | Contract-consistent handoff confirmation | Relevant parties, agent records | Closed but possession later |

## 5. What to validate with Kaleb and the broker

Confirm actual stage exceptions, working hours/escalation, who verifies each professional update, the representation gate for each activity, and the real search configuration flow. Pilot the search brief against a recent buyer's anonymized preferences, including a mid-search budget change and an unsupported filter. Use that evidence to adjust implementation order, not to remove the contracts above.
