# Requirements

**Part of [Blueprint v5](README.md).** Every requirement from blueprint v4 is carried over here, reworded
only where needed, each with its status on 24 September 2026. Where v5 changes a requirement,
the change is stated beside it and the v5 section that owns it is named. Requirement IDs are
kept so tests and commits that cite them stay traceable.

**Status key:** **Built** (live and tested) · **Partly** (some of it is live; the rest is named) ·
**Not built** · **Open** (waits on a decision in [README §11](README.md#11-decisions)).

## 1. Product boundaries

- Rift makes buying or selling understandable before, during and after a transaction. A visitor
  gets a useful answer; a client sees what matters now, what they owe and who is handling the
  rest; the agent sees the work that needs his judgment.
- The outcome that matters is **more clients served clearly and consistently with less repeated
  coordination**. Lead conversion matters because value earns a relationship; it never justifies
  withholding the promised answer, covert profiling, or unnecessary contact.
- Rift owns relationship context, plans, decisions, responsibilities and coordination history.
  The MLS owns listing facts; ShowingTime coordinates showings; Remine handles GAR forms and
  e-signature; lenders and closing professionals are the authority on their figures. Rift is not
  a lender, MLS, signature authority, wire-transfer tool or contract interpreter.
- **Not in scope** until a later blueprint says otherwise: a freeform site builder, autonomous
  negotiation, automated offer acceptance, generated valuations, mortgage qualification, payment
  initiation, a custom e-signature system, an MLS replacement, neighborhood ranking, and
  ownership or equity forecasting. Outside professionals never need a Rift account.

## 2. State

| ID | Requirement | Status |
| --- | --- | --- |
| STATE-01 | Journey status (active, paused, completed, cancelled) is separate from stage. Pausing a search does not suspend contract obligations. | Built |
| STATE-02 | Buyer stages: Prepare, Search, Tour & evaluate, Offer, Under contract, Close, Own. Discovery is the public side, not a client stage. Stages summarize reality; they are not forced screens. | Built |
| STATE-03 | Seller stages: Prepare, Price & launch, Market & show, Review offers, Under contract, Close, Continue. | Not built (v5 §9) |
| STATE-04 | Under contract, workstreams run at once, each with its own state, owner, evidence and dates. Cash buyers mark financing work as not applying. | Built (ten workstreams, including walkthrough and possession) |
| STATE-05 | Stage changes need evidence and an authorized person. Time passing, an AI suggestion or unrelated ticks never advance a transaction. History keeps source, before and after, reason, actor, time and version. | Built |
| STATE-06 | A failed offer returns the journey to search or offer and keeps the attempt. A terminated contract keeps its history; restarting is a new attempt. Amendments replace specific dates and their reminders together. | Built |
| STATE-07 | A sale and a purchase can depend on each other (proceeds, possession). Neither moves the other; the first release shows a dependency the agent recorded, with its owner. | Not built (v5 §9) |

## 3. Lead side (public value and continuity)

| ID | Requirement | Status |
| --- | --- | --- |
| LEAD-01 | Every tool answers its advertised question before asking for contact details, and the answer stays available if the visitor declines to save, book or subscribe. | Built. **Changed by v5:** extra functionality beyond the advertised answer may ask for details (decision D14, README §5.1) |
| LEAD-02 | Ask only what the chosen tool needs. Explain sensitive inputs; tell unknown from zero and answers from defaults; show a partial result as soon as possible; keep back navigation and edits without duplicate telemetry. | Partly. One long questionnaire asks everything today; v5 §5 splits it into values |
| LEAD-03 | After value, offer "Save my plan", "Ask Kaleb to review" and "Book a conversation". Saving, hiring the agent, marketing permission and transaction readiness are separate events. | Partly. Email capture, a review request and booking exist; "Save my plan" as a plan does not (v5 §5.5) |
| LEAD-04 | Answers, preferences, source and snapshots carry into the client journey with their dates. Clients confirm only what is stale, missing, conflicting or consequential. | Partly. The readout shows when a journey starts; answers do not yet prefill the brief (v5 §5.5) |
| LEAD-05 | First touch never changes. Agent corrections and last touch are stored separately. Campaign parameters are bounded identifiers, never financial answers, tokens, full URLs or free text. | Built |
| LEAD-06 | Anonymous progress on one device expires and can be reset or deleted. Restoring on another device needs an authorized claim. No fingerprinting; no merging by an unverified email. | Built. Thirty days on the device; "Delete all of it" on every answer resets it; the saved plan's private link is the only way to restore elsewhere |
| LEAD-07 | Saved readouts keep their original figures. A recalculation is a new snapshot with versions and a comparison. | Built |

## 4. Buyer search

| ID | Requirement | Status |
| --- | --- | --- |
| SEARCH-01 | The agent reviews and edits each criterion of the brief. Client corrections make a new revision. Criteria are hard, preference or undecided, with who said it and when. Filters Matrix cannot express are marked for checking by hand, never claimed as enforced. | Built |
| SEARCH-02 | An approved search package names the destination, copyable criteria, cadence, exclusions, version, approver and status. Without write access the actions are "Copy criteria" then "Record activation"; never "Search activated" without a receipt or the agent's confirmation. | Built (manual path) |
| SEARCH-03 | A saved search has its external reference, the approved and (where readable) observed configuration, and a status from draft to unknown. Unreadable is unknown, not active. External edits are never overwritten silently. | Built (manual path) |
| SEARCH-04 | Reactions (interested, maybe, pass, would like to see it) are individual, reversible with history, separate from facts; co-buyer disagreement stays visible. | Built |
| SEARCH-05 | A side-by-side property comparison: like-for-like fields, unknowns, monthly scenarios, cash impact and the client's priorities. Agent-only remarks and access codes never reach the client. | Partly. Each home shows fit against the approved brief; no side-by-side comparison or monthly scenario (needs W10) |
| SEARCH-06 | Preference changes are proposed, never inferred into live filters. Updating Matrix still needs the agent. | Built |
| SEARCH-07 | A tour request is a request, not an appointment. Requested, awaiting, confirmed, changed, cancelled and completed are distinct; changed times and representation are rechecked. | Built |
| SEARCH-08 | After a showing, a short reaction and "Would you consider an offer?" or "What should change in the search?". No long ratings. | Built |
| SEARCH-09 | When nothing fits, show which hard requirements limit the search; never silently widen it. Withdrawn listings leave the active shortlist and stay in history. | Not verified; check during the client portal pass (v5 §7) |
| Pilot targets | A reviewed search package from an existing brief in five minutes; priorities found without asking again; feedback recorded in under a minute; an update without re-entering unchanged information. Measured against the agent's current process. | Open: measured in the pilot (`/studio/pilot` counts setup time) |

## 5. Client Today and journey

Today answers: current stage, next action, meaningful dates, what others are doing, what changed,
and how to get help. The most important action comes first, and "one primary action" never
hides a second real deadline.

Next-action order: (1) verified urgent obligations and critical blockers, by due time and
consequence; (2) released decisions waiting on this person; (3) this person's next actionable
task; (4) work that belongs to someone else, with owner, last update and expected check-in;
(5) if nothing is owed, say so without implying every third party is on track. **Built.**

Agent pinning of a client item, with a reason and expiry, that can never hide critical
obligations. Client priority never depends on commission or lead score. **Not built** (v5 §8).

| ID | Requirement | Status |
| --- | --- | --- |
| UX-01 | Empty, loading, partial, waiting, blocked, overdue, failed, offline, revoked and completed states each have words and a next step. An outage is never "nothing to do". | Built for the journey screens; redo for redesigned pages |
| UX-02 | A client's "done" is a claim, not proof of funds, approval, signature or another professional's work. | Built |
| UX-03 | Milestones reached are distinct from possibilities. No success percentage; counts name what is pending. | Built |
| UX-04 | "Rift is watching" needs a live monitor with scope, last success and failure state. "Your agent recommends" needs approved text. "Lender confirmed" needs the lender and dated evidence. | Built for what exists; no monitors exist yet, so no "watching" copy is shown |

## 6. Money and evidence

Customer calculations stay in `lib/core/compute.ts` and verified registries. Official figures are
shown as sourced records. Language models may extract candidate values for review but never
author a number or choose an assumption.

| ID | Requirement | Status |
| --- | --- | --- |
| MONEY-01 | Every figure carries amount, unit, assumptions, source and date, engine version, failure explanation and review state. Unknown is not zero; estimates and official figures never share a label. | Partly (readouts); completed in W10 |
| MONEY-02 | The public buyer headline counts assistance as 0; programs are conditional upside; presence is not approval; stale programs are withheld with an explanation; overlapping amounts are never added without validated combination rules. | Built. **Extended by v5 §6:** combinations are shown only as "potential", with the stacking rules recorded per program |
| MONEY-03 | A versioned breakdown: estimated total buying budget; needed before closing; estimated remaining funds at settlement; suggested reserve; official cash to close (from the closing document). Earnest money is timing, not a second cost; nothing is paid twice; negative amounts keep their meaning. Old snapshots keep their labels. | Not built (W10). **Changed by v5:** moving costs leave the headline cash figure now (Kaleb, R1), ahead of W10 |
| MONEY-04 | Monthly payment separates principal and interest, mortgage insurance, taxes, insurance, HOA and optional reserves; missing property costs are visible; the generic PMI rule is never presented as FHA, VA or USDA underwriting. | Partly (readout); completed in W10 |
| MONEY-05 | A comfort range is a planning scenario, never a lending decision. An "how much can I afford" solver needs its own bounds, tests and disclosures before release. | Not built. Needed for the "What can I afford" value (v5 §5.2) |
| MONEY-06 | Seller net is price minus uniquely classified costs and payoff. Commission is negotiated, never a "standard rate". No double counting of credits; negative net is a shortfall to resolve; no generated repair ROI, valuation or equity figure. | Partly (seller readout); revisit in the seller values (v5 §5.3) |
| MONEY-07 | Keep the 3% material drift guard; also disclose sign changes, newly missing inputs and changed authority. Publishing never promotes verification. | Partly. The 3% guard is built; the extra disclosures are not |

**Evidence contract.** Record separately: origin (user, agent, computed, provider, document);
review (preliminary, pending-review, reviewed, verified, with the existing ceilings and named
verifier); freshness (current, stale, superseded, unknown); authority (who can confirm it);
provenance (source, version, page, dates, assumptions). "Calculated" describes origin, not
certainty. New inputs make a new figure; verification is never inherited. **Partly** (the trust
ladder and program freshness exist; the full contract lands with W10 and the assistance engine).

## 7. Documents, decisions, dates and funds

| ID | Requirement | Status |
| --- | --- | --- |
| DOC-01 | Keep the original and its checksum; classify by transaction, family, form and edition, parties and version; quarantine and validate before use. | Built (structural check, not a virus scan, and the screen says so) |
| DOC-02 | Extraction returns candidate fields with exact source references; consequential amounts, dates, parties and terms need a person's confirmation; a failure leaves the original and a manual path. | Not built. **Needed by v5 §5.8** (offer upload that fills the form) |
| DEC-01 | A decision has options, comparable figures, tradeoffs, sources, a response deadline, decision makers and agent context. A counter supersedes older versions and their approvals. | Built (buyer offers) |
| DEC-02 | Responses need a signed-in, permitted person and the current version. Household disagreement is its own state; everyone required must agree. | Built |
| DEC-03 | Client responses are instructions, never signatures, acceptance or notices. Remine governs signed documents. | Built |
| DATE-01 | Dates keep their source, trigger, local date and time if stated, zone, counting rule, who verified them and when. Date-only is not midnight. | Built |
| DATE-02 | Unverified dates make an internal task, not a client countdown. Contract dates and the agent's own targets are distinct. Business days, holidays, amendments, zones and daylight saving are tested. | Built |
| DATE-03 | A missed deadline is an urgent agent item; software never declares rights waived or contracts ended. | Built |
| FUNDS-01 | Amount, holder, due date, submitted evidence and confirmed receipt are separate. No bank details handled; Rift never moves money. | Built |

## 8. Operations and automation

- Operations groups work into **Needs attention, Today, Waiting and Upcoming**. Each item says why
  it exists, who owns it, what it relates to, the evidence, the due time, the next action and how
  it resolves. Filters persist; returning from a detail page keeps the queue position.
  **Not built as specified** (v5 §8 redesign).

| ID | Requirement | Status |
| --- | --- | --- |
| OPS-01 | Internal notes, lead scores, private contact basis, lender files and other parties' information never reach a client view. Client updates are deliberately released. | Built |
| OPS-02 | Snoozing needs an owner and a resume time and never moves a contract date. Delegation needs acceptance or shows as unaccepted. Outside parties are tracked without accounts. | Not built (v5 §8) |
| AUTO-01 | Drafts and internal reminders are automatic; every new external action needs the agent's approval, bound to the exact content, recipient, channel and versions. A material change voids the approval. | Built for today's actions (nothing external is automated beyond existing nurture). Needed as a general mechanism before any integration or AI draft (v5 §10) |
| AUTO-02 | Every run records prepared, awaiting approval, queued, running, succeeded, failed, unknown outcome or cancelled, with an idempotency key, attempts, receipt and recovery owner. Timeouts after a send are unknown until reconciled. | Partly (job runs and idempotent writes); the general outbox is not built |
| AUTO-03 | Consent, representation, version and revocation are rechecked just before execution. A human reply stops nurture before the next send; a fallback channel never overrides an opt-out. | Built |
| AUTO-04 | Existing consented nurture keeps its policy until explicitly changed. | Built |
| AUTO-05 | AI drafts intake, document candidates, short sourced summaries and campaign recipes. It never publishes, sends, changes searches, decides representation, moves money, sets legal deadlines or changes numbers on its own. Uploaded content is untrusted and cannot grant permissions. | Policy stands. Rift calls no AI today |
| AUTO-06 | Per-workflow and monthly AI cost limits before AI is switched on; running out means manual entry, never a lost deadline. Model and prompt versions are auditable; private data is not used for training. | Not built. **Required before v5 §5.8 and §6 AI features** (pilot cap $50 a month, D07) |

## 9. Access and privacy

| Actor | Sees by default | Never by default |
| --- | --- | --- |
| Anonymous visitor | Their own in-progress inputs, public tools, a summary shared with them | Client files, agent records, transaction actions |
| Client member | Their journey, released plan, own tasks and decisions, granted documents | Agent notes and scores, other people's finances |
| Co-buyer or co-owner | What is explicitly shared on the journey | Every member's income, credit or bank documents |
| Agent | His own relationships and transactions | Other agents' records |
| Outside professional | Manual handoff for now; later a narrow task or document | The household file, other offers, unrelated finances |
| Read-only share recipient | One selected summary until revoked or expired | Identity, decisions, writes, private originals |

| ID | Requirement | Status |
| --- | --- | --- |
| ACCESS-01 | Email sign-in proves an address, not membership. Invitations bind a verified address to a role. Revoking access is separate from deleting history. | Built |
| ACCESS-02 | New share links use high-entropy tokens stored as hashes, explicit scopes, revocation, expiry, no referrer, no indexing and no shared caching. Old links keep their old limited view. Tokens and financial inputs never reach previews, analytics, logs or error reports. | Partly. Old links keep their scope; selected read-only summary shares are not built (v5 §7) |
| PRIV-01 | Product data, aggregate analytics and audit are separate. Answers, homes, reasons and documents are private product records; analytics never receives financial values or browsing history. | Built |
| PRIV-02 | Published retention promises stand until a reviewed change updates policy, screens, jobs and tests together. Deletion is real; required holds have a basis and an end. | Built. The broker's hold rule (F16) is open |
| PRIV-03 | Do not import lender files just to record preapproval status. | Built (nothing is imported) |
| PRIV-04 | Sharing with the agent, marketing, booking contact, recording consent and representation are separate permissions; opt-outs reach queued jobs; nobody consents to marketing for someone else. | Built |

## 10. Campaigns and public design

Public pages are expressive, client pages calm, Operations utilitarian (v5 §3). Brand tokens are
reused after contrast checks.

| ID | Requirement | Status |
| --- | --- | --- |
| CAMP-01 | Campaigns are immutable recipes of approved blocks with validated properties. No arbitrary HTML, scripts, embeds, custom CSS or client-supplied formulas. AI may draft a recipe, never code. | Not built (v5 §5.10) |
| CAMP-02 | Start with one buyer recipe on the existing assistance and readout path; a general composer follows. Maps, inventory, personalization, experiments and custom domains come later. | Not built |
| CAMP-03 | Preview at phone and desktop, validate disclaimers and sources, publish atomically, keep revisions and attribution, roll back to a prior version; visitors stay on the version they started. | Not built |
| CAMP-04 | Tools share one calculation and input contract across public pages, the portal and Operations. A presentation variant may change layout, never the maths, permissions or eligibility. An artifact reads the same output as the table and has a text equivalent. | Built for existing tools; **binding on every v5 value and artifact** |
| CAMP-05 | No fabricated testimonials, counts, activity, stories or property data. No promised output behind a form. Review requests are neutral. | Built |

## 11. Quality

| ID | Requirement | Status |
| --- | --- | --- |
| QUALITY-01 | WCAG 2.2 AA: keyboard, visible focus, labelled errors, announcements, contrast, reduced motion, 200% zoom, 44px touch targets on client pages; charts have text equivalents; state has words and an icon. | Built for the journey screens (AT39). Every redesigned page must pass again |
| QUALITY-02 | Client flows work at 375px and 390px and on desktop; nothing clipped; retry and unsaved states are shown; offline never accepts a decision. | Built for the journey screens. Redo for redesigned pages |
| QUALITY-03 | Public performance: LCP 2.5s or less, INP 200ms or less, CLS 0.1 or less at the 75th percentile on real traffic. Optional visuals load after the tool without layout shift. | Not measured (no traffic). **Binding on the v5 artifacts** |
| QUALITY-04 | Integration health distinguishes configured, authorized, last successful, stale, unavailable and failed. Missed runs, lag, unknown outcomes and orphaned tasks are monitored without logging private data. | Built (job runs, `/api/health`) |

## 12. Measures (each with its denominator)

| Outcome | Measure | Guardrail | Status |
| --- | --- | --- | --- |
| Public value | Completed readouts / valid started assessments, by campaign and version | Completion never requires capture | Instrumented; no traffic yet |
| Value ladder (new in v5) | Visitors who take a second value / visitors who finish a first | Counts questions answered, never the answers | Not built (v5 §5) |
| Conversion | Saved plans and confirmed consultations / completed readouts, separately | A requested booking is not a confirmed one | Partly |
| Search efficiency | Agent minutes per setup and per update; repeated data entry | Baseline before claiming savings | Pilot report (setup time) |
| Buyer clarity | Buyers who can state their priorities and next step unaided / pilot participants | Record confusion and disagreement | Pilot |
| Coordination | Status-chasing questions per active buyer-week; overdue unowned work | Never suppress questions to improve the number | Pilot report (same-day replies) |
| Reliability | Verified executions / approved executions; unresolved failures by age | Timeouts stay unknown until reconciled | Job runs |
| Safety | Wrong released dates, duplicate sends, exposures, stale approvals executed | Any one stops expansion until investigated | Tests; pilot |
| Capacity | Active clients served at stable response and missed-obligation rates | More clients alone is not success | Pilot |

## 13. Acceptance scenarios

The forty v4 scenarios stand, carried here unchanged. AT01 to AT29 and AT34 to AT40 are covered
by the built packages W01 to W09, W11 and W12, as recorded in `docs/handoff.md` §8.2. AT30 to
AT33 wait for money v2 (W10). New v5 work states its acceptance checks in the section that
specifies it.

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

## 14. Findings from the v4 review that still bind

The v4 review found twenty problems in the original blueprint (F01 to F20). Their resolutions
are built into the requirements above; these are the ones that still constrain future work.

| ID | Finding | What it means for v5 |
| --- | --- | --- |
| F04 | Calculated, estimated, verified, suggested and unknown were one confidence ladder | Keep origin, review, freshness, authority and provenance separate (evidence contract, §6) |
| F08 | "Cash to close" included inspection, appraisal and moving | Moving leaves the public figure now (Kaleb, R1); the full ledger is W10 |
| F09 | A "comfortable range" had no tested model | The affordability value needs its own model first (MONEY-05) |
| F10 | Match percentages, readiness scores, live counts and "Rift is watching" had no evidence | No percentages; counts only from authorized sources; monitoring copy needs a live monitor |
| F12 | Matrix write access was assumed | Manual path stays until rights are confirmed (D02) |
| F13 | GAR form numbers were treated as stable configuration | Identify forms by family, form ID, edition, file hash and source page; forms are licensed |
| F14 | Representation was one gate | Today's gate stays until the broker's action-specific rules arrive (D06) |
| F16 | Long-lived records versus deletion promises | Holds need a basis and an end; the broker decides (D06) |
| F17 | Notification cadence and service promises had no owner | D07 settled the pilot; D07a is open |
| F18 | Recommendations could drift into steering | Only explicit property preferences and places the person chose; no demographics, school or crime rankings, or proxies, including in free text. Binding on the lead-side values and the assistance engine |
| F19 | The campaign composer was called quick and moderate without evidence | Time to publish is a test target; start with one fixed recipe |
| F20 | "No action needed" when third-party status was missing | Say "No action currently assigned to you; waiting for ..., last confirmed ..." |

Documentation debts found in the v4 review and still worth fixing when those files are next
touched: `product.md` promises a password-based save (Rift uses email links); `schema.md`
describes conceptual `clients` and `stage_transitions` tables and shortens ownership to
`agent_id = auth.uid()` (policies map the sign-in user to `rift_agents.id`); `integrations.md`
mixes capability, configuration and verification in one description.
