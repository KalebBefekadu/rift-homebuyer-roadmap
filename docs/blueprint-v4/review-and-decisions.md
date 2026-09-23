# Review findings and decisions

**Status:** review draft, 22 September 2026. Findings are recommendations unless explicitly recorded as confirmed below. Priority describes when an issue must be resolved, not whether the existing application is exploitable or broken.

## 1. Assessment of the supplied blueprint

The strongest ideas are worth preserving: value before capture; a calm client journey; an operator surface organized around attention; specialized tools retained underneath Rift; useful financial explanations; and constrained campaign composition. The document is not yet executable because it describes desired screens without consistently defining authority, source data, transitions, failure recovery, or delivery order.

The principal improvement is to turn each promise into a contract: **what triggers it, who owns it, what evidence makes it true, what happens if it fails, and how we test it.** More features would not fix the original gaps.

## 2. Findings requiring explicit resolution

| ID | Finding and evidence | Consequence | Proposed disposition |
| --- | --- | --- | --- |
| F01 | v0.3 covers both end-to-end journeys, ownership, campaigns, and broad automation without a release boundary. Existing handoff §2 still has a buyer traffic gate. | Engineers cannot determine what a finished release means. | **Buyer-first direction confirmed.** Seller expansion remains later. Decide the applicability of the old traffic gate separately in D08. |
| F02 | AGENTS says production is unbuilt; handoff says phases 1–3 are built; current routes and September 20–21 migrations include client plans, decisions, representation, referrals, and offers. | A fresh implementation could duplicate or replace functioning work. | Use the code inventory in the implementation plan. Refresh baseline docs before product work; do not infer deployed status from repository files. |
| F03 | Blueprint §46.6.9 puts calculator inputs/outputs into campaign data. `lib/core/telemetry.ts` and the database allowlist prohibit answer telemetry. | Financial answers could become a behavioral dossier. | Store submitted answers and snapshots in the private product domain. Analytics receives allowlisted events/counts only. New metadata requires matching code and database changes. |
| F04 | Blueprint §50 combines calculated, estimated, verified, suggested, and unknown as one confidence ladder. Existing review model uses preliminary → pending-review → reviewed → verified. | A correct calculation can appear professionally confirmed; an authoritative import can appear current forever. | Separate origin, review, freshness, authority, and provenance. Preserve the existing trust ladder. |
| F05 | Blueprint says conversion is “not a new record.” Existing production relationships are lead-centered; a person may buy and sell repeatedly. | One person, one stage, and one property become incorrectly coupled. | Preserve the relationship ID; create distinct journey and transaction records with explicit links. No repeated intake. No email-based automatic household merge. |
| F06 | Buyer stages are described serially despite inspection, financing, title, and insurance running concurrently. | Completing one branch could hide a blocker in another. | One display stage, multiple independent workstreams, and explicit advancement evidence. Rejected offers and terminated contracts are retained as attempts. |
| F07 | “Accept” and “Counter” buttons do not specify their legal or operational effect. Current offer rooms already distinguish choice from acceptance. | A click may be mistaken for a signed or delivered instruction. | Use “Ask my agent to proceed” or “Record my preference.” Separate client instruction, agent approval, document signature, delivery, and binding confirmation. |
| F08 | “Cash to close” currently includes inspection, appraisal, and moving in `compute.ts`/`calculations.md`; the draft extends that language into official settlement comparison. | A client may compare quantities that mean different things. | Preserve old snapshots; introduce a versioned money ledger with total budget, pre-closing cash, remaining settlement funds, and reserves. [CFPB explanation](https://www.consumerfinance.gov/owning-a-home/closing-disclosure/) distinguishes closing costs from cash actually due at closing. |
| F09 | The draft promises a comfortable buying range without a specified inverse affordability model; the existing engine models costs at a stated price. | A price-cost calculation becomes an unsupported qualification claim. | R1 begins with user-set target price/payment and deterministic scenario comparison. A computed comfort range needs a separately tested contract; lender approval remains external. |
| F10 | “91% match,” “82% ready,” live inventory counts, renovation payback, equity forecasts, and “Rift is watching” lack evidence contracts. | Precision and reassurance can be fabricated by layout. | Prefer explicit fit reasons and outstanding blockers. Only show measured counts from authorized sources. Monitoring copy requires last-success and failure state. No fabricated ROI or close probability. |
| F11 | Client portal is called authenticated in the draft; production `/plan/[token]` is a bearer-link surface. | New documents and decisions could inherit inappropriate access. | D03: recommend email sign-in for private files/decisions; retain narrow, revocable read-only shares. Do not broaden old tokens. |
| F12 | Matrix/OneHome write access is presumed as a target; listing access does not prove contact/search-write access. | A core workflow could depend on a nonexistent commercial permission. | Keep the search brief and manual activation path usable. FMLS publicly describes licensed data via Bridge, not proof that this account may write Matrix contacts/searches. [FMLS](https://www.fmls.com/marketplace-info) |
| F13 | The draft lists GAR form numbers as if they are stable workflow configuration. | A renamed or revised form could silently change extraction or deadline behavior. | Use document family, form ID, edition, actual file hash, source page, and verified terms. GAR's current index includes midyear revisions; access is licensed. [Index](https://forms.garealtor.com/Downloads.aspx), [licensing](https://garealtor.com/law-ethics/contract-forms/) |
| F14 | Representation is treated as a single stage gate, but the applicable agreement depends on the service, scope, parties, dates, and brokerage policy. | “Signed” alone may not establish permission for the next action. | Retain existing gates until broker review; add action-specific coverage for tours, offer work, and listings. NAR's rule concerns MLS participants working with buyers before tours and distinguishes open-house situations. [NAR](https://www.nar.realtor/the-facts/written-buyer-agreements-101), [open houses](https://www.nar.realtor/the-facts/consumer-guide-to-open-houses-and-written-agreements) |
| F15 | Handoff §4.9 suppresses review requests after dissatisfaction; product.md also says “No review gating.” | A proposed referral engine could inherit conflicting rules and violate platform policy. | Service recovery must be independent of review eligibility. Use neutral review invitations, no sentiment filter; keep expansion disabled until reconciled. [Google policy](https://support.google.com/business/answer/7400114) |
| F16 | Long-lived snapshots/property passports coexist with deletion promises and required transaction records. | “Immutable” could be misread as “retain forever,” or deletion could erase required evidence. | Immutability means no overwrites during approved retention. Classify records, limit holds, disclose exceptions, delete eligible data and revoke access. Broker decides transaction-record retention. |
| F17 | Notification cadence, quiet hours, escalation coverage, AI budget, and service promises have no accountable owner. | Automation can increase agent workload or promise response times one person cannot meet. | D07 sets policy. Queue items require accountable owner, evidence, due time, resolution, and visible delivery failure. No inferred 24/7 coverage. |
| F18 | Seller valuation, market guidance, school/location information, and buyer preference learning lack permitted-input boundaries. | Recommendations may drift into unsupported valuation or steering. | Use explicit property preferences and user-selected geography. No inferred demographics, neighborhood quality score, school/crime rankings, or protected-class proxies. Reject unsupported recommendations rather than paraphrasing them. |
| F19 | Campaign builder difficulty is called moderate and campaign creation “5–10 minutes” without validation. | Estimates become commitments; editor work displaces the buyer journey. | Treat time-to-publish as a test target. Start with a fixed recipe and existing tools; defer configurable composition until reuse is proven. |
| F20 | Several screens reassure “No action needed” even when third-party status may be absent or old. | Silence from a lender becomes falsely reassuring progress. | Say “No action currently assigned to you; waiting for lender update, last confirmed …” when evidence is incomplete. |

## 3. Additional repository contradictions

These are documentation findings, not changes made to production behavior in this review.

- `product.md` says stale programs are silently suppressed; handoff §4.4 and current customer wording explain withheld programs. Retain the visible explanation.
- `integrations.md` initially describes calendar/rates as absent or hard-coded, then documents working adapters later. Split capability, configuration, and end-to-end verification into separate columns.
- `schema.md` describes conceptual `clients` and `stage_transitions`; current managed-client code uses `rift_leads`, `stage_since`, and stage notes. The model must be mapped before migration.
- `schema.md` compresses ownership to `agent_id = auth.uid()`; actual policies map the auth user to `rift_agents.id`. Do not copy the shorthand into new SQL.
- `product.md` promises password-based save; production exposes capability links. Choose the future access contract explicitly.
- Prototype client overview can show an assistance-related gap update without its authority being evident. Recheck this against the no-unapproved-assistance headline rule when replacing the screen.
- The telemetry key allowlist accepts primitive values. Key allowlisting alone cannot stop sensitive data hidden inside an allowed `page` or `source` string. Constrain values to controlled route/campaign identifiers; no URL queries or free text.
- `next.config.ts` lists private result/token routes but does not include `/plan/:token*` in its explicit no-referrer list. Review all capability routes, caches, logs, previews, and referrers before expanding private access.

## 4. Decision register

Only explicit user answers are confirmed. Recommendations below are usable planning assumptions, not permission to ship dependent behavior.

| ID | Decision | Current position | Owner / when needed |
| --- | --- | --- | --- |
| D01 | Next implementation release | **Confirmed:** complete buyer journey first, shared seller foundations. | Kaleb, answered 22 Sep 2026 |
| D02 | Operating stack and integration rights | **Confirmed:** Matrix/OneHome, ShowingTime, Google email/calendar, Remine for GAR forms/e-sign. MLS organization, account-specific API rights, and current CRM/coordination arrangement remain unknown. | Kaleb + vendor/broker; capability discovery before adapter selection |
| D03 | Private client access | **Confirmed:** email sign-in for private documents and decisions; selective read-only share links. | Kaleb, answered 22 Sep 2026 |
| D04 | Initial automation authority | **Confirmed:** drafts and internal reminders; agent approves external actions. Existing consented nurture is separately governed and not implicitly disabled. | Kaleb, answered 22 Sep 2026 |
| D05 | Existing clients and migration | Number of active buyers/sellers, current transaction stages, available exports, and business continuity needs unknown. No automatic import/backfill into active transaction states. | Kaleb; before migration pilot |
| D06 | Broker-controlled rules | Representation scope/gates, offer presentation handling, form licensing, retention/holds, advertising/consent, funds-instruction policy. Existing protections remain until a reviewed replacement exists. | Broker / counsel as appropriate; before affected production behavior |
| D07 | Operating commitments | Business hours, response targets, deadline escalation coverage, notification caps, initial pilot size, monthly integration/AI budget. Do not invent customer promises. | Kaleb; before live pilot |
| D08 | Old traffic gate vs buyer journey expansion | Buyer-first direction does not establish traffic counts or prove the old gate satisfied. Recommend formally superseding the old build order for the buyer journey while leaving broad seller expansion gated. | Kaleb; before prioritizing implementation |
| D09 | Buyer exception scope | Proposed R1: Georgia residential resale, financed and cash buyers, multiple participants, terminated/restarted contracts, remote signing handoff. New construction, probate/estate/trust, short sales, and unusual authority cases get explicit manual exception handling. | Kaleb + broker; before workflow fixtures |
| D10 | What hurts most today | **Confirmed:** buyer search, specifically translating preferences and setting up/updating Matrix/OneHome searches. Make W03/W04 the first useful product slice. A detailed recent transaction example can refine the design later. | Kaleb, answered 22 Sep 2026 |
| D11 | Money terminology and contract v2 | Adopt the ledger/labels in the specification and preserve historical snapshots. | Kaleb; before changing financial UI or formulas |
| D12 | Public review policy | Replace sentiment gating with neutral invitation eligibility and independent service recovery; do not expand the current automation before reconciliation. | Kaleb / broker; before advocacy work |

### Efficient discovery session

Use one recent buyer and one recent seller transaction, anonymized, to validate the stage contracts. Walk through: first inquiry, first tour, first offer, executed agreement, changed deadline, closing, and what went wrong. For each, record the source of truth, actual tool, person responsible, and evidence of completion. This answers the original fifty research questions with observable examples rather than an interview checklist.

The active-client count was asked but not supplied; the answer confirmed Google only. Keep D05 open rather than interpreting silence as zero clients.

### Source coverage

| Original sections | Where they are resolved |
| --- | --- |
| 0–3: surfaces, principles, navigation | Product specification §§1–3 and §6 |
| 4–25: buyer journey and automation | Buyer contracts B00–B20; specification §5; implementation W01–W12 |
| 26–45: seller journey and automation | Seller contracts S00–S18; money/decision contracts; later W13 |
| 46–48: public loops, continuity and composer | Specification §§4 and 11; campaign/privacy contracts |
| 49–51: intelligence, confidence and human authority | Specification §§7–10; versioned approvals and evidence |
| 52–54: design and pitfalls | Specification §§2, 6, 11–12; quality acceptance scenarios |
| 55: Georgia process anchors | F13/F14, D06; source-versioned stage/deadline contracts |
| 56–59: research and stage template | Decision register, discovery session, all stage contracts |
| 60–61: outcomes and research basis | Product promise, measurable outcomes, linked official sources |

## 5. Research limits

Official sources were checked on 22 September 2026. They support product boundaries, not a determination of the governing terms of any transaction. No form text, account-specific vendor contract, brokerage policy, or API entitlement was supplied. Form selection and deadline interpretation therefore remain broker/professional-controlled.

The TokenSave graph was used first and reported approximately 4,382 tokens saved across two context calls. The suggested repository-local `.tokensave/tokensave.db` was absent, so selected source files were inspected directly. The graph labeled TypeScript snippets as Rust and returned sparse coverage for broad cross-layer queries. If useful, open a [TokenSave issue](https://github.com/aovestdipaperino/tokensave/issues) with a minimal public reproduction; **strip all sensitive or proprietary code and local paths before submitting**.
