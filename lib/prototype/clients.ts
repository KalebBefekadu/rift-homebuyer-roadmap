export interface Client {
  id: string; name: string; av: string; color: string; role: string;
  journey: "Buyer" | "Seller" | "Buyer + Seller";
  stage: string; county: string; source: string; via?: string; since: string;
  rep: "None" | "Prepared" | "Sent" | "Signed" | "Expired";
  next: string; nextDue: string; value: string; heat: "hot" | "warm" | "cool";
  flag?: string;
  email: string; phone: string;
  household?: { name: string; role: string; state: string }[];
  tasks: { t: string; owner: string; due: string; state: string }[];
  timeline: { t: string; d: string; who: string }[];
  numbers: [string, string][];
}

export const CLIENTS: Client[] = [
  {
    id: "maya", name: "Maya Ellison", av: "ME", color: "#2f5480", role: "First-time buyer",
    journey: "Buyer", stage: "Building readiness", county: "DeKalb",
    source: "Paid social", since: "24 Aug 2026", rep: "Prepared",
    next: "Send the buyer agency agreement", nextDue: "Overdue 2d", value: "$325,000", heat: "hot",
    flag: "Journey blocked at Ready to shop until signed",
    email: "maya.ellison@example.com", phone: "(404) 555-0132",
    household: [
      { name: "Maya Ellison", role: "Primary", state: "Active" },
      { name: "Devon Ellison", role: "Co-buyer", state: "Invited 2 Sep" },
    ],
    tasks: [
      { t: "Open a dedicated savings account", owner: "Maya", due: "11 Sep", state: "Now" },
      { t: "Confirm Georgia Dream eligibility", owner: "Brookhaven", due: "15 Sep", state: "Waiting" },
      { t: "Send the buyer agency agreement", owner: "Kaleb", due: "4 Sep", state: "Overdue" },
      { t: "Complete homebuyer education", owner: "Maya", due: "20 Oct", state: "Upcoming" },
    ],
    timeline: [
      { t: "Meeting recap ready for review", d: "1d", who: "Rift" },
      { t: "Lender question sheet shared with Brookhaven", d: "1d", who: "Rift" },
      { t: "Planning session with Maya and Devon", d: "2d", who: "Kaleb" },
      { t: "Plan published", d: "4d", who: "Kaleb" },
      { t: "Assessment completed", d: "13d", who: "Maya" },
    ],
    numbers: [["Cash needed", "$31,190"], ["Covered", "$10,790"], ["Gap", "$20,400"], ["Monthly at target", "$2,357"]],
  },
  {
    id: "vance", name: "Harold & Ruth Vance", av: "HV", color: "#3f6f5f", role: "Long-tenured seller",
    journey: "Seller", stage: "Preparing the property", county: "Cobb",
    source: "Referral", via: "Priya Raman", since: "2 Aug 2026", rep: "Signed",
    next: "Decide on the assessment appeal", nextDue: "19 days left", value: "$415,000", heat: "hot",
    flag: "Appeal window closes 25 Sep",
    email: "r.vance@example.com", phone: "(770) 555-0188",
    household: [
      { name: "Harold Vance", role: "Owner", state: "Active" },
      { name: "Ruth Vance", role: "Owner", state: "Active" },
    ],
    tasks: [
      { t: "Approve the repair shortlist", owner: "Harold", due: "8 Sep", state: "Now" },
      { t: "File the homestead exemption", owner: "Ruth", due: "25 Sep", state: "Now" },
      { t: "Decide on the assessment appeal", owner: "Harold", due: "2 Sep", state: "Overdue" },
      { t: "Schedule photography", owner: "Kaleb", due: "18 Sep", state: "Upcoming" },
    ],
    timeline: [
      { t: "Ruth asked about the painter quote", d: "16h", who: "Ruth" },
      { t: "Repair triage delivered", d: "3d", who: "Rift" },
      { t: "Listing agreement signed", d: "9d", who: "Harold" },
      { t: "Seller assessment completed", d: "35d", who: "Harold" },
    ],
    numbers: [["Expected price", "$415,000"], ["Payoff", "$236,000"], ["Est. net proceeds", "$140,600"], ["Unclaimed value found", "$2,300/yr"]],
  },
  {
    id: "okafor", name: "Nadia & Chris Okafor", av: "NO", color: "#8a4a2e", role: "Selling and buying",
    journey: "Buyer + Seller", stage: "Reviewing offers", county: "Fulton",
    source: "Referral", via: "Harold & Ruth Vance", since: "19 May 2026", rep: "Signed",
    next: "Choose between two offers", nextDue: "Tomorrow 5:00pm", value: "$428,000", heat: "hot",
    flag: "Purchase down payment depends on this sale closing 17 Oct",
    email: "n.okafor@example.com", phone: "(404) 555-0170",
    household: [
      { name: "Nadia Okafor", role: "Owner", state: "Active" },
      { name: "Chris Okafor", role: "Owner", state: "Active" },
    ],
    tasks: [
      { t: "Choose between two offers", owner: "Nadia", due: "7 Sep", state: "Now" },
      { t: "Confirm purchase financing order", owner: "Kaleb", due: "9 Sep", state: "Upcoming" },
      { t: "Interim housing decision", owner: "Nadia", due: "20 Sep", state: "Upcoming" },
    ],
    timeline: [
      { t: "Second offer received — Deel", d: "3h", who: "Rift Offer" },
      { t: "First offer received — Whitfield", d: "14h", who: "Rift Offer" },
      { t: "Listing reached 14 showings", d: "1d", who: "Rift" },
      { t: "Went live on the market", d: "22d", who: "Kaleb" },
    ],
    numbers: [["Best offer net", "$398,900"], ["Purchase cash needed", "$92,400"], ["Margin", "$306,500"], ["Possession gap", "3 days"]],
  },
  {
    id: "pike", name: "Jordan Pike", av: "JP", color: "#6b4a7a", role: "New referral",
    journey: "Buyer", stage: "Exploring", county: "DeKalb",
    source: "Referral", via: "Priya Raman", since: "4 Sep 2026", rep: "None",
    next: "Finish the assessment", nextDue: "Stopped at Q9", value: "—", heat: "warm",
    email: "j.pike@example.com", phone: "(404) 555-0119",
    tasks: [{ t: "Finish the readiness assessment", owner: "Jordan", due: "9 Sep", state: "Now" }],
    timeline: [
      { t: "Started the assessment, stopped at question 9", d: "22m", who: "Jordan" },
      { t: "Arrived via Priya Raman's referral link", d: "2d", who: "Rift" },
    ],
    numbers: [["Assessment progress", "8 of 9"], ["Assistance matched", "$30,000–$37,500"]],
  },
  {
    id: "beltran", name: "Tomás Beltrán", av: "TB", color: "#5c6470", role: "Not yet ready",
    journey: "Buyer", stage: "Exploring", county: "Gwinnett",
    source: "Organic search", since: "14 Jun 2026", rep: "None",
    next: "Nothing due — monthly check", nextDue: "1 Oct", value: "$260,000", heat: "cool",
    flag: "Stalled: no action across three touches",
    email: "t.beltran@example.com", phone: "(678) 555-0143",
    tasks: [{ t: "Build savings to $6,000", owner: "Tomás", due: "Dec", state: "Upcoming" }],
    timeline: [
      { t: "Told Gwinnett funding closed, gap corrected", d: "4h", who: "Rift" },
      { t: "Opened living-package update", d: "9d", who: "Tomás" },
      { t: "Assessment completed", d: "84d", who: "Tomás" },
    ],
    numbers: [["Gap", "$18,900"], ["Saving rate", "$300/mo"], ["Est. ready", "Aug 2027"]],
  },
  {
    id: "raman", name: "Priya Raman", av: "PR", color: "#7a5c2e", role: "Past client",
    journey: "Buyer", stage: "Homeownership", county: "DeKalb",
    source: "Open house", since: "3 Oct 2025", rep: "Expired",
    next: "Nothing due", nextDue: "—", value: "Closed $312,000", heat: "warm",
    email: "priya.raman@example.com", phone: "(404) 555-0155",
    tasks: [{ t: "Artist gift — manual fallback", owner: "Kaleb", due: "8 Sep", state: "Overdue" }],
    timeline: [
      { t: "Artist gift email bounced", d: "6h", who: "Rift" },
      { t: "Referred Jordan Pike", d: "2d", who: "Priya" },
      { t: "Referred Harold & Ruth Vance", d: "35d", who: "Priya" },
      { t: "Left a review", d: "8mo", who: "Priya" },
      { t: "Closed on 118 Ashbury Lane", d: "9mo", who: "Kaleb" },
    ],
    numbers: [["Referrals given", "2"], ["Became clients", "2"], ["Reviews", "1"], ["Passport opens", "4 in 6mo"]],
  },
];

export const findClient = (id: string) => CLIENTS.find((c) => c.id === id);

export const STATE_CHIP: Record<string, string> = {
  Now: "chip-ink", Waiting: "chip-warn", Overdue: "chip-neg", Upcoming: "chip", Done: "chip-pos",
};
export const REP_CHIP: Record<string, string> = {
  None: "chip", Prepared: "chip-warn", Sent: "chip-warn", Signed: "chip-pos", Expired: "chip",
};
