# Audit: the client portal and Operations, by outcome

Looked at on 13 October 2026 against the local demo book (docs/setup.md §8: 34 people,
16 journeys, 6 contracts), at desktop width, signed in as the local agent, with the client
side seen through the agent's preview (`/app/preview/<journey>/<member>`). Code was read only
to confirm or explain what the product showed.

**The one filter.** A finding is here only if it moves conversion (leads becoming clients),
retention and referral (clients relying on the portal and sending people), or Kaleb's capacity
(hours per client). Accessibility, mobile layout, visual polish, loading states and copy were
out of scope unless they blocked a top task. None did.

## 1. Verdict

Both surfaces are further along than the brief assumed. Today answers all seven §8.2 questions,
every item links to where it is handled, the money ledger is live in the portal, and the saved
plan carries into the search brief. The problems are at the edges, where work leaves the
product and has to be carried back by hand.

**Client portal: the three that matter most**
1. **The client has two homes.** Decisions and a seller's choice between offers live only on the
   old `/plan/<token>` link. The portal shows Patricia Moore, at Review offers, "Nothing is
   waiting on you right now" while Today shows Kaleb that she has already chosen an offer there.
   A seller deciding on the biggest number of their life is told to look somewhere else, and
   AT04 already says authenticated decisions belong behind a sign-in.
2. **The contract phase is silent.** The portal emails a client about homes, offers, priorities,
   pricing and proceeds (WS11.5), and about nothing between contract and closing: not when
   insurance becomes theirs, not when a step is assigned to them. That is the stretch with the
   most deadlines and the most "where are we?" texts.
3. **Closing is a dead end for referral.** After closing the portal is a good moving-in list and
   then nothing. The referral link exists, but only on Kaleb's lead page; the client never
   sees it. Ethan Walker, two days from closing, is told "Nothing is waiting on you" with no
   word on wiring, ID or the walkthrough.

**Operations: the three that matter most**
1. **"I have replied" does not count as contact.** It stops the sequence and records the reply
   time, but Relationships reads "last contact" only from notes, so a lead answered from Today
   still reads "None logged" and counts toward "16 with no contact in 14 days". The two pages
   disagree, and Kaleb has to record the same call twice to make them agree.
2. **The first reply starts two clicks away.** The new-lead row shows the figures and what they
   were told, but no phone number. Seven of nine leads were past the 15-minute target. The
   call is the conversion moment, and the row does not offer it.
3. **Chasing others is all by hand.** Waiting on others held 19 items, each ending "Ask Smith
   Law where it stands", with nothing prepared to send. Rift already knows the property, the
   workstream and the last word; the message is a template away.

Why these beat everything else: each one is a place where the client or Kaleb leaves the
product to do something Rift already has the facts for, and each is days of work, not weeks.

## 2. Hypotheses, written before the walk

| | Hypothesis | Verdict | Evidence |
| --- | --- | --- | --- |
| O1 | Today shows work but does not do it | **Changed** | Every item links to where it is handled (`DeskItem.href`). The gap is narrower: outbound words (first reply, check-ins) are never prepared |
| O2 | First reply happens outside Rift and is not logged back | **Confirmed, worse** | `markRepliedTo` (`operations/actions.ts:54`) writes no note; `lastContacts` (`lib/db/clients.ts:541`) reads notes only. No phone on the row |
| O3 | No per-person conversation record | **Rejected** | Lead notes with call, text, email and met exist (`/operations/lead/<id>`). O2 bypasses them |
| O4 | Waiting on others has no prepared nudge | **Confirmed** | 19 items, "Next: Ask X where it stands", no draft. Third parties are a name only (`rift_workstream_updates.owner_name`) |
| O5 | No batch weekly client status | **Changed** | Per-thing emails exist for search and offers (`lib/core/notice.ts`); the contract phase has none. Filling that gap beats a digest |
| C1 | No reason to open the portal between milestones | **Confirmed for the contract phase** | No notice kind covers workstreams or steps; nothing says what changed since the last visit |
| C2 | A client cannot ask Kaleb from inside the portal | **Changed** | Help gives the email and the same-day promise. A chat would break §3.13; see the decisions below |
| C3 | Money is not answered in production | **Rejected** | The ledger is in the portal with estimate marks and the week's rate |
| C4 | After closing the portal goes quiet | **Confirmed** | Moving in is good; no referral or review moment anywhere in `app/(client)` |
| C5 | The free readout does not carry into the portal | **Rejected** | The saved plan prefills the brief and the money ledger |
| New | Two client homes | **Found** | `DecisionRoom` and `Choose` render only in `app/(rift)/plan/[token]`; `lib/db/portal.ts` reads neither |
| New | Today contradicts itself | **Found** | James Holloway: "Needs the sale's possession date first… James Holloway is handling it", then "Nothing is waiting on you". Sellers are labelled "(buyer)" |

## 3. Capacity math

Rough and explicit, for a book of 10 active clients (5 searching, 3 under contract, 2
selling) plus 10 new leads a week. Minutes per week.

| Activity | Today | After the top 10 | Assumption |
| --- | --- | --- | --- |
| Status questions under contract | 45 | 15 | 3 a week per contract at 5 min; notices and "since you last looked" answer two of them |
| Chasing lender, attorney, others | 54 | 27 | 3 check-ins a week per contract at 6 min; a prepared draft halves it |
| Seller offer choice relayed and re-keyed | 20 | 5 | One round a week across the sellers |
| Closing-week questions | 8 | 3 | One closing every two weeks, three questions at 5 min |
| Search-phase questions | 25 | 20 | One a week per searching client |
| New leads: dial and log twice | 30 | 10 | 3 min a lead today, 1 after |
| Referral asks written by hand | 5 | 1 | One closing every two weeks |
| **Total** | **187 (3.1 h)** | **81 (1.4 h)** | About 1.8 hours a week saved per 10 clients |

The bigger effect is not the hours. It is the same-day promise holding at twice the book.

## 4. The top 10, ranked by outcome impact over effort

| # | Change | Moves | Effort |
| --- | --- | --- | --- |
| 1 | "I have replied" asks how (call, text, email) and records that as contact | Capacity, trust in own data | 0.5 d |
| 2 | Call and text from the new-lead row, with a prepared opener from what they were told | Conversion | 0.5 d |
| 3 | Tell the client when something becomes theirs under contract | Retention, capacity | 1 d |
| 4 | The seller's offers and their choice, in the portal | Retention, capacity | 2 d |
| 5 | Closing-week list in the portal, with the wire-fraud warning | Trust, capacity | 1 d |
| 6 | "Pass it on" after closing, in the portal, the same for everyone | Referral | 0.5 d |
| 7 | Draft the check-in for Waiting on others | Capacity | 0.5 d |
| 8 | Released decisions in the portal | Retention | 1 d |
| 9 | Client Today stops contradicting itself; sellers labelled as sellers | Trust | 0.5 d |
| 10 | "Since you last looked" on the client's Today | Retention | 1.5 d |

Acceptance tests, written first, in the style of handoff §7:

1. Given a new lead marked replied with "Call" on Today, Relationships shows a last contact of
   today and the lead page shows a call note; the sequence is stopped (4.11 still holds).
2. Given a new lead with a phone number, the Today row offers Call and Text links to that
   number; the text's body names Kaleb and the place they asked about and contains no figure
   that was not on their readout. A lead with no phone shows Email only.
3. Given a workstream or plan step saved with the client as owner, each joined member with the
   right scope is emailed once per window, the email names the kind of thing and links to
   Today, and carries no address, figure or document (WS11.5 rules).
4. Given released offers on a sale, a joined seller with "Price and fees" sees them in the
   portal, ranked by what reaches them, and can choose one; the choice is recorded with what
   they were shown, once, and Today shows Kaleb the same item as from the plan link. A
   viewer, or a member without the scope, sees neither the offers nor the control.
5. Given a buying journey at Close, or with a closing date within 7 days, the client's Today
   shows the closing-week list, led by the wire-fraud warning with its official source; a sale
   shows the seller's version.
6. Given a journey with a recorded closing, every joined member sees the same pass-it-on card
   with the lead's referral link; nothing in it depends on mood or advocacy state (4.9).
7. Given a Waiting on others item for a contract workstream, "Draft the check-in" opens a
   message naming the property, the workstream and the last word, and nothing is sent by Rift.
8. Given a released decision on the lead behind a journey, a joined member sees it in the
   portal exactly as on the plan link; an unreleased one never leaves the server.
9. Given a dependency whose owner is the member, Today does not also say "Nothing is waiting
   on you". A member of a sale is labelled Seller or Co-seller.
10. Given a member who last opened the portal on day D, Today lists what changed since D that
    they are allowed to see, and nothing they are not; a first visit lists nothing.

## Status (13 October 2026)

All ten are built, each in its own commit with its acceptance test, and checked in a browser
against the demo book. Where the build differs from the plan above:

- **Item 2.** Text is offered only with the phone consent recorded on the lead's enrolment
  (4.12); the opener names no figure and no day.
- **Item 3.** The new kind is `yours` (migration `20261013100000`). A person on two journeys
  from one lead is told once.
- **Item 5.** Practical steps only, without sources: the official pages could not be read from
  the build environment (handoff §8.3).
- **Item 7.** A mail draft with an empty "To", not an Outbox message: no third party's
  address is stored (decision below).
- **Item 10.** Changes are counted by Georgia day, after the day of the last visit, because
  most records carry a day and not a time (migration `20261013110000`).
- **Found on the way:** Today read the lead's enrolment as a list when PostgREST returns an
  object, so no lead ever read as stopped and stopped leads kept counting as waiting for a
  first reply. Fixed with item 1. The same shape in the retention sweep is listed in
  handoff §8.3.

## 5. Decisions for Kaleb

**Made on 13 October, on these recommendations, and built** (handoff §8.3). The date reminders
are built behind business rule 7, `clientDateReminders`, which starts off.

- **Retire the plan link for clients with a portal.** Once 4 and 8 are live, a member opening
  `/plan/<token>` could be sent to the portal. *Recommendation:* yes, for joined members only;
  leads without a portal keep the link.
- **Asking Kaleb from inside the portal.** §3.13 rules out a chatbot. A per-item "Ask Kaleb
  about this" that opens the client's own email with the item named would keep the record in
  email and still save a "which one?" exchange. *Recommendation:* try it on Today only.
- **Third-party contacts on a contract.** With the lender's and attorney's emails stored, item
  7 could put check-ins in the Outbox for one-click approval instead of opening a mail draft.
  *Recommendation:* yes, approval-gated like every other send (§10.2).
- **Contract-date reminders to clients.** A scheduled email 48 hours before a checked date the
  client owns. *Recommendation:* yes, after item 3 has run for two weeks without complaints.

## 6. Considered and dropped

- Accessibility, mobile and visual passes: out of scope by the filter; none blocked a task.
- Generated first replies or check-ins: rule 1 and §10.2. The openers and drafts here are fixed
  templates filled from stored facts.
- A chat or message thread in the portal: §3.13. See the decision above instead.
- A weekly digest to every client: items 3 and 10 say the same thing when it happens.
- Third-party analytics on portal use: rule 6 and "What not to do".
- Ranking leads with anything but the existing score: the score is already explained on the row.
