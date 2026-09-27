/**
 * Made-up data for the Operations mock-up (Blueprint v5 §8, decision D15).
 *
 * Every name, address and figure here is invented. The mock-up exists so
 * Kaleb can click through the proposed layout and say what to keep or change
 * before any real Operations screen is rebuilt; it reads nothing real and
 * writes nothing anywhere.
 */

export type Group = "attention" | "approval" | "today" | "waiting" | "upcoming";

export const GROUP_LABEL: Record<Group, string> = {
  attention: "Needs attention",
  approval: "Needs your approval",
  today: "Today",
  waiting: "Waiting on others",
  upcoming: "Upcoming",
};

/** What each group answers, from §8.2. */
export const GROUP_QUESTION: Record<Group, string> = {
  attention: "What needs my attention now?",
  approval: "What needs my approval?",
  today: "What is happening today?",
  waiting: "What is waiting on someone else?",
  upcoming: "What deadlines are coming?",
};

export interface OpsItem {
  id: string;
  group: Group;
  title: string;
  /** Why it is here. */
  why: string;
  owner: string;
  /** What it relates to: a person, a journey or a contract. */
  about: { label: string; href: string };
  evidence: string;
  due: string;
  next: string;
  tone: "neg" | "warn" | "pos" | "none";
}

export const ITEMS: OpsItem[] = [
  { id: "a1", group: "attention", title: "Inspection period ends tomorrow, 5:00 pm", why: "Contract date, not yet met", owner: "Kaleb", about: { label: "Dana & Chris Okafor, 418 Ridgecrest Dr", href: "/prototype/operations/journey/okafor" }, evidence: "Purchase agreement, section 4, checked 12 Sep", due: "Tomorrow 5:00 pm", next: "Record the amendment or the release", tone: "neg" },
  { id: "a2", group: "attention", title: "Buyer asked a question 6 hours ago", why: "Past the same-day promise at 5:00 pm", owner: "Kaleb", about: { label: "Maya Thompson", href: "/prototype/operations/journey/thompson" }, evidence: "\"Can we see the Decatur townhome Saturday?\"", due: "Today 5:00 pm", next: "Reply, or book the showing", tone: "warn" },
  { id: "a3", group: "attention", title: "Weekly program check could not read one page", why: "A scheduled job needs you", owner: "Kaleb", about: { label: "Programs", href: "/prototype/operations/other?page=programs" }, evidence: "gwinnettcounty.com answered 503 twice", due: "This week", next: "Open the page, or wait for next Monday", tone: "warn" },
  { id: "p1", group: "approval", title: "Search update to approve", why: "The household agreed a change", owner: "Kaleb", about: { label: "Maya Thompson", href: "/prototype/operations/journey/thompson" }, evidence: "Price up to $410,000 (was $385,000), confirmed by both", due: "Today", next: "Approve, then update Matrix", tone: "none" },
  { id: "p2", group: "approval", title: "Georgia Dream page changed", why: "A flagged program change", owner: "Kaleb", about: { label: "Programs", href: "/prototype/operations/other?page=programs" }, evidence: "\"Up to $10,000\" became \"Up to $12,000\"", due: "Before it ages out, 12 Dec", next: "Still right, or needs updating", tone: "none" },
  { id: "p3", group: "approval", title: "Draft follow-up email ready", why: "Prepared, not sent (D04)", owner: "Kaleb", about: { label: "Luis Herrera (lead)", href: "/prototype/operations/relationships?open=herrera" }, evidence: "Saved a $340k plan, checked programs", due: "Today", next: "Send, edit or discard", tone: "none" },
  { id: "t1", group: "today", title: "Showing: 2291 Belvedere Ln, 11:00 am", why: "Confirmed in ShowingTime", owner: "Kaleb", about: { label: "Maya Thompson", href: "/prototype/operations/journey/thompson" }, evidence: "Confirmed slot, 11:00 to 11:30", due: "11:00 am", next: "Ask for their answer afterwards", tone: "pos" },
  { id: "t2", group: "today", title: "Call booked: Priya Nair", why: "Booked from the site", owner: "Kaleb", about: { label: "Priya Nair (lead)", href: "/prototype/operations/relationships?open=nair" }, evidence: "Topic: cash to close", due: "2:30 pm", next: "Read their plan first", tone: "pos" },
  { id: "w1", group: "waiting", title: "Appraisal report", why: "Lender ordered it 9 Sep", owner: "Lender: Summit Home Loans", about: { label: "Dana & Chris Okafor", href: "/prototype/operations/journey/okafor" }, evidence: "Last update 22 Sep: inspector scheduled", due: "Check in Thursday", next: "Ask the loan officer for a date", tone: "none" },
  { id: "w2", group: "waiting", title: "Title commitment", why: "Attorney is running title", owner: "Attorney: Park & Wills", about: { label: "Dana & Chris Okafor", href: "/prototype/operations/journey/okafor" }, evidence: "Opened 8 Sep", due: "Check in Monday", next: "Nothing until then", tone: "none" },
  { id: "u1", group: "upcoming", title: "Financing contingency ends", why: "Contract date", owner: "Kaleb", about: { label: "Dana & Chris Okafor", href: "/prototype/operations/journey/okafor" }, evidence: "Purchase agreement, section 5", due: "3 Oct", next: "Confirm loan approval with the lender", tone: "none" },
  { id: "u2", group: "upcoming", title: "Closing", why: "Contract date", owner: "Kaleb", about: { label: "Dana & Chris Okafor", href: "/prototype/operations/journey/okafor" }, evidence: "Purchase agreement, section 1", due: "10 Oct", next: "Final walkthrough booked 9 Oct", tone: "none" },
];

export const ACTIVITY = [
  { at: "9:40 am", text: "New lead from the site: Luis Herrera saved a $340k plan", href: "/prototype/operations/relationships?open=herrera" },
  { at: "8:15 am", text: "Maya Thompson agreed the search change; Jordan Thompson agreed too", href: "/prototype/operations/journey/thompson" },
  { at: "Yesterday", text: "Offer submitted from /offer on 77 Pine Hollow Ct, with its PDF", href: "/prototype/operations/other?page=offers" },
  { at: "Yesterday", text: "Weekly program check: 6 unchanged, 1 changed, 1 unreachable", href: "/prototype/operations/other?page=programs" },
];

export const NEW_LEADS = [
  { id: "herrera", name: "Luis Herrera", summary: "Saved a $340k plan: cash to close $24,100, assistance up to $10,000", arrived: "9:40 am", minutes: 12 },
  { id: "nair", name: "Priya Nair", summary: "Booked a call about cash to close", arrived: "Yesterday", minutes: null },
];

export interface Person {
  id: string;
  name: string;
  side: "Buyer" | "Seller";
  stage: string;
  next: string;
  due: string;
  lastContact: string;
  source: string;
  summary: string;
  journey: string | null;
}

export const PEOPLE: Person[] = [
  { id: "okafor", name: "Dana & Chris Okafor", side: "Buyer", stage: "Under contract", next: "Record the inspection outcome", due: "Tomorrow", lastContact: "Today", source: "Referral from the Adeyemis", summary: "Built a $425k plan, checked programs, booked a call.", journey: "okafor" },
  { id: "thompson", name: "Maya Thompson", side: "Buyer", stage: "Touring", next: "Reply about Saturday", due: "Today", lastContact: "Yesterday", source: "Google, cash to close", summary: "Saved a $385k plan: cash to close $27,300.", journey: "thompson" },
  { id: "herrera", name: "Luis Herrera", side: "Buyer", stage: "New lead", next: "First reply", due: "Now", lastContact: "Never", source: "Facebook, assistance", summary: "Saved a $340k plan: assistance up to $10,000; asked for program alerts.", journey: null },
  { id: "nair", name: "Priya Nair", side: "Buyer", stage: "New lead", next: "Call at 2:30 pm", due: "Today", lastContact: "Never", source: "Direct", summary: "Booked a call about cash to close.", journey: null },
  { id: "walsh", name: "Eleanor Walsh", side: "Seller", stage: "Considering", next: "Pricing conversation", due: "Friday", lastContact: "3 days ago", source: "Unclaimed money page", summary: "Checked what she would keep: $182,000 before commission.", journey: null },
];

export interface Workstream { name: string; state: "done" | "active" | "waiting" | "blocked" | "not-started" }

export const TRANSACTIONS = [
  {
    id: "okafor", property: "418 Ridgecrest Dr, Decatur", client: "Dana & Chris Okafor", stage: "Under contract",
    nextDeadline: "Inspection ends tomorrow 5:00 pm", blocked: "Appraisal date not confirmed",
    work: [
      { name: "Earnest money", state: "done" }, { name: "Inspection", state: "active" }, { name: "Appraisal", state: "waiting" },
      { name: "Financing", state: "active" }, { name: "Title", state: "waiting" }, { name: "Insurance", state: "not-started" },
      { name: "HOA", state: "done" }, { name: "Survey", state: "not-started" }, { name: "Walkthrough", state: "not-started" },
      { name: "Possession", state: "not-started" },
    ] as Workstream[],
  },
];

export const JOURNEY: Record<string, { name: string; stage: string; status: string; next: string; household: string; overview: string[] }> = {
  okafor: {
    name: "Dana & Chris Okafor", stage: "Under contract", status: "On track, one date tomorrow",
    next: "Record the inspection outcome by tomorrow 5:00 pm", household: "Dana (buyer), Chris (buyer)",
    overview: ["Inspection ends tomorrow 5:00 pm", "Appraisal ordered 9 Sep, no date yet", "Closing 10 Oct"],
  },
  thompson: {
    name: "Maya Thompson", stage: "Touring", status: "Search updated, waiting on your approval",
    next: "Approve the search change and reply about Saturday", household: "Maya (buyer), Jordan (co-buyer)",
    overview: ["Showing today 11:00 am", "Question waiting 6 hours", "Search change agreed by both"],
  },
};

/** Everything the quick switcher can jump to. */
export const SWITCH = [
  ...PEOPLE.map((p) => ({ label: p.name, hint: `${p.side} · ${p.stage}`, href: p.journey ? `/prototype/operations/journey/${p.journey}` : `/prototype/operations/relationships?open=${p.id}` })),
  { label: "Today", hint: "Page", href: "/prototype/operations" },
  { label: "Relationships", hint: "Page", href: "/prototype/operations/relationships" },
  { label: "Transactions", hint: "Page", href: "/prototype/operations/transactions" },
];
