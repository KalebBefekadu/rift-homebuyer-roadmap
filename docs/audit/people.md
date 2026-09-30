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

## Outside this scope, noticed in passing
- `grid-2` is used elsewhere and does not exist in `app/prototype/rift.css`.
- The browser pane is shared between agents; tabs are navigated by other sessions.
