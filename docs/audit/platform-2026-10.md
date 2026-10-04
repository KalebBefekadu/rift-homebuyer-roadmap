# Platform audit, 3 October 2026

A list of what to work on next across the whole platform: public site, client side,
Operations, data, security, reliability, engineering, compliance and growth.

**How this was gathered:**
- the live site (health check, page timings, phone-width checks, robots and sitemap);
- the code at `aff675e` (sizes, routes, endpoint guards, dependencies, `npm audit`);
- CI history;
- blueprint v5 §1, §7, §10, §12 and §13, and handoff §8;
- the four page audits in this folder (`business.md`, `journeys.md`, `people.md`, `today.md`).

**Not checked:**
- **The production database.** Reading it was blocked by this session's permission settings, so the failing job below is not diagnosed.
- **Real Brevo, Cal.com, Sentry or Anthropic responses.**

**Priority:**
- **P0:** broken now, or a risk before any real client.
- **P1:** a product gap someone will hit.
- **P2:** quality or upkeep.
- **P3:** growth.

**Owner:**
- **Eng:** engineering can do it alone.
- **Kaleb:** needs your answer or account.
- **Broker:** needs the broker.

**Corrections after a second look (4 Oct):**
- **#4 was wrong.** CI does build, checks the bundle budget and runs every `e2e/` suite on
  each push (`.github/workflows/ci.yml`). The real gap is #3: deploys did not wait for it.
- **#5 overstated Brevo.** `"set, not verified (deep check requires the cron secret)"` means the
  public health check did not ask Brevo, not that Brevo refused the sender. Settings shows the
  real answer. The custom sending domain and Supabase's mailer still stand.

## Progress

| # | State | What changed |
| --- | --- | --- |
| 1 | Partly | The summary's reads wait the agent's 8 s deadline, not a visitor's 2 s (a cold scheduled start spent the 2 s before the queries were sent). The recorded reason for the failure is on Operations › Today; read it there to confirm this was the cause, or whether Brevo refused the send |
| 2 | Done | A menu on phones (a `<details>`, so it opens before JavaScript), reaching this side's pages and the other two sides; an e2e test on each side |
| 3 | Done in the repo | `npm run deploy` refuses unless HEAD is `origin/main` and CI passed it, then deploys a clean checkout. Connecting Vercel to GitHub would replace it (Kaleb) |
| 4 | Not a gap | See corrections |
| 6 | Done | No Next 16 needed: Next 15 pins its bundled PostCSS at 8.4.31, so an npm `overrides` entry lifts it to 8.5.28, which carries the fixes; Next is on 15.5.27. Vitest 4.1.11 fixes the moderate mocker advisory (all 2,094 tests pass unchanged; `vite-node`, which Vitest 4 no longer brings, is now its own dev dependency for the program seed). What `npm audit` still lists is `braces` inside the lint tooling: dev-only, with no fixed version published |
| 7 | Done | `rift_schema_migrations` records each migration in the same request; `/api/health` says `schema: current` or `behind`; a test keeps `lib/db/schema-version.ts` on the newest file; the token comes from the environment or `.env.local` first |
| 8 | Done | `scripts/local/run.sh <command>` sets the local environment itself and refuses to start unless the database is local; `dev:local` uses it |
| 2 (more) | Done | The abroad landing has its own bilingual header, which the first e2e run caught without a menu; it now has one, and below 400px "Talk to Kaleb" moves into it so the header fits 320px. `/buy/programs` scrolled sideways to 779px at 320px (a screen-reader label escaping its table's scroller); `.scroll-x` now contains it, and the page is in the phone suite |
| 17 | Done | Operations › Settings › Mortgage rate: the current rate and its age, the Friday job's last run, and a form to record it by hand (1 to 20%, no future dates); Today's stale-rate item links there |
| 18 | Done | `rift_offer_answers` (history, migration 20261004100000): each inbound offer card records answered or not and the sender's respond-by day; a recorded answer wins over the lead-reply guess, and an unanswered offer with a deadline sorts by it on the board |
| 19 | Done | A sale's Offers and Preparation tabs record, release and remove offers, save the seller's figures, approve the take, and add, tick and remove steps, with the record page's own controls; writes go through the journey route (one `seller` op that resolves the person from the journey), so they cannot hang the way a server action on that page can |
| 20 | Done | "Take off the list" asks in place: Sold, They passed, Withdrawn, or a typed reason |
| 21 | Done | A held Advocacy moment has Reopen, which hands it back to its window (a reopened ask past its window reads "Window passed") |
| 22 | Done | Visitors include sessions that used a value with no first visit recorded (opened from a shared link, never past a landing page), but not sessions first recorded before the period |
| 24 | Done | The whole Relationships row opens the panel; the overdue and quiet chips count within the other filters already set |
| 25 | Done | The quarterly email promises what the plan can do (work the numbers out again with this quarter's rate and programs), not county news it never carried; seller and abroad words of their own |
| 26 | Done | The dormant day-one email, in its saved-plan words, is skipped when the save email went out; the partial-answers version still goes |
| 27 | Kept | Abroad buyers are buyers: `rift_leads.side` is buy or sell, Operations filters on it, and the emails take the audience from the plan. Adding a third side would change every side filter for no difference a reader sees |
| 28 | Done | A pre-D31 seller readout is skipped with a true reason instead of "no readout figures" |
| 29 | Partly | `app/globals.css` also imported two Google fonts from the retired MVP on every page, which only a page outside `.rift` could show; removed (system fonts there). Fontshare stays until its files are self-hosted, which needs a download (your yes) |
| 30 | Started | The full policy ships as `Content-Security-Policy-Report-Only` (`lib/core/csp.ts`): origins for scripts, styles, fonts, images and connections, no frames or plugins. Reports go to `/api/csp-report`, which keeps only the directive and blocked origin (a report carries the page address, which on a plan page is the secret) and sends that to Sentry. No violations on the funnel, sign-in or Today locally. Enforce it by moving it to the enforced header after a quiet week |
| 31 | Partly | The "could not be read" pages were mostly the visitor's two-second deadline on agent pages, spent on cold starts. 181 reads in 27 modules the agent, signed-in clients, client links and jobs use now wait eight seconds; the funnel's keep two; `lib/db/deadline-by-reader.test.ts` holds the split. Consolidating the busiest pages into one database function each is still open, for when the book is larger |
| 32 | Needs Kaleb | 23 reads ask for more than 1,000 rows (`lib/db/listing.ts`, `offer-board.ts`, `progress.ts`, `clients.ts`, `summary.ts` and others). Whether Supabase caps them depends on the project's API "Max rows" setting, which this session could not read. Raising it to 10,000 is one setting; at pilot size no list is near the cap |
| 34 | Done | `agent-lookup` waited out a real 3.5 s deadline; `COLD_START_MS` moved to `lib/core/timeout.ts` so the test shortens it (now 0.2 s). `query-shapes` has a 30 s budget |
| 40 | Done | Blueprint §1 brought to 4 Oct |
| 38 | Partly | The unused `_s` is gone and lint is clean. `.sr-only` already exists in `rift.css` (the audit was wrong about that) |

---

## P0: fix first

| # | What | Why it matters | Owner | Size |
| --- | --- | --- | --- | --- |
| 1 | **The morning summary job is failing.** `/api/health` reports `daily-summary failed`; the other four jobs are ok. | It is the one alert channel D07 chose instead of instant alerts. While it fails, new leads wait until you happen to open Today. | Eng (needs a production log read) | S |
| 2 | **No navigation on phones.** At 375 px the header hides Buying, Selling and From abroad (`display:none`) and offers no menu. | Most visitors are on phones. On a value page the only way to another value is the footer. | Eng | S |
| 3 | **Deploys come from a laptop, not from `main`.** `vercel deploy` uploads the working folder, untracked files included. This week that shipped code that was not on GitHub after a rejected push, and nearly shipped someone's unfinished folder. | The live site can differ from the repo with nothing failing. | Eng + Kaleb (turn on Vercel's Git deploys) | S |
| 4 | **CI does not build or run the browser tests.** It runs typecheck, lint and unit tests. The build, plus the `e2e/` suites (accessibility, phone, funnel, smoke, styling), run only by hand. | A build break or an accessibility regression reaches `main` unseen. Combined with #3, nothing stands between a commit and production. | Eng | S |
| 5 | **Email is not ready for real clients.** Brevo's sender is "set, not verified", and there is no custom sending domain (DKIM, DMARC). Unless custom SMTP has been set in Supabase (not checked), its sign-in links go through the built-in mailer, which allows only a few emails an hour. | Follow-ups land in spam, and a buyer's sign-in link may never arrive (the R2 review already hit "no email came"). | Kaleb (domain DNS), then Eng (Brevo SMTP for Supabase auth) | M |
| 6 | **A high-severity advisory in the framework.** `npm audit` flags PostCSS (bundled with Next 15.5) for XSS and source-map file reads. The fix path is Next 16. | Build-time exposure mostly, but it is the one red item, and it grows while we wait. | Eng | M |
| 7 | **Production schema changes depend on another project's secret.** `scripts/apply-sql-migration.sh` reads the Supabase access token from `~/veltro-monorepo/.../.env.local`. Nothing checks that production has every migration in `supabase/migrations`. | If that repo moves or its token rotates, migrations stop. A missed migration shows up only as a degraded page. | Eng | S |
| 8 | **A local setup command can silently point at production.** `source <(scripts/local/env.sh)` on macOS's bash 3.2 loads nothing, so the app falls back to the production keys in `.env.local`. | Demo data or test writes could land in the live database. | Eng (make the script refuse) | S |

## P1: product gaps

### Before the pilot

| # | What | Why | Owner | Size |
| --- | --- | --- | --- | --- |
| 9 | **The pilot has not started.** 3 to 5 buyers, added by hand (§13). | Everything since 23 Sep was built for it. The client side has had no real use. | Kaleb | n/a |
| 10 | **Client side design pass.** Navigation (Today, Homes, Journey, Money, Documents, Help) and the §4 rules on phone (§7.2) have not been done. Operations and the public site have had theirs. | It is the part the pilot buyers will use every day. | Eng | L |
| 11 | **Cal.com is not connected.** Health shows `calendar: missing`. Booked calls and showings are not on the Calendar page. | Booking stays a request, and the Calendar shows only contract dates and follow-ups. | Kaleb (account and key), then Eng | S |
| 12 | **Your profile does not reach the pages.** The footer, readout and privacy page spell out your name and "Peachtree Cardinal" in their own text. Licence number and phone are stored but shown nowhere. | Georgia advertising rules generally expect the brokerage to be identified clearly. Editing Settings changes nothing a visitor sees. | Broker (what must show), then Eng | S |
| 13 | **The broker's written rules** (D06, D09), retention after closing (5 years), and marketing to unrepresented buyers. | The settings exist with defaults, and the page says they are undecided. Deletion runs on the retention number. | Broker | n/a |
| 14 | **Amharic: 161 of 161 strings unreviewed, 2 known wrong.** The abroad headline still says Georgia, and the rent ratios are estimates labelled as county averages. | Wrong claims shown to the audience that page exists for. | Kaleb (native reviewer) | M |
| 15 | **Programs email for plan savers.** Most savers now skip it, because the match needs income, household and work. A short "check what you may qualify for" variant is unwritten. | The programs value is the biggest number for first-time buyers, and most leads never hear about it. | Kaleb (yes or no), Eng | S |
| 16 | **Confirm the defaults chosen during the rebuild** (D38): Advocacy windows, the four-week "withdraw the listing" wording, and what "taken on" counts in Reports. | They shape what Today and Advocacy ask of you. | Kaleb | n/a |

### Operations, left from the page audits

| # | What | Owner | Size |
| --- | --- | --- | --- |
| 17 | No screen to record a mortgage rate. The rate item's next action is still a terminal command. | Eng | S |
| 18 | Inbound offers have no "answered" flag or response deadline. "Replied" is inferred from the lead's email reply. Needs a migration. | Eng | M |
| 19 | Seller offers and preparation are still worked on the person page, not the journey tab. | Eng | M |
| 20 | "Take off the list" on Homes uses the browser's `prompt()`. | Eng | S |
| 21 | Held Advocacy moments cannot be reopened, because there is no delete. | Eng | S |
| 22 | Reports undercounts visitors: they come only from `rift_attributions`, so 63 finished a value but only 27 visits were recorded on the demo book. | Eng | M |
| 23 | Forms inside journey tabs (Showings, Offers, Dates, Search setup, brief editor) and two older forms (`Check.tsx`, NewCampaign) keep their old markup. | Eng | M |
| 24 | Relationships: only the name opens the panel, not the whole row. The quick-chip counts ignore the stage, next-step and contact filters. | Eng | S |

### Follow-up emails

| # | What | Owner | Size |
| --- | --- | --- | --- |
| 25 | The quarterly email (l3) says "what has changed in your county" but carries no county data. | Eng | S |
| 26 | The dormant day-1 email (d1) can follow the save email within a day. | Eng | S |
| 27 | Abroad plans are filed as `side=buy` on the lead. Emails read the plan's side as a workaround. | Eng | S |
| 28 | Pre-D31 seller readout leads get "no readout figures" in their emails. | Eng | S |

## P2: engineering quality

| # | What | Why | Size |
| --- | --- | --- | --- |
| 29 | **Fonts load from Fontshare on every page**, including the funnel. They also cause the hydration warning in the Operations layout. | Every visitor's IP goes to a third party on a site whose promise is "nothing leaves". It also costs a blocking third-party request. Self-host them. | S |
| 30 | **No full Content-Security-Policy.** Only `frame-ancestors`, `base-uri` and `form-action` are set; a nonce-based CSP is noted in `next.config.ts` as not done. | Defence in depth for pages carrying people's finances. | M |
| 31 | **Operations pages fan out many reads.** The journey page adds about 8 parallel queries per load, and Reports needed an 8-second deadline. Under load, reads time out and pages show "could not be read". | Slow, flaky pages as the book grows. Consolidate the hot pages into one database function each. | M |
| 32 | **Supabase's 1,000-row API limit** still applies to some reads (raised earlier). | Lists and reports go quietly short past 1,000 rows. Needs a project setting, or paging. | S |
| 33 | **No browser tests for Operations, the Questions editor or the client side.** `e2e/` covers public pages only. | The pages rebuilt this week are covered only by unit tests and one-off manual checks. | M |
| 34 | **Flaky database tests under load.** `query-shapes` and `agent-lookup` hit their timeouts when the machine is busy. | False failures slow every merge. | S |
| 35 | **Dependency drift.** `@supabase/ssr` 0.6 → 0.12 (auth cookie fixes), Sentry 10 → 11, Next 15 → 16 (#6), Vitest 4, ESLint 10, TypeScript 7. | Each gap makes the next upgrade bigger. | M |
| 36 | **Large files:** `lib/db/clients.ts` (847 lines), `lib/db/portal.ts` (753), `lib/core/assistance.ts` (715), `lib/db/retention.ts` (642), the journey page (594), the Questions editor (568). | Harder to change safely. Split along the seams already in them. | M |
| 37 | **The prototype is now superseded for Operations.** `app/prototype/studio/*` still builds; it returns 404 in production. AGENTS.md allows retiring a screen once its replacement is live and checked. | Build time and confusion about which screen is real. | S |
| 38 | **Small leftovers:** unused `.desk-*` rules in `rift.css`; `grid-2` used in `sell/unclaimed/Unclaimed.tsx` but defined nowhere; no shared `sr-only` class; an unused `_s` at `lib/db/recovery.ts:167`. | Housekeeping. | S |
| 39 | **Local stack ergonomics.** The minted service key expires in 24 hours, the local proxy returns 501 on token refresh, and the shared Browser pane collides between parallel agents. | Wasted time on false "could not sign in" states. | S |
| 40 | **The blueprint's §1 "Where Rift stands" is dated 28 Sep.** It predates the Operations rebuild, Questions and the follow-up changes. | It is the first thing anyone reads. | S |

## P3: growth and conversion

| # | What | Why | Owner |
| --- | --- | --- | --- |
| 41 | **Measure the funnel by value.** Reports now shows visitor → value → lead → taken on → closed. Set a weekly look at which value converts and where people stop. | The thesis is "value converts". This is the evidence for it. | Kaleb + Eng |
| 42 | **Speed to lead.** D07 chose one daily summary. Once #1 is fixed, consider an instant alert for a hot band during business hours. | Response time is the strongest lever on conversion once a lead exists. | Kaleb |
| 43 | **Search presence.** The sitemap and robots are right (private pages excluded, `/equb` unindexed pending attorney review). Next: the Google Business Profile, county and city landing content, and share images per value. | The value pages are good content with no inbound path but campaigns. | Kaleb + Eng |
| 44 | **Referral loop.** Advocacy now asks at the right moments. Add a simple way for a client to pass their plan link on, and track it as a source. | Cheapest leads, already half built (referral tokens exist). | Eng |
| 45 | **Equb page.** It is live and unindexed pending attorney review. Decide its path to launch, and whether its leads join the same follow-ups. | A distinct audience with its own trust needs. | Kaleb + counsel |

---

## Where things stand

- **Public site:** fast on desktop (server response about 0.2 to 0.4 s; largest paint about 0.8 s on a value page). Phone-width layout fits, but has no menu (#2). Every image has alt text and every control has a name on the home page.
- **API:**
  - Every write endpoint goes through the request guard (`lib/db/guard.ts`).
  - The dev email preview returns 404 in production.
  - Both document routes check the session.
  - Private pages send no referrer and are excluded from search.
- **Data and jobs:** the database is reachable, the rate is fresh, retention is clear, and 4 of 5 jobs are ok (#1). AI spend is capped at $50 a month in code.
- **Tests:** 154 test files and 2,088 tests pass, and the last 6 CI runs are green. They cover typecheck, lint and unit tests only (#4).
