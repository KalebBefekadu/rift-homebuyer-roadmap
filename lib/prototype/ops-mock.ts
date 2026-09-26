/**
 * Made-up data for the Operations mock-up (Blueprint v5 §8, decision D15).
 *
 * Kaleb approves the new Operations layout by clicking through a mock-up
 * before any real screen is rebuilt. Everything here is invented and fixed to
 * one moment, Friday 25 September 2026 at 9:31 in the morning, so the mock-up
 * reads the same every time it is opened and nothing in it can be mistaken for
 * a real client.
 *
 * The clock matters more than it looks. The first version said a job "retries
 * at 8:00" beside a text that arrived at 8:10 and a lead that came in at 9:25,
 * so the page contradicted itself about what time it was. Every time and every
 * "in N days" below is measured from NOW, and ops-mock.test.ts checks that
 * nothing on Today is in the wrong group for that clock.
 *
 * The vocabulary is the real one: stages, workstreams and who owns each come
 * from lib/core/progress.ts, so the mock-up cannot quietly propose words the
 * product does not use.
 *
 * Pure data: no React, no I/O.
 */

import type { Stage, Workstream, WorkState } from "@/lib/core/progress";
import type { StepMark } from "./ops-playbook";

/** The mock-up's "now": Fri 25 Sep 2026, 9:31 am, Atlanta. */
export const NOW = { day: "2026-09-25", time: "9:31 am", label: "Fri 25 Sep, 9:31 am" };
export const MOCK_TODAY = "Fri 25 Sep";

/** Whole days from NOW to an ISO day; negative when it has passed. */
export function daysFromNow(iso: string): number {
  return Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${NOW.day}T00:00:00Z`)) / 86_400_000);
}

/** "today", "tomorrow", "in 4 days", "2 days ago". */
export function inDays(iso: string): string {
  const d = daysFromNow(iso);
  if (d === 0) return "today";
  if (d === 1) return "tomorrow";
  if (d === -1) return "yesterday";
  return d > 0 ? `in ${d} days` : `${-d} days ago`;
}

export type Side = "buy" | "sell";

export interface MockPerson {
  id: string;
  name: string;
  side: Side;
  /** Lead, or client with the stage of their journey. */
  stage: "New lead" | "Nurture" | "Client" | "Past client";
  journeyStage?: Stage;
  next: string;
  /** Shown as written; `dueOn` sorts it. */
  due: string;
  dueOn: string;
  overdue?: boolean;
  lastContact: string;
  lastContactOn: string;
  source: string;
  /** The lead summary (§5.5): what they did, from what they handed over. */
  summary: string;
  phone?: string;
  email: string;
  journeyIds: string[];
  /** The saved plan they started from, if any. */
  plan?: string;
  /** Representation (buyer or listing agreement), in the product's words. */
  agreement: { state: "signed" | "sent" | "none"; text: string };
  notes: { at: string; kind: "Call" | "Email" | "Text" | "Note"; body: string }[];
}

export const PEOPLE: MockPerson[] = [
  {
    id: "p1", name: "Maya Tesfaye", side: "buy", stage: "New lead",
    next: "Call back: she asked for a review of her numbers", due: "Today 9:40", dueOn: "2026-09-25",
    lastContact: "Never", lastContactOn: "", source: "Instagram · fall-assistance",
    summary: "Asked for a review of a $340k plan: 3 assistance programs to check, cash to close $14,210. No call booked.",
    phone: "(404) 555-0142", email: "maya.t@example.com", journeyIds: [],
    plan: "$340k plan, saved today 9:25",
    agreement: { state: "none", text: "No buyer agreement yet" },
    notes: [{ at: "Today 9:25", kind: "Note", body: "Came in from the fall assistance post. Asked for a review, left a phone number." }],
  },
  {
    id: "p2", name: "Daniel and Ruth Okafor", side: "buy", stage: "Client", journeyStage: "under-contract",
    next: "Confirm the appraisal is ordered", due: "Today", dueOn: "2026-09-25", overdue: true,
    lastContact: "Yesterday", lastContactOn: "2026-09-24", source: "Referral · the Abebes",
    summary: "Saved a $425k plan: cash to close $24,788, monthly cost $2,891. Booked a call.",
    phone: "(678) 555-0110", email: "okafor.home@example.com", journeyIds: ["j1"],
    plan: "$425k plan, saved 2 Aug",
    agreement: { state: "signed", text: "Buyer agreement signed 9 Aug, until 9 Feb" },
    notes: [
      { at: "Thu 24 Sep", kind: "Call", body: "Inspection response signed. Seller fixes the water heater and the GFCI outlets." },
      { at: "Tue 22 Sep", kind: "Email", body: "Sent the inspection summary and the three items worth asking for." },
    ],
  },
  {
    id: "p3", name: "Selam Haile", side: "buy", stage: "Client", journeyStage: "tour",
    next: "Approve the search change she asked for", due: "Today", dueOn: "2026-09-25",
    lastContact: "Wed 23 Sep", lastContactOn: "2026-09-23", source: "Abroad page",
    summary: "Checked she can buy from abroad; cost to buy and own a year $96,300. Booked a call.",
    phone: "+251 91 555 0100", email: "selam.h@example.com", journeyIds: ["j2"],
    plan: "Buying from abroad, saved 14 Sep",
    agreement: { state: "signed", text: "Buyer agreement signed 18 Sep, until 18 Mar" },
    notes: [{ at: "Wed 23 Sep", kind: "Call", body: "Wants Decatur added, and townhomes are fine now. Her brother Yonas is less sure." }],
  },
  {
    id: "p4", name: "Grace Whitfield", side: "sell", stage: "Client", journeyStage: "offer",
    next: "Go through both offers on what reaches her", due: "Today 4:00 pm", dueOn: "2026-09-25",
    lastContact: "Today 8:10", lastContactOn: "2026-09-25", source: "Seller landing",
    summary: "Saved a plan: what she'd keep $151,010 to $159,310, selling costs $19,690 to $27,990. Booked a call.",
    phone: "(770) 555-0199", email: "grace.w@example.com", journeyIds: ["j3"],
    plan: "Selling plan, saved 20 Aug",
    agreement: { state: "signed", text: "Listing agreement signed 28 Aug, until 28 Feb" },
    notes: [{ at: "Today 8:10", kind: "Text", body: "Second offer came in overnight. Call at 4?" }],
  },
  {
    id: "p5", name: "Tomás Rivera", side: "buy", stage: "Nurture",
    next: "Reply to his question (draft ready)", due: "Today", dueOn: "2026-09-25",
    lastContact: "Thu 24 Sep", lastContactOn: "2026-09-24", source: "Google",
    summary: "Saved a $290k plan: 14 months to save the down payment. No call booked.",
    email: "tomas.r@example.com", journeyIds: [],
    plan: "$290k plan, saved 1 Sep",
    agreement: { state: "none", text: "No buyer agreement yet" },
    notes: [
      { at: "Thu 24 Sep", kind: "Email", body: "Replied to follow-up 2: does the 14 months change if his partner's income counts? The emails stopped here." },
      { at: "Mon 14 Sep", kind: "Email", body: "Follow-up 2 sent on schedule." },
    ],
  },
  {
    id: "p6", name: "Hannah Lee", side: "buy", stage: "Client", journeyStage: "close",
    next: "Answer her early move-in question", due: "Yesterday", dueOn: "2026-09-24", overdue: true,
    lastContact: "Today 7:55", lastContactOn: "2026-09-25", source: "Past client · the Parks",
    summary: "Booked a call from the lender questions page.",
    phone: "(404) 555-0177", email: "hannah.lee@example.com", journeyIds: ["j4"],
    agreement: { state: "signed", text: "Buyer agreement signed 2 Jul" },
    notes: [
      { at: "Today 7:55", kind: "Email", body: "Lender: clear to close." },
      { at: "Thu 24 Sep", kind: "Text", body: "Can I move a few boxes in before closing?" },
    ],
  },
  {
    id: "p7", name: "Abebe family", side: "buy", stage: "Past client",
    next: "One year in their home: homestead reminder", due: "Thu 1 Oct", dueOn: "2026-10-01",
    lastContact: "Aug 2026", lastContactOn: "2026-08-12", source: "Past client",
    summary: "Closed 30 Sep 2025. Referred the Okafors.",
    email: "abebe.fam@example.com", journeyIds: [],
    agreement: { state: "signed", text: "Closed; agreement ended" },
    notes: [{ at: "12 Aug", kind: "Call", body: "Thanked them for sending the Okafors." }],
  },
  {
    id: "p8", name: "Marcus Bell", side: "buy", stage: "Client", journeyStage: "under-contract",
    next: "Hear back from the attorney on the lien", due: "Mon 28 Sep", dueOn: "2026-09-28",
    lastContact: "Tue 22 Sep", lastContactOn: "2026-09-22", source: "Zillow message",
    summary: "Saved a $360k plan: cash to close $19,400. Booked a call.",
    phone: "(470) 555-0123", email: "marcus.b@example.com", journeyIds: ["j5"],
    plan: "$360k plan, saved 30 Jul",
    agreement: { state: "signed", text: "Buyer agreement signed 3 Aug, until 3 Feb" },
    notes: [{ at: "Tue 22 Sep", kind: "Call", body: "Told him about the lien. The seller's side says it is paid and will send proof." }],
  },
];

/** A workstream on a contract, with who owns it and their last word (progress.ts). */
export interface MockWork {
  stream: Workstream;
  state: WorkState;
  /** Who it is waiting on, in the product's words: "You", "The lender", "The buyers". */
  who: string;
  note?: string;
  due?: string;
  /** Rule 9: nothing is confirmed without a named party and a day. */
  word?: string;
  /** No word from an outside party for STALE_DAYS or more. */
  stale?: boolean;
}

export interface MockParty { role: string; name: string; reach: string }

export interface MockJourney {
  id: string;
  personId: string;
  label: string;
  side: Side;
  stage: Stage;
  next: string;
  household: { name: string; role: string; joined: boolean }[];
  keyDates: { label: string; on: string; iso: string; state: "done" | "soon" | "passed" | "later" }[];
  brief?: { field: string; value: string; strength: "Requirement" | "Preference" | "Not decided"; by: string }[];
  briefNote?: string;
  /** The saved Matrix search, as the agent sees it. */
  matrix?: string;
  homes?: { address: string; price: string; reactions: { who: string; says: string }[]; showing?: string }[];
  offers?: {
    from: string; price: string; reaches?: string; terms: string; status: string;
    received?: string; expires?: string; earnest?: string; source?: string;
  }[];
  documents?: { name: string; added: string; shared: string }[];
  work?: MockWork[];
  property?: string;
  price?: string;
  closing?: { label: string; iso: string };
  team?: MockParty[];
  /** The journey so far, stage by stage: what the stage track opens. */
  story: { stage: Stage; at: string; what: string }[];
  /** Where this journey's checklist steps stand, where that is not simply
   *  "done" for a passed stage or "to do" (ops-playbook.ts, stepsFor). */
  checks?: Record<string, StepMark>;
}

export const JOURNEYS: MockJourney[] = [
  {
    id: "j1", personId: "p2", label: "First home, DeKalb", side: "buy", stage: "under-contract",
    next: "Confirm the appraisal is ordered", property: "2214 Candler Park Ct, Decatur", price: "$418,000",
    closing: { label: "Fri 16 Oct", iso: "2026-10-16" },
    household: [
      { name: "Daniel Okafor", role: "Buyer", joined: true },
      { name: "Ruth Okafor", role: "Buyer", joined: true },
    ],
    keyDates: [
      { label: "Due diligence ended", on: "Wed 23 Sep", iso: "2026-09-23", state: "done" },
      { label: "Appraisal due", on: "Tue 29 Sep", iso: "2026-09-29", state: "soon" },
      { label: "Financing contingency ends", on: "Mon 5 Oct", iso: "2026-10-05", state: "later" },
      { label: "Closing", on: "Fri 16 Oct", iso: "2026-10-16", state: "later" },
    ],
    team: [
      { role: "Lender", name: "Priya Nair, Summit Home Loans", reach: "(404) 555-0188" },
      { role: "Closing attorney", name: "Hart & Cole LLP", reach: "closings@example.com" },
      { role: "Listing agent", name: "Dana Brooks", reach: "(678) 555-0164" },
    ],
    work: [
      { stream: "earnest-money", state: "confirmed", who: "The buyers", note: "$4,000 received", word: "Closing attorney, Mon 14 Sep" },
      { stream: "inspection", state: "confirmed", who: "The buyers", note: "Response signed by both sides", word: "Listing agent, Thu 24 Sep" },
      { stream: "financing", state: "in-progress", who: "The lender", note: "Conditional approval", word: "Lender, Fri 18 Sep" },
      { stream: "appraisal", state: "waiting", who: "The lender", note: "Not confirmed as ordered", due: "Tue 29 Sep", word: "Lender, Fri 18 Sep", stale: true },
      { stream: "title", state: "in-progress", who: "The closing attorney", note: "Search ordered", word: "Closing attorney, Mon 21 Sep" },
      { stream: "insurance", state: "not-started", who: "The buyers", due: "Fri 9 Oct" },
      { stream: "repairs", state: "in-progress", who: "You", note: "Water heater, GFCI outlets" },
      { stream: "walkthrough", state: "not-started", who: "You", due: "Thu 15 Oct" },
      { stream: "closing", state: "not-started", who: "The closing attorney", due: "Fri 16 Oct" },
      { stream: "possession", state: "not-started", who: "You", due: "Fri 16 Oct" },
    ],
    homes: [{ address: "2214 Candler Park Ct, Decatur", price: "$418,000", reactions: [{ who: "Both", says: "Under contract" }] }],
    offers: [{ from: "The Okafors (your offer)", price: "$418,000", terms: "FHA, 10 days due diligence, $4,000 seller contribution, close 16 Oct", status: "Accepted 9 Sep" }],
    documents: [
      { name: "Purchase and sale agreement", added: "9 Sep", shared: "Both buyers" },
      { name: "Inspection report", added: "18 Sep", shared: "Both buyers" },
      { name: "Amendment to address concerns", added: "24 Sep", shared: "Both buyers" },
    ],
    checks: {
      "b-uc-read": { state: "done", by: "You", on: "9 Sep", note: "Rift read the contract; you checked and approved the dates" },
      "b-uc-dates": { state: "done", by: "You", on: "9 Sep" },
      "b-uc-kickoff": { state: "done", by: "You", on: "10 Sep", note: "Approved by you, sent by Rift" },
      "b-inspect-book": { state: "done", by: "Meron", on: "11 Sep" },
      "b-chase": { state: "doing", note: "Flagged the lender today: no word on the appraisal for 7 days" },
    },
    story: [
      { stage: "prepare", at: "2 Aug", what: "Saved a $425k plan on the cost-to-buy page" },
      { stage: "prepare", at: "9 Aug", what: "Buyer agreement signed by both" },
      { stage: "prepare", at: "10 Aug", what: "Pre-approved with Summit Home Loans" },
      { stage: "search", at: "12 Aug", what: "Search brief agreed: DeKalb, 3 bedrooms, at most $430,000" },
      { stage: "search", at: "12 Aug", what: "Matrix search started; 31 matches in the first week" },
      { stage: "tour", at: "16 Aug", what: "First showings: 4 homes" },
      { stage: "tour", at: "6 Sep", what: "9 homes seen in all; both said yes to Candler Park Ct" },
      { stage: "offer", at: "8 Sep", what: "Offered $418,000, FHA, asking $4,000 toward costs" },
      { stage: "offer", at: "9 Sep", what: "Offer accepted" },
      { stage: "under-contract", at: "14 Sep", what: "Earnest money received by the attorney" },
      { stage: "under-contract", at: "18 Sep", what: "Lender: conditional approval" },
      { stage: "under-contract", at: "Wed 23 Sep", what: "Due diligence ended; the contract is firm" },
      { stage: "under-contract", at: "Thu 24 Sep", what: "Inspection response signed by both sides" },
    ],
  },
  {
    id: "j2", personId: "p3", label: "Rental from abroad", side: "buy", stage: "tour",
    next: "Approve the search change",
    household: [
      { name: "Selam Haile", role: "Buyer", joined: true },
      { name: "Yonas Haile", role: "Sees homes, not money", joined: true },
    ],
    keyDates: [{ label: "Video tours", on: "Sat 26 Sep", iso: "2026-09-26", state: "soon" }],
    briefNote: "Selam asked on Wed for Decatur and townhomes. Yonas reacted \"no\" to both townhomes on the shortlist. The Matrix search changes only after you approve.",
    matrix: "Saved search \"Haile, DeKalb\" · runs every morning · 4 new matches this week",
    brief: [
      { field: "Price", value: "At most $300,000", strength: "Requirement", by: "Selam, call on 23 Sep" },
      { field: "Areas", value: "DeKalb County, adding Decatur", strength: "Requirement", by: "Selam, call on 23 Sep" },
      { field: "Type of home", value: "Single-family, adding townhouse", strength: "Not decided", by: "Selam yes, Yonas no" },
      { field: "Bedrooms", value: "At least 3", strength: "Requirement", by: "Her saved plan, 14 Sep" },
    ],
    homes: [
      { address: "88 Ponce Pl, Decatur (townhouse)", price: "$289,000", reactions: [{ who: "Selam", says: "Interested" }, { who: "Yonas", says: "No" }], showing: "Video tour Sat 11:00" },
      { address: "1407 Line St, Decatur (townhouse)", price: "$275,000", reactions: [{ who: "Selam", says: "Maybe" }, { who: "Yonas", says: "No" }], showing: "Video tour Sat 11:40" },
      { address: "310 Glenwood Ave, DeKalb", price: "$299,000", reactions: [{ who: "Selam", says: "No: the road" }, { who: "Yonas", says: "No" }] },
    ],
    checks: {
      "b-react": { state: "doing", note: "Selam and Yonas reacted to all three; they disagree on both townhomes" },
      "b-tour-book": { state: "waiting", due: "Sat 26 Sep", note: "Video tours Sat 11:00 and 11:40, if you approve the search change. Listing agents have not confirmed access" },
      "b-tour-plan": { state: "todo", note: "Prepared for you once the tours are confirmed" },
    },
    story: [
      { stage: "prepare", at: "14 Sep", what: "Checked she can buy from abroad; saved the plan" },
      { stage: "prepare", at: "18 Sep", what: "Buyer agreement signed" },
      { stage: "prepare", at: "18 Sep", what: "Yonas invited: sees homes, not money" },
      { stage: "search", at: "19 Sep", what: "Search brief agreed: DeKalb, 3 bedrooms, at most $300,000" },
      { stage: "search", at: "19 Sep", what: "Matrix search started" },
      { stage: "tour", at: "Mon 21 Sep", what: "Three homes added to the shortlist" },
      { stage: "tour", at: "Tue 22 Sep", what: "Yonas said no to both townhomes" },
      { stage: "tour", at: "Wed 23 Sep", what: "Selam asked for Decatur and townhomes" },
    ],
  },
  {
    id: "j3", personId: "p4", label: "Selling in Cobb", side: "sell", stage: "offer",
    next: "Go through both offers with Grace at 4:00",
    household: [{ name: "Grace Whitfield", role: "Seller", joined: true }],
    keyDates: [
      { label: "Offer B expires", on: "Today 6:00 pm", iso: "2026-09-25", state: "soon" },
      { label: "Offer A expires", on: "Sat 26 Sep 12:00 pm", iso: "2026-09-26", state: "soon" },
    ],
    property: "41 Kennesaw Ave, Marietta", price: "Listed at $435,000",
    offers: [
      { from: "Offer A · Dana Brooks, agent", price: "$430,000", reaches: "$172,960", terms: "Conventional, $8,000 asked back, close 30 Oct", earnest: "$5,000", status: "Presented Thu", received: "Thu 24 Sep 3:20 pm", expires: "Sat 12:00 pm", source: "Emailed by the agent" },
      { from: "Offer B · unrepresented buyer", price: "$422,000", reaches: "$173,420", terms: "Cash, nothing asked back, close 16 Oct", earnest: "$10,000", status: "New overnight", received: "Today 2:14 am", expires: "Today 6:00 pm", source: "Offer page, PDF read and checked by the sender" },
    ],
    documents: [
      { name: "Offer B contract (PDF)", added: "Today 2:14 am", shared: "Not shared" },
      { name: "Seller's property disclosure", added: "30 Aug", shared: "Grace" },
    ],
    checks: {
      "s-receive": { state: "done", by: "Rift", on: "Today 2:14 am", note: "Offer A Thu 3:20 pm, by email; Offer B today 2:14 am, through the offer page" },
      "s-check": { state: "doing", due: "today, before 4:00 pm", note: "Offer A checked Thu. Offer B's terms were checked by its sender, not yet by you" },
      "s-compare": { state: "done", by: "Rift", on: "Today 2:20 am", note: "Offer B leaves her $460 more, and closes two weeks sooner" },
      "s-present": { state: "doing", due: "today 4:00 pm", note: "Offer A presented Thu. Offer B at 4:00 today" },
      "s-decide": { state: "todo", due: "today 6:00 pm, when Offer B expires" },
      "s-counter": { state: "todo", note: "When Grace decides" },
    },
    story: [
      { stage: "prepare", at: "20 Aug", what: "Saved a selling plan: what she'd keep" },
      { stage: "prepare", at: "28 Aug", what: "Listing agreement signed" },
      { stage: "prepare", at: "30 Aug", what: "Property disclosure completed" },
      { stage: "search", at: "4 Sep", what: "Listed at $435,000" },
      { stage: "tour", at: "4 to 20 Sep", what: "14 showings, 2 second visits" },
      { stage: "offer", at: "Thu 24 Sep", what: "Offer A presented to Grace" },
      { stage: "offer", at: "Today 2:14 am", what: "Offer B came in through the offer page, with its PDF read" },
      { stage: "offer", at: "Today 8:10", what: "Grace texted: call at 4?" },
    ],
  },
  {
    id: "j4", personId: "p6", label: "Condo in Midtown", side: "buy", stage: "close",
    next: "Confirm the repairs receipts before the walkthrough", property: "990 Peachtree St #1204, Atlanta", price: "$312,000",
    closing: { label: "Wed 30 Sep", iso: "2026-09-30" },
    household: [{ name: "Hannah Lee", role: "Buyer", joined: true }],
    keyDates: [
      { label: "Repairs receipts due", on: "Mon 28 Sep", iso: "2026-09-28", state: "soon" },
      { label: "Final walkthrough", on: "Tue 29 Sep", iso: "2026-09-29", state: "soon" },
      { label: "Closing", on: "Wed 30 Sep", iso: "2026-09-30", state: "soon" },
    ],
    team: [
      { role: "Lender", name: "Ana Ruiz, Peach State Credit Union", reach: "(770) 555-0150" },
      { role: "Closing attorney", name: "Moore Title & Law", reach: "(404) 555-0133" },
      { role: "Listing agent", name: "Chris Tan", reach: "chris.tan@example.com" },
    ],
    work: [
      { stream: "earnest-money", state: "confirmed", who: "The buyer", word: "Closing attorney, 10 Aug" },
      { stream: "inspection", state: "confirmed", who: "The buyer", word: "Listing agent, 20 Aug" },
      { stream: "financing", state: "confirmed", who: "The lender", note: "Clear to close", word: "Lender, today 7:55" },
      { stream: "appraisal", state: "confirmed", who: "The lender", word: "Lender, 2 Sep" },
      { stream: "title", state: "confirmed", who: "The closing attorney", word: "Closing attorney, 21 Sep" },
      { stream: "insurance", state: "reported", who: "The buyer", note: "HO-6 policy emailed by Hannah, not yet checked" },
      { stream: "repairs", state: "waiting", who: "The listing agent", note: "Receipts from the seller", due: "Mon 28 Sep", word: "Listing agent, Wed 23 Sep" },
      { stream: "walkthrough", state: "not-started", who: "You", due: "Tue 29 Sep" },
      { stream: "closing", state: "in-progress", who: "The closing attorney", due: "Wed 30 Sep", note: "Settlement statement expected Mon" },
      { stream: "possession", state: "not-started", who: "You", due: "Wed 30 Sep" },
    ],
    homes: [{ address: "990 Peachtree St #1204, Atlanta", price: "$312,000", reactions: [{ who: "Hannah", says: "Under contract" }] }],
    offers: [{ from: "Hannah Lee (your offer)", price: "$312,000", terms: "Conventional, 7 days due diligence, close 30 Sep", status: "Accepted 8 Aug" }],
    documents: [
      { name: "Purchase and sale agreement", added: "8 Aug", shared: "Hannah" },
      { name: "HO-6 policy", added: "Thu 24 Sep", shared: "From Hannah" },
    ],
    checks: {
      "b-settle": { state: "doing", due: "Mon 28 Sep", note: "The attorney expects to send it Monday" },
      "b-settle-check": { state: "todo", due: "Mon 28 Sep", note: "When the statement arrives" },
      "b-wire": { state: "ready", note: "Drafted from the attorney's instructions. Nothing sends until you approve" },
    },
    story: [
      { stage: "prepare", at: "2 Jul", what: "Buyer agreement signed; pre-approved with Peach State CU" },
      { stage: "search", at: "3 Jul", what: "Search brief agreed: Midtown condo, at most $330,000" },
      { stage: "tour", at: "July", what: "6 condos seen" },
      { stage: "offer", at: "7 Aug", what: "Offered $312,000, conventional" },
      { stage: "offer", at: "8 Aug", what: "Offer accepted" },
      { stage: "under-contract", at: "10 Aug", what: "Earnest money received" },
      { stage: "under-contract", at: "20 Aug", what: "Inspection done" },
      { stage: "under-contract", at: "2 Sep", what: "Appraisal at value" },
      { stage: "under-contract", at: "21 Sep", what: "Title clear" },
      { stage: "close", at: "Thu 24 Sep", what: "Hannah uploaded her HO-6 policy" },
      { stage: "close", at: "Thu 24 Sep", what: "Hannah asked about moving boxes in early" },
      { stage: "close", at: "Today 7:55", what: "Lender: clear to close" },
    ],
  },
  {
    id: "j5", personId: "p8", label: "Townhome in Smyrna", side: "buy", stage: "under-contract",
    next: "Get proof the lien is paid", property: "17 Ridge Walk, Smyrna", price: "$352,000",
    closing: { label: "Thu 22 Oct", iso: "2026-10-22" },
    household: [{ name: "Marcus Bell", role: "Buyer", joined: true }],
    keyDates: [
      { label: "Due diligence ended", on: "Fri 18 Sep", iso: "2026-09-18", state: "done" },
      { label: "Financing contingency ends", on: "Fri 9 Oct", iso: "2026-10-09", state: "later" },
      { label: "Closing", on: "Thu 22 Oct", iso: "2026-10-22", state: "later" },
    ],
    team: [
      { role: "Lender", name: "Priya Nair, Summit Home Loans", reach: "(404) 555-0188" },
      { role: "Closing attorney", name: "Hart & Cole LLP", reach: "closings@example.com" },
      { role: "Listing agent", name: "Omar Said", reach: "(470) 555-0171" },
    ],
    work: [
      { stream: "earnest-money", state: "confirmed", who: "The buyer", word: "Closing attorney, 8 Sep" },
      { stream: "inspection", state: "confirmed", who: "The buyer", word: "Listing agent, 17 Sep" },
      { stream: "financing", state: "in-progress", who: "The lender", word: "Lender, Mon 21 Sep" },
      { stream: "appraisal", state: "confirmed", who: "The lender", note: "At value", word: "Lender, Tue 22 Sep" },
      { stream: "title", state: "blocked", who: "The closing attorney", note: "A 2019 contractor's lien is still recorded", word: "Closing attorney, Tue 22 Sep" },
      { stream: "insurance", state: "in-progress", who: "The buyer", due: "Fri 9 Oct" },
      { stream: "repairs", state: "not-applicable", who: "You", note: "None asked for" },
      { stream: "walkthrough", state: "not-started", who: "You", due: "Wed 21 Oct" },
      { stream: "closing", state: "not-started", who: "The closing attorney", due: "Thu 22 Oct" },
      { stream: "possession", state: "not-started", who: "You", due: "Thu 22 Oct" },
    ],
    homes: [{ address: "17 Ridge Walk, Smyrna", price: "$352,000", reactions: [{ who: "Marcus", says: "Under contract" }] }],
    offers: [{ from: "Marcus Bell (your offer)", price: "$352,000", terms: "Conventional, 10 days due diligence, close 22 Oct", status: "Accepted 3 Sep" }],
    documents: [{ name: "Title commitment", added: "Tue 22 Sep", shared: "Marcus" }],
    checks: {
      "b-uc-read": { state: "done", by: "You", on: "3 Sep", note: "Rift read the contract; you checked and approved the dates" },
      "b-uc-dates": { state: "done", by: "You", on: "3 Sep" },
      "b-uc-kickoff": { state: "done", by: "You", on: "4 Sep", note: "Approved by you, sent by Rift" },
      "b-inspect-book": { state: "done", by: "Meron", on: "5 Sep" },
      "b-chase": { state: "doing", note: "Will flag the seller's attorney Mon 28 Sep if the lien proof has not come" },
    },
    story: [
      { stage: "prepare", at: "30 Jul", what: "Saved a $360k plan" },
      { stage: "prepare", at: "3 Aug", what: "Buyer agreement signed" },
      { stage: "search", at: "5 Aug", what: "Search brief agreed: Smyrna townhomes, at most $365,000" },
      { stage: "tour", at: "August", what: "7 homes seen" },
      { stage: "offer", at: "2 Sep", what: "Offered $352,000, conventional" },
      { stage: "offer", at: "3 Sep", what: "Offer accepted" },
      { stage: "under-contract", at: "8 Sep", what: "Earnest money received" },
      { stage: "under-contract", at: "17 Sep", what: "Inspection done; nothing asked for" },
      { stage: "under-contract", at: "Tue 22 Sep", what: "Appraisal at value" },
      { stage: "under-contract", at: "Tue 22 Sep", what: "Attorney found a recorded lien; title blocked" },
    ],
  },
];

/** What each stage is for, in plain words, for a stage the client has not reached. */
export const STAGE_ABOUT: Record<Stage, { buy: string; sell: string }> = {
  prepare: { buy: "The plan, the buyer agreement, pre-approval, and who in the household sees what.", sell: "The plan, the listing agreement, disclosures, and getting the home ready." },
  search: { buy: "Agree the brief, then the Matrix search runs every morning.", sell: "Price agreed, photos, and the listing goes live." },
  tour: { buy: "Shortlist, showings and everyone's reactions.", sell: "Showings and feedback, with honest numbers." },
  offer: { buy: "Write the offer, negotiate, and agree.", sell: "Compare offers on what reaches the seller, counter, accept." },
  "under-contract": { buy: "Ten workstreams, from earnest money to title, each with who it waits on.", sell: "The buyer's inspection, appraisal and financing, and the repairs asked for." },
  close: { buy: "Final walkthrough, the settlement statement, and the keys.", sell: "Settlement statement, final proceeds, and handing over the keys." },
  own: { buy: "The first weeks, homestead, and one year on.", sell: "Final proceeds reconciled, and staying in touch." },
};

/** A seller's journey uses the same stages under words that fit selling (a proposal: the seller journey itself waits, D08). */
export const SELL_STAGE_LABEL: Record<Stage, string> = {
  prepare: "Prepare", search: "List", tour: "Showings", offer: "Offers",
  "under-contract": "Under contract", close: "Close", own: "After the sale",
};

export type TodayGroup = "attention" | "approval" | "today" | "waiting" | "upcoming";

export interface TodayItem {
  id: string;
  group: TodayGroup;
  title: string;
  /** Why it is on the list. */
  why: string;
  /** "You", or who else it is with. */
  owner: string;
  personId?: string;
  journeyId?: string;
  /** Tab the item opens on. */
  tab?: "overview" | "search" | "homes" | "offers" | "contract" | "history";
  due: string;
  /** ISO day, for grouping Upcoming by day and checking the groups. */
  on: string;
  /** Time of day, for Today's agenda order. */
  at?: string;
  next: string;
  evidence?: string;
  /** Waiting on others: when they last said anything, and when to chase. */
  lastHeard?: string;
  checkIn?: string;
  /** What kind of thing it is, as an icon and a word (rule 10). */
  kind: "date" | "failed" | "request" | "lead" | "draft" | "search" | "program" | "call" | "showing" | "offer" | "closing" | "moment";
}

export const TODAY: TodayItem[] = [
  { id: "t1", group: "attention", kind: "date", title: "Appraisal not confirmed as ordered", why: "Due Tue 29 Sep. The lender has not said it is ordered, and ordering usually takes two days.", owner: "You", personId: "p2", journeyId: "j1", tab: "contract", due: "Due in 4 days", on: "2026-09-25", next: "Call the lender", evidence: "No word from the lender for 7 days" },
  { id: "t2", group: "attention", kind: "request", title: "Hannah Lee's question is past the same-day promise", why: "Asked yesterday at 4:12 pm whether she can move boxes in before closing.", owner: "You", personId: "p6", journeyId: "j4", due: "17 h ago", on: "2026-09-24", next: "Reply to Hannah" },
  { id: "t3", group: "attention", kind: "failed", title: "The morning summary emails did not send", why: "Brevo refused them at 7:00 and again on the 8:00 retry: the sending domain is not verified. Two emails are held, not lost.", owner: "You", due: "Since 7:00", on: "2026-09-25", next: "Open email settings", evidence: "Brevo: domain not verified" },
  { id: "t4", group: "approval", kind: "search", title: "Search change for Selam Haile", why: "Decatur added, townhomes allowed. Yonas said no to both townhomes, so they disagree.", owner: "You", personId: "p3", journeyId: "j2", tab: "search", due: "Asked Wed", on: "2026-09-25", next: "Review the change" },
  { id: "t5", group: "approval", kind: "draft", title: "Reply to Tomás Rivera, drafted", why: "He replied to follow-up 2, so the emails stopped. A reply is drafted from his plan's numbers; nothing sends until you approve.", owner: "You", personId: "p5", due: "Replied Thu", on: "2026-09-25", next: "Read the draft" },
  { id: "t6", group: "approval", kind: "program", title: "Program change flagged: DeKalb assistance", why: "The county's page changed its income limit. Nobody sees the new figure until you check it.", owner: "You", due: "Flagged Thu", on: "2026-09-25", next: "Check the official page", evidence: "Official page, read Thu 6:00" },
  { id: "t8", group: "today", kind: "call", title: "Call: Selam Haile", why: "Booked through Cal.com, about the search change. She is 7 hours ahead.", owner: "You", personId: "p3", journeyId: "j2", tab: "search", due: "11:30 am", at: "11:30", on: "2026-09-25", next: "Open her search" },
  { id: "t9", group: "today", kind: "offer", title: "Grace Whitfield: go through both offers", why: "Offer B leaves her $460 more and closes two weeks sooner.", owner: "You", personId: "p4", journeyId: "j3", tab: "offers", due: "4:00 pm", at: "16:00", on: "2026-09-25", next: "Open the offers" },
  { id: "t10", group: "today", kind: "offer", title: "Offer B on Grace's home expires", why: "Unless she accepts or counters.", owner: "Grace", personId: "p4", journeyId: "j3", tab: "offers", due: "6:00 pm", at: "18:00", on: "2026-09-25", next: "Decide with Grace at 4:00" },
  { id: "t11", group: "waiting", kind: "date", title: "Proof the Smyrna lien is paid", why: "Title is blocked until the attorney sees it.", owner: "Seller's attorney", personId: "p8", journeyId: "j5", tab: "contract", due: "Check in Mon", on: "2026-09-28", next: "Chase Monday 9:00", lastHeard: "Tue 22 Sep", checkIn: "Mon 28 Sep 9:00" },
  { id: "t12", group: "waiting", kind: "date", title: "Repairs receipts for Hannah Lee", why: "Needed before Tuesday's walkthrough.", owner: "Listing agent", personId: "p6", journeyId: "j4", tab: "contract", due: "Due Mon", on: "2026-09-28", next: "Chase Monday 9:00", lastHeard: "Wed 23 Sep", checkIn: "Mon 28 Sep 9:00" },
  { id: "t13", group: "waiting", kind: "date", title: "Hannah's HO-6 policy to be checked", why: "She sent it. Nobody has confirmed it meets the lender's requirement.", owner: "Lender", personId: "p6", journeyId: "j4", tab: "contract", due: "Before Wed", on: "2026-09-28", next: "Ask the lender", lastHeard: "Never asked", checkIn: "Today" },
  { id: "t14", group: "upcoming", kind: "showing", title: "Selam: two video tours", why: "The two townhomes, if you approve the change.", owner: "You", personId: "p3", journeyId: "j2", tab: "homes", due: "Sat 11:00", on: "2026-09-26", next: "Confirm access with the listing agents" },
  { id: "t15", group: "upcoming", kind: "date", title: "Okafor appraisal due", why: "2214 Candler Park Ct.", owner: "Lender", personId: "p2", journeyId: "j1", tab: "contract", due: "Tue 29 Sep", on: "2026-09-29", next: "See Needs attention" },
  { id: "t16", group: "upcoming", kind: "date", title: "Hannah Lee: final walkthrough", why: "Receipts first.", owner: "You", personId: "p6", journeyId: "j4", tab: "contract", due: "Tue 29 Sep", on: "2026-09-29", next: "Walkthrough checklist" },
  { id: "t17", group: "upcoming", kind: "closing", title: "Hannah Lee closes", why: "990 Peachtree St #1204.", owner: "Closing attorney", personId: "p6", journeyId: "j4", tab: "contract", due: "Wed 30 Sep", on: "2026-09-30", next: "Settlement statement Mon" },
  { id: "t18", group: "upcoming", kind: "moment", title: "The Abebes: one year in their home", why: "Homestead reminder; they sent you the Okafors.", owner: "You", personId: "p7", due: "Thu 1 Oct", on: "2026-10-01", next: "Write to them" },
  { id: "t19", group: "upcoming", kind: "date", title: "Okafor financing contingency ends", why: "After this their earnest money is at risk if the loan fails.", owner: "You", personId: "p2", journeyId: "j1", tab: "contract", due: "Mon 5 Oct", on: "2026-10-05", next: "Final approval by Fri 2 Oct" },
];

export const GROUP_LABEL: Record<TodayGroup, string> = {
  attention: "Needs attention",
  approval: "Needs your approval",
  today: "Today",
  waiting: "Waiting on others",
  upcoming: "Next two weeks",
};

/** What changed since yesterday, and who did it. "Rift" is what ran on its own. */
export const ACTIVITY: { at: string; what: string; by: "Rift" | "You" | "Client" | "Lender" | "Agent" }[] = [
  { at: "9:25", what: "Maya Tesfaye came in from Instagram and asked for a review", by: "Client" },
  { at: "8:10", what: "Grace Whitfield texted about the second offer", by: "Client" },
  { at: "8:00", what: "Morning summary retry refused by Brevo; 2 emails held", by: "Rift" },
  { at: "7:55", what: "Hannah Lee is clear to close", by: "Lender" },
  { at: "6:00", what: "Checked 14 program pages; one changed (DeKalb)", by: "Rift" },
  { at: "2:14", what: "Offer B on Grace's home arrived; its PDF was read and checked by the sender", by: "Rift" },
  { at: "Thu", what: "Tomás Rivera replied, so his follow-up emails stopped", by: "Rift" },
];

/** What Rift did on its own since yesterday: Today's answer to §8.2 question 7. */
export const AUTOMATION = { sent: 3, stopped: 1, checked: 14, failed: 1 };

export const STATE_WORD: Record<WorkState, string> = {
  "not-started": "Not started",
  "in-progress": "In progress",
  waiting: "Waiting",
  blocked: "Blocked",
  reported: "Reported, not checked",
  confirmed: "Confirmed",
  "not-applicable": "Not needed",
};

/** Two or three letters per workstream, for the Transactions grid's column heads. */
export const WORKSTREAM_SHORT: Record<Workstream, string> = {
  "earnest-money": "EM", inspection: "Insp", financing: "Fin", appraisal: "Appr", title: "Title",
  insurance: "Ins", repairs: "Rep", walkthrough: "Walk", closing: "Close", possession: "Keys",
};

export const CALENDAR: { on: string; at: string; kind: "call" | "showing" | "date" | "closing" | "moment"; what: string; who?: string; source: string }[] = [
  { on: "2026-09-25", at: "9:40 am", kind: "call", what: "Reply to Maya Tesfaye (15-minute target)", who: "Maya Tesfaye", source: "New lead" },
  { on: "2026-09-25", at: "11:30 am", kind: "call", what: "Selam Haile: the search change", who: "Selam Haile", source: "Cal.com" },
  { on: "2026-09-25", at: "4:00 pm", kind: "call", what: "Grace Whitfield: both offers", who: "Grace Whitfield", source: "You" },
  { on: "2026-09-25", at: "6:00 pm", kind: "date", what: "Offer B expires", who: "Grace Whitfield", source: "Offer" },
  { on: "2026-09-26", at: "11:00 am", kind: "showing", what: "Video tour: 88 Ponce Pl", who: "Selam Haile", source: "Tour" },
  { on: "2026-09-26", at: "11:40 am", kind: "showing", what: "Video tour: 1407 Line St", who: "Selam Haile", source: "Tour" },
  { on: "2026-09-26", at: "12:00 pm", kind: "date", what: "Offer A expires", who: "Grace Whitfield", source: "Offer" },
  { on: "2026-09-28", at: "All day", kind: "date", what: "Repairs receipts due", who: "Hannah Lee", source: "Contract" },
  { on: "2026-09-29", at: "All day", kind: "date", what: "Appraisal due", who: "Daniel and Ruth Okafor", source: "Contract" },
  { on: "2026-09-29", at: "5:30 pm", kind: "showing", what: "Final walkthrough", who: "Hannah Lee", source: "You" },
  { on: "2026-09-29", at: "2:00 pm", kind: "call", what: "Marcus Bell: title update", who: "Marcus Bell", source: "Cal.com" },
  { on: "2026-09-30", at: "10:00 am", kind: "closing", what: "Closing: 990 Peachtree St #1204", who: "Hannah Lee", source: "Contract" },
  { on: "2026-10-01", at: "All day", kind: "moment", what: "The Abebes: one year in their home", who: "Abebe family", source: "Advocacy" },
  { on: "2026-10-05", at: "All day", kind: "date", what: "Okafor financing contingency ends", who: "Daniel and Ruth Okafor", source: "Contract" },
];

/** Advocacy (the referral engine, lib/core/referral.ts), as a queue of prompts. Nothing sends by itself. */
export const MOMENTS: { who: string; moment: string; when: string; ask: string; state: "due" | "later" | "quiet" }[] = [
  { who: "Abebe family", moment: "One year in their home", when: "Thu 1 Oct", ask: "Homestead reminder and a note; they already referred the Okafors", state: "due" },
  { who: "Hannah Lee", moment: "Two weeks after closing", when: "Wed 14 Oct", ask: "Ask how the move went, then whether she'd leave a review", state: "later" },
  { who: "Daniel and Ruth Okafor", moment: "Under contract", when: "Now", ask: "Nothing. Say congratulations and go quiet", state: "quiet" },
  { who: "Marcus Bell", moment: "Under contract", when: "Now", ask: "Nothing. Say congratulations and go quiet", state: "quiet" },
];

/** Made-up pilot figures for the Reports sketch. Not a claim about anything real. */
export const REPORT = {
  period: "September so far",
  funnel: [
    { step: "Started a value", n: 412 },
    { step: "Saw their answer", n: 297 },
    { step: "Saved a plan", n: 61 },
    { step: "Booked a call", n: 19 },
    { step: "Became a client", n: 4 },
  ],
  reply: { within: 17, of: 19, target: "15 minutes" },
  values: [
    { name: "What will it cost to buy?", started: 168, saved: 27 },
    { name: "How much home fits my budget?", started: 91, saved: 14 },
    { name: "Can I buy from abroad?", started: 64, saved: 9 },
    { name: "What would I keep if I sold?", started: 52, saved: 8 },
    { name: "What should I ask a lender?", started: 37, saved: 3 },
  ],
};
