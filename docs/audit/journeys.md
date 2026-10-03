# Audit: journeys and Search

Scope: `/operations/journey/[id]` (every tab, buy and sell), `/operations/journey/[id]/compare`
and `/operations/search`. Looked at with the local demo book, journeys 01 to 16, at 1440 px and
390 px, and by dumping the text of every tab of every journey.

What a journey is for: the agent runs one buy or one sale end to end. Every tab should say which
stage this is, what is blocking, what is next, and put the stage's main action first.
Search is the working list of active home searches and what each one needs from the agent.

## What the demo journeys cover

| Journey | Who | State |
| --- | --- | --- |
| 01 | Sofia Alvarez, buy | Search, brief awaiting review, household disagrees |
| 02 | Chris Nguyen, buy | Tour, one showing "time changed, not reconfirmed" |
| 03 | Rachel Kim, buy | Offer, a counter waiting on the household |
| 04 | Michael Brooks, buy | Under contract, repairs blocked, three unchecked dates, linked to sale 05 |
| 05 | Michael Brooks, sell | Market and show, linked to purchase 04 |
| 06 | Ethan Walker, buy | Close, cash |
| 07 | Nia Johnson, buy | Own, completed |
| 08 | Samuel Adeyemi, buy | Search, approved but not set up in Matrix |
| 09 | Linda Patterson, buy | Back at Search after a terminated contract, brief changed since Matrix |
| 10 | Robert Chen, buy | Paused |
| 11 | James Holloway, sell | Under contract, linked to purchase 12 |
| 12 | James Holloway, buy | Search, linked to sale 11 |
| 13 | Margaret Ellis, sell | Prepare, plan items due |
| 14 | David Owens, sell | Review offers, listing live, a choice made |
| 15 | Patricia Moore, sell | Review offers |
| 16 | Barbara Wright, sell | Continue, completed |

## Journey workspace: top problems

Logic

1. **"Nothing is waiting on you here" is false on most journeys.** The overview only knows about
   the household, dates, workstreams and the lead's free-text next action. It never looks at the
   search, showings, offers, listing or preparation, so: 08 (approved search not set up in Matrix),
   01 (brief awaiting review and the household disagrees), 02 (a showing time changed), 03
   (counter to answer), 14 and 15 (offers to release, a choice to act on), 13 (preparation items
   due in days) all say nothing is waiting. The one next action in the header is the same blind
   spot, so the page header and the overview disagree with Today.
2. **A paused journey does not say why or what resumes it.** 10 is Paused; the reason sits in
   Recent activity only. Completed journeys (07, 16) say "Nothing is waiting" where "Completed on
   Sep 9" with the outcome would be the answer.
3. **The lead's next action date is raw ISO and never ages.** "(2026-09-27)" on 09 is three days
   overdue and looks like any other line. "(2026-09-29)" on 03 was yesterday. Nothing is marked
   overdue.
4. **Seller household says "Buyer", "Co-buyer" and "sees search priorities, homes, price and fees".**
   A seller has no search or homes; only the price scope reaches the seller's page. The invite
   form offers three checkboxes of which two do nothing for a seller.
5. **Seller property form saves type "single-family"**, which is not one of the property types the
   rest of the product knows ("detached"). Such a home is described as "Unknown type of home" in
   a brief match, and the property tab shows the raw value ("detached", "yes").
6. **Listing tab: "Live on the MLS · the listing"** names nothing. The record has a detail
   ("Live on FMLS as #7405561"), a link and a date; none is shown, nor is the "other sites" event.
7. **History prints raw ISO dates** ("week of 2026-09-21", "Review with them on 2026-09-28").
8. **The header's linked line prints raw dependency codes** ("proceeds, owner ..."), and the
   header, overview card and Linked card all say the same thing three times.

Information design

9. **No stage is shown.** The stage is a grey chip beside "Active". There is no path (Prepare to
   Own) on any tab but Contract, and the current stage is not marked there except by being
   un-ticked.
10. **The header is one dense card with ad hoc spacing**, a serif `h1`, 8 to 10 wrapping tab
    buttons (two rows on a laptop, three on a phone), and a three-line footer disclaimer on every
    tab. Not the kit: no PageHead, Section, Notice, Empty.
11. **Tabs do not say which need something.** No counts, no marks.
12. **Failed reads are a red line under an empty card.** Each says "did not load" in its own
    wording and colour and with no icon (rule 10).
13. **Seller Offers and Preparation tabs are read-only tables that send the agent to the lead
    record for every action.** The tab should say that up front, and offer the action first.
    Numbers are not right-aligned.

Visual

14. Every tab body is a `card p-4` with inline margins; headings are `t-md w6` with a muted line
    under, so hierarchy is flat and spacing differs between tabs.
15. At 390 px the header takes more than half the first screen before any content.

## Compare page

- **Type row shows the raw code "detached"** (the compare table's own label map keys on
  "single-family", which no home carries). Also: Basement fact shows "Yes" but a home card shows
  "yes"; fine in the table.
- Heading is a bare `h1.serif` with a text arrow back link; no lede hierarchy; the empty state
  ("Add at least two homes") has no link to add them.
- Table is shared with the buyer's page (components/rift/money/CompareTable). Left alone beyond
  the label fix, except the page frame.

## Search

- A flat list of cards, sorted by what is owed, which is right, but:
- **Closed and under-contract journeys are listed as "Write the brief"**: 07 Nia Johnson, who
  closed in September, and 06 Ethan Walker, in Close, both read as searches owed a brief. A
  journey past Offer, or completed or cancelled, is not an active search and should not be.
- **The "need something from you" count includes those**, so "7 of 11 need something" overstates.
- The summary says "Set up" means recorded; the status chip repeats a long label that already
  says it. Dates are "Sep 20", never "6 days ago", so a search that has been waiting two weeks
  looks like one from today.
- Rows are not scannable: person, label, what next and a status chip are one run of text.
  Nothing says which stage the journey is at, or whether it is paused.
- Failure states are plain red or grey lines without icon or word.

## Accessibility

- Tab buttons use `btn-p`/`btn-g` colour to show the current one; `aria-current` is set, so
  it is also announced, but there is no non-colour difference on screen except the fill.
- Linked, Household and showing forms use `button.u` text links as actions.
- `prompt()` is used to ask why a home comes off the list (Homes tab). Native dialogs cannot be
  styled or reached reliably; left, noted below.

## Left alone, on purpose

- The write forms inside the tabs (SearchSetup, Offers, Showings, Progress, Dates) behave
  correctly; they are restyled only through their containers.
- The stored values of other tables.

## Fixed (see commits on this branch)

- One journey head on every tab (kit PageHead, stage path, next-action bar, scrolling tab bar with
  counts of what needs the agent per tab). Pure rules in `lib/core/journey-focus.ts`, tested.
- Overview "What needs you" now reads search status, showings, offers, listing, sale offers and
  preparation as well as dates and workstreams; paused and finished journeys say so and why.
- Lead next action shows "3 days overdue", not an ISO date; recent activity reads "13 days ago".
- Seller household uses Seller / Co-seller and offers only the price scope; seller property form
  uses the real property types (the old "single-family" option was refused by the facts check).
- Compare: Type in words (`propertyTypeLabel`), page on the kit, empty state links to Homes.
- Listing: "Live on the MLS" names the recorded detail, link and day; other sites row added.
- History, pricing, proceeds, offer terms and brief sources: days in words, not ISO.
- Search: lists only searches still active (`lib/core/search-list.ts`, `journeyStates` in
  `lib/db/progress.ts`), grouped Needs you / Running / Paused / All in the address, with stage,
  what it needs, age and the Matrix status with icon and word.

## Left, and why

- `prompt()` for "why is it coming off the list" on Homes: needs its own dialog component.
- Seller Offers and Preparation are still worked on the person's record (server actions on the
  journey page can hang, see journey/ops.ts); the tab now says so and puts the link first.
- Free text typed by the agent (evidence, dependency notes, history notes) can contain ISO dates;
  that is their text, not a rendering defect.
- Showing, Offers, Dates, SearchSetup and Brief editor forms keep their markup inside the new panels.
