# Manual review, 5 October 2026: implementation plan

Kaleb reviewed every public page by hand on 5 October. This document turns that review into
engineering work: what changes, where in the code, and how we know it is done. It also covers
the three investigations he asked for: the client sign-in journey, Operations, and the client
portal.

**Nothing here has been built.** This is the plan. Per AGENTS.md, the decisions in §1 should be
answered, or parked in `docs/handoff.md` §8, before the work that depends on them starts.

**How this was gathered:**
- Kaleb's written review (every page item below comes from it).
- The code at `2558872` (main, after PR #11), read for each page and flow.
- The existing audits in this folder (`platform-2026-10.md` and the four page audits), so nothing
  already listed there is listed again as new.

**Not checked:** the live site, the production database, Supabase Auth logs, and Brevo logs.
Where a cause below could only be confirmed with one of those, it says so.

**Labels:**
- **Priority.** P0: broken now. P1: a real gain the review asked for. P2: polish.
- **Size.** S: under a day. M: one to three days. L: more than three days.
- **Owner.** Eng: engineering alone. Kaleb: needs his answer. Broker: needs the broker's answer.

---

## 1. Decisions needed first

Several review items change a promise the product makes, or touch a legal line. These need an
answer before the matching work starts. The engineering view is given for each, so the decision
can be quick.

| # | Decision | Why it cannot just be built | Engineering view | Owner |
| --- | --- | --- | --- | --- |
| D1 | **Email and password sign-in for clients** (review: sign-in) | Blueprint v5 §7.3 makes the invitation the only way in, and the sign-in page says "there is no password to remember". A password changes that rule. | Recommend yes, with one guard: anyone can create a login, but a login sees nothing until it holds an invitation for the same address. Access stays invitation-only; only the way of proving who you are changes. See WS1. | Kaleb |
| D2 | **Remove the footer lines** "Guided by Kaleb Befekadu, Peachtree Cardinal, Georgia..." and "Every figure is a planning estimate... not tax or legal advice" (review: home page) | The first identifies the agent and brokerage. The audit (`platform-2026-10.md` #12) notes Georgia advertising rules generally expect the brokerage to be identified clearly. The second is the disclaimer that keeps a computed figure from reading as a lending commitment or valuation. | Remove both from the home page body as asked, but keep a short brokerage line and the disclaimer in the site footer, in smaller type, until the broker says either can go. | Broker |
| D3 | **"Free to use... Kaleb is paid a commission only if you buy or sell with him"** (review: home page) | It is a disclosure of how the agent is paid. Removing it is allowed, but it is part of the honesty the product is built on. | Fine to remove from the home page. Keep it on `/privacy` or an About line. | Kaleb |
| D4 | **Abroad page: say "United States" instead of "Georgia" everywhere** | The figures on that page (taxes, closing costs, rent ratios) are computed from Georgia terms, and Kaleb is licensed in Georgia. Saying "United States" next to Georgia numbers would present them as national figures. | Change the headline and general copy to the United States (owning US property from abroad is a national topic). Keep "Georgia" wherever a figure is computed, for example "Example: a home in Georgia". | Kaleb |
| D5 | **Equb security instrument copy** (review: Equb, new section) | A pooled savings group that guarantees each member's payout, collects by ACH, and holds money for others may fall under money transmission, lending or insurance rules. The copy must not promise what the structure does not yet do. | Write the section as intent: "we are building", not "your payout is guaranteed". Have an attorney read it before it goes live. | Kaleb + attorney |
| D6 | **Amharic for the whole Equb page** | `lib/core/i18n.ts` has an Amharic dictionary for the abroad pages, marked as a first pass by a non-native writer and still unreviewed (audit #14). A second page doubles what needs a native reviewer. | Build it on the same dictionary and toggle. Ship the Amharic only after Kaleb reviews the strings. | Kaleb |
| D7 | **Equb Example group: remove "Example for illustration. Group sizes and amounts vary."** | Without it, the numbers in the table read as the terms of a real group. | Remove the sentence as asked, and change the card's kicker from "Example group" to "An example group", so the table still says it is an example. | Kaleb |

---

## 2. Workstreams

Ordered by priority. Each item lists the change, the files, and how to check it is done.

### WS1. Client sign-in (P0)

**What Kaleb sees:** a client opens the invitation link and is asked to request a sign-in email.
The email link then fails several times. He wants the invitation kept, a normal email and
password option added, and the whole journey made reliable.

#### How it works today

1. The agent clicks **Invite someone** in Operations. That makes a link; nothing is emailed
   (`app/(operations)/operations/journey/[id]/Household.tsx`).
2. The agent sends that link to the client by email or text.
3. The client opens `/app/invite/[token]`. The page says who invited them and shows
   **Email me a sign-in link** (`app/(client)/app/invite/[token]/page.tsx`, `InviteActions.tsx`).
4. A second email is sent with a one-time link (`lib/db/signin.ts`, via Brevo when configured,
   otherwise Supabase's mailer).
5. The client clicks it, `/auth/callback` signs them in, and they return to the invitation.
6. They click **Join**, which accepts the invitation, then reach `/app`.

That is two links, two inboxes and three clicks before the client sees anything.

#### Why it breaks (each is a separate cause)

| # | Cause | Evidence | Confirm with |
| --- | --- | --- | --- |
| F1 | **The invitation link does not sign anyone in.** By design, step 3 always asks for a second email. This is the "it asks them to resend" Kaleb saw. | `invite/[token]/page.tsx` docblock: "The link alone grants nothing." | Code |
| F2 | **Supabase's mailer is rate limited**, and without custom SMTP may deliver only to the project team. Until PR #11 is deployed with Brevo configured, every sign-in email goes this way. | `platform-2026-10.md` #5 | Supabase Auth logs |
| F3 | **A Supabase-mailer link only works in the browser that asked for it.** It uses PKCE: the code verifier is a cookie in the requesting browser. Asking on a laptop and opening the email on a phone fails with "expired". Brevo links (PR #11) do not have this problem. | `app/auth/callback/route.ts`, `exchangeCodeForSession` | Reproduce on two devices |
| F4 | **Email security scanners can use up the one-time link** before the person clicks it. Outlook Safe Links and some corporate filters open every link in a message. `/auth/callback` signs in on a plain GET, so the scanner's visit spends the token and the person's click then fails. | `app/auth/callback/route.ts` | Test with an Outlook or Microsoft 365 address |
| F5 | **Issuing a new invitation link kills the previous one.** If the agent clicks **New link** while the client still has the old one, the old link says "not valid". | `reissueInvite` in `lib/db/journeys.ts` | Code |
| F6 | **A mismatched redirect list.** Supabase only redirects to URLs on its allow-list. If the site's address (`NEXT_PUBLIC_SITE_URL`) is not on it, Supabase sends people to its default Site URL instead of `/auth/callback`. | `scripts/configure-auth-redirects.sh` adds only the vercel.app address | Supabase Auth settings |
| F7 | **The sign-in page answers "check your email" even when nothing was sent**, for an address with no invitation. This is deliberate, so it cannot reveal who is a client, but it means a typo looks like a lost email. | `app/api/app/route.ts`, `signin` action | Code |

#### What to build

| ID | Change | Files | Done when | Size |
| --- | --- | --- | --- | --- |
| WS1.1 | **The invitation link signs the client in.** Opening a valid invitation shows two choices: **Create a password** (new) or **Email me a link** (today's path). Creating a password sets up the account and accepts the invitation in one step, then lands on the journey. | `invite/[token]/*`, `app/api/app/route.ts`, `lib/db/portal.ts` | A new client goes from the invitation to their journey with one link and no second email. | M |
| WS1.2 | **Email and password sign-in** on `/app/sign-in`, beside the email link. Plus **Forgot password**. A login with no invitation sees "Ask your agent for an invitation" and no data. Needs D1. | `app/(client)/app/sign-in/*`, Supabase Auth settings (enable email+password, minimum length) | Sign in, sign out, reset password and wrong password all work, and a login with no invitation sees nothing. | M |
| WS1.3 | **Scanner-proof links.** `/auth/callback` shows a **Continue** button and signs in only when it is pressed (a POST). A scanner's GET no longer uses up the token. | `app/auth/callback/route.ts` (split into a page and a POST handler) | A link that has been fetched once still signs in when the person clicks it. | S |
| WS1.4 | **All sign-in emails through Brevo, including the agent's.** Set custom SMTP in Supabase to Brevo (no code), so the agent sign-in and password-reset emails stop using the rate-limited mailer. | Supabase dashboard; `app/(operations)/operations/sign-in/SignIn.tsx` needs no change | Ten sign-in emails in ten minutes all arrive. | S |
| WS1.5 | **Deploy and configure PR #11.** Set `BREVO_API_KEY`, `BREVO_FROM_EMAIL` (verified sender), `SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_SITE_URL` in Vercel. Add the live address to Supabase's redirect list. | Vercel and Supabase settings | `/api/health` shows email configured, and a test invitation completes. | S |
| WS1.6 | **Keep older links working.** **New link** keeps the previous invitation valid until it expires, rather than replacing it, or the Household panel says plainly that the old link stopped working. | `lib/db/journeys.ts` (needs a migration if two tokens are kept) | Re-issuing a link does not strand a client holding the old one. | S |
| WS1.7 | **Sign-in status in Operations.** Household shows when each member last signed in, and offers **Send sign-in email** for a joined member. | `Household.tsx`, `lib/db/journeys.ts` | The agent can tell "never signed in" from "signed in yesterday". | S |
| WS1.8 | **End-to-end tests for the whole journey:** invitation to password account, invitation to email link, sign-in on a second device, link fetched by a scanner, expired link, wrong address. | `e2e/` (local Supabase Auth stack needed; today's local stack has no auth) | All six pass in CI. | M |

**Not proposed:** an agent button that signs in as the client. It was started on 5 October and
stopped: it lets the agent act as the client (accept offers, confirm the brief) with no trace
that it was not them. WS1.1 and WS1.2 remove the need for it. If Kaleb wants to see what a client
sees, WS10.2 is a read-only preview.

---

### WS2. Equb page (`/equb`)

Files: `app/(rift)/equb/Landing.tsx` (all sections), `components/rift/equb-art.tsx` (the
illustrations), `app/(rift)/equb/page.tsx`.

| ID | Change | Done when | Pri | Size |
| --- | --- | --- | --- | --- |
| WS2.1 | **Hero illustration bigger and further right.** The `Circle` is capped at `maxWidth: 360` and centred in its column (`Landing.tsx:181`). Raise the cap to about 440 and align it to the right edge of the column. On phones it stays centred below the text. | Desktop: larger, sitting right. 375px: no sideways scroll. | P2 | S |
| WS2.2 | **New headline.** Replace "The Equb your family trusted, built to buy you a home." with something simple and clear. Proposals: "Save together. Buy a home." or "A group savings plan for your down payment." Kaleb picks. | Headline replaced in both languages. | P1 | S |
| WS2.3 | **Whole page in Amharic.** Move every string on the page into `lib/core/i18n.ts` and add the `LocaleToggle` the abroad page uses, with the same `?lang=am` link and saved choice. Needs D6. | Every visible string switches. The form's labels and errors too. | P1 | M |
| WS2.4 | **Vision section copy and layout.** Headline becomes "Leveraging a tool that is proven. A clear path to a home." (grammar fix: "a tool"). Layout: the heading sits alone on the left with empty space under it while three paragraphs run long on the right. Put the text directly under the heading in one column, or keep two columns and fill the left with an illustration (a circle of hands passing a key fits the existing art). | The section reads top to bottom with no empty column at 1280px and 375px. | P1 | S |
| WS2.5 | **New section after Vision: "How we make Equb safer."** Short and high level, three to five items: protection if a member stops paying after their turn (a security or guarantee on the group, details to come); a legal entity for each group; a team of professionals; a dashboard where members see every payment; automatic payments by ACH. Wording as intent, not a guarantee. Needs D5. | Section live, attorney has read it. | P1 | S |
| WS2.6 | **Example group: remove the disclaimer line** (`Landing.tsx:261`). Needs D7. | Line gone, card still reads as an example. | P2 | S |
| WS2.7 | **Why Bet Equb spacing.** Increase the gap between the five cards and the two illustration cards (`marginTop: 18` at `Landing.tsx:288`, to about 28). | Visibly separated groups. | P2 | S |
| WS2.8 | **Centre the "Funds go to your closing attorney" card.** The illustration and its caption should sit in the exact centre of the card, horizontally and vertically. Make the card a flex column with centred content, and give both cards in the pair the same height. | Centred at every width; both cards equal height. | P2 | S |
| WS2.9 | **Better and more calls to action.** Today there are two ("Reserve My Seat" in the header and hero). Add one after the safety section and one after the example group. Proposed wording: "Save my seat", "See if a group fits me", "Join the next group". All go to the new form page (WS2.10), not the bottom of the page. | Four CTAs, each tracked separately, each opening the form page. | P1 | S |
| WS2.10 | **Two-step form, on its own page** (`/equb/reserve`). Step 1: name, phone, email. **Next** saves the lead right away (so someone who stops after step 1 is not lost), then step 2 asks household size, language, target price and timeline. Step 2 updates the same lead. The bottom-of-page form becomes the same two steps. | A step-1-only lead appears in Operations. Step 2 updates it, not a duplicate. Phone consent is still asked when a phone is given. Telemetry stores question ids only (rule 6). | P1 | M |

Note for WS2.10: the capture endpoint today takes the whole form once. Step 1 needs a "create"
call that returns a short-lived token, and step 2 an "update" call that uses it, so step 2
cannot be used to change someone else's lead.

---

### WS3. Home page (`/`)

File: `app/(rift)/page.tsx`, the cards' art in `components/rift/value/artifacts.tsx`.

| ID | Change | Done when | Pri | Size |
| --- | --- | --- | --- | --- |
| WS3.1 | **Title spacing, and a smaller title.** More space between "Know the real number before you talk to anyone." and "Most people find out...", and a smaller title. The home, buy and sell pages all use the same title style (`.d1`), so fix it once in `app/prototype/rift.css`: lower the top of its size range and add margin above the description. Fixes WS4.1 and WS5.1 too. | All three pages match the new spacing at 1280px and 375px. | P1 | S |
| WS3.2 | **Group the small costs.** In the buying card's cash breakdown, combine Prepaids and escrow, Inspection and Appraisal into one row ("Other costs"). Clicking it opens the three lines beside it with a smooth slide-out, and clicking again closes it. Build it as one shared component so the buy page (WS4.4) uses the same thing. | Keyboard and screen reader can open it (a real button with `aria-expanded`). Animation respects reduced-motion settings. The total does not change. | P1 | M |
| WS3.3 | **Redo the selling illustration** (`ProceedsFlow`). Kaleb finds it hard to read. Proposal: a single horizontal bar for the sale price, with the loan payoff and selling costs cut away from it, and what is left highlighted. The same change goes on the sell page (WS5.3). | Kaleb approves a mock before it is built. | P1 | M |
| WS3.4 | **Simpler captions.** Buy: "Cash you need for a $325,000 home: more than the $11,375 down payment." Sell: "What you keep from a $415,000 sale after the loan and selling costs." The numbers stay computed from `compute.ts` (rule 1). | Captions replaced; figures still come from the defaults. | P1 | S |
| WS3.5 | **Better CTA wording** than "Start with buying" and "Start with selling". Proposals: "See what buying will cost me" and "See what I'd walk away with". | Replaced and tracked. | P1 | S |
| WS3.6 | **Remove three lines:** "Free to use, with nothing to sign up for..." (`page.tsx:101`, needs D3); "Guided by Kaleb Befekadu..." and "Every figure is a planning estimate..." (`components/rift/site/SiteFooter.tsx:54` and `:66`, need D2). The footer is shared by every public page, so this changes them all. | Lines removed or moved per D2 and D3. | P1 | S |
| WS3.7 | **Six cards instead of two (plus the two small ones today).** Two buyer values, two seller values, one Equb, one Abroad, each with its own illustration. Proposed buyer values: "Cash to close" and "Georgia down payment help". Seller: "What you'd walk away with" and "Unclaimed money from your sale". Each card links to its value page. | Six cards in a 3 by 2 grid on desktop, one column on phones, each with art. | P1 | M |

---

### WS4. Buy page (`/buy`)

File: `app/(rift)/buy/page.tsx`.

| ID | Change | Done when | Pri | Size |
| --- | --- | --- | --- | --- |
| WS4.1 | Title spacing and size. Done by WS3.1. | Matches home. | P1 | none |
| WS4.2 | **An illustration on each value card**, showing what that value is. One shared illustration set for buy, sell, home and abroad (see WS9.2). | Every card has art that works in light and dark. | P1 | M |
| WS4.3 | **Remove the program count.** "13 Georgia programs, each checked against its official page." becomes "Georgia programs, each checked against its official page." (`buy/page.tsx:106`). The count changes as programs are added or close. | No number in the heading. | P2 | S |
| WS4.4 | The grouped small-costs row from WS3.2, in the buy page's breakdown. | Same component as home. | P1 | none |

### WS5. Sell page (`/sell`)

File: `app/(rift)/sell/page.tsx`.

| ID | Change | Done when | Pri | Size |
| --- | --- | --- | --- | --- |
| WS5.1 | Title spacing and size. Done by WS3.1. | Matches home. | P1 | none |
| WS5.2 | An illustration on each value card (WS9.2). | Every card has art. | P1 | M |
| WS5.3 | The new selling illustration from WS3.3. | Same as home. | P1 | none |

---

### WS6. Abroad page (`/abroad`)

Files: `app/(rift)/abroad/Landing.tsx`, strings in `lib/core/i18n.ts`.

| ID | Change | Done when | Pri | Size |
| --- | --- | --- | --- | --- |
| WS6.1 | **Simplify the page.** It tries to explain too much. Cut it to: headline, three reasons, the two value cards, one CTA. Move the rest to `/abroad/how`. Kaleb approves the cut list first. | Page roughly half its current length. | P1 | M |
| WS6.2 | **Fix the "One asset, priced in dollars..." illustration** (`why.h2`). Today it explains nothing and is cut off. Replace it with one that shows the four ways the home pays back (rent, growth, a dollar asset, a place to stay), and fix the clipping. | Fully visible at 375px and 1280px; Kaleb approves the mock. | P1 | M |
| WS6.3 | **Header layout.** The abroad page has its own two-language header (audit #2, more). Kaleb sees it as off. Needs a screenshot to pin down the exact fault; check the language toggle and "Talk to Kaleb" at 375px, 768px and 1280px first. | Header aligned at all three widths. | P1 | S |
| WS6.4 | **Illustrations on "Cost to buy and own" and "The return" cards.** | Both cards have art. | P1 | S |
| WS6.5 | **Georgia to United States** in general copy. Needs D4: keep "Georgia" where a figure is computed. Both languages. | No "Georgia" left except beside a computed figure. | P1 | S |

---

### WS7. Book page (`/book`)

File: `app/(rift)/book/Booking.tsx`.

| ID | Change | Done when | Pri | Size |
| --- | --- | --- | --- | --- |
| WS7.1 | **Make it much simpler.** Heading "Twenty minutes about your numbers", one short line under it ("One conversation about what stands between you and a move."), the form, nothing else. | Page fits on one phone screen above the button. | P1 | S |
| WS7.2 | **Delete three lines:** "Live booking is not switched on yet...", "We email you what you worked out here...", "Your answers stay yours either way...". | Lines gone. | P1 | S |
| WS7.3 | **Email required.** Today it is optional unless live calendar booking is on (`Booking.tsx:250`). Make it required always, on the page and on the server. | The server refuses a booking with no valid email. | P1 | S |

Check before deleting: the "Live booking is not switched on" line tells the visitor they will not
get a time on the spot. With it gone, the confirmation after sending must still say Kaleb will
reply with a time.

---

### WS8. Offer page (`/offer`)

File: `app/(rift)/offer/Form.tsx`, reading in `app/api/offer/read/route.ts`, saving in
`app/api/offer/route.ts`.

| ID | Change | Done when | Pri | Size |
| --- | --- | --- | --- | --- |
| WS8.1 | **Start with the PDF only.** The page shows just the upload. After upload, the reader fills what it can and the form appears, whether it found everything, part of it or nothing. | Only the upload box shows until a file is chosen. | P1 | M |
| WS8.2 | **Uploading counts as sending.** The moment the PDF is stored, the agent has the offer, even if the sender never finishes the form. Needs who sent it, so the upload step asks for name and phone first (or the offer arrives as "sender unknown"). Kaleb picks which. | An upload with an abandoned form shows on the Offers board. | P1 | M |
| WS8.3 | **More PDFs after the first.** The upload control stays above the form so addenda can be added. Today one file is kept (`documentToken` is a single value). | Several PDFs attach to one offer. | P1 | M |
| WS8.4 | **Errors on the box itself.** Today missing fields are listed together (`errors` is one list). Show a red message under each missing box, mark the box red, and move focus to the first one. | Each required box shows its own error. | P1 | S |
| WS8.5 | **No contingencies selected by default.** Today Inspection and Appraisal start ticked (`Form.tsx:53`). Start empty. | Both unticked on load, unless the PDF says otherwise. | P1 | S |
| WS8.6 | **"You are" as clickable cards.** "A real estate agent" and "The buyer" look like text. Make them two bordered cards with a radio mark and a hover state. | They read as choices at a glance. | P2 | S |

Note: the PDF reader must stay out of the customer-facing value path (rule 1). It proposes values
for the sender to confirm, and boxes stay marked "from your PDF" until edited. That stays as is.

---

### WS9. Across every page

| ID | Change | Files | Done when | Pri | Size |
| --- | --- | --- | --- | --- | --- |
| WS9.1 | **Start over, everywhere.** Kaleb's numbers from days ago came back. The calculators keep answers in the page address (`router.replace` in `components/rift/value/ValueFlow.tsx:53`), so a link from browser history or autocomplete brings the old answers back. Add a visible **Start over** on every buy, sell and abroad value page that clears the answers and the address, and stop restoring answers from an address older than the visit. First reproduce it to confirm this is the path. | `ValueFlow.tsx`, `components/rift/Forget.tsx` (already clears the drafts in storage) | One click returns every value to blank, and a fresh visit starts blank. Saved plans are unaffected. | P1 | M |
| WS9.2 | **One illustration set.** WS3.7, WS4.2, WS5.2 and WS6.4 all ask for a picture per value. Draw them once, in the style of `components/rift/art.tsx` and `equb-art.tsx` (line art, theme colours, works in dark mode), and reuse them on every page. | `components/rift/value/` | One component per value, used everywhere that value appears. | P1 | L |
| WS9.3 | **Check every change at 375px and 1280px**, in both languages where there are two. The phone suite in `e2e/` already fails on sideways scrolling; add the Equb form page to it. | `e2e/` | CI passes the phone suite. | P1 | S |

---

### WS10. Operations (the agent's side): issues and improvements

Only items not already in `platform-2026-10.md` are new here. The still-open items from that audit
that affect daily use are repeated at the end so this is one list.

| ID | Issue or improvement | Why it matters | Pri | Size | Owner |
| --- | --- | --- | --- | --- | --- |
| WS10.1 | **The agent's own sign-in uses Supabase's mailer** (`operations/sign-in/SignIn.tsx` calls `signInWithOtp` in the browser). It has the same rate limit and PKCE device problem as F2 and F3. | Kaleb can be locked out of his own tools. Fixed by WS1.4, plus an optional password (WS1.2). | P0 | S | Eng |
| WS10.2 | **No way to see what a client sees.** Add **Preview as client** on a journey: a read-only render of the client's page as that member's scopes allow, from the agent's own session, with no sign-in as them. | Checking what was shared today means asking the client. | P1 | M | Eng |
| WS10.3 | **Sign-in status per household member** (WS1.7). | "Did they ever open it?" has no answer today. | P1 | S | Eng |
| WS10.4 | **Invitations are copy and paste only.** By design (decision D04: a message to a client is something the agent approves). Offer **Email this invitation**, which shows the email and sends only when he presses Send. | One fewer app switch per invitation, and the email comes from the product with the right wording. | P2 | S | Kaleb (revisit D04) |
| WS10.5 | **Equb leads are not separated in Operations** (to verify): leads from `/equb` arrive as buyers. When groups exist, the agent will need to see Equb interest on its own. | Equb is a separate product line with its own follow-up. | P2 | M | Kaleb |
| Open | Still open from the platform audit: the morning summary job failing (#1); deploys from a laptop instead of Vercel's Git deploys (#3); email sender and domain (#5); Cal.com not connected (#11); the agent profile not reaching the pages (#12); Supabase's 1,000-row limit (#32). | See that document. | | | |

### WS11. Client portal: issues and improvements

| ID | Issue or improvement | Why it matters | Pri | Size | Owner |
| --- | --- | --- | --- | --- | --- |
| WS11.1 | **Getting in is broken.** All of WS1. | Nothing else on this list matters until clients can sign in. | P0 | | Eng |
| WS11.2 | **One long page.** The journey is a single scroll of up to nine sections (Today, Moving in, Offers, Priorities, Homes, Pricing, Proceeds, Money, Documents) with in-page links (`app/(client)/app/j/[id]/page.tsx`). On a phone, Documents is far down. The navigation from Blueprint v5 §7.2 (Today, Homes, Journey, Money, Documents, Help) is not built (audit #10). | Clients come back for one thing; they should reach it in one tap. | P1 | L | Eng |
| WS11.3 | **Clients cannot send documents.** Documents only go agent to client. A buyer cannot upload a pre-approval letter or ID. | The agent collects these by email today, outside the record. | P1 | M | Eng |
| WS11.4 | **No messages in the portal.** Help says "email Kaleb". The prototype (`/prototype/app/messages`) has a message thread; production does not. | Questions about a home or offer leave the context they are about. | P1 | L | Kaleb (is it wanted?) |
| WS11.5 | **No alert when something new is shared** (to verify): no email found telling a client a home, offer or document was added. | Clients have to remember to check. | P1 | M | Eng |
| WS11.6 | **English only.** The client portal has no Amharic, though the audience the Equb and abroad pages serve will become clients. | The language promise stops at sign-in. | P2 | L | Kaleb |
| WS11.7 | **No client account settings**: no way to change email, set or reset a password, or see who else is in the household. Comes with WS1.2. | Needed once passwords exist. | P1 | S | Eng |
| WS11.8 | **No browser tests for the client side** (audit #33 covers public pages and Operations only). | The portal broke without any test failing. Part of WS1.8. | P1 | M | Eng |

---

## 3. Suggested order

1. **Decisions D1 to D7** (Kaleb, broker, attorney). One sitting.
2. **WS1.5, WS1.4** (settings, no code): gets email working this week.
3. **WS1.1 to WS1.3, WS1.8, WS10.1**: the sign-in rebuild, with its tests.
4. **WS3.1, WS3.4 to WS3.6, WS4.3, WS7, WS8.4 to WS8.6, WS2.2, WS2.4, WS2.6 to WS2.8**: the quick copy and layout items. One or two days together.
5. **WS9.1** (start over) and **WS2.9, WS2.10** (Equb form): the two behaviour changes visitors will feel.
6. **WS9.2** illustrations, then **WS3.2, WS3.3, WS3.7, WS4.2, WS5.2, WS6** which depend on them.
7. **WS2.3, WS2.5** once D5 and D6 are answered.
8. **WS8.1 to WS8.3**: the offer upload rework.
9. **WS10.2 to WS10.5, WS11.2 to WS11.7**: portal improvements, after the pilot buyers can sign in.

## 4. Rules from AGENTS.md this work touches

- **Rule 1, computed not generated:** every new figure in captions and cards comes from
  `compute.ts` or `registry.ts`. The offer PDF reader proposes values the sender confirms; it
  never writes a figure a customer is shown as ours.
- **Rule 6, telemetry allowlist:** the two-step Equb form sends question ids and timings only.
  A new event key needs a migration.
- **Rule 10, never colour alone:** the offer form's red errors need an icon and words, not just
  a red border.
- **Every table ships with its RLS policy:** WS1.6, WS8.3 and WS11.3 add or change tables.
- **Docs and tests change with the code:** `docs/integrations.md` for WS1, and
  `lib/core/docs.test.ts` if any number in a document changes.
