/**
 * Made-up data for the Operations mock-up (Blueprint v5 §8, decision D15).
 *
 * Kaleb approves the new Operations layout by clicking through a mock-up
 * before any real screen is rebuilt. Everything here is invented and fixed to
 * one morning (Friday 25 September 2026), so the mock-up reads the same every
 * time it is opened and nothing in it can be mistaken for a real client.
 *
 * The vocabulary is the real one: stages and workstreams come from
 * lib/core/progress.ts, so the mock-up cannot quietly propose words the
 * product does not use.
 *
 * Pure data: no React, no I/O.
 */

import type { Stage, Workstream, WorkState } from "@/lib/core/progress";

export const MOCK_TODAY = "Fri 25 Sep";

export type Side = "buy" | "sell";

export interface MockPerson {
  id: string;
  name: string;
  side: Side;
  /** Lead, or the stage of their journey. */
  stage: "New lead" | "Nurture" | "Client" | "Past client";
  journeyStage?: Stage;
  next: string;
  due: string;
  overdue?: boolean;
  lastContact: string;
  source: string;
  /** The lead summary (§5.5): what they did, from what they handed over. */
  summary: string;
  phone?: string;
  email: string;
  journeyId?: string;
  notes: { at: string; kind: "Call" | "Email" | "Text" | "Note"; body: string }[];
}

export const PEOPLE: MockPerson[] = [
  {
    id: "p1", name: "Maya Tesfaye", side: "buy", stage: "New lead",
    next: "Call back: asked Kaleb to review her numbers", due: "Today 9:40", overdue: false,
    lastContact: "Never", source: "Instagram · fall-assistance",
    summary: "Asked for a review on a $340k plan: assistance 3 programs to check, cash to close $14,210 · no call booked",
    phone: "(404) 555-0142", email: "maya.t@example.com", notes: [],
  },
  {
    id: "p2", name: "Daniel and Ruth Okafor", side: "buy", stage: "Client", journeyStage: "under-contract",
    next: "Confirm appraisal is ordered with the lender", due: "Today", overdue: true,
    lastContact: "Yesterday", source: "Referral · the Abebes",
    summary: "Saved a plan on a $425k plan: cash to close $24,788, monthly cost $2,891 · call booked",
    phone: "(678) 555-0110", email: "okafor.home@example.com", journeyId: "j1",
    notes: [
      { at: "Thu 24 Sep", kind: "Call", body: "Inspection response signed. Seller to fix the water heater and the GFCI outlets." },
      { at: "Tue 22 Sep", kind: "Email", body: "Sent the inspection summary and the three items worth asking for." },
    ],
  },
  {
    id: "p3", name: "Selam Haile", side: "buy", stage: "Client", journeyStage: "tour",
    next: "Approve the search update she asked for", due: "Today",
    lastContact: "Wed 23 Sep", source: "Abroad page",
    summary: "Checked she can buy from abroad, cost to buy and own $96,300 · call booked",
    phone: "+251 91 555 0100", email: "selam.h@example.com", journeyId: "j2",
    notes: [{ at: "Wed 23 Sep", kind: "Call", body: "Wants Decatur added, and townhomes are fine now." }],
  },
  {
    id: "p4", name: "Grace Whitfield", side: "sell", stage: "Client", journeyStage: "offer",
    next: "Walk her through the two offers on what reaches her", due: "Today 4:00",
    lastContact: "Today 8:10", source: "Seller landing",
    summary: "Saved a plan: what you'd keep $151,010 to $159,310, selling costs $19,690 to $27,990 · call booked",
    phone: "(770) 555-0199", email: "grace.w@example.com", journeyId: "j3",
    notes: [{ at: "Today 8:10", kind: "Text", body: "Second offer came in overnight. Call at 4?" }],
  },
  {
    id: "p5", name: "Tomás Rivera", side: "buy", stage: "Nurture",
    next: "Follow-up email 3 goes out on its own", due: "Mon 28 Sep",
    lastContact: "Mon 14 Sep", source: "Google",
    summary: "Saved a plan on a $290k plan: timeline 14 months · no call booked",
    email: "tomas.r@example.com", notes: [],
  },
  {
    id: "p6", name: "Hannah Lee", side: "buy", stage: "Client", journeyStage: "close",
    next: "Final walkthrough booked, confirm the repairs receipts", due: "Tue 29 Sep",
    lastContact: "Today 7:55", source: "Past client · the Parks",
    summary: "Booked a call",
    phone: "(404) 555-0177", email: "hannah.lee@example.com", journeyId: "j4",
    notes: [{ at: "Today 7:55", kind: "Email", body: "Lender cleared to close." }],
  },
  {
    id: "p7", name: "Abebe family", side: "buy", stage: "Past client",
    next: "One year in their home: send the homestead reminder", due: "Thu 1 Oct",
    lastContact: "Aug 2026", source: "Past client",
    summary: "Closed 30 Sep 2025",
    email: "abebe.fam@example.com", notes: [],
  },
];

export interface MockWork { stream: Workstream; state: WorkState; note?: string; due?: string }

export interface MockJourney {
  id: string;
  personId: string;
  label: string;
  side: Side;
  stage: Stage;
  next: string;
  household: { name: string; role: string; joined: boolean }[];
  keyDates: { label: string; on: string; state: "done" | "soon" | "passed" | "later" }[];
  brief?: { field: string; value: string; strength: "Requirement" | "Preference" | "Not decided"; by: string }[];
  briefNote?: string;
  homes?: { address: string; price: string; reaction: string; showing?: string }[];
  offers?: { from: string; price: string; reaches: string; terms: string; status: string }[];
  work?: MockWork[];
  property?: string;
  activity: { at: string; what: string }[];
}

export const JOURNEYS: MockJourney[] = [
  {
    id: "j1", personId: "p2", label: "First home, DeKalb", side: "buy", stage: "under-contract",
    next: "Confirm appraisal is ordered", property: "2214 Candler Park Ct, Decatur",
    household: [
      { name: "Daniel Okafor", role: "Buyer", joined: true },
      { name: "Ruth Okafor", role: "Buyer", joined: true },
    ],
    keyDates: [
      { label: "Due diligence ends", on: "Wed 23 Sep", state: "done" },
      { label: "Appraisal due", on: "Tue 29 Sep", state: "soon" },
      { label: "Financing contingency", on: "Mon 5 Oct", state: "later" },
      { label: "Closing", on: "Fri 16 Oct", state: "later" },
    ],
    work: [
      { stream: "earnest-money", state: "confirmed", note: "Received by the closing attorney" },
      { stream: "inspection", state: "confirmed", note: "Response signed Thu" },
      { stream: "financing", state: "in-progress", note: "Conditional approval" },
      { stream: "appraisal", state: "waiting", note: "Lender has not confirmed it is ordered", due: "Tue 29 Sep" },
      { stream: "title", state: "in-progress" },
      { stream: "insurance", state: "not-started", due: "Fri 9 Oct" },
      { stream: "repairs", state: "in-progress", note: "Water heater, GFCI outlets" },
      { stream: "walkthrough", state: "not-started" },
      { stream: "closing", state: "not-started", due: "Fri 16 Oct" },
      { stream: "possession", state: "not-started" },
    ],
    homes: [{ address: "2214 Candler Park Ct, Decatur", price: "$418,000", reaction: "Under contract" }],
    offers: [{ from: "Okafor", price: "$418,000", reaches: "", terms: "FHA, 10 days due diligence, $4,000 seller contribution", status: "Accepted" }],
    activity: [
      { at: "Thu 24 Sep", what: "Inspection response signed by both sides" },
      { at: "Wed 23 Sep", what: "Due diligence ended, contract firm" },
    ],
  },
  {
    id: "j2", personId: "p3", label: "Rental from abroad", side: "buy", stage: "tour",
    next: "Approve the search update",
    household: [
      { name: "Selam Haile", role: "Buyer", joined: true },
      { name: "Yonas Haile", role: "Can see homes, not money", joined: false },
    ],
    keyDates: [{ label: "Video tours", on: "Sat 26 Sep", state: "soon" }],
    briefNote: "Selam asked for a change on Wed: Decatur added, townhomes allowed. Waiting for your approval before the Matrix search changes.",
    brief: [
      { field: "Price", value: "at most $300,000", strength: "Requirement", by: "Selam, call on 23 Sep" },
      { field: "Areas", value: "DeKalb County, Decatur", strength: "Requirement", by: "Selam, call on 23 Sep" },
      { field: "Type of home", value: "Single-family, Townhouse", strength: "Preference", by: "Selam, call on 23 Sep" },
      { field: "Bedrooms", value: "at least 3", strength: "Requirement", by: "Her saved plan, 20 Sep" },
    ],
    homes: [
      { address: "88 Ponce Pl, Decatur", price: "$289,000", reaction: "Interested", showing: "Video tour Sat 11:00" },
      { address: "1407 Line St, Decatur", price: "$275,000", reaction: "Maybe", showing: "Video tour Sat 11:40" },
      { address: "310 Glenwood Ave, DeKalb", price: "$299,000", reaction: "Pass: the road" },
    ],
    activity: [
      { at: "Wed 23 Sep", what: "Selam asked for Decatur and townhomes" },
      { at: "Mon 21 Sep", what: "Three homes added to her shortlist" },
    ],
  },
  {
    id: "j3", personId: "p4", label: "Selling in Cobb", side: "sell", stage: "offer",
    next: "Review two offers with Grace at 4:00",
    household: [{ name: "Grace Whitfield", role: "Seller", joined: true }],
    keyDates: [{ label: "Offer 2 expires", on: "Today 6:00 pm", state: "soon" }],
    offers: [
      { from: "Buyer A (Dana, agent)", price: "$430,000", reaches: "$172,960", terms: "Conventional, $8,000 asked back, close 30 Oct", status: "Presented" },
      { from: "Buyer B (unrepresented)", price: "$422,000", reaches: "$173,420", terms: "Cash, nothing asked back, close 16 Oct", status: "New overnight" },
    ],
    activity: [{ at: "Today 2:14 am", what: "Offer B came in through the offer page, with its PDF read" }],
  },
  {
    id: "j4", personId: "p6", label: "Condo in Midtown", side: "buy", stage: "close",
    next: "Confirm the repairs receipts before the walkthrough", property: "990 Peachtree St #1204, Atlanta",
    household: [{ name: "Hannah Lee", role: "Buyer", joined: true }],
    keyDates: [
      { label: "Final walkthrough", on: "Tue 29 Sep", state: "soon" },
      { label: "Closing", on: "Wed 30 Sep", state: "soon" },
    ],
    work: [
      { stream: "earnest-money", state: "confirmed" },
      { stream: "inspection", state: "confirmed" },
      { stream: "financing", state: "confirmed", note: "Clear to close" },
      { stream: "appraisal", state: "confirmed" },
      { stream: "title", state: "confirmed" },
      { stream: "insurance", state: "reported", note: "HO-6 binder emailed, not checked" },
      { stream: "repairs", state: "waiting", note: "Receipts from the seller", due: "Mon 28 Sep" },
      { stream: "walkthrough", state: "not-started", due: "Tue 29 Sep" },
      { stream: "closing", state: "in-progress", due: "Wed 30 Sep" },
      { stream: "possession", state: "not-started" },
    ],
    activity: [{ at: "Today 7:55", what: "Lender: clear to close" }],
  },
];

export type TodayGroup = "attention" | "approval" | "today" | "waiting" | "upcoming";

export interface TodayItem {
  id: string;
  group: TodayGroup;
  title: string;
  /** Why it is on the list. */
  why: string;
  owner: string;
  personId?: string;
  journeyId?: string;
  due: string;
  next: string;
  evidence?: string;
}

export const TODAY: TodayItem[] = [
  { id: "t1", group: "attention", title: "Appraisal not confirmed as ordered", why: "Due Tue 29 Sep; the lender has not confirmed it. Ordering usually takes two days", owner: "Kaleb", personId: "p2", journeyId: "j1", due: "Today", next: "Call the lender", evidence: "Contract dates, checked 18 Sep" },
  { id: "t2", group: "attention", title: "Maya Tesfaye asked for a review, not answered", why: "New lead at 9:25; the reply target is 15 minutes", owner: "Kaleb", personId: "p1", due: "15 min", next: "Call her" },
  { id: "t3", group: "attention", title: "Morning summary email did not send", why: "The scheduled job failed at 7:00 (Brevo timed out). It retries at 8:00", owner: "Rift", due: "Today", next: "Nothing unless 8:00 fails too" },
  { id: "t4", group: "approval", title: "Search update for Selam Haile", why: "She asked for Decatur and townhomes. The Matrix search changes only after you approve", owner: "Kaleb", personId: "p3", journeyId: "j2", due: "Today", next: "Approve or talk to her" },
  { id: "t5", group: "approval", title: "Program change flagged: DeKalb assistance", why: "The county's page changed its income limit. Not shown to anyone until you check it", owner: "Kaleb", due: "Mon 28 Sep", next: "Check the official page", evidence: "Official source, read Thu" },
  { id: "t6", group: "today", title: "Grace Whitfield: review two offers", why: "Offer B expires at 6:00 pm", owner: "Kaleb", personId: "p4", journeyId: "j3", due: "4:00 pm", next: "Open the offers" },
  { id: "t7", group: "today", title: "Selam Haile: video tours", why: "Two homes on her shortlist", owner: "Kaleb", personId: "p3", journeyId: "j2", due: "Sat 11:00", next: "Confirm access with the listing agents" },
  { id: "t8", group: "waiting", title: "Repairs receipts from the seller", why: "Needed before Hannah Lee's walkthrough", owner: "Seller's agent", personId: "p6", journeyId: "j4", due: "Mon 28 Sep", next: "Check in Monday morning", evidence: "Last update Wed" },
  { id: "t9", group: "waiting", title: "HO-6 binder to be checked", why: "Hannah sent it; nobody has confirmed it matches the lender's requirement", owner: "Lender", personId: "p6", journeyId: "j4", due: "Mon 28 Sep", next: "Ask the lender to confirm" },
  { id: "t10", group: "upcoming", title: "Hannah Lee closes", why: "990 Peachtree St #1204", owner: "Kaleb", personId: "p6", journeyId: "j4", due: "Wed 30 Sep", next: "Walkthrough Tue first" },
  { id: "t11", group: "upcoming", title: "Okafor financing contingency ends", why: "After this the earnest money is at risk if the loan fails", owner: "Kaleb", personId: "p2", journeyId: "j1", due: "Mon 5 Oct", next: "Check the approval is final by Fri 2 Oct" },
];

export const GROUP_LABEL: Record<TodayGroup, string> = {
  attention: "Needs attention",
  approval: "Needs your approval",
  today: "Today",
  waiting: "Waiting on others",
  upcoming: "Upcoming, next two weeks",
};

export const ACTIVITY: { at: string; what: string; by: "Rift" | "Kaleb" | "Client" }[] = [
  { at: "8:10", what: "Grace Whitfield texted about the second offer", by: "Client" },
  { at: "7:55", what: "Lender marked Hannah Lee clear to close", by: "Client" },
  { at: "7:00", what: "Morning summary failed to send; retry at 8:00", by: "Rift" },
  { at: "2:14", what: "Offer B on Grace's home arrived through the offer page, PDF read and checked by the sender", by: "Rift" },
  { at: "Thu", what: "Two follow-up emails sent on schedule; one stopped because Tomás replied", by: "Rift" },
];

export const STATE_WORD: Record<WorkState, string> = {
  "not-started": "Not started",
  "in-progress": "In progress",
  waiting: "Waiting",
  blocked: "Blocked",
  reported: "Reported, not checked",
  confirmed: "Confirmed",
  "not-applicable": "Not needed",
};
