# Operations audit: the business pages

Transactions, Offers, Advocacy, Reports and Campaigns, opened against the local demo book
at 1440 px and at 390 px on 30 September 2026. Written before any fix, so it records what
the pages did, not what they were meant to do. Each page starts with the agent's job on it,
because most of the problems below are the page doing a different job from that one.

## Transactions `/operations/transactions`

**The job:** see every contract at once, spot the one that needs him today, and open it.

Logic and correctness

- **Rows are in the order the contracts were recorded,** not by what is next. The contract
  closing tomorrow can sit below one with nothing due for a week.
- **"Next date" only counts dates checked against the document.** A contract whose dates are
  all unchecked reads "None checked ahead", which sounds like nothing is due; the dates are
  there and are the more urgent for being unchecked. On closed and terminated rows the same
  words appear where the closing or termination date belongs.
- **Ended contracts still list their flags.** A terminated contract shows "Due diligence
  period ends passed, not recorded as met", which is noise about a deal that is over.
- **Buying and selling look the same.** James Holloway is a seller; nothing on the row says
  so, and the workstreams mean different things on each side.
- The client column falls back to an email address for a lead with no name, which is fine,
  but the property column has no link text for the stage the contract is in ("Close").

Information design

- **The ten workstream glyphs are unlabelled.** Nobody can tell which glyph is Title and
  which is Appraisal without hovering each one; the legend under the table is a key to the
  shapes, not to the positions. What the agent needs from that column is how far along it is
  and whether anything is stuck.
- Dates are absolute only ("Thu, Oct 1, 5:00 PM"); "tomorrow" is what matters at a glance.

Phone (390 px)

- The table is squeezed into a scrolling card: the address wraps to five lines, the next
  date and the workstreams are off screen to the right. It needs a stacked row, not a table.

## Offers `/operations/offers`

**The job:** every live offer, on both sides, with what needs answering and by when.

Logic and correctness

- **It shows only offers that came in through the public `/offer` form.** Buyer offers
  (Rachel Kim's counter to answer, Michael Brooks's accepted offer with no contract recorded
  yet) and offers on listings (Patricia Moore's three, one of them never shown to her, and
  her choice waiting on Kaleb) are not on the page called Offers. They are only reachable
  one journey at a time.
- **Raw codes on screen:** financing reads "fha", "conventional", "va", "cash"; the closing
  date reads "Close 2026-11-13"; `representing: "other"` falls through to "for their buyer"
  (Evergreen Homebuyers LLC is neither). The PDF comparison lists field keys ("closeOn:",
  "dueDiligenceDays:") instead of words.
- **The due diligence period is said twice:** once from the structured field ("14 days due
  diligence") and again from the contingency list ("Due diligence 14 days").
- **No deadline, no age.** An inbound offer does not say when it arrived; nothing on the
  page says what is waiting on whom.
- **Inbound offers on his own listings are not connected to them.** Two offers arrived for
  1402 Briarcliff Rd NE, which is David Owens's listing; the page does not say so.
- "No relationship record. The lead write did not land." is said about an offer whose
  submitter simply gave no way to be matched; it reads like a failure when it may not be one.

Design

- Hand-drawn header, hand-drawn failure and empty states, inline sizes: not on the kit.

## Advocacy `/operations/referrals`

**The job:** a short, prioritised list of people worth asking for a review or an
introduction today, and a record of what was asked.

Logic and correctness

- **Every funnel lead with a readout is "Readout delivered: Due now", forever.** Nineteen of
  the twenty-three people on the list are strangers who took an assessment and whom nobody
  has taken on (no stage), or clients whose readout was months ago. The ask ("send this to
  someone it would help") only makes sense to somebody Kaleb is talking to, in the days after
  they got their numbers.
- **No moment ever ages out.** "Plan published" is still due for Michael Brooks, who is under
  contract; "Closing day" would be "Due now" seven months after a closing if nobody recorded
  it (the brief found Barbara Wright in exactly that state). Every moment needs a window
  after its trigger, after which it has passed and leaves the queue.
- **The order is only by moment strength,** so the list is thirteen "Readout delivered" rows
  in no particular order. Freshness is what makes an ask timely.
- **The private "how did it go" card is drawn for every closed client indefinitely,** even
  after it was answered "It went well" (Nia Johnson), taking a full card.
- "This person" for a lead with no name; "0 moments" beside Ethan Walker, who is on the list
  for a follow-up that the heading does not name.

Design and accessibility

- "Due now" is an accent-coloured chip with no icon (rule 10).
- At 390 px the four decision buttons run off the right edge of the card.
- Hand-drawn header and states; not on the kit.

## Reports `/operations/reports`

**The job:** a truthful picture of the business: visitors to leads to clients to closed,
where they come from, how well each converts, and what the pipeline is worth.

Logic and correctness

- **None of that is on the page.** It reports the pilot (same-day replies, Matrix checks),
  the value ladder, and question drop-off. There is no lead count, no source breakdown, no
  conversion to client or closing and no pipeline value, although the commission setting,
  the stage weights and the attribution records all exist.
- **"Where people stop" fails on nearly every load of the local stack,** reading "Did not
  load; unknown, not empty" for both sides. Measured: the two `rift_funnel_report` and
  `rift_funnel_starts` calls answer in 30 to 55 ms against PostgREST directly, but the page
  issues them after ten other reads, all racing the 2 second read deadline, which is a
  wall-clock deadline shared with a busy event loop (the comment on `AUTH_DEADLINE_MS`
  describes the same effect). Under a cold compile, or a cold serverless start, the
  deadline expires before the query is even sent. It is the deadline, not the query.
- The page also pulls up to 20,000 raw events for the value ladder in the same burst.
- Every section is a different period or none: the ladder is 90 days, the funnel 90 days,
  "Started, not finished" 30 days, the pilot all time, and not every heading says which.

Design

- Hand-drawn headings with inline styles, one table styled by hand, prose paragraphs where
  a figure would do. Not on the kit.

## Campaigns `/operations/campaigns` and `/operations/campaigns/[id]`

**The job:** make and publish landing pages, and see whether they bring anyone in.

Logic and correctness

- **No result per campaign.** The list shows name, address, live version and version count;
  it never says whether a page brought a visitor or a lead, though visits carry the
  campaign's slug in their attribution.
- The create form is the first thing on the page, above the list, at full width; on a
  phone it pushes the list below the fold.

Design

- The list and the detail page draw their own headings ("← Campaigns" link, serif h1) and
  their own failure states. The detail page's failure is a bare red line.
- The composer's two columns do not stack below about 900 px: the preview's fixed 375 px
  frame makes the page scroll sideways on a phone.
- The list table wraps the slug into four lines on a phone.

## Across all five

- Three of five pages are not on the page kit (`PageHead`, `Section`, `Notice`, `Empty`),
  so their tops, gutters and failure states differ from the rest of Operations.
- Dates are raw ISO in three places and absolute everywhere; nothing says "in 2 days".

## What was done about it

Every page above is on the page kit, and the tables become stacked cards below 760 px.

- **Transactions:** ordered by what needs the agent (stuck or missed first, then the
  nearest date), unchecked dates shown and labelled, "n of m confirmed" beside the strip,
  a side tag, no flags on ended contracts, a stat row. Pure rules in `lib/core/transactions.ts`.
- **Offers:** one list of every live offer (buyers' offers, sellers' offers and rooms,
  offers that came in by form) with what it waits on, who, and by when
  (`lib/core/offer-board.ts`, `lib/db/offer-board.ts`). Financing, dates and PDF field
  names are words; the due diligence period is said once; an inbound offer is "replied"
  once the lead behind it has a human reply since it arrived.
- **Advocacy:** every ask has a window after its trigger and is "passed" after it
  (14 days for numbers and closing day and the thirty-day check, 30 for six months and
  each anniversary), nothing is asked of a lead nobody picked up or while a person is under
  contract or closing, the queue is ordered by strength then soonest window, and the page
  shows eight people at a time. `lib/core/referral.ts`.
- **Reports:** three views (the business, the buyer pilot, where people stop) so each opens
  only its own reads. The business view is the visitor to closed funnel, sources, and the
  commission-weighted pipeline, each with its period and what it counts
  (`lib/core/business-report.ts`). The cold-start failure was a deadline, not a slow query:
  agent-side reads now have an eight second deadline (`REPORT_DEADLINE_MS`).
- **Campaigns:** visits and leads per campaign from first-touch tags, an honest "Unknown"
  when that read fails, and a composer that stacks on a phone.

Left for a decision rather than guessed: see the report that accompanied this branch.
