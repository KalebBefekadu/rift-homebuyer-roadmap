# Rift Blueprint v5

**The single source of truth for what Rift is and what gets built next.**
**Written:** 24 September 2026. **Owner:** Kaleb Befekadu.
**Replaces:** blueprint v4 (`docs/blueprint-v4`, now kept only as the record of the September
review) and the test feedback file from Kaleb's page-by-page review (rounds R1 and R2, merged
here in full and then deleted).

Blueprint v5 exists because blueprint v4 built the private client journey and Operations
plumbing, and left the public site and the look of Operations as they were. When Kaleb tested
the live site he found no visible change on any page. v5 keeps everything v4 got right,
records what is built, and turns the rest, plus his feedback, into one plan across Rift's three
experiences: the lead side, the client side and the Agent OS.

## Contents

0. [How to use this document](#0-how-to-use-this-document)
1. [Where Rift stands](#1-where-rift-stands-24-september-2026)
2. [The product: three experiences](#2-the-product-three-experiences)
3. [Principles](#3-principles)
4. [Design system, across the whole site](#4-design-system-across-the-whole-site)
5. [Lead side](#5-lead-side)
6. [The Georgia assistance engine](#6-the-georgia-assistance-engine)
7. [Client side](#7-client-side)
8. [Agent OS (Operations)](#8-agent-os-operations)
9. [Seller journey](#9-seller-journey)
10. [Platform: money, automation, integrations](#10-platform-money-automation-integrations)
11. [Decisions](#11-decisions)
12. [What only Kaleb can supply](#12-what-only-kaleb-can-supply)
13. [Delivery order](#13-delivery-order)
14. [Change log](#14-change-log)

Companion files in this folder:
- [requirements.md](requirements.md): every requirement ID carried from v4 (STATE, LEAD,
  SEARCH, UX, MONEY, DOC, DEC, DATE, FUNDS, OPS, AUTO, ACCESS, PRIV, CAMP, QUALITY), each marked
  Built, Partly or Not built, plus the forty acceptance scenarios.
- [journey-contracts.md](journey-contracts.md): the stage-by-stage contracts, buyer B00 to B20
  and seller S00 to S18, carried from v4.

---

## 0. How to use this document

- **Planning lives here and nowhere else.** If this document and another one disagree about
  what Rift should be or what comes next, this one wins. `docs/handoff.md` stays the engineering
  record of what is built and how it works; it does not decide what is built next.
- **New feedback is added to the section it concerns**, tagged with who said it and the round,
  like the existing tags: (Kaleb, R1) and (Kaleb, R2) are the review of 24 September 2026.
- **A decision is recorded in §11** before the work that depends on it starts. An open decision
  disables that work; an engineer's default never stands in for it.
- **Proposals are marked as proposals.** Anything written by engineering and not yet confirmed by
  Kaleb (for example most of the Agent OS layout in §8) says so, and is confirmed through a
  design review before it is built.
- **Built items are not repeated as work.** When something ships, its line here says "Built"
  with the date, and the details go in `docs/handoff.md`.
- **No em dashes** anywhere, including this document (a test enforces it on the site).

---

## 1. Where Rift stands (24 September 2026)

Live at https://rift-homebuyer-roadmap.vercel.app. Code at
https://github.com/KalebBefekadu/rift-homebuyer-roadmap.

### Built and live

| Area | What exists |
| --- | --- |
| Lead side | Front door; buyer, seller and abroad landings, questionnaires and readouts (computed on the server, shareable, dated snapshots); Georgia programs list; how-it-works pages; unclaimed money page; public offer form; booking request; privacy page with "delete all of it"; first-touch attribution; answer-free telemetry; follow-up emails with consent and stop rules |
| Client side | Email sign-in by invitation; household members with scopes; the buyer's Today, search priorities, homes and reactions, showings answers, offer answers, checked contract dates, "You own your home" after a confirmed closing, and a printable records page |
| Agent OS | Today (ranked leads, review queue, follow-ups, deadlines, failed jobs); Relationships; person records with plan, decisions, agreement, journeys; the journey page (brief, Matrix search record, household, homes, showings, offers and documents, where it stands, ten workstreams, contract dates); Search; Offers; Calendar; Advocacy; Pilot report; funnel question editor; settings; morning summary email |
| Platform | Supabase with row-level security on every table, history-only tables, idempotent writes, job-run tracking and health checks, release switch `RIFT_BUYER_SEARCH`, Brevo email, Sentry |

Blueprint v4 packages built: W00 to W09, W11 and W12. Not started: W10 (money v2) and W13 (seller
journey and campaigns). Details and dates: `docs/handoff.md` §8.2.

### What the live review found (Kaleb, R2)

- No visible change on any page, public or agent. The v4 work sits behind sign-in, and the
  agent's account had no journey yet, so even the new agent screens were mostly empty.
- The agent side still says "Studio" in its addresses and emails.
- The buyer portal sent no sign-in email: no invitation existed yet, and the sign-in page gives
  no sign that nothing was sent (see §7.3).
- The public pages need a design pass, the questionnaire and readouts need to become separate
  values, and the Georgia programs need rethinking (§4, §5, §6).
- Operations needs a major UI and UX redesign (§8).

### Not built, in one list

Everything below is specified in the section named.
- Design system rules: spacing, symmetry, footers, form controls, calls to action (§4).
- Lead side rebuilt as separate values, with a custom artifact each (§5).
- Page-by-page public changes from the review (§5.6 to §5.9).
- The Georgia assistance engine (§6).
- Client side: money, documents and help areas; clearer sign-in; summary share links; the
  dependency between a sale and a purchase; move-in handoff (§7).
- Agent OS redesign, full rename to Operations, Transactions view, snooze, delegation and
  pinning (§8).
- Seller journey (§9) and the campaign composer (§5.10).
- Money v2 (W10), the approval and outbox mechanism, AI budget controls, document extraction,
  Cal.com, and the other integrations (§10).
- The pilot itself: 3 to 5 real buyers, added by hand (§13).

---

## 2. The product: three experiences

Rift is three experiences sharing one set of data, identity and automation:

```text
                         RIFT
                           │
             ┌─────────────┴─────────────┐
             │                           │
       LEAD SIDE (public)           CLIENT SIDE (portal)
       buyer, seller, abroad        buyer, later seller
             │                           │
             └────────────┬──────────────┘
                          │
                  AGENT OS (Operations)
                          │
                 AI + AUTOMATION LAYER
                          │
   Matrix/OneHome · ShowingTime · Remine · Google · Cal.com · Brevo
```

| Experience | Question it answers | Feel | In one line |
| --- | --- | --- | --- |
| Lead side | "What does my situation mean?" | Expressive, bright, editorial, one custom artifact per value | Discovery + value + personalization + conversion |
| Client side | "What matters for my move today?" | Calm, personal, reassuring, phone-first | Progress + understanding + decisions |
| Agent OS | "What needs my judgment?" | Utilitarian, dense where useful, fast to scan, keyboard-friendly | Control + exceptions + execution |

- **Names.** The agent side is called **Operations** everywhere a user can see it: navigation,
  titles, emails and web addresses. "Agent OS" is the internal name for the architecture.
- **The AI layer is not a fourth website.** Four levels, in order of how much they are trusted:
  workflow automation (deterministic reminders), AI reasoning (turning messy input into a draft),
  tool execution (only through verified integrations), and human decision (judgment, negotiation,
  anything legal or financial). AI prepares and drafts; people decide and approve.
- **Conversion is a state change, not a new record.** Someone who used the lead side and becomes
  a client never starts over (§5.5).
- **Messages and decisions are distinct.** No messaging platform; email and calls stay, and the
  meaningful outcome is recorded.

---

## 3. Principles

Carried from v3 and v4, with Kaleb's review added. Each applies to all three experiences unless
it says otherwise.

1. **Value before contact.** Every tool gives its advertised answer before asking for details.
   Extra functionality beyond that answer may ask for details (decision D14).
2. **Say "no account" quietly.** Mention it subtly once or twice on the whole site, never at every
   turn. (Kaleb, R1)
3. **Simple, and not crowded.** Kaleb likes that the pages are not crowded; keep it that way while
   adding value. (Kaleb, R1)
4. **Symmetry and alignment.** Nothing out of line; paired columns balance; spacing follows one
   system (§4). (Kaleb, R1)
5. **One primary action at a time.** Each screen has one obvious next step: "Get my numbers",
   "Save my plan", "Review these homes", "Record a check". Secondary things sit below it.
6. **Simple first; more is one press away (Kaleb, R3).** Every screen shows the simple answer and
   its one next step. Complexity that cannot be avoided is not removed and not crammed in: it
   goes in a layer on the same screen, behind a press, whose label says what is inside and how
   much. This applies to the whole site: public, client and Operations. §4.8 sets the rule.
7. **Journey first, dashboard second.** Organize around where the person is and what happens
   next, not a grid of widgets.
8. **Education at the moment of need,** never an encyclopedia.
9. **Automation reduces noise.** Clients see decisions, deadlines, exceptions and meaningful
   updates, not a stream of automated tasks.
10. **Honest numbers.** Every figure is computed or sourced, carries its assumptions and date, and
    never overclaims ("potentially eligible", never "you qualify"). No fabricated counts,
    testimonials, activity, match percentages or forecasts.
11. **People keep authority.** AI and automation propose; the agent approves external actions;
    professionals confirm their own facts.
12. **The calls to action must earn the click.** The review found them weak everywhere (Kaleb, R2);
    §4.4 sets the rule.
13. **Avoid becoming** a generic CRM, a giant dashboard, a task app, a document portal, a chatbot
    with real-estate branding, an MLS clone, a pile of calculators, or a lead form in disguise.

---

## 4. Design system, across the whole site

The brand stays: editorial serif headings, warm off-white canvas, restrained palette, strong
charcoal, terracotta for buyers, green for sellers, generous whitespace, large meaningful numbers,
subtle borders. What changes is the discipline around layout and interaction.

### 4.1 Spacing and symmetry (Kaleb, R1)
- One spacing scale and one content grid for every page, with fixed section spacing. No
  one-off margins.
- Paired columns balance: when a short text column sits beside a tall list, the layout changes
  (stack, centre, or give the text a visual) so no empty hole is left. The buyer landing's
  "Seven minutes" section is the reference case of what not to do (§5.7, D3).
- Cards and question boxes align to the grid and are centred with the content above and below
  them. The buyer landing's county box is the reference case (§5.7, D2).
- Symmetry is reviewed on every page at 1280px, 390px and 375px before it ships.

### 4.2 One footer rule (Kaleb, R1)
- Both the front door and the buyer landing have misaligned footers. Every page uses one footer
  component with the same columns, alignment and spacing. The footer's link groups align to the
  content grid, not to the window edge.

### 4.3 Form controls (Kaleb, R2)
- Radio and checkbox circles are clipped on the forms, most visibly on the abroad page ("I have a
  green card or a U.S. visa", "I have an ITIN, not a Social Security number"), probably elsewhere
  too. One option-control component with enough padding, used everywhere.
- Single-choice questions advance on click; there is no Next button (§5.6).
- Money inputs accept any amount (§5.6, E3).

### 4.4 Calls to action (Kaleb, R2)
- "The CTA is poor throughout the entire platform." Every page is reviewed for its one primary
  action: a specific verb about the person's outcome ("See my cash to close", "Check my
  programs"), one visual weight for primary actions and one for secondary, and never more than
  one primary action per view.
- After a value is delivered, the primary action is the next value or "Save my plan" (§5.5).

### 4.5 Custom artifacts (Kaleb, R1)
- Each value (§5.2 to §5.4), and the buying and selling choices on the front door, gets its own
  custom artifact: a visual centrepiece made for that answer, not decoration.
- Artifact language: architectural geometry, home and material forms, data built into the visual,
  crisp typography, restrained bright accents, slow purposeful motion, no stock photography, no
  AI imagery unrelated to the question. Each artifact explains, personalizes or pulls people in;
  the best do all three.
- Examples from v3: a cash-to-close stack that assembles the pieces of cash; a proceeds flow from
  sale price through payoff and costs to "what you keep"; a journey path Prepare to Own.
- Every artifact reads the same computed output as its table and has a text equivalent
  (CAMP-04), and loads after the tool without shifting the layout (QUALITY-03).
- **Decided (D13, 24 Sep):** "artifact" means this custom visual, one made for each value.

### 4.6 Three levels of expression
Public: most expressive. Client: calm and personal. Operations: utilitarian (smaller type,
stronger hierarchy, tables and lists, fewer decorative surfaces). Shared tokens, typography and
icons; different density.

### 4.7 Accessibility and performance
Every redesigned page passes again: WCAG 2.2 AA, keyboard, focus, 200% and 400% zoom, reduced
motion, 375px and 390px with no sideways scroll, 44px touch targets on public and client pages,
and the performance targets in QUALITY-03.

**Checked (25 Sep):** the end-to-end suites (`npm run test:e2e`: WCAG 2.2 AA with axe, no sideways
scroll at 412px and 320px, styling, funnel, smoke) now cover every value page, the how-it-works
pages, the offer upload and a closed summary link, on desktop and phone: 256 passing. Keyboard and
400% zoom are not automated and still need a manual pass.

### 4.8 Layers: simple first, more on request (Kaleb, R3)
- **The screen answers its one question and offers its one next step.** Everything else that
  belongs on the page sits in a layer: `components/rift/Layer.tsx`, closed by default.
- **The label says what is inside and how much**, and carries the one fact worth seeing while it
  is closed: "Who to call · 12 leads, best first", "How this was worked out · 6 figures".
- **Never behind a layer:** a failure, a deadline, a blocker, a figure's headline, or anything a
  rule requires on screen. A layer opens by itself when something inside it needs the person.
- **Opening a layer never changes a figure, never navigates, and closing it loses nothing.** It
  works without script, from the keyboard and on a phone (a 44px row).
- **Where it applies:** the whole site, page by page, in the same pass that checks each page at
  1280px and 390px. **Done (26 Sep):** Operations Today, journey, person record and
  Relationships' forecast; on the value pages, "How this was worked out" and the line-by-line
  breakdowns whose picture already shows the same lines (cash to close, selling costs, what you
  keep, the monthly payment's parts, where the months come from). Tables that answer the page's
  own question stay open ("The two scenarios", "Across three prices", "What your situation
  means"). **Next:** the saved plan page, the client journey pages, the abroad results.

---

## 5. Lead side

The lead side should feel like **question, useful answer, personal insight, deeper answer, saved
plan, relationship**, not "marketing page, form, phone call". The person should be invested in
the experience before being asked to invest in the agent.

### 5.1 Separate values, earned one at a time (Kaleb, R1 and R2)

- Today the landing leads with one value (down payment assistance you may qualify for), and one
  long questionnaire produces a crowded readout with several values mixed together. The
  readout is "very complicated and confusing". (Kaleb, R2)
- **Each value becomes its own component**: its own few questions, its own answer, its own
  artifact.
- Finishing a value shows **only that value**, then "You can also get..." the next one, which
  often needs just one more question. Answers already given are reused, never asked again.
- The landing pages can offer several values as separate ways in.
- **Gating (D14, decided 24 Sep).** The rule: what a person needs to **understand their
  situation** is free; what they need to **act on it, keep it, or be told later** asks for their
  details. That keeps the answer honest (LEAD-01) and asks for details at the moment the person
  gets something extra in return.

  | Always free, no details | Asks for name and email (phone optional unless stated) |
  | --- | --- |
  | Every value's answer, in full, with its artifact and assumptions | **Save my plan:** keep the values, reopen on any device |
  | The programs table, with filter, sort and each program's official source | **Program alerts:** tell me when a program I match opens, changes or runs out of funds |
  | The assistance value: potential matches for their answers, what each checks, and the best potential combined amount | **My assistance plan:** every workable combination, what to do for each program in order, the documents to gather, and which kind of lender takes part, as a saved and printable plan |
  | The next value, reusing earlier answers | **Ask Kaleb to review my numbers,** or **Book a call** (phone required for booking, as §5.9) |
  | Sharing a readout link | **Email me my plan** as a PDF |

  On the programs page this gives the stronger call to action Kaleb asked for (G3): browse
  freely, "See which programs fit me" leads into the free assistance value, and the personal
  plan and alerts are what ask for details. A value's answer is never cut short to force the
  form, and declining leaves everything on the free side working.

**Acceptance for every value:** the answer appears with no contact details asked; only that
value is shown; the next value is offered and reuses earlier answers; the artifact and the text
equivalent show the same numbers; completion is measured without recording answers (§12 of
requirements).

### 5.2 Buyer values

Catalogue drawn from v3 (§5, §46.3, §47) and today's readout. The first set and their order
are decided (D20).

| Value | Question it answers | Inputs (ask only these) | Answer | Notes |
| --- | --- | --- | --- | --- |
| Assistance | "What Georgia programs might help me?" | County, first-time status, then income, household, price, credit, occupation, loan type as each program needs | Potential programs and potential combinations (§6) | Headline stays conditional (MONEY-02) |
| Cash to close | "How much cash do I really need?" | Price, down payment choice, county | Real cash needed, line by line | **Moving is removed** (Kaleb, R1) |
| Monthly cost | "What would I pay each month?" | Price, down payment, rate (weekly Freddie Mac) | Monthly cost across three prices | Taxes, insurance, HOA shown separately (MONEY-04) |
| Timeline | "When could I buy?" | Savings, monthly saving, cash needed | Months to ready, and the two changes that shorten it most | Unknown saving rate never becomes "ready now" |
| Affordability | "How much home fits me?" | Income, debts, comfort payment | A comfort range as a planning scenario | Needs its own tested model first (MONEY-05) |
| Lender questions | "What should I ask a lender?" | Uses earlier answers | Questions written for their situation | Existing readout section |
| Rent vs. buy, first-time roadmap, readiness | From v3 | To define | To define | Later values |

**First order (D20, decided 24 Sep):** 1. Assistance (the strongest reason to start, and the
assistance engine powers it); 2. Cash to close (the site's core idea: the down payment is not the
number); 3. Monthly cost; 4. Timeline. Affordability follows once its model is tested; the rest
come later.

**Built (25 Sep):** "How much home fits my budget?" (`/buy/afford`, MONEY-05: comfortable and
stretch planning scenarios from a tested model) and "What should I ask a lender?"
(`/buy/lender-questions`: questions for their down payment, credit and first-time status, no
answers supplied). Both are offered after an answer and in the footer; the landing keeps D20's four
as its ways in, so the grid stays whole.

### 5.3 Seller values (Kaleb, R2: same lens as the buyer side)

| Value | Question | Inputs | Answer |
| --- | --- | --- | --- |
| Net proceeds | "What would I actually keep?" | Likely price, amount owed, county | Proceeds after payoff and costs (MONEY-06) |
| Selling costs | "What will selling cost?" | Price, county | Each cost, commission as a negotiated input, never a standard rate |
| Unclaimed money | "Am I losing money already?" | County, homestead status | Exemptions and appeal deadlines (existing `/sell/unclaimed`) |
| Preparation | "Should I fix this before listing?" | Condition questions | What is worth addressing, maybe, not yet; no invented ROI |
| Sell first or buy first, move-up | From v3 | To define | To define |

**Built (25 Sep):** the seller landing `/sell` offers the values as separate ways in; net proceeds
at `/sell/proceeds` and selling costs at `/sell/costs`, each with its own questions and drawing.
Commission is asked, and "Not agreed yet" shows a 4% to 6% range rather than a rate. Neither
asks the county, because nothing in a seller's costs changes by county yet; the county returns
when a county tax rate does.

**Built (25 Sep, second slice):** all four seller values are live. Preparation (`/sell/prepare`)
sorts work into worth doing now, maybe and not yet from three condition questions, with reasons
and no dollar return (MONEY-06). Money you may be losing (`/sell/unclaimed`) now asks its
questions one at a time like the others, and no longer suggests an assessment appeal: it used to
compare every visitor's price with a sample house's assessed value, and the old seller readout
suggested an appeal to every seller. `/sell/start` and `/sell/results` answer a 307 to `/sell`,
or to `/sell/proceeds` with the price and payoff the link carried, keeping campaign and
referral tags. The seller questions in Operations' funnel editor no longer have a page (D24).

**First order (D20, decided 24 Sep):** 1. Net proceeds; 2. Unclaimed money (useful even to someone not
selling, and already built); 3. Selling costs; 4. Preparation.

All buyer-side feedback applies to the seller side unless it is buyer-specific: separate values,
no Next button, uncapped amounts, simpler readouts, better calls to action, the footer and
spacing rules, and a rewritten how-it-works page. Seller pages: `/sell`, `/sell/start`,
`/sell/results`, `/sell/unclaimed`, `/sell/how`. This is public-page work and is not held back by
the seller journey's gate (§9).

### 5.4 Buyers abroad (Kaleb, R1 and R2)

- Say **the United States**, not Georgia, where the point is about being allowed to buy: "You
  don't need citizenship, a green card, or a visa to own property in the United States." People
  abroad care about the US and many do not know Georgia. Applies on the front door and every
  abroad page.
- The abroad page is too complicated. Split it into values and do not put everything on one page.
- **Values, in order (D20, decided 24 Sep):** 1. "Can I buy in the United States?" (by residency
  status); 2. What buying and owning would cost; 3. The return, shown only with its estimate
  label until real county rent ratios arrive (§12).
- Collect a phone number, with the existing consent rules for calls and texts (a phone number
  without consent is refused today; keep that).
- Fix the clipped radio circles (§4.3).
- The Amharic for one message (what was kept after a deletion) is owed, and the rent ratios
  behind the return figure are invented estimates (§12).
- **Built (25 Sep):** the three values, each on its own page: `/abroad/can-i-buy` ("Yes", then
  what the status changes: the smallest down payment, the rate on top, what a lender asks for,
  and that cash avoids it), `/abroad/cost` (cash to send and the monthly cost of owning, at the
  recorded rate, no rent), and `/abroad/return` (asks what is missing, then renders the existing
  bilingual readout, rent still labelled an estimate). The English landing links all three.
  **Not done:** the landing itself is still the one long page, because it is the Amharic page
  and the value questions have no Amharic yet (D25). Collecting a phone number here waits on
  the same consent question as booking (D22).

### 5.5 Saving the plan and carrying it into the client side

- **"Save my plan"** replaces the plain email box: the person's values so far, saved as a plan
  they can reopen, with separate choices for being contacted, marketing and booking (PRIV-04,
  LEAD-03).
- **A plan taking shape:** as the person completes values, a small summary builds up (for
  example target price, cash needed, monthly cost, programs to check). It is the thing they
  save.
- **Anonymous progress** on one device expires and can be reset; restoring elsewhere needs a
  claim (LEAD-06).
- **Continuity:** when a saved plan becomes a client journey, its answers prefill the search
  brief with their dates and source, and the client confirms only what is stale or missing
  (LEAD-04).
- **Lead summary in Operations:** each lead shows what they did, for example "Built a $425k plan,
  checked programs, saved cash-to-close, no consultation booked" (v3 §46.7), built from recorded
  actions, never from browsing surveillance.
- **Built (25 Sep):** the one-line summary ("Saved a plan on a $425k plan: cash to close
  $24,788 · no call booked") on each lead in Today and on the person's page, with a chip per
  saved value that reopens it with their answers. It is built only from the saved plan and
  whether they booked; a lead who did neither shows no line rather than an invented one.
- **Built (25 Sep), continuity (LEAD-04):** when a buyer's journey starts, the brief editor starts
  from the newer of their readout and their saved plan: the price as a ceiling and the county as
  the area, dated, sourced, and "Not decided" until they confirm it.
- **Built (25 Sep), deletion and reset:** "Delete all of it" sits at the bottom of every value's
  answer and resets this device's answers and plan (LEAD-06). The saved plan's page deletes by
  its link, so it works from any device: before this, a person who opened their plan from the
  email could not delete it, and sellers had no delete button at all once their readout was
  retired. Restoring progress on another device is Save my plan; there is no other claim path.

### 5.6 Buyer questions (`/buy/start`) (Kaleb, R2)

- **The layout is bad.** The "So far" card on the left is wide, the question column on the right
  is narrow, they do not line up, and most of the screen is empty. Redesign it around one
  centred question at a time, with the running figure placed where it balances the page.
- **No Next button.** Choosing an answer moves straight to the next question. Typed and slider
  answers keep an explicit continue, since they cannot know when the person is done.
- **Amounts are capped.** "What price range are you thinking about?" stops at $700,000; what if
  someone wants $1,000,000? The same limit problem applies to savings ($120,000) and monthly
  saving ($3,000), and on the seller side to price ($1,200,000) and amount owed ($900,000).
  Every amount question must accept any realistic amount, for example a slider for the common
  range plus typing an exact figure.
- With values split (§5.1), each value asks only its own questions.

### 5.7 Front door and buyer landing (Kaleb, R1)

**Front door `/`**
- Put "I'm buying" and "I'm selling" **side by side**, each with its own custom artifact.
- **Delete the three trust points** ("Calculated, not written", "Nothing is held back", "No call
  unless you ask"). They are "just useless". Replace them with something simpler and more
  effective, respecting principle 2.
- Buyers abroad: "United States" wording (§5.4).
- Footer (§4.2).

**Buyer landing `/buy`**
- Delete "Two questions. No account, no email, no phone call."
- (D2) The county and ownership question box is not centred or aligned.
- (D3) Empty space below "Not a brochure and not a callback..." because the left column is short
  and the list on the right is tall.
- (D4) Remove Moving from "What you bring". The same figure ($26,188) is on the front door; both
  change.
- Offer several values, not only assistance (§5.1).
- Footer (§4.2).

### 5.8 Readouts, programs and how it works

**Buying readout `/buy/results`** (Kaleb, R2)
- Too complicated and confusing. Show only the value the person came for, then offer the next.
  The same applies to the seller and abroad readouts.

**Georgia programs `/buy/programs`** (Kaleb, R2)
- Too much information. Make it very simple, more like a **table**, with a **filter** and a
  **sort**.
- Reword "Every Georgia program we track" to something like "Georgia programs".
- The call to action needs work; hold some functionality back until the person creates an
  account or gives their details. Decided in D14 (§5.1): the table and the matches stay free;
  the personal assistance plan and program alerts ask for details.
- The programs themselves come from the assistance engine (§6), shown with "View official
  program source", "Last verified", and the standard caution line.

**How it works** (`/buy/how`, `/sell/how`, `/abroad/how`) (Kaleb, R1)
- They read like a legal document or a privacy policy. Rewrite them to explain the process and
  the value Rift gives.
- The only money message: **you pay Rift nothing**; the only fees are the ones any transaction
  has, such as agent fees. No other talk about money.
- **Built (25 Sep):** all three rebuilt on one layout (`components/rift/site/HowItWorks.tsx`):
  the steps from first question to keys, the values available today (from the catalogue), the
  one money line, one call to action, and a link to `/privacy` for what is kept. The abroad page
  keeps its English-only notice, names tax and ownership questions with the adviser who answers
  them, and labels the return as an estimate.

### 5.9 Submit an offer and book a call

**Submit an offer `/offer`** (Kaleb, R2)
- Heading becomes **"Submit an offer"**, replacing "Submit an offer on any Georgia address. And
  see what it is actually worth to the seller before you send it. No account, nothing to
  install, and the arithmetic is yours whether or not you press send."
- **Start with the upload:** "Upload your offer in PDF". Rift reads the PDF and fills in the
  boxes; the sender reviews, edits if needed, and presses submit. Extraction follows DOC-02:
  candidate values with their place in the document, a person confirms, a failed read leaves a
  manual form. It needs AI with a cost limit (AUTO-06, D16).
- **Fields:** remove "Repair credit asked"; remove "Brokerage (optional)"; choosing "Other" for
  financing requires saying what it is; **add due diligence days**.
- **Sending is required:** remove "Send it to Kaleb. Optional. The arithmetic above is yours
  either way." The sender must say whether they are "a real estate agent" or "the buyer", and
  phone is required.

**Built (25 Sep):** heading "Submit an offer"; repair credit and brokerage removed; "Other"
financing must say what it is; due diligence days added (0 to 60, empty means not said);
sending is the point of the page, so "Optional" is gone; the sender says "I'm a real estate
agent" or "I'm the buyer", with nothing preselected; phone required, and still passed on with
the offer only, never stored for marketing. Migration `20260927000000_rift_offer_terms.sql` adds
the two columns; Operations → Offers shows them.

**Built (25 Sep), the upload:** "Upload your offer in PDF" at the top of `/offer`. Claude reads
it into the boxes, each filled box shows the page and exact words it came from, and sending
needs a tick that the sender checked them (DOC-02). Anything that fails, or no key, or the
month's budget spent, leaves the manual form with a sentence saying why. The $50 monthly AI
limit is enforced in code with a ledger (`rift_ai_usage`, AUTO-06). Needs `ANTHROPIC_API_KEY`
and the migration `20260927010000_rift_ai_usage.sql`; the model is Claude Opus 5 until
extraction accuracy tests on real offers show a smaller one passes (D16).

**Book a call `/book`** (Kaleb, R2)
- The form is not centred.
- Field order: name, phone, email, then time.
- "When suits you?" becomes **"What time works best for you?"**
- **Built (25 Sep):** one centred column; fields in the order name, phone, email, then time;
  "What time works best for you?"; the shared footer. **Open:** §5.1 says phone is required to
  book, but a phone number is refused without the call-and-text consent box, and that consent
  says it is "not a condition" of anything. Requiring a phone to book would make the consent a
  condition. Kaleb to decide (see §11).
- **Real times from Cal.com** (decided 24 Sep): free plan, connected to Kaleb's Google Calendar,
  so bookings appear there. Rift already has the Cal.com adapter; it needs `CAL_API_KEY` and
  `CAL_EVENT_TYPE_ID`. Until then the page asks for a preferred time.

### 5.10 Campaigns (later)

From v4 (CAMP-01 to CAMP-05) and v3 §46.6: landing pages as recipes of approved blocks, including
the custom artifact block, composed in Operations; AI may draft a recipe, never code; preview,
validate, publish and roll back. Start with one buyer recipe on the assistance path; the general
composer comes after. Campaign data flows into the lead summary (§5.5). **Waits for** the value
components (§5.1), because campaigns are built from them.

---

## 6. The Georgia assistance engine

Kaleb's design (R1). For a Georgia-only product it replaces building on several national down
payment assistance providers.

### 6.1 The idea
- An earlier plan combined Freddie Mac DPA One, possibly Down Payment Resource (DPR), and a
  Rift-maintained specialty database. DPA One offers a central database and API for government
  and housing-agency programs; DPR keeps a larger national database and sells integrations.
- The problems: API access, licensing, cost, duplicate programs, conflicting data, and dependence
  on outside providers.
- Instead, build **one normalized Georgia database**:

```text
                    RIFT
          Georgia Assistance Database
                       │
        ┌──────────────┼──────────────┐
        ↓              ↓              ↓
 Government/HFA     Banks & CUs     Other Programs
        │              │              │
 GA Dream          Bank grants      Builders
 Counties           CRA programs     Employers
 Cities             Credit unions    Nonprofits
 Housing Auth.                      Special programs
        │              │              │
        └──────────────┼──────────────┘
                       ↓
             ~50–100 Programs
                       ↓
              Eligibility Engine
                       ↓
                  Buyer Profile
                       ↓
        Potential Programs + Stacking
```

- **Start** with the roughly 25 Georgia programs already found through DPR, DPA One, Georgia DCA
  and similar sources. **Then** use automated research to find the harder ones: banks, credit
  unions, counties, cities, housing authorities, nonprofits, employers and builders.

### 6.2 One standard record per program
- Program name and provider; assistance amount; type (grant or loan) and repayment or
  forgiveness terms; where it applies; income and purchase-price limits; minimum credit score;
  first-time buyer requirement; eligible loan types; occupation requirements; deadlines and
  funding availability; official source and last-checked date; whether it combines with other
  programs, where known.
- Fields for keeping it current:

```text
official_source_url
discovered_date
last_verified_date
next_review_date
program_status
application_deadline
funding_status
source_type
```

- *Engineering note:* the existing registry (`lib/core/registry.ts`, the stale-program rule and
  the freshness setting) is extended into this record, not replaced, so today's "withheld because
  not verified" behaviour carries over.

### 6.3 Matching is the product, not the database
The buyer enters their details:

```text
Purchase Price:     $375,000
Location:           DeKalb County
Income:             $82,000
Household:          2
Credit:             720
First-time buyer:   Yes
Occupation:         Teacher
Loan:               Conventional
```

Rift checks them against each program's rules and returns potential matches, with what fits and
what still needs checking:

```text
POTENTIAL MATCHES

Georgia Program A
Potential assistance: $10,000
✓ Income
✓ Location
✓ Purchase price
✓ First-time buyer

Bank Program B
Potential assistance: $7,500
✓ Location
✓ Income
△ Additional lender requirements

County Program C
Potential assistance: $15,000
✓ Geography
✓ Income
△ Funding availability must be confirmed
```

- These inputs are asked only as the assistance value needs them (§5.2), and they are private
  product data, never analytics (PRIV-01). Occupation is used only where a program itself
  requires it.

### 6.4 Combining programs
- Show combinations that could work together, not just a list:

  > Potential assistance combination: Program A + Program B.
  > Potential combined assistance: $17,500.
  > Compatibility and current availability must be verified.

- A combination appears only when both programs' recorded rules allow it; unknown compatibility
  is shown as unknown. The public headline still counts assistance as 0 (MONEY-02).

### 6.5 Keeping it current: two jobs
- **Monitoring:** revisit each program's official page monthly or quarterly, not every six to
  twelve months, because limits, funding and rules change faster than that. No staff needed:

```text
Initial Deep Research
        ↓
Discover 50–100 programs
        ↓
Human/AI structure information
        ↓
Rift Database
        ↓
Save official source URLs
        ↓
Periodic automated checks
        ↓
Page unchanged? ──────→ Do nothing
        │
      Changed
        ↓
AI compares old/new
        ↓
Flag record
        ↓
Update / review
```

- **Discovery:** a deeper search of all of Georgia every 6 to 12 months, only for programs not
  already in the database.
- A flagged change is reviewed by a person before the record changes (AUTO-05). A check that
  fails is visible in Operations like any other scheduled job (QUALITY-04). AI cost is capped
  (AUTO-06, D16: within $50 a month for the pilot).

### 6.6 Facts from official sources, not other databases
- Facts such as maximum amounts, limits and deadlines are generally not protected just because
  another database collected them. But another company's compilation, descriptions, categories,
  API output or terms-restricted content can raise contract or copyright problems.
- So Rift collects facts from the administering organization's own public pages and does not
  copy DPR's database:

```text
DPR tells us:
"Program XYZ exists"
          ↓
Rift finds:
Official Program XYZ website
          ↓
Rift extracts facts from
the primary source
          ↓
Rift database
```

- This also records exactly where each fact came from.

### 6.7 How each program is shown
- A "View official program source" button and "Last verified: September 2026".
- "Program terms and funding availability may change. Confirm current eligibility with the
  program administrator or participating lender before relying on this information."
- Never "you qualify": say "Potentially eligible" or "Likely match based on the information
  provided". Lenders and program administrators decide.

### 6.8 Where DPA One and DPR fit
- Discovery and reference tools only, not APIs Rift depends on. Each Rift record points back to
  the organization that runs the program.
- Result: no API dependency or recurring API cost; a Georgia-only dataset small enough to manage;
  specialty programs competitors may miss; full control of matching and combining.
- If Rift expands to other states (Florida, Texas, North Carolina and so on), a commercial API or
  data licence starts to make sense then.
- For the Georgia-only first version: a small, high-quality dataset, with the engineering effort
  spent on matching and combining rather than national data infrastructure.

**Acceptance:** every shown program has an official source and a last-verified date; a program
past its review date is withheld with the reason shown; no combination is shown without both
programs' rules allowing it; "qualify" never appears; the programs table filters and sorts; a
failed monitoring check shows in Operations.

---

## 7. Client side

### 7.1 Built
Invitation sign-in and household scopes; Today in the fixed order (blockers, decisions, own
tasks, what others are doing); search priorities with "These are right", "Something should
change" and "Make the change myself"; homes with reactions and "Would like to see it"; showings
and the after-showing answer; offer answers per version; checked contract dates; earnest money
as "sent, not confirmed received"; "You own your home" only after a confirmed closing; the
printable records page. Stage contracts B00 to B20 are in [journey-contracts.md](journey-contracts.md).

### 7.2 To build
- **The same UI and UX lens as the public site** (Kaleb, R2): the client pages were not reviewed
  for design; they get the §4 rules and a calm, phone-first pass.
- **Navigation from v4:** Today, Homes, Journey, Money, Documents, with Help always reachable.
  Today there is one journey page and a records page.
- **Money area** with money v2 (W10, §10.1).
- **Documents area**: every document shared with them in one place, not only through offers.
- **Help**: how to reach the agent and what happens next, on every page.
- **Selected read-only summary links** for someone outside the household (ACCESS-02).
- **A sale linked to a purchase** shows the dependency and its owner (STATE-07).
- **Move-in handoff** (B19): utilities, keys, address changes, and county homestead and tax
  dates from maintained official sources.
- **Ownership records** (B20) later: maintenance and warranty records, with retention approved
  first.
- **Side-by-side home comparison** (SEARCH-05) once W10 provides monthly scenarios.
- **Check the no-match state** (SEARCH-09).

**Built (25 Sep):** the areas across the top of every journey page (Today, Homes, Search, Offers,
Documents, Records; a seller sees Today, Documents and Records), and **Help** on every signed-in
page: how to reach the agent, what happens next, what to do when something looks wrong. The
**Documents area** lists everything shared with the member, newest first: the agent now shares any
document from the journey page with everyone in the household or only those who see money (the
default for offers, contracts, appraisals and lender papers), recorded as history in
`rift_document_shares` (migration `20260927020000`). Offer documents a member was asked about
still appear. The list, the records page and the open link use one rule.

**Built (25 Sep), summary links (ACCESS-02):** from the records page, a member who can answer for the
household makes a read-only link for someone outside it: where the move stands, the checked
contract dates, and/or the homes and showings, for 7, 30 or 90 days, never any money. The link is
shown once, stored only as a hash, and can be stopped. Migration `20260927030000`.

**Built (25 Sep), move-in handoff (B19):** "Add the move-in steps" on the person's plan in
Operations adds six first-weeks steps (utilities, locks and codes, address changes, closing papers,
homestead, HOA), each with an owner and no date, and never twice. The homestead step names the
tax commissioner as holding the deadline: Rift has no maintained county source for it yet (§12),
so the agent adds the date after checking it.

### 7.3 Signing in (Kaleb, R2)
- Kaleb could not get into the buyer portal: no email came. Cause: no invitation existed, and
  the sign-in page sends nothing to an uninvited address without saying so.
- Make the path clear without revealing who is a client: the sign-in page explains that access
  starts with an invitation from the agent and what to do if no email arrives; the agent's
  journey page makes "invite the household" an obvious first step.
- **Checked (25 Sep): built.** The sign-in page explains that access starts with an invitation and
  what to do when nothing arrives; a journey with nobody invited opens with "First step: invite
  the buyer".

---

## 8. Agent OS (Operations)

**A major UI and UX redesign.** The agent pages were not redesigned in v4 and look unchanged
(Kaleb, R2). The layout below is **engineering's proposal**, built from v3 §0.3, v4 §9 and what
the live pages show. **How it gets approved (D15, agreed 24 Sep):** before any real Operations
screen is rebuilt, engineering makes a clickable mock-up of the new layout with made-up data.
Kaleb clicks through it and says what to keep or change; only then is it built for real. This
costs days, where building the wrong layout would cost weeks.

### 8.1 What is wrong today
- **The name.** Addresses are still `/studio/...`, the emails say "Open them in Studio", and two
  setting descriptions say Studio. (Kaleb, R2)
- **Today is the old lead list.** It ranks leads and lists queues, but is not organized around
  "what needs my judgment". Journey work, deadlines and failed jobs are mixed into the lead view.
- **The journey page is one very long page** with nine stacked sections (brief, what changed,
  Matrix search, household, homes, showings, offers, where it stands, dates). Finding one thing
  means scrolling past everything else.
- **No view across deals.** There is no Transactions view of every contract with its workstreams
  and dates.
- **It looks like the public site.** Same editorial serif and spacing, where Operations should be
  compact and utilitarian.
- **Navigation** is a top bar of seven items plus three buttons that barely fits at 1280px.
- **Missing tools:** snooze, delegation, pinning, persistent filters, keyboard shortcuts, a quick
  switcher, detail panels that keep your place.

### 8.2 What Operations must answer, at a glance
1. What needs my attention now?
2. What needs my approval?
3. What is happening today?
4. What is waiting on someone else?
5. What deadlines are coming?
6. Which leads or clients changed?
7. What did Rift do on its own, and did anything fail?

### 8.3 Navigation (proposal)
- A **left sidebar**, stable on every page, collapsible, replacing the top bar:
  - **Today**
  - **Relationships** (leads and clients)
  - **Search**
  - **Transactions** (new)
  - **Offers**
  - **Calendar**
  - then, smaller: **Reviews and referrals** (was "Advocacy"), **Reports** (the pilot report and
    funnel figures), **Campaigns** (later), **Lead-form questions** (was "Questions"), **Settings**.
    Renamed in the third mock-up: Kaleb could not tell what the old names were for.
- "Add someone" as a single primary button in the sidebar.
- A **quick switcher** (Cmd+K) to jump to any person, journey or page, and keyboard shortcuts for
  the common actions. The prototype at `/prototype/studio` already has a palette to start from.
- Full rename: every address moves to `/operations/...` with permanent redirects from
  `/studio/...`; emails and settings text say Operations.

### 8.4 Today (proposal)
Five groups, each item saying why it is there, who owns it, what it relates to, its evidence, its
due time and its next action:
- **Needs attention:** passed contract dates, failed jobs, overdue items, buyer requests past
  the same-day promise, disagreements in a household.
- **Needs your approval:** drafts and prepared actions waiting for the agent (AUTO-01), search
  updates to approve, flagged program changes (§6.5).
- **Today:** showings, calls, closings, inspections, bookings.
- **Waiting on others:** lender, attorney, buyer, other agent, with last update and when to check
  in.
- **Upcoming:** dates and milestones in the next two weeks.
- A **Recent activity** strip: meaningful changes across the business, not every event.
- New leads and "Call today" leads stay prominent, with the 15-minute reply target (D07a keeps
  the instant new-lead alert).
- Snooze with an owner and a resume time (never moving a contract date), delegate with
  acceptance, pin with a reason and expiry (OPS-02).

### 8.5 Relationships (proposal)
- A table: name, side, stage, next action and due date, last contact, source. Search, filters
  that persist, sort.
- Opening a person opens a **detail panel** beside the list, so the agent keeps his place; a
  full page is one click further.
- The person view leads with the lead summary (§5.5), then journeys, plan, decisions, agreement,
  history.

### 8.6 The journey workspace (proposal)
- Replace the long page with a **workspace**: a fixed header (name, stage, status, next action,
  household) and tabs:
  - **Overview:** next actions, blockers, key dates, recent activity.
  - **Search:** brief, what changed and who agrees, Matrix record.
  - **Homes and showings.**
  - **Offers and documents.**
  - **Contract:** where it stands, workstreams, dates.
  - **History.**
- Every write keeps today's rules (history-only records, request IDs, server checks).
- **The process is a checklist that gets executed (Kaleb, review of the second mock-up).** Each
  stage opens its steps, taken from the journey contracts (B01 to B20, S01 to S18), and every step
  says who does it: Rift on its own (internal work only), Rift preparing it for the agent's
  approval (anything a client or outside party sees, AUTO-01), the agent, the transaction
  coordinator, the client, or an outside professional. Ticking a step records who and when; a
  step another party must confirm asks who confirmed it (rule 9), and a client's "done" is a
  report (UX-02). Sending an agreement, presenting an offer and a price opinion are the agent's
  in every mode. Who does each step is set once in Settings, Checklists, for every client; a
  journey can add a step of its own. The ten workstreams are steps too, so Transactions and the
  checklist read the same. Source: `lib/prototype/ops-playbook.ts`, tested in
  `lib/core/ops-playbook.test.ts`.

### 8.7 Transactions (new, proposal)
- Every contract in one table: property, client, stage, next deadline, workstreams at a glance
  (a small status for each of the ten), and anything blocked or unconfirmed.
- Opens straight to the journey's Contract tab.

### 8.8 The other pages
- **Search:** keep, restyle as a table; add "update pending" filters.
- **Offers:** inbound offers from `/offer`, now with the uploaded PDF and extracted terms (§5.9).
- **Calendar:** real Cal.com bookings alongside dates and showings.
- **Reports:** the pilot report plus funnel and value-ladder figures.
- **Settings:** sections down the side with real controls and a save bar: profile and hours,
  team (what the coordinator can do), automation (the three modes, each workflow, what is always
  the agent's), checklists (who does each step), leads and emails, connections, privacy.
- **Lead-form questions:** keep; say on the page what they are and that they never reach a figure.

### 8.9 Look and feel
- Utilitarian: sans-serif interface type, smaller scale, dense tables, clear hierarchy, few
  decorative surfaces, consistent status chips with words and icons.
- Works on a phone for the urgent things (Today, a person, a journey's next action), and
  everything by keyboard.
- Same accessibility bar as the rest (§4.7).

**Mock-up ready for Kaleb (25 Sep), second version the same day:** `/prototype/operations`,
made-up data, nothing saved. Open it with `npm run dev`, or on a preview deployment with
`RIFT_INTERNAL=1` set at build time (prototype pages are hidden in production otherwise). Kaleb
said the first version was already better than the live pages and asked for an audit; the
second version is the result, and its "What changed" button lists each change so the review
can accept or reject them one by one. The main ones: a one-line summary answering the seven
questions above; one strong button per screen instead of one per item; Done, three snooze
times, delegation and a pin on every item; Waiting on others with last heard and when to chase;
a clock that agrees with itself (tested); sortable Relationships that turn into cards on a
phone; the person panel in §8.5's order; on the journey, the stages are the navigation (Kaleb asked
for simpler: a stage track plus six tabs became one clickable track, each stage opening
what happened, what is happening, or what comes next, and "Whole story" showing it all);
a breadcrumb and who else is on the deal; a workstream grid on Transactions; expiry countdowns on Offers;
sketches of Search, Advocacy, Reports, Questions and Settings; and keyboard shortcuts (g then
a letter, j and k, e, ?). What to look at: Today at 1280px (every group's heading and first
item on one screen), opening a person from Relationships and coming back, a journey's tabs,
Transactions, clicking through a journey's stages, and Cmd+K. Say what to keep or change; the real screens are rebuilt only after
that (D15).

**Third version (26 Sep), from Kaleb's review of the second:** Today and Offers were
overwhelming, Full page on a person should open their journey, the journey was overwhelming and
should run as a checklist (above, §8.6), Settings did not look like settings, and Questions and
Advocacy did not say what they were. So: Today is one "Needs you" list with the day's schedule
and the coordinator's list beside it, and waiting, coming up and what changed are closed until
opened; the journey is the stage track and that stage's checklist, with the brief, homes,
offers, dates and history in closed sections and contact, team and notes in the header; Full
page opens the journey (a person with no journey keeps a page of their own); Offers is one card
per offer leading with what reaches the seller, its expiry and one action; Settings as above;
the two pages renamed and explained. The page's "What changed" button lists each change.
Answered by the review: the transaction coordinator is real, so delegation to them stays.

**Being built (26 Sep, Kaleb: "you can start implementing").** The review of the third version
approved the direction. Built so far: the sidebar on every Operations page (phone: a Menu
button), the names that say what each page is, sans-serif Operations headings, and Today as one
"Needs you" list (failed jobs, contract dates, people past the reply target, actions due,
sellers' choices, agreements running out, a stale rate or program, figures to check, follow-ups
that need him) with everything else in layers: follow-up, who to call, the week, everyone being
worked, started-not-finished, where people stop. The journey page is layered, and has the
checklist ("What needs doing", 28 Sep): the stage track, each stage's steps from the journey
contracts, who does each, and where it stands (`lib/core/checklist.ts`, one table,
`rift_step_marks`, migration 20260928000000). Differences from the mock-up, on purpose: a Rift
step that does not run yet shows as the agent's, "until Rift can" (UX-04: no claim without a
live monitor; today only the lead summary, the quiet-party flag and, for sellers, taking and
ranking offers run); a passed stage's unrecorded steps say "not recorded" instead of being
assumed done; coordinator steps say Coordinator but anyone signed in records them, since
coordinator accounts do not exist yet; and who does each step is not yet editable in Settings.
Next: Relationships as a table with a side panel, Transactions, Offers as cards, Settings as
sections (with Checklists and Team), coordinator accounts.

**Acceptance:** the seven questions in §8.2 are answered from Today without scrolling on a
1280px screen; no user-visible "Studio" remains and every old address redirects; returning from
a detail keeps the list position and filters; every item on Today names its owner and next
action.

---

## 9. Seller journey

- The seller's private journey (stages S00 to S18 in [journey-contracts.md](journey-contracts.md))
  and seller stages in Operations wait until the buyer pilot shows results (D08). They share the
  buyer foundations already built: journeys, households, offers, documents, dates, workstreams.
- The seller **public pages** are improved now with the buyer side (§5.3); only the private
  journey waits.
- Includes: seller Today; pricing strategy with the agent's approved opinion (no generated
  valuation); preparation plan; listing assets; launch; showings and feedback with honest
  denominators; weekly performance review; offer review (the existing offer room and "your
  take"); negotiation; under contract; final proceeds reconciled to the official statement;
  post-sale. And a sale linked to a purchase (STATE-07).

---

## 10. Platform: money, automation, integrations

### 10.1 Money v2 (W10)
Starts once the pilot starts (D11). The ledger in MONEY-03: estimated total buying budget; needed
before closing; estimated remaining funds at settlement; suggested reserve; official cash to
close from the closing document. Old snapshots keep their meaning. Acceptance AT30 to AT33. The
moving-cost removal (§5.7) happens before W10, on the public figure only.

### 10.2 Approvals, outbox and AI controls
Needed before any integration writes or any AI draft is used:
- The approval and outbox mechanism (AUTO-01, AUTO-02).
- AI cost limits per workflow and per month, with manual entry when they run out; model and
  prompt versions recorded; no training on private data (AUTO-06). Pilot budget: at most $50 a
  month on AI and integrations (D07).
- **Provider (D16, decided 24 Sep):** Anthropic's Claude API, on the smallest model that
  passes each job's accuracy tests (Haiku 4.5 for comparing program pages, a larger model only
  where offer extraction needs it). A hard monthly limit of $50 across all AI use for the pilot,
  enforced in code, with manual entry when it is reached. Kaleb may raise the limit later.
- First AI uses: offer PDF extraction (§5.9), program page monitoring (§6.5), optionally turning
  an agent's notes into a draft search brief (v4 §3.2: candidates with source spans, never a
  ready search).

### 10.3 Integrations

| Tool | Status | Next step |
| --- | --- | --- |
| Cal.com | Adapter built; not connected | **Decided:** connect on the free plan to Kaleb's Google Calendar (§5.9) |
| Brevo | Live (follow-ups, alerts, summary) | Authenticate a custom sending domain (DKIM, DMARC) before real clients |
| Supabase sign-in email | Live | Check the sending limits during the pilot |
| Matrix/OneHome | Manual path built | Confirm the account's write rights (D02) before any adapter |
| ShowingTime | Manual path built | Confirm integration rights (D02) |
| Remine | Manual path built | Confirm export or API rights and broker policy (D02, D06) |
| Google email and calendar | Not connected | Only after choosing scopes and account (D02) |
| MLS data | None | Licence fields, media, caching and AI use separately |

### 10.4 Standing engineering rules
Carried from v4 and the build so far: pure rules in `lib/core`, database access in `lib/db`,
typed results; every write has a request ID and replays safely; history-only tables; row-level
security and non-owner tests with every table; additive migrations; a release switch for each
release; no secrets in `NEXT_PUBLIC_`; verify on the live site after each deploy.

---

## 11. Decisions

### Settled

| ID | Decision | Settled |
| --- | --- | --- |
| D01 | Complete the buyer journey first, with shared seller foundations | 22 Sep |
| D03 | Email sign-in for private documents and decisions; selected read-only summaries by link | 22 Sep |
| D04 | Automation prepares drafts and internal reminders; the agent approves external actions. Rift sends buyers only sign-in links; the agent sends invitations himself | 22 to 23 Sep |
| D05 | No import; Rift has no real clients yet, so each client is added by hand | 23 Sep |
| D07 | Conservative pilot: business hours, same-business-day replies, one morning summary instead of instant journey alerts, 3 to 5 buyers, at most $50 a month on AI and integrations | 23 Sep |
| D08 | The old traffic gate is set aside for the buyer journey; the seller journey waits for pilot results | 23 Sep |
| D10 | Buyer search (preferences into Matrix) is the first useful slice | 22 Sep |
| D11 | The v4 money ledger and labels are adopted; W10 follows the pilot's start | 23 Sep |
| D12 | Review requests are the same for everyone; service recovery is separate | 23 Sep |
| D17 | Georgia assistance comes from Rift's own database built from official sources; DPA One and DPR are discovery tools only (§6) | 24 Sep |
| D18 | Booking uses Cal.com's free plan with Kaleb's Google Calendar | 24 Sep |
| D19 | Blueprint v5 is the only source of truth for planning | 24 Sep |
| D07a | **Keep the two instant alerts**: a new lead from the public site, and a seller choosing an offer. Everything else stays in the morning summary, which also lists new people, so nothing is missed. Why: how quickly a new lead hears back strongly affects whether they become a client, and a seller's chosen offer has a deadline attached; both are rare enough not to become noise. Buyer journey activity stays summary-only, as D07 set. The 15-minute "Call today" target stays | 24 Sep |
| D13 | A custom artifact is a custom visual made for each value (§4.5) | 24 Sep |
| D14 | Understanding is free; keeping, acting and alerts ask for details (table in §5.1) | 24 Sep |
| D15 | The Operations layout is approved by clicking through a mock-up before it is built (§8) | 24 Sep |
| D16 | Claude API, hard limit $50 a month across all AI for the pilot, raised later if needed (§10.2) | 24 Sep |
| D20 | The first values, in order. Buyer: assistance, cash to close, monthly cost, timeline. Seller: net proceeds, unclaimed money, selling costs, preparation. Abroad: can I buy in the United States, cost to buy and own, the return (§5.2 to §5.4) | 24 Sep |
| D21 | Design and lead side first (phases 1 to 3 together), the Operations mock-up alongside; the pilot starts whenever Kaleb has 3 to 5 buyers ready (§13) | 24 Sep |

### Open

| ID | Question | Why it matters | Who |
| --- | --- | --- | --- |
| D02 | Integration rights for Matrix/OneHome, ShowingTime, Remine and Google, on Kaleb's accounts | No adapter is built without them; the manual paths stay | Kaleb with vendors and broker |
| D06 | The broker's written rules: when a buyer agreement is required, offer presentation, forms, record holds (F16), advertising and text consent, funds instructions | Today's rules stay until answered. Deferred by Kaleb until after testing | Broker |
| D09 | Confirm the first release's scope with the broker (Georgia resale, financed and cash, several buyers, restarts; new construction, estates, trusts and short sales as manual exceptions) | Deferred with D06 | Kaleb and broker |
| D22 | Is a phone number required to book a call (§5.1 says yes)? If so, is the call-and-text consent required with it, or is a manual call-back about the booking allowed without it? | Today a phone is refused without consent, and the consent says it is not a condition of anything | Kaleb, with D06 on text consent |
| D25 | Amharic for the abroad value questions and answers, written by a speaker. Until it exists the Amharic landing stays one page and the separate values are English only | §5.4 asks for the split on every abroad page; machine translation is ruled out | Kaleb |
| D24 | The seller funnel in Operations' question editor no longer renders anywhere, since `/sell/start` forwards to the values. Keep its custom questions for a later "ask Kaleb" step, or retire the seller funnel from the editor? Rule 5 still holds either way: custom questions never reach a figure | Otherwise Kaleb can edit questions nobody sees | Kaleb |
| D23 | The commission range shown when a seller has not agreed one (built as 4% to 6%), and whether the front door's seller example (5.5%) and the offer page's assumption (6%) should show a range too | MONEY-06: commission is negotiated, never a standard rate | Kaleb |

---

## 12. What only Kaleb can supply

Engineering never invents these; until they arrive the product says so on screen.
- The broker's written rules (D06, D09). Raise after testing, as Kaleb asked.
- Integration rights (D02).
- County rent-to-price ratios for the abroad return figure (today's are estimates, and the
  Amharic still claims they are county averages).
- The Amharic for the deletion "kept" message, and a native review of the whole Amharic
  translation.
- Licence number and phone for the agent profile.
- The 3 to 5 pilot buyers, added by hand.
- Cal.com account and API key (§5.9); a custom email domain for Brevo before real clients.
- Confirmation that the test data created during the review can be cleared.

---

## 13. Delivery order

Decided (D21, 24 Sep): design and lead side first. Each phase ships in reviewable pieces, tested, migrated and
verified on the live site as before.

| Phase | Work | Needs first |
| --- | --- | --- |
| 0. Housekeeping | Full rename to Operations with redirects; connect Cal.com; clearer buyer sign-in (§7.3); clear the test data | Cal.com key |
| 1. Design system | Spacing and grid, footer, form controls, call-to-action rules, artifact language (§4) | Nothing (D13 settled) |
| 2. Lead side | Values split and questionnaire rebuilt (§5.1, §5.6); front door and buyer landing (§5.7); readouts, programs table, how it works (§5.8); offer upload and book page (§5.9); seller and abroad with the same lens (§5.3, §5.4); Save my plan and continuity (§5.5) | Nothing (D20 settled) |
| 3. Assistance engine | Program records from official sources, matching, combinations, monitoring and discovery (§6) | Nothing (D16 settled) |
| 4. Agent OS | Mock-up, Kaleb clicks through it, then build the redesign (§8) | Kaleb's review of the mock-up |
| 5. Pilot and client side | Run the pilot with 3 to 5 buyers; client side design pass and missing areas (§7); money v2 (W10) once the pilot starts | Pilot buyers |
| 6. Seller journey and campaigns | After pilot results (§9, §5.10) | D08 evidence |

Phases 1 and 2 go together (the design rules are applied as the pages are rebuilt). Phase 3 can
run alongside phase 2, since the assistance value depends on it. Phase 4 can start its prototype
during phase 2. The pilot (phase 5) can start any time the agent is ready, since the client
journey is live; running it before phase 4 means piloting on today's Operations screens.

---

## 14. Change log

| Date | Change |
| --- | --- |
| 28 Sep 2026 | The journey checklist, built: steps, who does each, marks with who and the day (§8.6; migration 20260928000000) |
| 26 Sep 2026 | Principle 6 and §4.8: simple first, more one press away (layers), site-wide. Operations: sidebar on every page; Today rebuilt as one list with layers (§8) |
| 26 Sep 2026 | Operations mock-up, third version: the journey as an executed checklist with who does each step, a simpler Today and Offers, real Settings (§8) |
| 25 Sep 2026 | Operations mock-up, second version from an audit against §8 (D15) |
| 25 Sep 2026 | Accessibility and phone-width suites extended to every new page; four defects fixed (§4.7) |
| 25 Sep 2026 | Buyer values: how much home fits (MONEY-05) and lender questions (§5.2) |
| 25 Sep 2026 | No-match state: which must-haves limit the search (SEARCH-09) |
| 25 Sep 2026 | Move-in handoff steps (B19) |
| 25 Sep 2026 | Read-only summary links for someone outside the household (ACCESS-02) |
| 25 Sep 2026 | Client side: areas, Help on every page, Documents area with agent sharing (§7.2) |
| 25 Sep 2026 | Operations mock-up for Kaleb's review (§8, D15) |
| 25 Sep 2026 | Offer PDF upload with Claude, and the $50 AI limit in code (§5.9, §10.2) |
| 25 Sep 2026 | A saved plan starts the buyer's search brief (LEAD-04) |
| 25 Sep 2026 | Delete all of it on every answer and by a saved plan's link; §7.3 confirmed built |
| 25 Sep 2026 | Lead summary in Operations from the saved plan and booking (§5.5) |
| 25 Sep 2026 | Abroad values: can I buy, cost to buy and own, the return (§5.4); answer chips wrap on phones |
| 25 Sep 2026 | Seller values complete: preparation, unclaimed money rebuilt, old seller pages forward (§5.3); a monthly-saving figure no longer counts as a referral |
| 25 Sep 2026 | How it works rewritten for buyers, sellers and abroad (§5.8) |
| 25 Sep 2026 | Submit an offer and Book a call rebuilt to §5.9; the phone-for-booking question opened |
| 25 Sep 2026 | Seller values, first slice: `/sell` landing, net proceeds and selling costs (§5.3) |
| 24 Sep 2026 | D20 (first values and their order) and D21 (design and lead side first) settled; building starts |
| 24 Sep 2026 | Decisions D07a, D13, D14, D15 and D16 settled; gating table added to §5.1 |
| 24 Sep 2026 | v5 created from blueprint v4, the original v3 blueprint, and Kaleb's live review (R1, R2). v4 archived. Test feedback merged and the file deleted. Journey contracts moved into this folder; v4 requirements carried into requirements.md with their status |
