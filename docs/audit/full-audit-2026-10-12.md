# Full audit, 12 October 2026

A to Z walk through the platform as each person meets it, scored on several parameters. Then
what to improve, what is left before production, and what to delete or shrink.

**How this was gathered:**
- **Code:** `main` at `160e959`, about 107,000 lines (app 34.5k, lib 57.6k, components 5.7k, SQL 5.9k, scripts 3.3k).
- **Checks:** `tsc` clean; lint clean; 165 test files, 1,961 tests pass, 208 skipped (the database suites, which need Postgres; CI runs them).
- **Build:** `next build` passes. `npm audit`, `npm outdated`, and `knip` for unused files and exports.
- **The production build, walked in Chromium at 320, 375, 390 and 412 px:**
  - with no database: every public page, the value questions answered end to end, and Save my plan;
  - so the client and Operations sides were read in code, not clicked through signed in.
- **Documents:** blueprint v5, handoff, the 3 October platform audit and every other doc in `docs/`.

**Not checked:** the production database, live Brevo, Sentry or Cal.com, and real-traffic performance.

**Scores** are 1 (poor) to 5 (excellent). They are this reviewer's judgment from walking the
pages and reading the code, not measurements. Nothing here has field data behind it, because
there is none yet.

---

## 0. The verdict in five lines

1. **The engineering is unusually good.**
   - Computed-not-generated numbers, honest degraded states and history-only tables.
   - Comments that explain why, and a test suite that guards the rules.
   - The public value pages are the best part of the product: three questions, a real answer, every assumption shown.
2. **The product has outrun its users.**
   - 107k lines, 20 Operations pages, a seller journey, campaigns, money v2, Equb, Amharic, advocacy.
   - Zero real clients and no real traffic.
   - The 6 September handoff said "the first 200 real assessments are worth more than the next 2,000 lines of code". About 60,000 lines later, that is still the most important sentence in the repository.
3. **Production is blocked by things code cannot fix:**
   - email deliverability, the broker's sign-off;
   - a native Amharic review, counsel on Equb;
   - backups, and the pilot itself.
4. **The documentation now misleads more than it helps.**
   - AGENTS.md says "the production product is not built yet"; README says "the MVP is built".
   - About 8,500 lines across 26 files, much of it superseded.
   - Every new session starts by reading it.
5. **Recommended next month:**
   - a feature freeze, fixing the five bugs below;
   - closing the production blockers, cutting the docs to a third;
   - then spending the effort on getting strangers to the value pages.

---

## 1. Bugs found during this audit (verified)

| # | What | Where | Severity |
| --- | --- | --- | --- |
| B1 | **`/sell/unclaimed` scrolls sideways on every phone.** Page is 443 px wide at 320, 375, 390 and 412. Two `.chip.chip-warn` spans run past the edge. The phone suite does not list this page | `app/(rift)/sell/unclaimed/Unclaimed.tsx`, `e2e/phone.spec.ts` | High (public, phone-first) |
| B2 | **Save my plan reports success when nothing was stored.** With no database the route returns `{ ok: true, url: null, skipped }`. The dialog says "Saved. Your plan is saved... keep the link below" and shows no link. Review mode says "Kaleb has it." Breaks the repo's own rule: never a silent success. Production returns `ok:false` on a failed write, so this hits preview and local builds, or any path that returns `skipped` | `components/rift/value/SavePlan.tsx:136-147`, `app/api/plan/save/route.ts:86` | Medium |
| B3 | **A default answer becomes "your" answer.** The price field opens at 325,000 (`def.fallback`). Pressing Continue without typing records it, and the answer's "Based on" chips present it as the person's own. Rule 11: "'you said' requires that they said it" | `components/rift/value/ValueFlow.tsx:152`, `parts.tsx` (BasedOn) | Medium (product honesty) |
| B4 | **`/abroad/results` with no answers shows a full headline.** "It runs $253 a month short, and still returns 10.5%" on a $285,000 DeKalb rental. Built entirely on defaults, with nothing saying so. Every buyer value asks first; this one does not | `app/(rift)/abroad/results/page.tsx` | Medium |
| B5 | **Missing campaign page returns HTTP 200.** `/c/<unknown>` renders "That page does not exist." with status 200 (the `(rift)/loading.tsx` stream starts before `notFound()`), and the title "Rift · Rift" | `app/(rift)/c/[slug]/page.tsx`, `app/(rift)/loading.tsx` | Low |
| B6 | **Save my plan's button is disabled with no reason.** It stays disabled until a name is typed, and nothing says so. The 28 Sep change log fixed exactly this pattern on another form ("left Record disabled without saying why") | `components/rift/value/SavePlan.tsx` | Low |
| B7 | **Two high `npm audit` advisories in production dependencies:** `sharp` (librsvg CVE) and `source-map-js` (DoS). Both fixed by `npm audit fix` | `package-lock.json` | Medium |
| B8 | **"Only you see this" on the income question is not quite true.** Every answer is in the URL query (`?i=` for income), so it reaches Vercel's request logs, browser history, and the "Share this answer" link. Sentry is scrubbed (`lib/monitoring/redact.ts`); the others are not | `lib/core/asks.ts:110` | Medium (privacy claim) |

---

## 2. The A to Z walkthrough

Parameters, each 1 to 5:
- **Value:** does the person get something real at this step.
- **Clarity:** is it obvious what this is and what to do.
- **Trust:** does it earn belief.
- **Convert:** does it move them to the next step.
- **Ease:** low friction.
- **Phone:** works well at 375 to 390 px.
- **Build:** code and test quality behind it.

### The stranger (lead side)

| Stage | Value | Clarity | Trust | Convert | Ease | Phone | Build | Avg |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A. Getting found (search, share, ads) | 2 | 3 | 3 | 1 | 3 | 4 | 4 | 2.9 |
| B. Front door `/` | 4 | 4 | 4 | 3 | 4 | 3 | 5 | 3.9 |
| C. Buyer landing `/buy` | 4 | 4 | 4 | 4 | 4 | 3 | 5 | 4.0 |
| D. A value's questions | 4 | 5 | 3 | 4 | 5 | 5 | 5 | 4.4 |
| E. The answer | 5 | 4 | 5 | 3 | 4 | 4 | 5 | 4.3 |
| F. The next value (the ladder) | 4 | 4 | 4 | 4 | 5 | 4 | 5 | 4.3 |
| G. Save my plan (capture) | 4 | 3 | 4 | 3 | 3 | 4 | 4 | 3.6 |
| H. Book a call | 3 | 4 | 3 | 3 | 3 | 4 | 4 | 3.4 |
| I. Submit an offer | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4.0 |
| J. Seller values | 4 | 4 | 4 | 3 | 4 | 2 | 4 | 3.6 |
| K. Buying from abroad, Amharic | 4 | 3 | 2 | 3 | 4 | 4 | 4 | 3.4 |
| L. Equb | 3 | 3 | 2 | 3 | 3 | 3 | 4 | 3.0 |

**A. Getting found (2.9).** The weakest stage, and the one everything else depends on.
- **What works:**
  - the sitemap and robots are right;
  - share cards exist for `/`, `/buy`, `/sell` and `/abroad`;
  - first-touch attribution is immutable.
- **What is missing:**
  - **an inbound path.** No public page per Georgia program, so nothing ranks for "DeKalb down payment assistance".
  - **no county or city pages,** and no Google Business Profile in the repo's plan.
  - **no share card for an individual answer.**
- Campaigns exist, but a campaign needs traffic to send.

**B. Front door (3.9).**
- **Strong:**
  - one headline;
  - two doors, each with a computed figure and its own drawing;
  - no stock imagery.
- **Weak on a phone:**
  - **length:** 4,818 px, about 5.7 screens.
  - **repetition:** the six "More you can work out here" cards repeat the questions already listed inside each door.
  - **fonts:** they load from Fontshare, a third-party, render-blocking request on every page. That also contradicts the privacy page's spirit.
- **Fix:**
  - cut "More" to Equb and abroad (the only two not reachable from a door);
  - self-host the fonts.

**C. Buyer landing (4.0).**
- **Good:**
  - six values, one primary action, the odd card spanning the row;
  - the cash-to-close drawing is the clearest single idea on the site.
- **Long on a phone:** 4,565 px.
- **Nobody there:** no face, credential or licence number anywhere near a call to action. For a stranger deciding whether to give an email to "Kaleb", **who Kaleb is** is the missing trust signal.

**D. The questions (4.4).**
- **Good:**
  - three questions to an answer;
  - one per screen, "Question 1 of 3", choices advance on click;
  - money accepts any amount.
- **Weak:** the prefilled price lets the default stand in for the person's answer (B3). Either:
  - start the field empty with the default as a placeholder; or
  - mark any untouched answer as "Rift's assumption" in "Based on".

**E. The answer (4.3).**
- **The product's best moment:**
  - a large figure and one sentence;
  - a drawing, a line-by-line table, and "how this was worked out";
  - assistance never folded in.
- **The conversion is buried.** On a phone, "Save my plan" sits about 2,200 px down, below three next-value cards.
- **Fix:**
  - a slim sticky bar on phones once the answer is on screen: "Email me this" (email only), with "Save my plan" for more;
  - the review ask ("Ask Kaleb to review my numbers") is the strongest offer on the page and should be the primary for anyone who has answered two or more values.

**F. The ladder (4.3).**
- "Nothing more to answer", "One more question" and "Two more questions" are exactly right: they price the next step honestly.
- Missing: after three values, nothing pulls them together into "your plan so far" until they save.

**G. Save my plan (3.6).**
- **Friction:**
  - a name, an email and an optional phone;
  - the button disabled without a reason (B6);
  - consent wording clear and honest.
- **Risks:**
  - **B2, the false success;**
  - **deliverability:** Brevo still has no authenticated domain (DKIM, DMARC), so the saved-plan email, the only thing that brings them back, may go to spam.
- **Fix:**
  - email only, name optional;
  - fix B2;
  - authenticate the domain.

**H. Book a call (3.4).**
- **No real calendar:** Cal.com is not connected (`/api/health`: `calendar: missing`), so it is a request, not a booking.
- **Too much asked:** name, phone and email are all required for a twenty-minute call request.
- **Fix:**
  - connect Cal.com, or say "Kaleb will text you two times" and ask for phone or email, not both.

**I. Submit an offer (4.0).**
- **Good:**
  - upload the PDF, an AI read fills the form (never a figure on a public page);
  - the file is kept even when the read fails.
- **Risk:** cost exposure.
  - It is an unauthenticated endpoint on the largest model, `claude-opus-5`, reserving $1.50 a call.
  - The limit is 3 per 10 minutes per IP, per serverless instance, inside **one shared $50 monthly budget**.
  - A modest bot can spend the month in an afternoon, and that also switches off the weekly program-page comparison.
- **Fix:**
  - give each workflow its own share of the budget;
  - add a bot check (Turnstile or a signed form token);
  - test whether a smaller current model passes the extraction tests.

**J. Seller values (3.6).**
- **Good:** proceeds, costs, prepare, unclaimed; the same lens as buyers.
- **Phone is broken on `/sell/unclaimed`** (B1).
- **The unclaimed-money value is underused.** It is the best seller hook on the site, because it serves owners who are not selling yet. Homestead exemption and appeal deadlines are an annual reason to come back.

**K. Abroad and Amharic (3.4).**
- **Good:** a distinctive, well-made niche; status, cost and return as separate values.
- **Trust is the problem:**
  - **the Amharic is unreviewed.** `/api/health` reports **421 of 421 Amharic strings unreviewed**, up from 161 on 3 October, with 2 known wrong. Financial guidance in an unreviewed translation, aimed at the audience most likely to rely on it, is the largest trust risk on the site;
  - **defaults shown as a result** (B4);
  - **the headline contradicts itself:** "runs $253 a month short, and still returns 10.5%" reads as a contradiction to a first-time investor; say what the 10.5% is in the headline.
- **Fix:**
  - get the native review, or switch Amharic off until it is done.

**L. Equb (3.0).**
- A real differentiator for Ethiopian families.
- **The legal question:** it takes seat requests (`/equb/reserve`) while unindexed "pending attorney review".
  - A pooled-savings product can raise questions about money transmission or securities.
  - Counsel should say what the page may promise before it collects anything.
- **Length:** 7,131 px long on a phone.

### The agent (Operations)

| Stage | Value | Clarity | Trust | Convert | Ease | Phone | Build | Avg |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M. A lead arrives (alert, Today) | 4 | 4 | 4 | 3 | 4 | 3 | 4 | 3.7 |
| N. Working the lead, inviting a household | 4 | 3 | 4 | 4 | 3 | 3 | 4 | 3.6 |
| O. Search, homes, showings, offers | 4 | 3 | 4 | n/a | 3 | 3 | 4 | 3.5 |
| P. Contract, dates, transactions | 4 | 4 | 5 | n/a | 3 | 3 | 5 | 4.0 |
| Q. Advocacy, referrals, reports | 3 | 3 | 4 | 3 | 4 | 3 | 4 | 3.4 |
| R. Settings, Questions, Programs, Outbox | 4 | 3 | 5 | n/a | 3 | 3 | 5 | 3.8 |

**M. A lead arrives.**
- **The alert goes to email only.** D07a keeps an instant new-lead alert, but it arrives by email. A 15-minute "Call today" target needs a text or a push to Kaleb's phone (he consents for himself, so there is no TCPA question).
- **The morning summary is unconfirmed.** It was failing in production on 3 October and is marked "Partly" fixed. Confirm it has run green every weekday since, because it is the safety net.

**N to R. Working the book.**
- **Built for a bigger business.** The workspace is thorough: tabs, workstreams, history-only facts, named sources. But it has been used by nobody.
- **Navigation:** about fifteen destinations for one agent with no clients. Empty pages teach the agent to stop looking.
- **Fix:** hide any section with nothing in it (Campaigns, Advocacy, Transactions, Offers) until it has its first item, and show it automatically after.
- **Untested where it matters:** the pilot needs "add a buyer, invite the household, they sign in, they see Today". Walk that path with a real phone and a real inbox before the first client, not after.

### The client (portal)

| Stage | Value | Clarity | Trust | Convert | Ease | Phone | Build | Avg |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| S. Invitation and sign-in | 4 | 4 | 4 | n/a | 3 | 4 | 4 | 3.8 |
| T. Today, Homes, Offers, Money, Documents, Help | 4 | 4 | 4 | n/a | 4 | 4 | 4 | 4.0 |
| U. Closing and moving in | 4 | 4 | 5 | n/a | 4 | 4 | 4 | 4.2 |
| V. After closing (advocacy, records) | 3 | 4 | 4 | 3 | 4 | 4 | 4 | 3.7 |

- **Sign-in:** rebuilt this month (passwords plus scanner-proof links). It now depends entirely on email arriving, so deliverability is again the gate.
- **Tests:** the client-side browser tests (`e2e-auth/`) run only by hand against a real Supabase, not in CI.
- **Portal:**
  - the tabs match blueprint §7.2, but the portal has had no real user;
  - its Amharic shares the 421-string review problem.

### Privacy and deletion, across all three

**Trust is excellent:**
- "Delete all of it" everywhere;
- an answer-free telemetry allowlist enforced in the database;
- first touch immutable;
- tokens scrubbed from Sentry.

**Two gaps:**
- **Answers in URLs (B8).**
- **The retired MVP's tables** (`clients`, `roadmaps`, `dpa_programs`, `agents_settings`):
  - never dropped (no migration drops them);
  - outside the retention sweep;
  - if production still holds rows in `clients`, that is personal data with no retention rule.

---

## 3. Making it a better product (ranked by impact for the effort)

| # | Change | Why | Effort |
| --- | --- | --- | --- |
| 1 | **Run the pilot now, with what exists.** Five buyers, added by hand. Freeze new features until it has run four weeks | Every score above is a guess until someone uses it | Kaleb |
| 2 | **One public page per Georgia program** (`/buy/programs/<slug>`). Rules, amounts, official source, last-checked date, and "check if it fits me". The data and the internal page already exist | The cheapest inbound path there is. People search for programs by name and county, and Rift has the most honest answer | S |
| 3 | **Email-only capture on the answer, sticky on phones.** "Email me this" with one field; "Save my plan" stays for more | Save sits about 2,200 px down today, behind a name field | S |
| 4 | **Instant lead alert to Kaleb's phone** (text or push), with the lead's one-line summary and a call link | Speed to lead is the strongest lever once a lead exists | S |
| 5 | **Put Kaleb on the page.** A photo, licence number, brokerage, and one honest line, next to every primary call to action. Read from the profile in Settings, not hard-coded (68 "Kaleb" strings in UI code today) | Strangers give an email to a person, not a brand | S |
| 6 | **Answer share cards.** An Open Graph image per answer ("$22,850 to buy a $320,000 home in DeKalb"), with no private figures beyond what the link already holds | People share numbers that surprised them; it is the referral loop without asking | M |
| 7 | **The homeowner loop.** Make unclaimed money (homestead, senior, appeal deadlines) a yearly reminder for owners who saved a plan. Each county's deadline is a reason to write | Listing leads years before a sale, from people who trusted the first answer | M |
| 8 | **Amharic: review it or hide it.** A native reviewer for 421 strings, or English-only until then | It is the trust promise to the audience that page exists for | Kaleb |
| 9 | **A weekly funnel review, written down.** Reports already shows visitor, value, lead, taken on, closed. Pick two numbers (saved plans per week, calls booked per week), set a target, and read them every Monday | The thesis is "value converts". This is how it gets proven or disproven | Kaleb |
| 10 | **Hide empty Operations sections** until their first item; collapse the sidebar to Today, Relationships, Calendar and Settings for the pilot | Fewer places to look, and none of them empty | S |
| 11 | **Lender handoff from "What should I ask a lender?"** Name two or three lenders who work with the matched programs. Get broker and counsel sign-off on RESPA first, and take no referral fees | Turns the value with the clearest next step into a real one | M |
| 12 | **Testimonials and closed-deal counts, once real.** Never before | Principle 10 already says this; it is listed so nobody builds the slot early | later |

---

## 4. Improving the code, by parameter

### Correctness
- **The bugs:** fix B1 to B6 above.
- **Phone suite coverage (`e2e/phone.spec.ts`):**
  - it lists 13 pages, so the overflow on `/sell/unclaimed` went unnoticed;
  - add every value page answered, both blank and with sample answers: assistance, monthly cost, timeline, afford, lender questions, sell costs, sell prepare, sell unclaimed, abroad cost, abroad results.
- **One rule for "the person said it":** `BasedOn` should distinguish a typed answer from a default (B3, B4).

### Security and abuse
- **AI budget:**
  - give each workflow its own share of the AI budget (`lib/core/ai.ts`);
  - and a bot check on `/api/offer/read`, the only public route that spends money.
- **Bot protection** (Turnstile or a signed, time-limited form token) on capture, plan save, offer, Equb and book. The in-memory, per-instance rate limiter is honest about being a deterrent; it is not a control.
- **Patch** `sharp` and `source-map-js` (B7).
- **CSP:** enforce it. The report-only policy started on 4 October. Read a week of `/api/csp-report` in Sentry, then move it to the enforced header.
- **`/api/health`:** returns full component detail to anyone. Keep `ok`/`degraded` public and the detail behind the cron secret.

### Performance
- **190 kB of JavaScript shared by every page,** including static ones like `/privacy`:
  - the drop from 229 to 189 kB when Session Replay was removed shows the monitoring SDK is the big lever;
  - measure with the bundle analyzer, then load Sentry lazily on public pages;
  - target 120 kB.
- **Fonts:** self-host Switzer and Zodiak (one download). It removes a third-party, render-blocking request and a privacy leak on every page. The Fontshare `<link>` is copied in five layouts today.
- **Operations:** consolidate the busiest pages' reads into one database function each (audit #31), before the book grows.

### Architecture
- **Production depends on the "specification" folder:**
  - every production layout imports `app/prototype/rift.css`;
  - `Track`, `Forget`, `Trust`, `lib/core/review.ts` and `lib/core/privacy.ts` import from `lib/prototype`.
  - Deleting the prototype today would break the live site.
  - Move the stylesheet to `app/styles/` and the shared modules to `lib/core` or `lib/rift` first.
- **2,952 inline `style={{...}}` objects:**
  - they defeat blueprint §4.1's "one spacing scale, no one-off margins";
  - CSS modules exist for Operations only;
  - move repeated patterns into named classes in the shared stylesheet, page by page as each is touched.
- **Two ways to write:** server actions and route handlers ("can hang" on the journey page, per the 4 Oct notes). Pick route handlers for anything on a long-lived page and write the rule down.
- **Large files still:**
  - `lib/core/i18n.ts` (1,118 lines): split per locale or per page;
  - `assistance.ts` (715), `email.ts` (688), `retention.ts` (665);
  - the journey page (615), `Questions/Editor.tsx` (568).
- **Agent identity:** comes from Settings, not from string literals (see §3 #5).

### Testing
- **CI runs the whole unit suite twice:** "Test", then "Fail if the database suites skipped". Run it once with `tee` and grep the same log. About a minute saved per run.
- **Client e2e:** `e2e-auth/` (the client's way in) is not in CI. Run it on a schedule against a staging Supabase.
- **Exports kept for tests:** `knip` reports 66 unused exports and 120 unused exported types. Most are constants exported for tests, which is fine. The rest are listed in §6.

### Developer experience and upkeep
- **`next lint`:** deprecated in Next 15.5 and removed in 16. Switch to the ESLint CLI now, so the Next 16 upgrade is one change, not two.
- **`vitest.config.ts`:** warns that it is ESM loaded as CommonJS. Rename it to `.mts`.
- **Behind on majors:** Next 16, Sentry 11, TypeScript 7, ESLint 10, Vitest 5. Take one per week, not all at once.
- **Deploys:** connect Vercel to GitHub, with CI as a required check and previews per PR. It retires `scripts/deploy.sh` and gives every change a preview link to check.

### Observability
- **Nothing pages anyone:**
  - `/api/health` and the job ledger are pulled, not pushed;
  - add an uptime check on `/api/health` and an alert when a cron job fails or is late;
  - free tiers of most uptime services are enough.
- **Reports:** it is the only product analytics. That is the right choice (no third-party analytics); make the Monday review (§3 #9) its user.

---

## 5. What is left before production

"Production" here means: real strangers arrive from real channels, and real clients sign in.

### Blockers

| # | Item | Owner |
| --- | --- | --- |
| P1 | **Email deliverability.** Authenticated sending domain in Brevo (SPF, DKIM, DMARC); Supabase auth mail through Brevo SMTP; a test to Gmail, Outlook and iCloud landing in the inbox | Kaleb (DNS), then Eng |
| P2 | **Broker sign-off** on what public pages must show: brokerage, licence number, Equal Housing Opportunity statement (none appears on any public page today), and the D06 and D09 rules | Broker |
| P3 | **Counsel review** of the consent wording (TCPA), the privacy page, and a short Terms of Use (there is none) | Kaleb + counsel |
| P4 | **Equb:** counsel says what the page may promise before it takes seat requests, or the reserve form is switched off | Kaleb + counsel |
| P5 | **Amharic:** native review of 421 strings, or Amharic hidden until done | Kaleb |
| P6 | **Backups.** Confirm the Supabase plan's backups (point-in-time if available) and do one restore into a scratch project. No document mentions backups today | Eng + Kaleb (plan) |
| P7 | **A staging environment** with its own Supabase project, so tests and previews never touch client data (setup.md already recommends it "before there is real client data") | Eng |
| P8 | **Fix B1 to B8** | Eng |
| P9 | **Daily summary green** five weekdays running, confirmed from the job ledger | Eng |
| P10 | **The pilot path walked for real.** Add a buyer, invite, sign in on a phone from a real inbox, see Today, upload a document, sign out | Eng + Kaleb |

### Should have, first month

| # | Item | Owner |
| --- | --- | --- |
| P11 | Instant lead alert to phone (§3 #4) | Eng |
| P12 | Cal.com connected, or the book page reworded to a request | Kaleb (key), Eng |
| P13 | Bot check and per-workflow AI budgets (§4, Security) | Eng |
| P14 | Enforced CSP | Eng |
| P15 | Uptime and job-failure alerts | Eng |
| P16 | Vercel connected to GitHub, CI required, PR previews | Kaleb (setting), Eng |
| P17 | Supabase API max rows raised, or the 23 large reads paged (audit #32) | Kaleb (setting) |
| P18 | Export, then drop the retired MVP tables in production | Eng |
| P19 | Self-hosted fonts | Eng |
| P20 | D38 defaults confirmed (Advocacy windows, the withdraw wording, "taken on") | Kaleb |

---

## 6. Deadweight: what to delete or shrink

### Code

| Item | Size | Action | Note |
| --- | --- | --- | --- |
| `app/prototype/*` (37 routes), `lib/prototype/fixtures.ts`, `rulesStore.ts`, and the prototype-only components `Shell`, `ProductShell`, `Readout`, `FunnelEditor`, `Ask` | about 10,300 lines | **Delete**, after the two moves in §4 Architecture (stylesheet, shared modules) | Every screen has a live replacement; Operations was built from the mock-up (D26). AGENTS.md's rule ("not until its replacement is live and checked") is met. 404 in production already; it still costs build time and confuses every new session |
| `app/dev/page.tsx` | 1 route | **Delete** | Says the client portal is "Phase 6. Specified, not built". It is built |
| `lib/brevo/sync.ts`, `scripts/ensure-brevo-attributes.mjs`, `npm run brevo:ensure-attributes` | about 150 lines | **Delete** | The retired MVP's contact sync. Nothing imports it |
| `lib/supabase/client.ts` | small | **Delete** | Nothing imports it |
| `lib/core/params.ts` and its test | about 200 lines | **Delete**, or fold in if `/r/<token>` needs it | Only its own test imports it |
| `output/rift-production-schema.sql` | 52 KB | **Delete** | "Generated 2026-09-08", 30 migrations out of date, and its header says "paste into the Supabase SQL editor". A hazard, not a convenience |
| `output/clear-test-data.sql` | small | **Delete** after it has run (blueprint §12 asks Kaleb to confirm clearing) | One-off |
| Unused exports in `lib/prototype/fixtures.ts` (17), `funnelStore`, `telemetry`, `attribution` | small | Go with the prototype | |
| The retired MVP's three migrations and four tables | 4 tables | Export, then drop the tables in a new migration; keep the old files as history | Personal data outside the retention sweep |
| Fontshare `<link>` in five layouts | 5 copies | One shared font component, then self-host | |
| The CI's second unit-test run | about 1 min per run | One run, one log | |
| The forwarding routes `/buy/start`, `/buy/results`, `/sell/start`, `/sell/results` | small | Keep for now; check request logs in January and delete any with no hits | Old links still exist in sent emails |

### Features to switch off until they have users

The code can stay behind its release switch; the cost being cut is attention and surface. Each
one was built ahead of the pilot by an explicit decision with a written way back (D27, D28,
D29).

| Feature | Size | Reverse by (blueprint §11) |
| --- | --- | --- |
| Campaign composer and AI campaign draft | about 1,300 lines | D29: unpublish all, hide the page |
| Seller journey workspace | stays, hidden | D28 |
| Money v2 client area | stays, hidden | D27 |
| Advocacy and referrals pages | shown only after the first closing | |
| Equb reserve form | off until counsel answers (P4) | |

### Documents (about 8,450 lines in 26 files today; target about 3,000)

| Document | Lines | Action |
| --- | --- | --- |
| `docs/blueprint-v4/` (5 files) | 950 | **Delete.** Archived on 24 Sep; git history keeps it |
| `docs/benchmark.md` | 645 | **Cut to the field-metrics section,** about 80 lines. Four grading passes of a prototype; the README's "93, provisional" goes with it |
| `docs/prototypes.md` | 501 | **Delete** with the prototype |
| `docs/handoff.md` | 725 | **Cut to the contracts** (§4) and requirements (§6), about 250 lines. §2 and §3 (traffic gate, phases) were overruled by D08 and D21. §5 describes the prototype. §8 and §9b describe a state that has moved on ("Nurture sequences are not connected to a sending system", "Studio") |
| `docs/product.md` + `docs/vision.md` | 833 | **Merge into one `vision.md`,** about 150 lines. Decision Rooms, Meeting-to-Plan, Document-to-Journey and Property Passport are unbuilt and unplanned in the blueprint |
| `docs/agent-kickoff.md` and `.cursor/rules/recommend-next-task.mdc` | 98 | **Delete or rewrite in ten lines.** Both send an agent to `/prototype` and the old phase order |
| `docs/setup.md` §13 "Repository map" | about 25 | **Rewrite.** It describes the retired MVP: `app/page.tsx` as a dev index, `lib/auth`, `app/actions`, and migrations "currently the RETIRED MVP's schema". It also points at `output/pending-migrations.sql`, which does not exist |
| `docs/audit/` (six files, plus this one) | 1,120 | **Keep one living list.** This file's §1 and §5 replace `platform-2026-10.md`'s open items. Fold the four page audits' open lines into it and delete them |
| `docs/blueprint-v5/README.md` | 1,177 | **Move the change log (60 rows) out** to `CHANGELOG.md` or git history, and the "Status (date)" paragraphs to handoff. The plan itself is about 600 lines |
| `AGENTS.md` and `README.md` | 180 | **Correct them.** AGENTS.md says "the production product is not built yet", "the MVP is phases 1-3, buyers only", "do not extend the prototype instead of building the product". README says 30 prototype routes, `lib/auth`, and the traffic gate. Every new session reads these first; today they describe September |

`lib/core/docs.test.ts` reads `handoff.md`, `schema.md`, `product.md`, `benchmark.md`,
`architecture.md` and `setup.md`. Move or delete the checked numbers in the same change as the
document, as AGENTS.md requires.

---

## 7. Suggested order

**Week 1, engineering:**
- B1 to B8;
- the CI double run;
- `npm audit fix`;
- correct AGENTS.md and README;
- delete `output/`, `app/dev`, `lib/brevo/sync.ts` and `lib/supabase/client.ts`;
- widen the phone suite.

**Week 1, Kaleb:**
- DNS for the sending domain;
- book the broker and counsel conversations (P2 to P4);
- find the Amharic reviewer;
- pick the five pilot buyers.

**Week 2:**
- move the stylesheet and shared modules out of `prototype`, then delete the prototype and its docs;
- cut handoff, benchmark and product/vision;
- hide the empty Operations sections;
- staging Supabase and the restore drill.

**Weeks 3 and 4:**
- program pages (§3 #2);
- the sticky email capture (§3 #3);
- the phone alert (§3 #4);
- Kaleb on the page (§3 #5);
- start the pilot;
- the first Monday funnel review.

**After that:** let the pilot's first four weeks decide what is built next. That is the rule
the handoff set on 6 September, and it is still right.
