# Testing Rift: what to try on each page

**Written:** 24 September 2026, for the build at the head of `main`.
**Live site:** https://rift-homebuyer-roadmap.vercel.app
**Code:** https://github.com/KalebBefekadu/rift-homebuyer-roadmap

Everything below is on the live site, which is production. Rift has no real clients yet, so
anything you create while testing is test data. When you are done, say so and it will be
cleared.

## 1. Signing in

There are no passwords anywhere. Both sides sign in with a link sent by email.

| Who | Where | How |
| --- | --- | --- |
| You, as the agent (Operations) | `/studio/sign-in` | Enter `kalebbefekadu@gmail.com`, then open the link in the email. Only that address is an agent; any other address is refused. |
| A buyer | `/app/invite/<token>` | You make an invitation link in Operations (section 4, Household) for an email address you own. Open the link, ask for a sign-in link, open the email, accept. |

Things that will trip you up if you do not know them:

- **Use two browsers, or one normal window and one private window.** The agent and the
  buyer share the same site, so signing in as the buyer in the same browser signs you out
  as the agent.
- **Open the email link on the same device and browser** where you want to be signed in. A
  link works once and expires after a short time. Ask for a new one if it has expired.
- **The buyer address must be one you invited.** `/app/sign-in` quietly sends nothing to an
  address nobody invited (so it cannot be used to find out who is a client).
- **Use a second address you own for the buyer**, not `kalebbefekadu@gmail.com`. Your other
  Gmail has received a sign-in link from this project before, so it is known to work. A
  brand new address should work too; if its email never arrives (check spam), note it: it
  would mean the sign-in email service only delivers to some addresses.
- **Rift sends buyers nothing except sign-in links.** An invitation link is shown to you
  once and you send it yourself (text, email, anything). If you lose it, make a new one.

## 2. What is new since the blueprint v4 work began

The private buyer journey did not exist before. It now covers, end to end:

1. The search brief (their priorities, with where each came from) and the buyer confirming
   it or asking for changes.
2. The Matrix search: approving the brief as a search, copying the criteria, and recording
   that you set it up in Matrix (Rift does not connect to Matrix; you record it).
3. The household: several buyers on one purchase, each invited by link, with what each can see.
4. Homes: a shared shortlist that both sides add to and react to.
5. Showings, recorded step by step as they happen in ShowingTime.
6. Offers: versions, counters, asking every buyer, their answers, and documents.
7. Where it stands: stages, the contract, ten workstreams under contract, closing and keys.
8. Contract dates, as checked history, with deadlines on Today.
9. The buyer's own pages: Today, priorities, homes, offers, and a printable records page.
10. The morning summary email (9 AM Eastern, business days) of what buyers did.
11. The pilot report at `/studio/pilot`.

The public site (the front door, buyer, seller and abroad readouts, `/offer`, `/book`) was
already live and is unchanged in how it works, so it needs only a light pass (section 6).

## 3. The quickest full test: one pretend buyer, start to finish

Do this first. It touches every new page in the order a real client would. Allow about an
hour. Browser A is you as the agent, browser B is the buyer.

1. **A:** sign in at `/studio/sign-in`.
2. **A:** Add someone (top right). Name "Test Buyer", your second email, buying, any answers.
3. **A:** on their record, under Agreement, record a signed buyer agreement that runs out
   in a few months. Showing times are refused without one; skip this step first if you want
   to see the refusal in step 13.
4. **A:** under Journeys, Start a journey (buying). You land on the journey page.
5. **A:** write the Search brief (price, beds, areas, must-haves) and save it.
6. **A:** Household: make an invitation link for your second email. Copy it.
7. **B:** open the invitation link, ask for a sign-in link, open the email, accept.
8. **B:** on Your search priorities, press "Something should change" and ask for one change.
9. **A:** refresh the journey page. The request shows under "What changed, and who agrees".
   Save a new version of the brief that makes the change.
10. **B:** press "These are right".
11. **A:** Matrix search: "Approve as Matrix search", "Copy criteria", then "I set this up in
    Matrix" with any saved search name.
12. **A:** Homes: add two homes (any address, price, beds). **B:** react to one ("Interested")
    and press "Would like to see it" on the other. Also "Add a home you found".
13. **A:** Showings: take the requested showing through "Asked in ShowingTime", a confirmed
    time, then "It happened". **B:** answer "You saw it. Would you consider an offer?".
14. **A:** Offers: Add a document (a small PDF), then Start an offer on that home, and ask the
    household with the document attached. **B:** answer "Go ahead with these terms"; the
    document opens from their side. **A:** record it prepared, signed, delivered, then accepted.
15. **A:** Where it stands: Record a contract (executed). Update a couple of workstreams.
16. **A:** Dates: add two dates from the contract (for example the end of due diligence as
    "calendar days after a date", and the closing date as written), then press "Checked
    against the document" on each. **B:** the checked dates now appear for the buyer.
17. **B:** on Today, report one of their tasks done ("I have done this" or "I sent it").
    **A:** confirm it on the workstream.
18. **A:** open `/studio/pilot`. Your replies from steps 9, 13, 14 and 17 are counted there.
    Record a check for the journey.
19. **B:** open the records page (link on their journey page) and print it or save it as a PDF.
20. **A:** Where it stands: "It closed, or was terminated", closed, with the closing confirmed.
    **B:** the buyer now sees "You own your home". Record possession and keys as their own step.
21. **Next business morning:** the summary email lists what the buyer did.

## 4. Operations (the agent side), page by page

Sign in first. The menu across the top: Today, Relationships, Search, Offers, Calendar,
Advocacy, Pilot, plus Add someone, Your questions and Your decisions on the right.

### Today `/studio`

- [ ] Leads are ranked, and each shows why it ranks where it does.
- [ ] A contract date that has passed shows as urgent until you record what happened.
- [ ] A scheduled job that failed or did not run shows as urgent. Retention sweep and rates
      refresh read "never" until their first recorded run (03:00 UTC daily, and Fridays).
- [ ] Nothing on it overflows or needs a sideways scroll on your phone.

### Relationships `/studio/clients`

- [ ] Everyone is listed newest first, and search by name or email finds them.
- [ ] Clicking a person opens their record.

### A person's record `/studio/lead/<id>`

- [ ] Contact details, where they are in the pipeline, and history newest first.
- [ ] "The next thing to do" with a due date saves.
- [ ] Agreement: record signed, with signed and runs-out dates. Try one that has already run out.
- [ ] Journeys: Start a journey, for buying (and try selling, to see that selling is not built yet).
- [ ] Their plan: add a step, mark it done, copy the plan link and open it signed out.
- [ ] Decisions: create a decision room with two options.
- [ ] Archive the record, then find it again.

### Add someone `/studio/add`

- [ ] Refuses with neither email nor phone; one of the two is enough.
- [ ] Asks why you can contact them, and saves.

### A buying journey `/studio/journey/<id>`

This is the main new page. Each section on it:

**Search brief**
- [ ] Write it, save it. Each change is kept as a version with who made it.
- [ ] Wording about who lives nearby, school rankings or crime is refused, including in free text.

**What changed, and who agrees**
- [ ] Shows each buyer's answer to the current version, and a buyer's requested change.

**Matrix search**
- [ ] "Approve as Matrix search" works only on a saved version.
- [ ] "Copy criteria" copies text you could paste into Matrix.
- [ ] "I set this up in Matrix" needs the saved search name (or its link).
- [ ] Pause and resume ("Record it paused in Matrix", "Record it running again").
- [ ] After changing the brief, the page says the Matrix search no longer matches until you
      approve and record again.

**Household**
- [ ] "Make invitation link" for an email, choosing what they can see (with or without money).
- [ ] The link is shown once. Making another replaces the first.
- [ ] Withdraw someone's access; their next visit to `/app` shows nothing of this journey.
- [ ] An invitation opened by a different signed-in address is refused. Links expire after 14 days.

**Homes**
- [ ] Add a home. The buyer's reactions and notes appear against it.
- [ ] Fit reads like "meets 2 of 3, 1 still to check", never a percentage.

**Showings**
- [ ] Refused without a signed buyer agreement in force today, with how to fix it.
- [ ] Each step: asked in ShowingTime, confirmed time, the time changed, cancel with a reason,
      it happened, then the buyer's answer (or record the answer they gave you by phone).
- [ ] A second viewing can be asked for after an answer.

**Offers**
- [ ] Start an offer, then ask the household.
- [ ] With two buyers, one "Go ahead" and one "Do not make this offer" shows a disagreement,
      and nothing can be prepared until it is settled.
- [ ] Record their counter: earlier answers stop counting but stay visible.
- [ ] "Record an answer they gave you" (by phone) says how they said it.
- [ ] Prepared, signed, delivered and accepted are separate steps. Accepted does not create
      the contract on its own.
- [ ] Add a document: PDF, JPG or PNG, up to 20 MB. Try a text file renamed to .pdf: it is
      refused. A document attached to an offer version reaches the buyers asked about it.
      Opening a document works through a link that lasts a minute.
- [ ] Withdraw an offer.

**Where it stands**
- [ ] Change the stage, with a reason. Under contract and Own cannot be chosen directly.
- [ ] Record a contract: the stage becomes Under contract, and ten workstreams appear. A cash
      purchase marks financing and appraisal as not applying.
- [ ] A workstream with no update for seven days says "waiting for an update", never "on track".
- [ ] "It closed, or was terminated": terminated sends the journey back to Search or Offer
      and keeps the old contract on file; the next contract starts with no dates.
- [ ] Closed with the closing confirmed by a named person moves it to Own.
- [ ] History shows every change and who made it.

**Dates** (appears once there is a contract)
- [ ] Add a date as written, or counted by a rule (calendar days, or business days that skip
      federal holidays). A date with no time never shows a time.
- [ ] "Checked against the document": the buyer sees a date only after this.
- [ ] Record an amendment that moves two dates at once. Correct it. No longer applies.
- [ ] A passed date shows on Today until you record what happened.

### Search `/studio/search`

- [ ] Each buyer's search with what is yours to do first: write the brief, approve it, set it
      up in Matrix and record it, or "The brief changed. Review it and update Matrix". A
      search that is running says "Nothing to do".

### Offers `/studio/offers`

- [ ] Offers sent through the public `/offer` form, read with the same arithmetic the sender saw.
- [ ] On a seller's record, compare offers and write "Your take", then "Approve and show seller".

### Calendar `/studio/calendar`

- [ ] The next five weeks across everyone, as a list, leading with what a client can see.

### Advocacy `/studio/referrals`

- [ ] After a closing: the same neutral review request for everyone, and a referral link to copy.

### Pilot `/studio/pilot`

- [ ] "Same-day replies": every buyer request is counted as same day, later, past due or
      waiting. Something a buyer did on Saturday is due Monday.
- [ ] "Still waiting on you" names who is waiting.
- [ ] "Search setup": time from approving a search to recording it in Matrix.
- [ ] "Checked against Matrix and the documents": Record a check. "Differs" needs a note on
      what differed. After you change the brief or a date, the check shows as out of date.
- [ ] Sign-in and scheduled work counts are right.
- [ ] Print: the menu and buttons are left off the printed copy.

### Your questions `/studio/questions` and Your decisions `/studio/settings`

- [ ] Edit a funnel question's wording and publish it; `/buy/start` shows the new wording.
- [ ] Each setting says what it changes, and changing one is saved.

### The morning summary (email)

- [ ] Arrives at 9 AM Eastern on business days, only when there is something to say.
- [ ] Lists what buyers did since the previous business morning, not what you did.
- [ ] A holiday is covered the next business morning.

## 5. The buyer's side, page by page

Use browser B, signed in with the invited address.

### Invitation `/app/invite/<token>`

- [ ] Says who invited them and to what, with the invited address partly hidden.
- [ ] Accepting while signed in as a different address is refused, with what to do.
- [ ] A used, withdrawn or expired link says which, and what to do.

### Sign in `/app/sign-in` and home `/app`

- [ ] With one journey, `/app` goes straight to it; with none, it says so plainly.

### Their journey `/app/j/<id>`

**Today**
- [ ] Order: what is blocking, then waiting on your answer, then yours to do (due within a
      week), then what others are doing.
- [ ] "I sent it" on earnest money reads "sent, not confirmed received" until you confirm it.
- [ ] After closing: "You own your home", with who confirmed it and when.

**Your search priorities**
- [ ] "These are right", "Something should change" and "Make the change myself" all work,
      and you see each on the agent side.
- [ ] Nothing here says "accept" or "sign".

**Homes**
- [ ] React: Interested, Maybe, Pass, Would like to see it, with an optional note.
- [ ] Add a home you found.
- [ ] After a showing, answer "Would you consider an offer?".
- [ ] A showing blocked by an agreement lapse shows only "On hold".

**Offers**
- [ ] Only versions they were asked about, and money only if they were given the money view.
- [ ] Answer: Go ahead with these terms, Change something first, Do not make this offer. Change the answer.

### Records `/app/j/<id>/records`

- [ ] Priorities, homes, showings, offers, where it stands, checked dates, and the documents
      on offers they were asked about.
- [ ] Print or save as a PDF; the copy reads well without the website.

## 6. The public site (light pass)

Signed out, ideally on your phone as well.

- [ ] `/` Front door: choose buying, selling or neither.
- [ ] `/buy` then `/buy/start`, answer the questions, then `/buy/results`: figures appear with
      no email asked for. Saving by email creates a person in Operations, sends you the
      new-lead alert, and starts follow-up emails to that address.
- [ ] `/buy/programs` and `/buy/how`.
- [ ] `/sell`, `/sell/start`, `/sell/results`, `/sell/unclaimed`, `/sell/how`.
- [ ] `/abroad`, `/abroad/results`, `/abroad/how`, including the Amharic switch.
- [ ] `/offer`: submit an offer; it appears in Operations under Offers.
- [ ] `/book`: there is no calendar connected, so it asks for a preferred time rather than
      offering real slots. That is expected.
- [ ] `/privacy`, and "delete all of it" from a readout.
- [ ] A shared readout link (`/r/...`) shows the figures as they were saved, with their date.

## 7. Known gaps (not bugs)

- **Money and seller journeys are not built.** Money (W10) starts with the pilot, and the
  seller journey (W13) waits for the pilot's results. A selling journey shows a placeholder.
- **Rift does not connect to Matrix, ShowingTime, Remine or Google.** You record what you did
  there. That is the design until account rights are confirmed.
- **Rules still waiting for the broker** (when an agreement is required, which records are
  kept and for how long, which date-counting rule a Georgia contract uses) are today's rules.
- **Deleting a person who has a contract keeps that journey**, as the privacy page promises.
- **No text messages**; every text step goes by email instead.
- **Licence number and phone** are blank on purpose until you supply them.
- **One Amharic message** (what was kept after a deletion) shows in English.
- The instant alert for a new lead and for a seller choosing an offer still arrives straight
  away; everything from buyers waits for the morning summary.

## 8. Reporting what you find

For each problem, note:

1. the page address,
2. what you did, in order,
3. what you expected and what happened instead,
4. a screenshot, and the time (so it can be found in the logs),
5. phone or computer, and which browser.

"It felt slow" or "this wording is confusing" is worth reporting too.
