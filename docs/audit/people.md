# Audit: Relationships, the person record, Add someone

Looked at 30 Sep 2026 against the local demo book (docs/setup.md §8), at 1440 px and 390 px,
before any change. Pages: `/operations/clients` (list and panel), `/operations/lead/[id]`
(buyer early, buyer touring, seller with offers, new unanswered lead, closed, archived) and
`/operations/add`.

## Relationships `/operations/clients`

**The job.** Somebody rings and says their name, or the agent wants "everyone I have not
spoken to in two weeks" or "every overdue next step". Find the person fast, see the essentials
beside the list, open the record.

Logic and correctness
- The band chip ("Call today", "This week") is the funnel's triage at arrival and never
  ages out: Nia Johnson, closed four months ago, and Michael Brooks, under contract, both
  carry a red "Call today". It reads as an instruction that is months stale.
- Closed people are flagged "Stalled" (Barbara Wright, closed ten months ago). The stall is
  computed for the terminal stages Closed and Lost, which have no normal dwell; `ruleFor`
  falls back to 45 days, so every closed client goes red after six weeks.
- Next step due dates are raw ISO (`2026-09-26`) and an overdue one looks exactly like a
  future one. Keisha Williams' step four days overdue has no mark at all.
- Source is a raw code (`funnel`, `manual`, `referral`, `import`).
- "1 months ago".
- The forecast's explainer quotes the first month ("0 of 0 means...") even when that month
  is empty, which makes the sentence meaningless on the first screen.
- Filters cover only status and side. The brief (and Blueprint §8.5, "search, filters that
  persist, sort") also needs stage, next step (overdue, due soon, none set) and last contact
  (quiet for two weeks, never), and a sort. There is no sort at all.

Information design
- The forecast (about 300 px, four paragraphs and nine chips) sits above the list, so the
  list the page is for starts below the fold at 1440 and three screens down on a phone.
- The name column carries the band chip; the stage column carries the stall chip; next
  action wraps to five lines. Rows are uneven heights and hard to scan.
- The panel shows the band code as a chip with no meaning, has no saved plan (what they
  want), no last contact, no stall, and email and phone are not links.
- Failure, skipped and empty states are hand-drawn cards, not the kit's Notice and Empty.

Layout and accessibility
- Hand-built `h1` and lede instead of `PageHead`; no primary action on the page.
- Filter chips wrap mid-group at 1440 ("Selling" alone on a second row) because the
  toolbar is capped at 560 px.
- At 390 px the seven-column table is clipped inside its card: only Name, Side and Stage
  are visible and there is no cue that it scrolls.
- Stall chips are colour and a word but no icon.

## The person record `/operations/lead/[id]`

**The job.** Understand one person at a glance: who, where they are, what is owed next,
what they want and can afford, then plan, offers, decisions, agreement, referrals and the
history. The blueprint (§8.5) says it leads with the lead summary (§5.5); §5.5 says the page
"opens with What they worked out".

Logic and correctness
- "What they worked out" (the saved plan) is below four full cards and a 72 px gap; the
  spec says the page opens with it. On Marcus Bell it is at y=1300.
- A lead from a referral or an import is labelled "Added by hand": the chip tests
  `source !== "funnel"`.
- Stage buttons move the person on a single click, including to Lost and Closed. Eleven
  buttons, no confirmation, on the page the agent uses while on the phone.
- The stage list offers seller stages to buyers and buyer stages to sellers ("Preparing the
  property" for a buyer, "Searching" for a seller).
- A next step, once set, can only be marked Done. It cannot be moved to another day or
  reworded, so the only way to reschedule is to claim it was done.
- An overdue next step is a red chip with no icon; "today" is a green chip that reads as
  "fine".
- Funnel score shows the raw band code: "96 (now)".
- What they told the funnel (timing in their words, price, co-buyer, why they scored) and
  their consent (email, phone, when) are recorded and shown nowhere on the record. Nor is
  whether automatic follow-up is running or stopped, and why.
- The back link goes to Today, whatever the agent came from.
- Raw ISO dates on plan steps (`· 2026-10-02`), offers (`closes 2026-10-31`) and the
  agreement ("in force until 2027-02-16").
- "Closed on" with an empty date field sits at the top of Referrals for every person,
  including a lead who arrived today.
- An archived record cannot be restored from the page (no write exists for it).

Information design
- The two-column layout never happens: `grid-2` is not defined anywhere in the stylesheet,
  so notes, next step, the note form and details stack full width.
- Two `shell-w` frames on one page: the record, then everything else, each with the page
  frame's 72 px bottom padding, which is the empty band after "Archive this record".
- Section headings are drawn four different ways (card title, uppercase eyebrow, `t-lg`
  heading, `t-md`), so it is not clear what is a section and what is a card.
- Phone and email are two black primary buttons, and nothing else on the page is the
  primary action.

Layout and accessibility
- At 390 px the page is 416 px wide (the plan link row and referral link overflow).
- Warnings are drawn as "⚠" text in `c-warn`, and errors as a card with "✕", not the kit's
  Notice.

## Add someone `/operations/add`

**The job.** Put in somebody the agent already knows, quickly, with why they may be
contacted.

Logic and correctness
- No duplicate check. Adding somebody already on record (same email or phone) makes a
  second person, and history, plan and follow-up split across two records.
- "Lost" is offered as the stage for a new person, and every stage is offered on both
  sides.
- The button stays grey with no reason given for why it cannot be pressed.

Layout
- `grid-2` again: email and phone stack with no gap between them.
- Hand-drawn header and back link to Today; the error is a hand-drawn card.

## What was fixed (30 Sep to 2 Oct 2026)

Relationships
- The funnel band only shows while nobody has picked the person up (`bandIsLive`), so closed
  and in-progress people no longer carry "Call today". Closed and Lost no longer compute a stall
  (`shape` in `lib/db/clients.ts`), so a closed client is not "Stalled" after six weeks.
- Due dates read "Overdue 4 days", "Due today", "Due in 5 days" or "Due Oct 20" with an icon
  and the word; source is a phrase; "1 months ago" is "1 month ago". All in `lib/core/people.ts`
  with tests.
- Filters for stage group, next step (overdue, due in 7 days, none set) and last contact, a sort
  (newest, next step due, longest since contact, name), and two quick chips with counts for
  overdue next steps and people with no contact in 14 days. The whole book (up to 500) is read so
  these narrow everyone, not a page; past 500 the page says so. Filters persist on the device.
- The forecast is under the list. Its worked example uses the first month that has anybody in it.
- Rows are one person each (side and source under the name); under 760 px a row is a card, so no
  table is clipped. The panel shows next step with its due state, last contact, what they worked
  out, journeys and notes, links the phone and email, scrolls into view on a phone, and each part
  says when it could not be read. Failure, empty and skipped states use the kit.
- Add someone is the page's primary action.

The person record
- Order: who and where they are, then Status and next step beside Record what happened, then
  What they want and can afford (funnel answers in their words, saved plan answers and figures,
  why they scored), then journeys, plan, offers, offer room, decisions, representation,
  referrals, history. How to reach them, consent, follow-up state and details sit in a rail that
  falls below the main column on a phone.
- A stage cannot be changed by one stray click: choose it, then confirm "Move to X". Only the
  stages of that side are offered. A next step can be changed, not only marked done. Overdue is
  an icon and the words.
- Consent per channel (agreed, said no, no answer), why you can contact them, and whether
  automatic follow-up is running or stopped and why, are shown (`lib/db/lead-background.ts`).
- A person can be restored from the archive (`restoreLead`), written to the history.
- A history that could not be read says so; before, `readLead` swallowed the failure and the page
  said "Nothing recorded yet".
- Referrals' closing date is collapsed until there is a closing. Dates are words, not ISO.
  Every panel uses the kit's Section and Notice; the warning-sign text warnings are Notices.
- Mobile: no horizontal scroll (the offer room button row wraps).

Add someone
- A second record for the same email or phone is refused with who it would duplicate, until the
  agent says "add anyway"; phones compare by digits. If the check cannot run it does not block.
- Lost is not offered as a starting stage; stages follow the side; the button says what is missing.

Left, and why
- `grid-2` is still used by `app/(rift)/sell/unclaimed/Unclaimed.tsx` (outside this scope).
- Row click opens the panel only from the name; a whole-row link needs `position: relative` on
  table rows, which is not reliable enough to depend on.
- Stall rules in `lib/core/pipeline.ts` use one dwell table for both sides; that is the
  specification's call and was not changed.

## Outside this scope, noticed in passing
- `grid-2` is used elsewhere and does not exist in `app/prototype/rift.css`.
- The browser pane is shared between agents; tabs are navigated by other sessions.
