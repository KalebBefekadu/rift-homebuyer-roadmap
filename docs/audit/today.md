# Audit: Today, Outbox, Calendar, loading

Looked at against the local demo book (docs/setup.md §8) at 1440 px and 390 px, before any
change. Pages: `/operations` (Today), `/operations/outbox`, `/operations/calendar`, and the
loading state shared by every Operations page.

## Today `/operations`

**The job.** The agent opens it every morning and needs to know, in one pass: who is waiting
on a first reply, what is on fire, what needs their approval, what is theirs to do today, what
is with somebody else, and what is coming. Ordered by urgency, with the next action on each
item, and nothing stale.

Logic and correctness
- A sale's pricing-review and weekly-review items keep appearing while the sale is at
  Review offers, and nothing ages them out. At Review offers an offer is in front of the
  seller; a "go through the pricing version with them" reminder is answered by the offer
  conversation, and a missed one never stops saying "N days ago". David Owens showed both.
- The sale items' due date is printed raw (`2026-09-28`) in the meta line, and the evidence
  reads "Due Mon, Sep 28, 2 days ago". Every other date on the page is "Mon, Sep 28".
- The weekly-review item says "Selling 1402 Briarcliff Rd" and nothing about the listing it is
  about: which MLS record, since when, when it was last reviewed. A seller with two homes
  (or a relist) cannot be told apart, and the agent has to open the journey to learn the
  listing number they are about to discuss.
- A held message ("Held back: they replied after this was approved; read their reply first")
  shows only "Approved, not sent yet". The reason is recorded and never displayed, so the
  item reads as one the agent has simply not sent, and they press Send into the same
  refusal. Same on the Outbox page.
- New leads: the figure strip only knows the buyer's four figures, so a seller (Grace
  Whitfield) shows just the "They were told" sentence and no strip at all; a buyer whose
  readout carries only a verdict shows nothing but the sentence.
- "A scheduled job needs you" and "The rate everyone is shown is X%" link to `/operations`,
  the page they are on: a dead end. The rate's next action is a shell command
  (`npm run rift:rate -- 6.72`), which the agent does not have open.
- "Waiting on others" (21 here) is titled by workstream alone ("Title", "Financing", "Title")
  with the person and property in the clamped second line, so three rows read identically.
- "Needs your approval" mixes four kinds of work (figure checks, dates to check, draft
  messages, a seller's choice) ordered by an arbitrary number, so "Check a figure" can
  outrank a seller's chosen offer.
- Contract-date items keep "Open" as their tone word even when they fall due tomorrow; the
  word "Open" says nothing about urgency.
- A count of "13" on a group heading and 3 visible rows: nothing says how much of a group is
  urgent.

Information design
- Seven cards in a three-column grid of identical weight: nothing says where to start. The
  reply-target strip is the right first thing, but the page has no summary line, so the agent
  must scan five cards to know whether the day is calm or on fire.
- Every row clamps its "why / about / owner / due" line to one line, so the person and
  property, the one thing that identifies a row, are cut off at 1440 and worse at 390
  ("Michael Brooks, 318...").
- The urgency chip uses the words Urgent / Soon / Open / Set, in a vocabulary that does not
  match its group (an item in "Needs attention" can be "Soon"); no icon (rule 10 asks for an
  icon and a word).
- "Mark" opens a second link row (Snooze, Delegate, Pin) in 12 px text: small targets.
- Recent activity lists "Tue 11:04 PM" instead of how long ago; "Rift" is a chip jammed
  against the text.
- The header, notices, empty states and section titles are hand-drawn and inline-styled, and
  do not match Transactions (the kit's example).
- "Figures you were asked to check" sits at the bottom, below everything, and its claim line
  is rendered in a monospace face at full width, with the value pushed far from its label.

Layout and accessibility
- No horizontal scroll at either width. On a phone the cards stack in the right order.
- Group headings carry `title=` tooltips holding the question each answers, invisible on a
  phone and to a keyboard.
- Notices use hard-coded fallback colours, not the kit.

## Outbox `/operations/outbox`

**The job.** Read what Rift prepared, approve it, change it, or discard it; and see what
happened to anything that did not go.

- The hold reason is missing (above). `problem` is shown only for failed and unknown, so an
  approved message with a "Held back:" detail looks fine.
- A state is a coloured chip with a word and no icon.
- Sort order is arrival order: a message that may have sent and one that failed sit between
  two routine drafts, and nothing says which to do first. "May have sent" is the one that
  must not be pressed through.
- The message box is two lines tall at 1440, so the agent signs off on a message whose body
  they cannot see.
- "Sent and discarded" is a bare list: only the address, absolute timestamps, and a failure
  later discarded looks like a success apart from one word.
- Notices (failed to load, not migrated) are plain red text, not the kit.
- Mobile: no overflow; the buttons wrap to full-width lines.

## Calendar `/operations/calendar`

**The job.** "What does the next month look like": Sunday evening planning.

- Contract dates are absent. Due diligence ends tomorrow, a closing is tomorrow, and a
  contingency is due in a week, and none appear: the calendar is built only from plan steps
  and next actions, while Today's Upcoming group already knows the contract dates. A calendar
  that omits the dates that carry legal weight is wrong, not incomplete.
- "SAT 26 SEP, OVERDUE" does not say for how long. The overdue block runs to ten items with
  no summary of how old.
- Every item links to the person's record, including contract dates, which belong on the
  journey's Contract tab.
- The headline sentence is the page's only summary; there are no counts to scan.
- A hand-drawn header and cards, not the kit; the empty state's call to action points at
  Relationships, which does not create anything with a date.
- The footnote about Cal.com is correct and stays.

## Loading

- A single grey "Loading..." line. The page makes seventeen reads; the agent sees one
  sentence and a blank screen, with no shape of what is coming and no announcement for a
  screen reader.

## Order of work

1. Logic: held reason shown (Today, Outbox); seller strip; cadence items age, stop at
   Review offers and name the listing; dead links; unit tests in `lib/core`.
2. Today onto the kit: summary, urgency icons and words, person first on every row, dates as
   "in 3 days" / "2 days ago".
3. Outbox and Calendar onto the kit; contract dates on the Calendar.
4. A real loading state.
