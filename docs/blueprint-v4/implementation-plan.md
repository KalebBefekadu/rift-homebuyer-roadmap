# Rift v4 implementation plan

**This is an implementation handoff, not an instruction to start coding before review.** The next release is a complete buyer journey; the first useful delivery solves translating buyer preferences into Matrix/OneHome search setup and updates. Confirmed integrations in use: Matrix/OneHome, ShowingTime, Remine, and Google email/calendar.

## 1. Current code to preserve and extend

Observed in repository commit `168aa96`; this is code existence, not proof that every capability is configured or deployed.

| Capability | Existing implementation | Treatment |
| --- | --- | --- |
| Public buyer/seller value | `app/(rift)/buy`, `app/(rift)/sell`, `lib/core/compute.ts`, `results.ts`, `registry.ts` | Reuse computation and delivery; financial contract v2 is a deliberate separate change |
| Assessment, attribution, telemetry | `app/api/assessment/*`, `app/api/attribution`, `app/api/events`, `lib/core/telemetry.ts` | Preserve boundaries and first-touch rules; no answer data in campaign analytics |
| Saved readouts and review | `app/(rift)/r/[token]`, `lib/db/review.ts`, `lib/core/review.ts` | Preserve historical snapshots and trust ceilings |
| Client management | `app/(studio)/studio/lead/[id]`, `lib/db/clients.ts`, `lib/core/pipeline.ts` | Existing `rift_leads` relationship and stage-note history remain; add journey scope without rewriting historical stages |
| Client plan | `app/(rift)/plan/[token]`, `lib/db/plan.ts`, `lib/core/plan.ts`, `rift_plan_items` | Keep narrow old link projection; add authenticated journey separately; do not expand old token authority |
| Readout-to-plan seam | `lib/core/seam.ts`, `lib/db/seam.ts` | Reuse immutable snapshot and material-drift controls |
| Representation | `lib/core/representation.ts`, `lib/db/representation.test.ts` | Retain gate while adding reviewed action/scope rules; avoid duplicating status logic |
| Decisions / offer rooms | `lib/core/decision.ts`, `lib/db/decisions.ts`, `lib/db/offer-room.ts`, `app/api/plan/choose` | Reuse comparable-options and current-offer-set rules; add authenticated actor/version approvals |
| Inbound offers | `app/api/offer`, `lib/db/offer-intake.ts`, `lib/db/offers.ts` | Preserve seller intake; do not confuse inbound seller offers with a buyer's outbound offer workflow |
| Nurture / delivery | `lib/core/nurture.ts`, `lib/db/nurture.ts`, `lib/db/email.ts`, `app/api/nurture/run` | Preserve stop/claim rules; reconcile existing policy with new draft-first mode explicitly |
| Booking / rates / retention | `lib/db/calendar.ts`, `lib/db/rates.ts`, `lib/db/retention.ts` | Reuse adapters and visible degradation; Google availability remains distinct from current Cal.com adapter |
| Authorization / bounded I/O | `lib/db/service.ts`, `session.ts`, `guard.ts`, `bounded.ts` | Reuse guard patterns, but verify tenant and membership on every new path, including service-role writes |
| Prototypes | `app/prototype`, `components/rift`, `lib/prototype` | Use for interaction comparison; do not convert fixtures into production data or delete screens prematurely |

The existing `schema.md` is partly conceptual. Read actual migration history and the deployed schema before a migration. Do not create a second set of clients, offers, decisions, or plans just because those names appear in a target diagram.

## 2. Architecture

Keep the existing Next.js/React/TypeScript application and Supabase persistence. No platform rewrite is justified by this review.

```text
UI / server actions / API boundaries
  → authenticated identity + tenant + resource permission + input validation
  → I/O-free domain policy (search, journey, decision, money, deadlines)
  → transaction / repository layer
  → outbox for approved external work
  → provider adapter OR explicit manual task
  → receipt / reconciliation / operation history
  → scoped client and Operations projections
```

Suggested modules, introduced only with their work package:

- `lib/core/search.ts`: structured preferences, diffs, validation, approved search package; no provider or model client.
- `lib/core/journey.ts`: canonical stages, transition prerequisites, parallel workstreams, next-action selection.
- `lib/core/deadlines.ts`: reviewed date specifications and deterministic display/reminder rules.
- `lib/core/authority.ts`: approvals, version binding, protected actions, and expiry.
- Existing money/review/seam modules extended under versioned contracts.
- `lib/db/search.ts`, `journeys.ts`, `memberships.ts`, `deadlines.ts`, `operations.ts`: persistence and transactional commands.
- `lib/integrations/{matrix,showingtime,remine,google}`: only verified supported capabilities. Manual adapters are legitimate first implementations.

These are proposed paths, not files already present. Keep UI rendering independent of whether a fact arrived manually, by API, or by reviewed extraction.

## 3. Domain and persistence changes

### 3.1 Additive model

| Entity / change | Minimum fields and invariants | First needed |
| --- | --- | --- |
| `rift_journeys` | ID, tenant, origin relationship, side, display label, creation time; one relationship can have several journeys | W01 |
| Journey membership | Journey, verified user, role, resource grants, invited/accepted/revoked times; membership is not inferred from email text | W02 |
| Search brief revisions | Journey, revision, schema version, source references, author, created time, immutable criteria, expected prior revision | W03 |
| Search approval / activation | Exact revision, approver/time, provider, external search/contact references, desired/observed config, activation evidence, status | W03–W04 |
| Property / listing references | Internal property ID, provider/listing ID where licensed, source URL, selected facts and freshness; property ≠ listing | W05 |
| Reactions / feedback | Journey, property, individual participant, reaction, optional explicit reason, version/history; not analytics events with answers | W05 |
| Tour request / stops | Journey, property, requested windows, provider refs, confirmed windows, timezone, status, history | W06 |
| Journey events | Journey, monotonic sequence/version, from/to state, actor, evidence refs, effective/recorded times, idempotency key | W07 |
| Transaction attempts / workstreams | Journey, property, parties, current governing document version, independent status/outcome; workstream owner, state, applicability, evidence | W07–W09 |
| Deadline revisions | Transaction/workstream, source term/version/page, trigger, date/time precision, timezone, rule version, verified actor/time, supersedes ID | W09 |
| Document versions | Tenant/journey/transaction, storage object, hash, family/edition, classification, scan state, permissions, source links | W08 |
| Decision revisions / responses | Exact released option set, required actors, response identity/time, expected version, supersession; extend existing decisions where compatible | W08 |
| Approval / operation run | Action, payload hash, exact recipients/attachments, scope, expiry, record versions, actor, idempotency key, execution receipt | W04 |
| Outbox / provider inbox | Committed command reference, dedupe key, attempt/backoff, receipt, unknown-outcome state; signed provider event IDs when supported | W04 onward |
| Evidence / figure versions | Existing figure identity plus origin, source, freshness and version references; never rewrite prior displayed values | W08–W10 |
| Campaign revisions | Recipe, allowed blocks/versions, validated props, published pointer, attribution identifiers | W13, later |

Add `journey_id`/`transaction_id` to existing plan/decision/document records only after a migration map is reviewed. Nullable legacy scope is explicit during rollout. Two journeys must not inherit each other's decisions because both point to one lead.

### Legacy stage display mapping for review

This mapping suggests a display, not permission to advance or a claim that a contract exists. Preserve the original label and history. Any ambiguous record stays in an agent review queue until mapped.

| Existing label | Proposed buyer display | Proposed seller display | Required qualification |
| --- | --- | --- | --- |
| Exploring | Prepare | Prepare | Keep readiness details inside the stage |
| Building readiness / Financing | Prepare | Review mapping | Do not infer a lender milestone |
| Ready to shop | Prepare or Search | Review mapping | Agent confirms readiness and actual search activation |
| Searching | Search | Review mapping | Do not infer tours or external saved-search activation |
| Preparing the property | Review mapping | Prepare | Side must match the real goal |
| Reviewing offers | Offer | Review offers | Buyer outbound versus seller inbound attempts must be distinguished |
| Under contract | Under contract | Under contract | Requires actual governing document/terms; otherwise pending verification |
| Closing | Close | Close | Scheduled event is not completed closing |
| Closed | Own | Continue | Confirm actual close and outstanding possession obligations |
| Lost / archived / null | Agent review | Agent review | May mean ended relationship, paused goal, or failed attempt; never infer cancellation of obligations |

### 3.2 Structured search contract

```ts
// Proposed domain contract; not shipped code.
type Strength = "hard" | "preference" | "undecided";
type SearchCriterion = {
  id: string;
  field: "price" | "bedrooms" | "bathrooms" | "propertyType" |
         "geography" | "basement" | "garage" | "lotSize" | "hoa" |
         "otherPropertyAttribute";
  operator: "equals" | "atLeast" | "atMost" | "oneOf" | "avoids";
  value: string | number | string[];
  unit: "USD" | "count" | "acres" | "USD/month" | "code" | null;
  strength: Strength;
  statedBy: string;
  statedAt: string;
  sourceRef: string;
};
type SearchBriefRevision = {
  journeyId: string;
  revision: number;
  schemaVersion: number;
  criteria: SearchCriterion[];
  unresolvedQuestions: string[];
};
```

Implement this as a discriminated validation schema: a TypeScript union alone does not enforce field/operator/unit compatibility. Money bounds must be finite, nonnegative, and explicitly stated; a contradiction such as minimum price above maximum blocks approval. Geography is client-selected place/area identifiers, not a generated demographic category. Free text under `otherPropertyAttribute` is review-only until mapped to an approved field; it must not bypass the permitted-input rules.

Store provider mapping separately from the brief. Each mapped filter identifies supported operator/value, provider field, mapping version, and whether its enforcement is exact, approximate, or unavailable. Approximate or unavailable filters appear prominently in the agent review and cannot be silently treated as hard constraints.

Optional language-model translation returns **candidate criteria plus source spans**, never a ready-to-activate search. Numeric values must match an explicit source or be marked unresolved. “Around $400k, maybe $430k” requires confirmation of target versus maximum. A form-first flow remains complete when AI is unavailable.

### Search review specimen

Synthetic test input adapted from the supplied blueprint: “Around $400k, maybe $430k for the right house. Three bedrooms minimum. Snellville, Lilburn or Lawrenceville. Basement strongly preferred. I do not want to be on a major road.” These are fixture values, not customer advice or computed affordability.

| Phrase | Proposed interpretation | Required review |
| --- | --- | --- |
| Around $400k | Stated target price | Preserve as target; do not turn into qualification |
| Maybe $430k | Tentative upper price | Ask for confirmation before hard maximum; do not silently activate |
| Three bedrooms minimum | Hard minimum of three | Verify provider field/unit mapping |
| Named cities | User-selected search areas | Confirm geographic boundaries used by the MLS |
| Basement strongly preferred | Preference | Do not exclude every home without a basement |
| Not on a major road | Deal breaker requiring a defined property test | Mark manual evaluation unless an authorized exact filter is available |

If the client later changes the maximum, Operations shows the old active value, proposed new value, source, and destination search. Approval updates only the intended search after version checks; a failed external update leaves the previous active configuration intact and the proposed change pending.

### 3.3 Tenant, identity, and history

Every scoped foreign key includes tenant compatibility through composite keys or equally strong database enforcement. `agent_id` is a `rift_agents` identifier, not the auth-user identifier. A service-role repository method still checks the authorized tenant, journey membership, and resource scope.

No mutation of approved search revisions, signed-document originals, or released decision snapshots. Editable drafts become new revisions when released. “Immutable” applies during permitted retention, not forever. Audit records cannot become a secret permanent copy of deleted financial answers.

RLS, grants, storage policies, and tests ship with each table/bucket. Client direct access remains denied until membership policies exist. [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security) distinguishes table access from row authorization and notes service-key bypass behavior. Test as actual non-owner roles, not the table owner.

## 4. Commands and interfaces

Names below describe contracts; use existing server actions where suitable. New URL design is not a reason to rewrite working endpoints.

All state-changing commands accept a request/idempotency ID and expected resource version, derive identity/tenant on the server, validate payloads, and return typed results. Never trust caller-supplied `agent_id`, approval state, financial totals, or review status.

| Command | Input | Preconditions | Result / failure |
| --- | --- | --- | --- |
| `createJourney` | Existing relationship ID, side, label | Agent owns relationship; no implied representation | New journey; existing lead/readout untouched |
| `saveSearchRevision` | Criteria, sources, expected revision | Authorized editor; schema validation | New revision or 409-equivalent conflict |
| `prepareSearchPackage` | Journey + exact revision + destination | Valid criteria; mapping capability known | Mapped filters, unsupported fields, source-linked review |
| `approveSearchPackage` | Package hash, recipient/contact, cadence | Agent; exact current version; resolved critical ambiguities | Approval bound to package; no external success yet |
| `activateOrUpdateSearch` | Approval ID | Approval current; contact authorization; provider capability | Receipt, manual task, failure, or unknown outcome |
| `recordManualActivation` | External ref/link, revision, confirmed time | Agent reviewed actual destination state | Clearly marked manual confirmation; not API verification |
| `recordReaction` | Property, reaction/reason, expected revision | Authenticated member allowed to use shortlist | Member-specific change; no silent filter mutation |
| `requestTour` | Property and availability | Membership; activity coverage checked before external request | Pending request, not confirmed calendar event |
| `releaseDecision` | Current decision revision and sources | Agent; comparability and authority checks | Client-visible revision |
| `recordDecisionResponse` | Released revision + option + response | Authenticated required participant; version current | Recorded instruction or conflict; never signature |
| `verifyDeadline` | Source reference and exact date specification | Authorized agent; source/trigger evidence | Versioned deadline and replacement reminder intents |
| `recordMilestone` | Workstream, evidence, expected version | Authorized actor and completion rule | Append event, update projection, enqueue work atomically |
| `revokeAccess` | Member/share ID | Authorized owner/admin | Access and queued-action authorization revoked |

For new endpoints, distinguish unauthorized, forbidden, invalid, conflict, rate-limited, unavailable, and accepted-pending outcomes. Do not extend legacy “HTTP 200 with ok:false” conventions without reviewing consumers. A write timeout is `unknown-outcome` when commit may have occurred; retries use the same key and reconcile.

## 5. Integration capability plan

| Tool | Confirmed use / public evidence | First implementation | Capability gate before automation |
| --- | --- | --- | --- |
| Matrix/OneHome | User confirms current search tool. FMLS publishes licensed-data access through Bridge. | Structured criteria, copyable setup/update diff, stored external reference, agent-confirmed activation | Exact MLS membership; permitted contact/search/auto-email writes, sandbox/test access, rate limits, data-use rights, receipts, and supported reconciliation |
| ShowingTime | User confirms; vendor documents scheduling/confirmation functions | Manual request handoff, confirmed itinerary, feedback captured in Rift | Authorized integration for this account, event semantics and cancellations; website functionality alone is not API entitlement |
| Remine | User confirms GAR forms/e-sign; vendor supports sign/view workflows and PDF export | Agent uses Remine; record document/version/signature evidence and handoff state | Supported export/event/API mechanism, broker policy, form license and secure document handling |
| Google email/calendar | User confirms Google | Approved draft and manual handoff; Google connection only after selecting scopes/account and validating access | OAuth permissions, disconnect/revocation, actual send/booking evidence, conflicts/timezones and reply detection |
| Brevo / Cal.com | Existing repository adapters | Preserve existing approved nurture/booking behavior until an explicit migration plan exists | Decide routing to avoid duplicate Google/Brevo messages or competing booking sources |
| MLS/property data | No account-specific rights established | Agent/client-added links and facts with source/date | License fields, media, attribution, cache duration, display/export and AI-processing rights separately |

Vendor sources: [FMLS Marketplace](https://www.fmls.com/marketplace-info), [ShowingTime](https://showingtime.com/solutions/showings-and-offers), [Remine signing](https://support.remine.com/hc/en-us/articles/360038457152-How-to-Send-to-Sign), [Gmail API](https://developers.google.com/workspace/gmail/api/guides), [Google Calendar API](https://developers.google.com/workspace/calendar/api/guides/overview).

These sources establish product capabilities, not access for Rift. No vendor was contacted and no user data was sent during this review. Browser automation is not a hidden substitute for missing rights. Any proposed assisted-browser workflow needs explicit terms/permissions, bounded credentials, human review, and recovery design before adoption.

## 6. Ordered work packages

No calendar estimate is attached before actual integration rights, active-client migration, and engineering capacity are known. Each package should fit a reviewable pull request or small cohesive group. Acceptance scenarios in §7 are written before the feature.

| Work | Outcome and requirements | Dependencies | Acceptance / evidence |
| --- | --- | --- | --- |
| **W00 — review and baseline** | Record decisions in handoff §8; update stale status/route/model docs; confirm affected business rules and live migration history | Owner review | No unresolved decision silently encoded; inventory and rollback assumptions reviewed |
| **W01 — journey identity** | Add the narrow identity seam; preserve `rift_leads`; extend forget/retention before permitting journey inserts | W00 | AT01–AT03 and deletion compatibility; no automatic stage backfill |
| **W02 — private access** | Email sign-in, invitations/membership, session and share scopes; REQ-ACCESS/PRIV | W01, D03 confirmed | AT04–AT06, AT25; old share links keep narrow scope |
| **W03 — search brief** | Form-first criteria, imported existing context, source-linked revisions, agent review/diff; REQ-SEARCH-01/02 | W01; W02 for client participation | AT07–AT10; anonymized real-buyer walkthrough |
| **W04 — Matrix setup/update handoff** | Approved package, manual activation confirmation, external refs, operation journal; supported adapter only if verified | W03, D04 confirmed, D02 access discovery | AT11–AT13; agent can complete actual setup/update with less repeated entry |
| **W05 — shared shortlist** | Property links/facts, comparisons, individual reactions, proposed preference changes | W02–W04 | AT14–AT16; no full listing feed required |
| **W06 — tours** | ShowingTime handoff, requested/confirmed itinerary, concise feedback, access boundaries | W05, broker activity gate | AT17–AT18; changed/cancelled showing drill |
| **W07 — client Today + journey** | Event-backed stages, concurrent workstreams, owner-aware next actions, existing plan integration | W01–W06 | AT19–AT21; no stale/missing state rendered as healthy |
| **W08 — offer and document review** | Private file pipeline, manual terms first, versioned offer strategy and authenticated decisions, Remine handoff | W02, W07, D06 broker rules | AT22–AT25; extraction may be deferred, manual workflow cannot |
| **W09 — contract and deadlines** | Confirmed terms to workstreams/dates, revisions, reminders, exception recovery | W08, D06/D07 | AT26–AT29; amendment/unknown-time/failed-run drills |
| **W10 — money v2** | Total budget vs settlement ledger, provenance, reconciliation, loan-model boundaries | D11, W08–W09 | AT30–AT33; preserve old reference case/snapshots and add new contract tests |
| **W11 — closing and Own** | Readiness blockers, walkthrough, actual closing/possession, records export and remaining tasks | W09–W10, retention decision | AT34–AT36; complete financed and cash-buyer scenarios |
| **W12 — pilot and release** | Real auth/delivery, manual/integration fallbacks, performance/accessibility, incident/rollback drill | W02–W11, D05/D07 | AT37–AT40; pilot evidence and reconciliation report |
| **W13 — seller expansion / campaigns** | Seller-specific pricing/launch/net workflow, then fixed recipes and constrained composer | Buyer release evidence, D08, data rights | Seller S00–S18 scenarios and recipe rollback tests before feature |

W03 can begin with an agent-only interface after W01 while private access is built. It must not masquerade as a complete client portal. W10 financial changes can be designed alongside search but must not quietly change search budget claims before their own tests pass.

### First usable delivery: acceptance walk-through

1. Agent opens an existing buyer and creates a buying journey.
2. Existing preferences and readout are shown with dates; agent enters missing priorities or pastes notes into an optional draft tool.
3. The buyer confirms the brief through email sign-in; disagreements remain visible.
4. Agent sees hard filters, preferences, unsupported criteria, and exact changes from the prior active search.
5. Agent approves the package, uses Matrix/OneHome, and records actual activation or receives a verified supported integration receipt.
6. A later changed preference creates a proposed revision; active external search remains unchanged until approved and confirmed.
7. Operations shows the current confirmed search and any outstanding update, without asking the buyer to repeat their story.

The manual route is production functionality, not a demo placeholder. It must be tested with the user's actual configuration steps before calling the slice successful.

## 7. Acceptance scenarios and traceability

Proposed test paths: pure policy under `lib/core/*.test.ts`; real Postgres constraints/RLS under `lib/db/*.test.ts`; browser workflows in the existing Playwright suite. Extend existing tests where possible. Test observable behavior and boundaries rather than duplicating implementation details.

| ID | Given / when / then | Requirement / package |
| --- | --- | --- |
| AT01 | Given an existing lead/readout, creating a journey preserves IDs, attribution, figures and old URLs. | STATE, LEAD; W01 |
| AT02 | Given agent A's relationship, agent B cannot read it or attach a journey/search child to it, even with A's IDs. | ACCESS; W01–W02 |
| AT03 | Given two buying/selling goals for one relationship, updating either never changes the other. | STATE-07; W01/W07 |
| AT04 | Given a forwarded old plan link, its holder cannot view new private files or record authenticated decisions. | ACCESS-02; W02 |
| AT05 | Given a co-buyer invitation, identity verification grants only the invited scope; revocation takes effect on future reads/writes/jobs. | ACCESS-01; W02 |
| AT06 | Given private income/file data and a gifter share, the response payload, page, export, logs and preview exclude those fields. | PRIV; W02 |
| AT07 | Given “basement preferred,” translation cannot make basement a hard filter without confirmation. | SEARCH-01; W03 |
| AT08 | Given ambiguous target/maximum prices or conflicting household priorities, approval blocks until explicitly resolved. | SEARCH-01; W03 |
| AT09 | Given a new budget statement, the prior revision remains immutable and the user sees only changed fields for confirmation. | LEAD-04, SEARCH-06; W03 |
| AT10 | Given unsupported or disallowed criteria, mapping marks unsupported property filters and refuses protected/proxy inputs; no hidden free-text bypass. | SEARCH, PRIV; W03 |
| AT11 | Given no Matrix write access, approved criteria produce a manual task, never an “active” success claim. | SEARCH-02/03; W04 |
| AT12 | Given approval of revision 4 and a later revision 5, execution of revision 4 is rejected pending renewed review. | AUTO-01; W04 |
| AT13 | Given a provider timeout after possible execution, retry with the same key reconciles; no duplicate external search or message. | AUTO-02; W04 |
| AT14 | Given two buyer reactions to one home, both remain visible and neither silently changes the search. | SEARCH-04/06; W05 |
| AT15 | Given missing HOA/tax data, property cost comparison exposes assumptions/unknowns and cannot claim exact payment fit. | MONEY, SEARCH-05; W05 |
| AT16 | Given zero matching homes or unavailable listing rights, show honest no-match/manual-link states without widening criteria. | SEARCH-09; W05 |
| AT17 | Given a requested showing and calendar event, the UI remains pending until showing confirmation exists. | SEARCH-07; W06 |
| AT18 | Given cancelled/changed showing or expired required agreement, invalidate the old itinerary/action and surface recovery. | SEARCH-07; W06 |
| AT19 | Given inspections completed while financing is blocked, client Today still shows the financing blocker. | STATE-04, UX; W07 |
| AT20 | Given a client checks “done” for earnest money, it records submission only until holder confirmation. | UX-02, FUNDS; W07/W09 |
| AT21 | Given a stale lender update, say last confirmed/awaiting confirmation, not “on track.” | UX-04; W07 |
| AT22 | Given counteroffer version 3, an old response to version 2 is rejected; prior history remains. | DEC-01/02; W08 |
| AT23 | Given one required co-buyer approves and another disagrees, no execution approval is inferred. | DEC-02; W08 |
| AT24 | Given client “proceed” response, no document is signed, offer delivered, or binding state set without the separate steps/evidence. | DEC-03; W08 |
| AT25 | Given malicious/invalid uploaded content or an instruction inside a document, quarantine/validation applies and no tool permissions change. | DOC, AUTO-05; W08 |
| AT26 | Given a source date without a time, preserve precision; do not fabricate midnight or a countdown instant. | DATE-01; W09 |
| AT27 | Given a verified amendment, supersede affected dates and cancel old reminder intents in one transaction. | DATE-02; W09 |
| AT28 | Given DST, weekend/holiday, local-zone and trigger-rule variations, calculate only the approved date rule and preserve source evidence. | DATE-01/02; W09 |
| AT29 | Given a missed contractual deadline or failed scheduled job, create an owned urgent item; no automated legal conclusion. | DATE-03, QUALITY-04; W09 |
| AT30 | Given earnest money paid, its settlement credit reduces remaining funds once, without duplicating total cost. | MONEY-03; W10 |
| AT31 | Given inspection/appraisal paid before closing, moving costs and reserves, buckets reconcile without calling all of them settlement funds. | MONEY-03; W10 |
| AT32 | Given possible assistance or stale program data, no unapproved amount improves the public headline; suppression is explained. | MONEY-02; W10 |
| AT33 | Given historical snapshot, changed assumptions, zero/negative baseline or sign change, preserve original and disclose the new meaning/version. | MONEY-06/07; W10 |
| AT34 | Given scheduled closing/signatures but no completion evidence, do not show ownership/sold; possession may remain separate. | B18/S17; W11 |
| AT35 | Given terminated contract then a new property, retain old attempt/evidence and start a new attempt without inherited deadlines. | STATE-06; W11 |
| AT36 | Given deletion/export request, process each resource under its disclosed retention and grants; revoke shares and purge eligible derived/provider copies. | PRIV-02; W11 |
| AT37 | Given human reply/opt-out/revocation after approval but before send, pending work is suppressed or rechecked; no unlawful fallback channel. | AUTO-03; W12 |
| AT38 | Given no providers or AI budget remaining, manual entry, source documents, plans and deadlines still work with named degraded states. | AUTO-06, QUALITY-04; W12 |
| AT39 | Given 375px/390px, keyboard, screen reader, zoom and reduced motion, all critical flows remain operable with readable numbers/states. | QUALITY-01/02; W12 |
| AT40 | Given a release disabled mid-pilot, old public/share/plan links still work and pending jobs cannot duplicate after recovery. | Rollout contract; W12 |

Also retain existing compute, consent, first-touch, telemetry, trust-ceiling, nurture-stop, document-drift, and schema tests. New financial rules do not delete inconvenient legacy tests; they introduce an explicit version boundary.

## 8. Migration and rollout

1. **Review first.** Resolve or park relevant findings in handoff §8. Confirm local/deployed migration inventories and a safe test database. No real client records are needed to validate the domain fixtures.
2. **Add, do not replace.** Apply identity/schema additions with RLS and tenant constraints; no destructive rename or bulk auto-conversion. New routes are feature-flagged, old routes preserved.
3. **Shadow projection.** Derive prospective journey displays from selected existing records without making them authoritative. Produce an agent-reviewed mapping for each active client. Existing stage notes are historical evidence, not automatic proof of contract state.
4. **Invite a controlled pilot.** Pilot size and active-client list need Kaleb's answer. Import only approved records and evidence; do not scrape inboxes or infer consent. Reconcile each buyer's current search and relevant dates with Matrix/OneHome and source documents.
5. **One authoritative writer per state.** During cutover route both old/new UI commands through one domain boundary. Dual-display is acceptable; two independent writable stage stores are not.
6. **Prove the external path.** Test actual email sign-in, approved communication, manual/integration search confirmation, a changed showing, a revised deadline, revocation and rollback. Do not call a credential-configured service verified.
7. **Expand after evidence.** Compare search setup/update time and status-chasing effort with baseline. Complete the rest of the buyer journey before declaring R1 done. Seller growth and composer remain explicit later work.

Rollback first disables new writers/jobs and returns users to valid existing projections. It does not delete new transaction evidence. After real records exist, use reviewed forward fixes and reconciliation instead of dropping tables. Any approved retention deletion must remain reachable throughout migration.

### Release readiness

Required: reviewed business decisions; per-feature acceptance scenarios; passing typecheck/lint/tests/build; true non-owner RLS tests; real sign-in/approved delivery evidence; desktop/mobile/accessibility checks; snapshot/financial comparisons; provider outage and recovery drills; backup restore and export/deletion validation; owner and schedule for monitoring/registry maintenance. Do not begin public financial or legal automation based on this draft alone.

## 9. Verification performed for this document review

- Read the supplied blueprint in full and cross-checked repository handoff, schema, integrations, calculations, vision, product, prototypes, and selected code/migrations.
- Used TokenSave before source exploration. Its repository-local SQLite fallback was unavailable; selected file inspection filled the gaps.
- Ran Rift locally on port 3105 and inspected `/prototype/app`, `/prototype/studio`, and `/prototype/buy`. These are prototype observations, not production acceptance tests.
- Initial test execution hit local socket restrictions; a read-only connection check confirmed `EPERM` for localhost port 55432. A rerun with local access and `TEST_DATABASE_URL` explicitly restricted to the repository's local `rift_test` target completed successfully: **79 suites passed; 1,071 tests passed; 93 skipped.** Unavailable database/PostgREST coverage remains unverified; skipped tests are not passes. No production database was inspected or changed.
- SQL in the next document is review-only and has not been applied or database-tested. New acceptance scenarios are specifications, not claims of implemented tests.

- **Typecheck passed:** `npx tsc --noEmit`.
- **Lint passed:** `npm run lint`, no ESLint warnings/errors (the command emits a Next.js deprecation notice).
- **Build passed:** `npm run build` after allowing the existing Google Fonts download. The first restricted run failed on that download, not a source compilation error. The temporary preview server was stopped; use the repository's `dev:clean` procedure before the next development preview because build and dev share `.next`.
- **Document checks passed:** local links, fenced blocks, all B00–B20/S00–S18 stage headings, all AT01–AT40 acceptance rows, and `git diff --check`.

Only documentation was changed: this package and the confirmed-direction entry in handoff §8.1. No application source, executable migration, provider configuration, or production data was changed. No commit or deployment was made.
