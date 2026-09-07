/**
 * Rift prototype — demonstration fixtures.
 * All names, properties, offers, messages, and documents are fabricated
 * demonstration data. Nothing here touches production stores or integrations.
 */

export type Owner = "customer" | "agent" | "rift" | "outside";
export type TaskState =
  | "completed" | "current" | "upcoming" | "blocked"
  | "waiting" | "optional" | "overdue";
export type ReviewState =
  | "preliminary" | "pending-review" | "reviewed" | "verified";

export const OWNER_LABEL: Record<Owner, string> = {
  customer: "You",
  agent: "Kaleb",
  rift: "Rift",
  outside: "Outside pro",
};

export const OWNER_COLOR: Record<Owner, string> = {
  customer: "#2563ff",
  agent: "#ff5c38",
  rift: "#10a875",
  outside: "#6b7585",
};

export const REVIEW_LABEL: Record<ReviewState, string> = {
  preliminary: "Preliminary estimate",
  "pending-review": "Pending review",
  reviewed: "Reviewed by your agent",
  verified: "Verified by lender",
};

export interface Task {
  id: string;
  title: string;
  owner: Owner;
  state: TaskState;
  due?: string;
  note?: string;
}

/* ---------------- buyer lifecycle ---------------- */

export const BUYER_STAGES = [
  "Exploring", "Building readiness", "Financing preparation", "Ready to shop",
  "Searching", "Preparing an offer", "Under contract", "Closing",
  "Moving in", "Homeownership",
] as const;

export const SELLER_STAGES = [
  "Considering a sale", "Preparing the property", "Pricing and launch",
  "Active listing", "Reviewing offers", "Under contract", "Closing", "Post-sale",
] as const;

/* ---------------- people ---------------- */

export interface Person {
  id: string;
  name: string;
  initials: string;
  role: string;
  journey: "buyer" | "seller" | "both";
  stage: string;
  county: string;
  source: string;
  campaign: string;
  referrer?: string;
  firstTouch: string;
  representation: "none" | "prepared" | "sent" | "signed" | "expired" | "declined";
  repExpires?: string;
  nextAction: string;
  nextDue: string;
  attention?: string;
  coBuyer?: string;
}

export const PEOPLE: Person[] = [
  {
    id: "maya",
    name: "Maya Ellison",
    initials: "ME",
    role: "First-time buyer",
    journey: "buyer",
    stage: "Building readiness",
    county: "DeKalb",
    source: "Paid social",
    campaign: "down-payment-help-aug",
    firstTouch: "2026-08-24",
    representation: "prepared",
    nextAction: "Open a dedicated savings account for closing funds",
    nextDue: "2026-09-11",
    coBuyer: "Devon Ellison",
  },
  {
    id: "harold",
    name: "Harold & Ruth Vance",
    initials: "HV",
    role: "Long-tenured seller",
    journey: "seller",
    stage: "Preparing the property",
    county: "Cobb",
    source: "Referral",
    campaign: "—",
    referrer: "Priya Raman",
    firstTouch: "2026-08-02",
    representation: "signed",
    repExpires: "2027-02-02",
    nextAction: "Approve the pre-listing repair shortlist",
    nextDue: "2026-09-08",
    attention: "Assessment appeal window closes in 19 days",
  },
  {
    id: "tomas",
    name: "Tomás Beltrán",
    initials: "TB",
    role: "Not yet ready",
    journey: "buyer",
    stage: "Exploring",
    county: "Gwinnett",
    source: "Organic search",
    campaign: "rent-vs-buy",
    firstTouch: "2026-06-14",
    representation: "none",
    nextAction: "Nothing due — checking back monthly",
    nextDue: "2026-10-01",
    attention: "Stalled: no action across three touches",
  },
  {
    id: "priya",
    name: "Priya Raman",
    initials: "PR",
    role: "Past client",
    journey: "buyer",
    stage: "Homeownership",
    county: "DeKalb",
    source: "Open house",
    campaign: "—",
    firstTouch: "2025-10-03",
    representation: "expired",
    nextAction: "Nothing due",
    nextDue: "—",
  },
  {
    id: "nadia",
    name: "Nadia & Chris Okafor",
    initials: "NO",
    role: "Buying and selling",
    journey: "both",
    stage: "Reviewing offers",
    county: "Fulton",
    source: "Referral",
    campaign: "—",
    referrer: "Harold & Ruth Vance",
    firstTouch: "2026-05-19",
    representation: "signed",
    repExpires: "2026-11-19",
    nextAction: "Choose between two offers in the Decision Room",
    nextDue: "2026-09-07",
    attention: "Two offers awaiting a decision",
  },
  {
    id: "jordan",
    name: "Jordan Pike",
    initials: "JP",
    role: "Referred lead",
    journey: "buyer",
    stage: "Exploring",
    county: "DeKalb",
    source: "Referral",
    campaign: "—",
    referrer: "Priya Raman",
    firstTouch: "2026-09-04",
    representation: "none",
    nextAction: "Finish the readiness assessment",
    nextDue: "2026-09-09",
  },
];

export const byId = (id: string) => PEOPLE.find((p) => p.id === id)!;

/* ---------------- tasks ---------------- */

export const MAYA_TASKS: Task[] = [
  { id: "t1", title: "Complete the readiness assessment", owner: "customer", state: "completed" },
  { id: "t2", title: "Review your plan and publish it", owner: "agent", state: "completed", note: "Published 2 Sep after your call" },
  { id: "t3", title: "Open a dedicated savings account for closing funds", owner: "customer", state: "current", due: "2026-09-11" },
  { id: "t4", title: "Confirm Georgia Dream eligibility with a participating lender", owner: "outside", state: "waiting", due: "2026-09-15", note: "Sent to Brookhaven Lending on 3 Sep" },
  { id: "t5", title: "Send the buyer agency agreement for signature", owner: "agent", state: "overdue", due: "2026-09-04" },
  { id: "t6", title: "Watch DeKalb assistance funding and alert you if it changes", owner: "rift", state: "current" },
  { id: "t7", title: "Complete the homebuyer education course", owner: "customer", state: "upcoming", due: "2026-10-20", note: "Required before closing by two of your matched programs" },
  { id: "t8", title: "Gather two months of pay stubs and bank statements", owner: "customer", state: "upcoming", due: "2026-10-01" },
  { id: "t9", title: "Order the appraisal", owner: "outside", state: "blocked", note: "Blocked until you are under contract" },
];

export const HAROLD_TASKS: Task[] = [
  { id: "s1", title: "Complete the seller assessment", owner: "customer", state: "completed" },
  { id: "s2", title: "Sign the listing agreement", owner: "customer", state: "completed" },
  { id: "s3", title: "Approve the pre-listing repair shortlist", owner: "customer", state: "current", due: "2026-09-08" },
  { id: "s4", title: "File the homestead exemption", owner: "customer", state: "current", due: "2026-09-25", note: "Unclaimed value check flagged this — worth roughly $900 a year" },
  { id: "s5", title: "Decide whether to appeal the county assessment", owner: "customer", state: "overdue", due: "2026-09-02", note: "Appeal window closes 25 Sep" },
  { id: "s6", title: "Schedule photography", owner: "agent", state: "upcoming", due: "2026-09-18" },
  { id: "s7", title: "Prepare the seller disclosure package", owner: "rift", state: "current" },
  { id: "s8", title: "Painter quote for main living areas", owner: "outside", state: "waiting", due: "2026-09-10" },
];

/* ---------------- agent daily brief ---------------- */

export type BriefKind =
  | "urgent" | "response" | "new" | "offer" | "approval"
  | "milestone" | "blocked" | "representation" | "failed" | "auto";

export interface BriefItem {
  id: string;
  kind: BriefKind;
  person: string;
  title: string;
  detail: string;
  age: string;
  href?: string;
}

export const BRIEF: BriefItem[] = [
  {
    id: "b1", kind: "offer", person: "Nadia & Chris Okafor",
    title: "Two offers awaiting your present-or-hold decision",
    detail: "Submitted 14h and 3h ago on 1841 Ferncliff. Neither has been seen by the seller.",
    age: "3h", href: "offer-review",
  },
  {
    id: "b2", kind: "urgent", person: "Harold & Ruth Vance",
    title: "Assessment appeal window closes in 19 days",
    detail: "Unclaimed value check estimated $1,100–$1,800 a year. No decision recorded yet.",
    age: "2d",
  },
  {
    id: "b3", kind: "representation", person: "Maya Ellison",
    title: "Buyer agency agreement prepared but not sent",
    detail: "Her journey cannot advance past Ready to shop until it is signed.",
    age: "2d",
  },
  {
    id: "b4", kind: "new", person: "Jordan Pike",
    title: "New referred lead from Priya Raman",
    detail: "Started the buyer assessment 20 minutes ago and stopped at question 9.",
    age: "20m",
  },
  {
    id: "b5", kind: "approval", person: "Maya Ellison",
    title: "Meeting recap ready for review",
    detail: "11 proposed plan changes from Tuesday's consultation.",
    age: "1d", href: "meeting",
  },
  {
    id: "b6", kind: "failed", person: "Priya Raman",
    title: "Artist gift email failed to send",
    detail: "Vendor mailbox rejected the message. A manual fallback task was created.",
    age: "6h",
  },
  {
    id: "b7", kind: "blocked", person: "Maya Ellison",
    title: "Waiting on Brookhaven Lending",
    detail: "Georgia Dream eligibility confirmation requested 3 Sep, no reply.",
    age: "3d",
  },
  {
    id: "b8", kind: "milestone", person: "Nadia & Chris Okafor",
    title: "Listing reached 14 showings",
    detail: "Above the pace for this price band in Fulton.",
    age: "1d",
  },
  {
    id: "b9", kind: "urgent", person: "Registry",
    title: "1 assistance program is stale and has been suppressed",
    detail: "Legacy county assistance pilot — last verified 157 days ago. Customers are no longer shown it.",
    age: "now",
  },
  {
    id: "b10", kind: "auto", person: "Tomás Beltrán",
    title: "Rift sent a living-package update",
    detail: "Gwinnett funding closed; his cash gap estimate was corrected and he was told why.",
    age: "4h",
  },
  {
    id: "b11", kind: "auto", person: "Maya Ellison",
    title: "Rift prepared the lender question sheet",
    detail: "Attached to her package and shared with Brookhaven Lending on her instruction.",
    age: "1d",
  },
  {
    id: "b12", kind: "response", person: "Harold & Ruth Vance",
    title: "Ruth asked whether the painter quote is reasonable",
    detail: "Message received yesterday evening, unanswered.",
    age: "16h",
  },
];

export const BRIEF_KIND_LABEL: Record<BriefKind, string> = {
  urgent: "Urgent", response: "Needs a personal reply", new: "New lead",
  offer: "Offer decision", approval: "Awaiting approval", milestone: "Milestone",
  blocked: "Blocked", representation: "Representation", failed: "Failed",
  auto: "Rift completed",
};

/* ---------------- offers ---------------- */

export interface OfferField {
  group: string;
  label: string;
  value: string;
  confidence: "high" | "medium" | "low";
  page: number;
  consequential?: boolean;
}

export interface Offer {
  id: string;
  ref: string;
  property: string;
  confirmed: boolean;
  submittedBy: string;
  brokerage: string;
  represented: boolean;
  submittedAt: string;
  price: number;
  netToSeller: number;
  financing: string;
  earnest: number;
  closeDate: string;
  contingencies: string[];
  concessions: string;
  proofOfFunds: boolean;
  preapproval: boolean;
  decision: "pending" | "presented" | "held" | "declined";
  flags: string[];
  fields: OfferField[];
}

export const OFFERS: Offer[] = [
  {
    id: "o1", ref: "RO-4471-KD", property: "1841 Ferncliff Road NE, Atlanta, GA 30329",
    confirmed: true, submittedBy: "Dana Whitfield", brokerage: "Peachtree & Vine Realty",
    represented: true, submittedAt: "2026-09-05 21:40",
    price: 428_000, netToSeller: 398_900, financing: "Conventional, 20% down",
    earnest: 8_000, closeDate: "2026-10-17",
    contingencies: ["Financing", "Appraisal", "Due diligence — 10 days"],
    concessions: "None requested", proofOfFunds: true, preapproval: true,
    decision: "pending", flags: [],
    fields: [
      { group: "Price", label: "Purchase price", value: "$428,000", confidence: "high", page: 1, consequential: true },
      { group: "Financing", label: "Loan type", value: "Conventional", confidence: "high", page: 1, consequential: true },
      { group: "Financing", label: "Down payment", value: "20% ($85,600)", confidence: "high", page: 1, consequential: true },
      { group: "Deposits", label: "Earnest money", value: "$8,000", confidence: "high", page: 2, consequential: true },
      { group: "Dates", label: "Closing date", value: "17 October 2026", confidence: "high", page: 2, consequential: true },
      { group: "Dates", label: "Due diligence ends", value: "10 days from binding", confidence: "medium", page: 3, consequential: true },
      { group: "Contingencies", label: "Financing contingency", value: "Yes — 21 days", confidence: "high", page: 3 },
      { group: "Contingencies", label: "Appraisal contingency", value: "Yes", confidence: "high", page: 3 },
      { group: "Concessions", label: "Seller paid closing costs", value: "None requested", confidence: "high", page: 4 },
      { group: "Documents", label: "Preapproval letter", value: "Attached", confidence: "high", page: 0 },
      { group: "Special Terms", label: "Post-closing possession", value: "Not requested", confidence: "medium", page: 5 },
    ],
  },
  {
    id: "o2", ref: "RO-4488-QM", property: "1841 Ferncliff Road NE, Atlanta, GA 30329",
    confirmed: true, submittedBy: "Marcus Deel", brokerage: "Unrepresented buyer",
    represented: false, submittedAt: "2026-09-06 08:55",
    price: 441_000, netToSeller: 392_400, financing: "FHA, 3.5% down",
    earnest: 2_000, closeDate: "2026-11-14",
    contingencies: ["Financing", "Appraisal", "Sale of buyer's current home", "Due diligence — 17 days"],
    concessions: "$12,000 toward closing costs",
    proofOfFunds: false, preapproval: false,
    decision: "pending",
    flags: [
      "Submitter indicated they are unrepresented — routed to you, no automated reply sent",
      "No preapproval or proof of funds attached",
      "Home-sale contingency detected in special terms",
      "Closing date is 28 days later than the other offer",
    ],
    fields: [
      { group: "Price", label: "Purchase price", value: "$441,000", confidence: "high", page: 1, consequential: true },
      { group: "Financing", label: "Loan type", value: "FHA", confidence: "medium", page: 1, consequential: true },
      { group: "Financing", label: "Down payment", value: "3.5% ($15,435)", confidence: "medium", page: 1, consequential: true },
      { group: "Deposits", label: "Earnest money", value: "$2,000", confidence: "high", page: 2, consequential: true },
      { group: "Dates", label: "Closing date", value: "14 November 2026", confidence: "low", page: 2, consequential: true },
      { group: "Dates", label: "Due diligence ends", value: "17 days from binding", confidence: "low", page: 3, consequential: true },
      { group: "Contingencies", label: "Sale of buyer's home", value: "Yes — found in special stipulations", confidence: "medium", page: 6 },
      { group: "Concessions", label: "Seller paid closing costs", value: "$12,000", confidence: "high", page: 4 },
      { group: "Documents", label: "Preapproval letter", value: "Not attached", confidence: "high", page: 0 },
      { group: "Special Terms", label: "Handwritten addendum", value: "Present, partially legible", confidence: "low", page: 6 },
    ],
  },
];

/* ---------------- meeting to plan ---------------- */

export interface ProposedChange {
  id: string;
  kind: "field" | "task" | "milestone" | "date" | "document";
  label: string;
  before: string;
  after: string;
  basis: string;
}

export const MEETING_NOTES = `Called Maya Tuesday 4:30. Devon joined for the second half.

She's been quoted $340k as a comfortable number by a lender friend but that was before we looked at the actual cash. Devon thought the down payment WAS the cash needed — didn't know about escrow or prepaids. That was the moment the conversation changed.

Savings is $9,000 not $12,000 — the $12k figure included her emergency fund which she does not want to touch. Agreed to treat that as untouchable.

Wants to be in before her lease ends 31 March. Devon is more flexible, said "we shouldn't rush it if the numbers don't work."

Georgia Dream looks likely on income. DeKalb county program also possible. She had never heard of either. Asked twice whether it was real money.

Action: send both to Brookhaven Lending to confirm eligibility. She'll open a separate savings account so the emergency fund stays separate. Homebuyer education course needs doing — she was surprised it was required.

Devon asked about the agency agreement, wants to read it before signing. Fair.`;

export const PROPOSED_CHANGES: ProposedChange[] = [
  { id: "c1", kind: "field", label: "Available savings", before: "$12,000", after: "$9,000", basis: "Maya stated the $12,000 included an emergency fund she will not use." },
  { id: "c2", kind: "field", label: "Target price", before: "$340,000", after: "$325,000", basis: "Revised after the true cash-to-close conversation." },
  { id: "c3", kind: "field", label: "Target close", before: "Not set", after: "Before 31 March 2027", basis: "Lease ends 31 March." },
  { id: "c4", kind: "field", label: "Household decision-makers", before: "Maya Ellison", after: "Maya Ellison, Devon Ellison", basis: "Devon joined the call and is part of the decision." },
  { id: "c5", kind: "task", label: "Open a dedicated savings account", before: "—", after: "Due 11 Sep, owner: customer", basis: "Agreed on the call." },
  { id: "c6", kind: "task", label: "Confirm Georgia Dream and DeKalb eligibility", before: "—", after: "Due 15 Sep, owner: outside professional", basis: "Agreed to send both to Brookhaven Lending." },
  { id: "c7", kind: "task", label: "Complete homebuyer education course", before: "—", after: "Due 20 Oct, owner: customer", basis: "Required by two matched programs." },
  { id: "c8", kind: "task", label: "Send buyer agency agreement", before: "—", after: "Due 8 Sep, owner: agent", basis: "Devon asked to read it before signing." },
  { id: "c9", kind: "milestone", label: "Financing preparation", before: "Upcoming", after: "Current", basis: "Lender conversation is now in progress." },
  { id: "c10", kind: "document", label: "Request two months of pay stubs", before: "—", after: "Requested from customer", basis: "Needed for eligibility confirmation." },
  { id: "c11", kind: "field", label: "Emergency fund treatment", before: "Not recorded", after: "Excluded from closing funds", basis: "Explicit instruction from Maya." },
];

/* ---------------- document to journey ---------------- */

export interface ExtractedDate {
  id: string;
  label: string;
  value: string;
  page: number;
  confidence: "high" | "medium" | "low";
  owner: Owner;
  consequential: boolean;
  contradiction?: string;
}

export const CONTRACT_DATES: ExtractedDate[] = [
  { id: "d1", label: "Binding agreement date", value: "6 September 2026", page: 1, confidence: "high", owner: "rift", consequential: true },
  { id: "d2", label: "Due diligence ends", value: "16 September 2026", page: 3, confidence: "high", owner: "customer", consequential: true },
  { id: "d3", label: "Earnest money delivered", value: "9 September 2026", page: 2, confidence: "high", owner: "customer", consequential: true },
  { id: "d4", label: "Loan application submitted", value: "11 September 2026", page: 4, confidence: "medium", owner: "customer", consequential: true },
  { id: "d5", label: "Appraisal ordered by", value: "18 September 2026", page: 4, confidence: "medium", owner: "outside", consequential: true },
  { id: "d6", label: "Financing contingency ends", value: "27 September 2026", page: 4, confidence: "low", owner: "customer", consequential: true, contradiction: "Page 4 says 21 days from binding, which would be 27 September. The addendum on page 7 says 25 days, which would be 1 October." },
  { id: "d7", label: "Final walkthrough", value: "16 October 2026", page: 5, confidence: "medium", owner: "customer", consequential: false },
  { id: "d8", label: "Closing", value: "17 October 2026", page: 1, confidence: "high", owner: "agent", consequential: true },
];

/* ---------------- referrals and reviews ---------------- */

export interface AdvocacyRecord {
  id: string;
  person: string;
  moment: string;
  reviewState: "not-asked" | "asked" | "received" | "routed-to-agent";
  referrals: { name: string; date: string; outcome: string }[];
}

export const ADVOCACY: AdvocacyRecord[] = [
  {
    id: "a1", person: "Priya Raman", moment: "Closed 12 Dec 2025",
    reviewState: "received",
    referrals: [
      { name: "Jordan Pike", date: "2026-09-04", outcome: "New lead — assessment started" },
      { name: "Harold & Ruth Vance", date: "2026-08-02", outcome: "Active seller — listing in preparation" },
    ],
  },
  {
    id: "a2", person: "Harold & Ruth Vance", moment: "Repair plan approved",
    reviewState: "not-asked",
    referrals: [{ name: "Nadia & Chris Okafor", date: "2026-05-19", outcome: "Active — reviewing offers" }],
  },
  {
    id: "a3", person: "Wendell Cruz", moment: "Closed 3 Aug 2026",
    reviewState: "routed-to-agent",
    referrals: [],
  },
];

/* ---------------- living package updates ---------------- */

export interface PackageUpdate {
  id: string;
  when: string;
  trigger: string;
  headline: string;
  meaning: string;
  action: string;
  tone: "blue" | "ember" | "emerald" | "solar";
}

export const PACKAGE_UPDATES: PackageUpdate[] = [
  {
    id: "u1", when: "6 Sep", trigger: "New program opened in your county",
    headline: "A DeKalb assistance program reopened its funding",
    meaning: "Your estimated assistance range moved from $22,500–$27,500 to $30,000–$37,500. Your cash gap estimate drops by about $7,500.",
    action: "Ask Brookhaven Lending to include this program in your eligibility check",
    tone: "emerald",
  },
  {
    id: "u2", when: "28 Aug", trigger: "Matched program's funding closed",
    headline: "Gwinnett's program closed its current funding round",
    meaning: "It was in your range only if you widened your search to Gwinnett. Nothing changes for DeKalb.",
    action: "No action needed — we will tell you if it reopens",
    tone: "solar",
  },
  {
    id: "u3", when: "19 Aug", trigger: "Rates moved",
    headline: "Rates moved enough to change your monthly estimate",
    meaning: "Your all-in monthly estimate at $325,000 went from $2,412 to $2,357. Your cash to close is unchanged.",
    action: "No action needed",
    tone: "blue",
  },
  {
    id: "u4", when: "12 Aug", trigger: "Your own progress",
    headline: "You crossed $9,000 saved",
    meaning: "At your current rate you reach the cash you need in about 11 months, down from 14 when we started.",
    action: "Keep the transfer automatic — it is doing the work",
    tone: "emerald",
  },
];

/* ---------------- playbooks ---------------- */

export interface Playbook {
  id: string;
  name: string;
  trigger: string;
  mode: "manual" | "approval" | "automatic";
  actions: string[];
  runs: number;
  lastRun: string;
  state: "healthy" | "failed" | "paused";
  failure?: string;
}

export const PLAYBOOKS: Playbook[] = [
  {
    id: "p1", name: "Nurture cadence — not yet ready",
    trigger: "Lead in Exploring or Building readiness with no action due",
    mode: "approval",
    actions: ["Check whether a readiness step is due", "Check whether an assumption went stale", "Prepare a living-package update", "Stop if nothing changed"],
    runs: 34, lastRun: "6 Sep", state: "healthy",
  },
  {
    id: "p2", name: "Post-closing gift",
    trigger: "Transaction reaches Closed",
    mode: "approval",
    actions: ["Create the manual fulfilment task", "Prepare the artist email with the approved property image", "Schedule two-week follow-up", "Record completion or failure"],
    runs: 6, lastRun: "6 Sep", state: "failed",
    failure: "Artist mailbox rejected the message. Manual fallback task created and assigned to Kaleb.",
  },
  {
    id: "p3", name: "Review and referral",
    trigger: "Closing day, and again two weeks after move-in",
    mode: "approval",
    actions: ["Prepare a personal review request", "One follow-up if unopened, then stop", "Share the referral link", "Thank the referrer when a referral arrives"],
    runs: 9, lastRun: "3 Sep", state: "healthy",
  },
  {
    id: "p4", name: "Assistance registry watch",
    trigger: "Daily",
    mode: "automatic",
    actions: ["Check verification age on every program", "Suppress anything past 90 days", "Raise an agent task", "Flag customers whose package included it"],
    runs: 212, lastRun: "6 Sep", state: "healthy",
  },
];
