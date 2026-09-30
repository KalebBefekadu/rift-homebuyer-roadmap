/**
 * A full, made-up book of business for the LOCAL stack, so every Operations
 * page can be seen with several records in every state at once.
 *
 *   npm run local:seed-demo                 load it into rift-pg (scripts/local/up.sh)
 *   node scripts/local/seed-demo.mjs        print the SQL instead
 *
 * Local only. It writes to the `postgres` database inside the rift-pg
 * container and nowhere else, and it is not a fixture for the test suites.
 * Never point it at a hosted database: every person, address and figure in it
 * is invented, and a real agent's book would end up mixed with them.
 *
 * Why it generates SQL rather than being SQL: several stored values are only
 * valid if they match what the application computes. An approved outbox step
 * must name the SHA-256 of the draft's canonical form, a lead's stored score is
 * what scoreLead gives its inputs, a Matrix package is what buildPackage makes
 * of a brief, a saved plan is what cleanPlan keeps. Importing those functions
 * (through jiti, as the app's own TypeScript) keeps the seed from drifting into
 * shapes the pages would read differently. Everything is dated relative to the
 * moment it runs, so a re-run makes the book fresh again.
 *
 * Re-runnable: every row it writes carries an id beginning `de30` (or a
 * session beginning `demo-`, or a rule decided by "Kaleb Befekadu (demo)"),
 * and the first thing the SQL does, in the same transaction as the inserts, is
 * delete exactly those. Nothing else is touched.
 */
import { createJiti } from "jiti";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const jiti = createJiti(import.meta.url, { alias: { "@": root } });
const load = (p) => jiti.import(path.join(root, p));

const { scoreLead } = await load("lib/core/lead.ts");
const { canonical } = await load("lib/core/outbox.ts");
const { buildPackage, canonicalPackage } = await load("lib/core/search.ts");
const { cleanPlan } = await load("lib/core/saved-plan.ts");
const { sequenceFor } = await load("lib/core/nurture.ts");
const { initialWork } = await load("lib/core/progress.ts");
const { resolve: resolveDeadline } = await load("lib/core/deadline.ts");
const { GEORGIA_PROGRAMS } = await load("lib/core/assistance.ts");
const { sourcesToCheck } = await load("lib/core/program-check.ts");
const { snapshotOf } = await load("lib/core/offer-room.ts");
const { zonedToUtc } = await load("lib/core/tour.ts");

/* ------------------------------------------------------------------ */
/* Time. Everything is relative to now, in Georgia.                    */
/* ------------------------------------------------------------------ */

const NOW = Date.now();
const MIN = 60_000, HOUR = 3_600_000, DAY = 86_400_000;
/** A moment in the past: ago(3) is three days ago, ago(0, 2) two hours ago. */
const ago = (days = 0, hours = 0, mins = 0) => new Date(NOW - days * DAY - hours * HOUR - mins * MIN).toISOString();
/** A moment in the future. */
const ahead = (days = 0, hours = 0) => new Date(NOW + days * DAY + hours * HOUR).toISOString();
const nyDay = (ms) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date(ms));
/** A Georgia calendar day, offset from today: day(-3) is three days ago. */
const day = (offset = 0) => nyDay(NOW + offset * DAY);
/** A time of day in Georgia on that day, so showings and tours land in daylight. */
const local = (offset, time) => new Date(zonedToUtc(day(offset), time)).toISOString();

/* ------------------------------------------------------------------ */
/* Ids. `de30` + a table code, so the delete can never reach a real row. */
/* ------------------------------------------------------------------ */

const CODES = {
  lead: 1, assessment: 2, readout: 3, answer: 4, consent: 5, enrolment: 6, touch: 7, note: 8, plan: 9,
  decision: 10, option: 11, journey: 12, member: 13, revision: 14, package: 15, response: 16, home: 17,
  reaction: 18, stop: 19, step: 20, feedback: 21, bid: 22, bidstep: 23, bidresp: 24, tx: 25, work: 26,
  jevent: 27, outcome: 28, deadline: 29, drev: 30, doc: 31, money: 32, offer: 33, levent: 34, showing: 35,
  lreview: 36, opinion: 37, presp: 38, sfig: 39, dep: 40, depev: 41, link: 42, recon: 43, moment: 44,
  outbox: 45, oevent: 46, campaign: 47, crev: 48, cpub: 49, check: 50, creview: 51, job: 52, rate: 53,
  figure: 54, review: 55, mark: 56, showkey: 57, request: 58,
};
const counters = {};
const id = (kind) => {
  const n = (counters[kind] = (counters[kind] ?? 0) + 1);
  return `de30${CODES[kind].toString(16).padStart(4, "0")}-0000-4000-8000-${String(n).padStart(12, "0")}`;
};
const rid = () => id("request");
const sha = (s) => createHash("sha256").update(s).digest("hex");

const AGENT = "dddd0000-0000-4000-8000-000000000001";
const KALEB = "Kaleb Befekadu";

/* ------------------------------------------------------------------ */
/* SQL                                                                 */
/* ------------------------------------------------------------------ */

class Raw { constructor(sql) { this.sql = sql; } }
const raw = (sql) => new Raw(sql);
const json = (v) => raw(`${lit(JSON.stringify(v))}::jsonb`);
const arr = (items, type) => raw(`array[${items.map(lit).join(",")}]::${type}[]`);
const lit = (v) => {
  if (v === null || v === undefined) return "null";
  if (v instanceof Raw) return v.sql;
  if (typeof v === "number") { if (!Number.isFinite(v)) throw new Error(`not a number: ${v}`); return String(v); }
  if (typeof v === "boolean") return v ? "true" : "false";
  return `'${String(v).replace(/'/g, "''")}'`;
};

const out = [];
const counts = {};
function ins(table, row, suffix = "") {
  const cols = Object.keys(row);
  out.push(`insert into ${table} (${cols.join(",")}) values (${cols.map((c) => lit(row[c])).join(",")})${suffix};`);
  counts[table] = (counts[table] ?? 0) + 1;
  return row;
}

/* ------------------------------------------------------------------ */
/* People                                                              */
/* ------------------------------------------------------------------ */

/**
 * One entry per person. `lead` is the LeadInput they gave (only funnel leads
 * have one). `readout` gives them an assessment, answers and a readout.
 */
const P = {};
const leadRows = [];

function person(key, p) {
  const leadId = id("lead");
  const session = `demo-${key}`;
  const created = p.created;
  const input = p.lead ? { side: p.side, contactable: Boolean(p.email || p.phone), hoursSince: 0, ...p.lead } : null;
  const score = input ? scoreLead(input) : null;
  const row = {
    id: leadId, agent_id: AGENT, name: p.name ?? null, email: p.email ?? null, phone: p.phone ?? null, side: p.side,
    score: score?.score ?? null, band: score?.band ?? null, signals: json(score?.signals ?? []),
    human_replied_at: p.replied ?? null, created_at: created, lead_input: input ? json(input) : null,
    stage: p.stage ?? null, stage_since: p.stage ? (p.stageSince ?? created) : null,
    source: p.source ?? "funnel", contact_basis: p.basis ?? null,
    archived_at: p.archived ?? null, archived_reason: p.archivedReason ?? null,
    next_action: p.next?.[0] ?? null, next_due: p.next?.[1] ?? null,
    session_id: session, client_token: p.clientToken ? `demo-plan-${key}-${sha(key).slice(0, 24)}` : null,
    payoff_cents: p.payoff ?? null, commission_pct: p.commission ?? null,
    mood: p.mood ?? null, mood_at: p.mood ? ago(p.moodDays ?? 3) : null, closed_on: p.closedOn ?? null,
    referral_token: `de30${sha(`ref-${key}`).slice(0, 20)}`,
    representation: p.rep?.[0] ?? "none", representation_signed_on: p.rep?.[1] ?? null, representation_expires_on: p.rep?.[2] ?? null,
    plan: p.plan ? json(p.plan) : null, plan_token: p.plan ? `demo${sha(`plan-${key}`).slice(0, 40)}` : null,
    plan_saved_at: p.plan ? (p.planSaved ?? created) : null,
  };
  leadRows.push({ row, referredBy: p.referredBy ?? null });
  P[key] = { ...p, id: leadId, session, input, score, token: row.referral_token };
  return P[key];
}

const buyPlan = (answers, values, extra = {}) => cleanPlan({ mode: "save", side: "buy", answers, values, ...extra }, new Date(NOW));

/* -- Funnel leads nobody has picked up, or only just ------------------ */

person("marcus", {
  name: "Marcus Bell", email: "marcus.bell@example.com", phone: "(404) 555-0142", side: "buy", created: ago(0, 0, 18),
  lead: { timing: "In the next 3 months", completion: 1, value: 385000, monthsToReady: 0, coBuyer: true, source: "google" },
  readout: { county: "Gwinnett", figures: { cashToClose: 21450, gap: 0, monthly: 2610, assistance: 10000, verdict: "You can buy in Gwinnett around $385,000 now; the cash is already there." } },
  plan: buyPlan({ county: "Gwinnett", price: 385000, savings: 42000, income: 118000 }, [{ tool: "cash", figure: "$21,450", href: "/buy/cash-to-close" }], { alerts: true }),
  attr: ["google", "cpc", "gwinnett-first-home", "/buy/cash-to-close"], phoneConsent: true,
});
person("destiny", {
  name: "Destiny Okafor", email: "destiny.okafor@example.com", phone: "(470) 555-0199", side: "buy", created: ago(0, 2, 5),
  lead: { timing: "In the next 3 months", completion: 1, value: 310000, monthsToReady: 2, coBuyer: false, source: "facebook" },
  readout: { county: "DeKalb", figures: { cashToClose: 16900, gap: 3400, monthly: 2240, assistance: 7500, verdict: "About two months of saving stands between you and a DeKalb home around $310,000." } },
  attr: ["facebook", "paid-social", "dekalb-assistance", "/buy/assistance"], phoneConsent: true,
});
person("priya", {
  name: "Priya Raman", email: "priya.raman@example.com", side: "buy", created: ago(0, 5, 40),
  lead: { timing: "3 to 6 months", completion: 1, value: 450000, monthsToReady: 4, coBuyer: true, source: "instagram" },
  readout: { county: "Fulton", figures: { cashToClose: 28100, gap: 9200, monthly: 3180, assistance: 0, verdict: "A $450,000 home in Fulton is about four months of saving away." } },
  attr: ["instagram", "organic", null, "/buy/monthly-cost"],
});
person("tomas", {
  name: "Tomás Herrera", email: "tomas.herrera@example.com", side: "buy", created: ago(1, 3),
  lead: { timing: "3 to 6 months", completion: 1, value: 520000, monthsToReady: 0, coBuyer: false, source: "abroad" },
  readout: { county: "Fulton", figures: { cashToClose: 161000, verdict: "Buying from Mexico with no U.S. credit: plan on a foreign national loan with 30% down." } },
  attr: ["google", "organic", null, "/abroad"], abroad: true,
});
person("grace", {
  name: "Grace Whitfield", email: "grace.whitfield@example.com", phone: "(678) 555-0117", side: "sell", created: ago(0, 3, 10),
  lead: { timing: "In the next 3 months", completion: 1, value: 540000, monthsToReady: 0, coBuyer: false, source: "google" },
  readout: { county: "Cobb", side: "sell", figures: { verdict: "At $540,000 you would keep about $214,000 after the payoff and selling costs." } },
  attr: ["google", "cpc", "cobb-sellers", "/sell/proceeds"], phoneConsent: false,
});
person("kevin", {
  name: "Kevin Tran", email: "kevin.tran@example.com", side: "buy", created: ago(0, 10),
  lead: { timing: "6 to 9 months", completion: 0.6, value: 290000, monthsToReady: null, coBuyer: false, source: "direct" },
  attr: ["(direct)", null, null, "/buy"], partial: true,
});
person("anon", {
  name: null, email: null, side: "buy", created: ago(0, 7),
  lead: { timing: "Just looking", completion: 1, value: 260000, monthsToReady: 14, coBuyer: false, source: "bing" },
  readout: { county: "Clayton", figures: { cashToClose: 12400, gap: 11800, monthly: 1890, assistance: 12500, verdict: "Clayton's assistance could close most of the gap on a $260,000 home." } },
  attr: ["bing", "organic", null, "/buy/assistance"],
});

/* -- Funnel leads being worked, or gone quiet ------------------------ */

person("lena", {
  name: "Lena Fischer", email: "lena.fischer@example.com", side: "buy", created: ago(4, 6), replied: ago(4, 5, 40),
  lead: { timing: "9 to 12 months", completion: 1, value: 640000, monthsToReady: 0, coBuyer: true, source: "abroad" },
  readout: { county: "Fulton", figures: { cashToClose: 198000, verdict: "From Germany with a second home in mind: the return depends on rental rules in your building." } },
  attr: ["linkedin", "social", "buyers-abroad", "/abroad/cost"], abroad: true, next: ["Send the foreign national lender intro", day(1)],
});
person("harold", {
  name: "Harold Jenkins", email: "harold.jenkins@example.com", phone: "(770) 555-0163", side: "sell", created: ago(6, 2), replied: ago(6, 1),
  lead: { timing: "6 to 9 months", completion: 1, value: 395000, monthsToReady: 0, coBuyer: false, source: "newsletter" },
  readout: { county: "Henry", side: "sell", figures: { verdict: "You would keep about $231,000; the roof is the one repair that changes that." } },
  attr: ["newsletter", "email", "september-sellers", "/sell/prepare"], phoneConsent: true,
  next: ["Call about the roof quote", day(-1)],
});
person("olivia", {
  name: "Olivia Martin", email: "olivia.martin@example.com", phone: "(404) 555-0188", side: "buy", created: ago(2, 4), replied: ago(2, 3, 50),
  lead: { timing: "3 to 6 months", completion: 1, value: 335000, monthsToReady: 3, coBuyer: false, source: "google" },
  readout: { county: "DeKalb", figures: { cashToClose: 18200, gap: 5100, monthly: 2380, assistance: 10000, verdict: "Three months of saving, or one assistance program, gets you to a DeKalb home." } },
  plan: buyPlan({ county: "DeKalb", price: 335000, savings: 13000, income: 84000 }, [{ tool: "assistance", figure: "$10,000", href: "/buy/assistance" }, { tool: "cash", figure: "$18,200", href: "/buy/cash-to-close" }], { alerts: true }),
  attr: ["google", "organic", null, "/buy/assistance"], phoneConsent: true,
  stage: "Exploring", stageSince: ago(2, 3), next: ["Walk through the Georgia Dream checklist", day(0)], clientToken: true,
});
person("brianna", {
  name: "Brianna Scott", email: "brianna.scott@example.com", side: "buy", created: ago(12), replied: ago(11, 20),
  lead: { timing: "9 to 12 months", completion: 1, value: 300000, monthsToReady: 9, coBuyer: false, source: "facebook" },
  readout: { county: "Clayton", figures: { cashToClose: 15800, gap: 8900, monthly: 2150, assistance: 12500, verdict: "Nine months of saving at your pace, fewer with Clayton's program." } },
  attr: ["facebook", "paid-social", "clayton-assistance", "/buy/assistance"], stopped: ["declined", 10],
});
person("jamal", {
  name: "Jamal Carter", email: "jamal.carter@example.com", side: "buy", created: ago(40),
  lead: { timing: "Just looking", completion: 1, value: 275000, monthsToReady: 18, coBuyer: false, source: "google" },
  readout: { county: "Douglas", figures: { cashToClose: 14100, gap: 12600, monthly: 1990, assistance: 5000, verdict: "Real, and about a year and a half of saving away." } },
  attr: ["google", "organic", null, "/buy/timeline"], stopped: ["unsubscribed", 20],
});
person("yuki", {
  name: "Yuki Tanaka", email: "yuki.tanaka@example.com", side: "buy", created: ago(9), replied: ago(9, -1),
  lead: { timing: "3 to 6 months", completion: 1, value: 480000, monthsToReady: 0, coBuyer: true, source: "abroad" },
  readout: { county: "Cobb", figures: { cashToClose: 150000, verdict: "Relocating from Osaka on an L-1: a U.S. lender can count your offer letter." } },
  attr: ["google", "organic", null, "/abroad"], abroad: true,
  stage: "Financing", stageSince: ago(5), rep: ["sent"], next: ["Chase the relocation lender's term sheet", day(2)],
});

/* -- Clients with journeys -------------------------------------------- */

const signed = (daysAgo, lastsDays) => ["signed", day(-daysAgo), lastsDays === null ? null : day(-daysAgo + lastsDays)];

person("alvarez", {
  name: "Sofia Alvarez", email: "sofia.alvarez@example.com", phone: "(404) 555-0131", side: "buy", created: ago(21), replied: ago(21, -0.2),
  lead: { timing: "3 to 6 months", completion: 1, value: 360000, monthsToReady: 1, coBuyer: true, source: "google" },
  readout: { county: "DeKalb", figures: { cashToClose: 19800, gap: 1900, monthly: 2520, assistance: 7500, verdict: "One month of saving, or DeKalb HomeStart, and you are ready." } },
  plan: buyPlan({ county: "DeKalb", price: 360000, savings: 18000, income: 121000, credit: "700-739" }, [{ tool: "afford", figure: "$360,000", href: "/buy/afford" }, { tool: "monthly", figure: "$2,520", href: "/buy/monthly-cost" }], { alerts: true }),
  attr: ["google", "cpc", "decatur-first-home", "/buy/afford"], phoneConsent: true,
  stage: "Searching", stageSince: ago(10), rep: signed(14, 180), clientToken: true, stopped: ["converted", 14],
  next: ["Send the Decatur shortlist", day(1)],
});
person("chris", {
  name: "Chris Nguyen", email: "chris.nguyen@example.com", phone: "(678) 555-0102", side: "buy", created: ago(45), replied: ago(45, -0.1),
  lead: { timing: "In the next 3 months", completion: 1, value: 425000, monthsToReady: 0, coBuyer: false, source: "zillow" },
  readout: { county: "Gwinnett", figures: { cashToClose: 24300, gap: 0, monthly: 2890, assistance: 0, verdict: "Ready now for Gwinnett around $425,000." } },
  attr: ["zillow", "referral", null, "/buy/cash-to-close"],
  stage: "Searching", stageSince: ago(30), rep: signed(40, 180), stopped: ["converted", 40],
});
person("rachel", {
  name: "Rachel Kim", email: "rachel.kim@example.com", phone: "(470) 555-0155", side: "buy", created: ago(60), replied: ago(60, -0.3),
  lead: { timing: "In the next 3 months", completion: 1, value: 430000, monthsToReady: 0, coBuyer: false, source: "google" },
  readout: { county: "Cobb", figures: { cashToClose: 26100, gap: 0, monthly: 2950, assistance: 0, verdict: "Ready now for Cobb around $430,000." } },
  attr: ["google", "organic", null, "/buy/monthly-cost"],
  stage: "Reviewing offers", stageSince: ago(3), rep: signed(50, 120), stopped: ["converted", 50], clientToken: true,
  next: ["Answer the Smyrna counter by 5pm", day(0)],
});
person("brooks", {
  name: "Michael Brooks", email: "michael.brooks@example.com", phone: "(404) 555-0177", side: "buy", created: ago(75), replied: ago(75, -0.1),
  lead: { timing: "In the next 3 months", completion: 1, value: 465000, monthsToReady: 0, coBuyer: true, source: "referral" },
  readout: { county: "DeKalb", figures: { cashToClose: 31200, gap: 0, monthly: 3240, assistance: 0, verdict: "Ready, once the sale of Wren Court closes." } },
  attr: ["referral", "word-of-mouth", null, "/buy/cash-to-close"],
  stage: "Under contract", stageSince: ago(12), rep: signed(70, 365), stopped: ["converted", 70], clientToken: true,
  payoff: 18700000, commission: 2.5, mood: "good",
});
person("ethan", {
  name: "Ethan Walker", email: "ethan.walker@example.com", side: "buy", created: ago(90), source: "manual", basis: "Asked for help at the Kirkwood open house",
  stage: "Closing", stageSince: ago(4), rep: signed(80, 365), mood: "mixed", moodDays: 2,
});
person("nia", {
  name: "Nia Johnson", email: "nia.johnson@example.com", phone: "(404) 555-0110", side: "buy", created: ago(120), replied: ago(120, -0.2),
  lead: { timing: "In the next 3 months", completion: 1, value: 340000, monthsToReady: 0, coBuyer: false, source: "google" },
  readout: { county: "Fulton", figures: { cashToClose: 18900, gap: 0, monthly: 2400, assistance: 10000, verdict: "Ready now, and ATL HomeNOW could cover most of the down payment." } },
  attr: ["google", "organic", null, "/buy/assistance"],
  stage: "Closed", stageSince: ago(20), rep: signed(110, 180), stopped: ["converted", 110], closedOn: day(-20), mood: "good", moodDays: 15, clientToken: true,
});
person("samuel", {
  name: "Samuel Adeyemi", email: "samuel.adeyemi@example.com", side: "buy", created: ago(25), replied: ago(25, -1),
  lead: { timing: "3 to 6 months", completion: 1, value: 400000, monthsToReady: 0, coBuyer: false, source: "abroad" },
  readout: { county: "Gwinnett", figures: { cashToClose: 118000, verdict: "From Lagos with an ITIN: a portfolio lender is the realistic route, at 25% down." } },
  attr: ["google", "organic", null, "/abroad/cost"], abroad: true,
  stage: "Ready to shop", stageSince: ago(8), rep: signed(18, 90), stopped: ["converted", 18],
});
person("linda", {
  name: "Linda Patterson", email: "linda.patterson@example.com", phone: "(770) 555-0124", side: "buy", created: ago(95), source: "manual", basis: "Past client from 2019, called about moving up",
  stage: "Searching", stageSince: ago(6), rep: signed(90, 180), next: ["Two new Marietta listings to send", day(-2)],
});
person("robert", {
  name: "Robert Chen", email: "robert.chen@example.com", side: "buy", created: ago(150), source: "import", basis: "Imported from the 2025 sphere list; opted in by email",
  stage: "Searching", stageSince: ago(40), rep: signed(175, 180),
});

/* -- Sellers ----------------------------------------------------------- */

person("ellis", {
  name: "Margaret Ellis", email: "margaret.ellis@example.com", phone: "(404) 555-0138", side: "sell", created: ago(16), replied: ago(16, -0.5),
  lead: { timing: "3 to 6 months", completion: 1, value: 610000, monthsToReady: 0, coBuyer: false, source: "google" },
  readout: { county: "DeKalb", side: "sell", figures: { verdict: "At $610,000 you would keep about $402,000." } },
  attr: ["google", "organic", null, "/sell/proceeds"],
  stage: "Preparing the property", stageSince: ago(9), rep: signed(9, 180), stopped: ["converted", 9], clientToken: true,
  payoff: 16400000, commission: 5.5,
});
person("owens", {
  name: "David Owens", email: "david.owens@example.com", phone: "(678) 555-0149", side: "sell", created: ago(50), source: "referral", basis: "Referred by Nia Johnson after her closing",
  stage: "Reviewing offers", stageSince: ago(22), rep: signed(40, 180), payoff: 21300000, commission: 5.5, clientToken: true,
});
person("patricia", {
  name: "Patricia Moore", email: "patricia.moore@example.com", phone: "(770) 555-0171", side: "sell", created: ago(70), replied: ago(70, -0.2),
  lead: { timing: "In the next 3 months", completion: 1, value: 475000, monthsToReady: 0, coBuyer: false, source: "facebook" },
  readout: { county: "Cobb", side: "sell", figures: { verdict: "At $475,000 you would keep about $281,000." } },
  attr: ["facebook", "paid-social", "cobb-sellers", "/sell/costs"],
  stage: "Reviewing offers", stageSince: ago(4), rep: signed(60, 180), stopped: ["converted", 60], clientToken: true,
  payoff: 16800000, commission: 5.0,
});
person("holloway", {
  name: "James Holloway", email: "james.holloway@example.com", phone: "(404) 555-0190", side: "sell", created: ago(85), source: "manual", basis: "Neighbour of the Ellis listing; asked for a pricing opinion",
  stage: "Under contract", stageSince: ago(15), rep: signed(80, 240), payoff: 9900000, commission: 5.0,
});
person("wright", {
  name: "Barbara Wright", email: "barbara.wright@example.com", side: "sell", created: ago(300), source: "manual", basis: "Long-time client; listed after retiring",
  stage: "Closed", stageSince: ago(212), rep: ["expired"], closedOn: day(-212), mood: "good", moodDays: 200,
});

/* -- The rest of the book --------------------------------------------- */

person("anthony", {
  name: "Anthony Russo", email: "anthony.russo@example.com", phone: "(404) 555-0107", side: "buy", created: ago(5), source: "referral", basis: "Nia Johnson sent him; he emailed first",
  stage: "Exploring", stageSince: ago(5), referredBy: "nia", attr: ["referral", "share", null, "/buy", "nia"],
  next: ["Book the first call", day(3)],
});
person("keisha", {
  name: "Keisha Williams", email: "keisha.williams@example.com", phone: "(678) 555-0126", side: "sell", created: ago(33), source: "manual", basis: "Met at the Decatur Book Festival booth; gave her card",
  stage: "Preparing the property", stageSince: ago(20), rep: ["prepared"], next: ["Painter walkthrough at 10am", day(-3)],
});
person("frank", {
  name: "Frank Dubois", email: "frank.dubois@example.com", side: "buy", created: ago(200), source: "import", basis: "Imported from the 2025 sphere list; opted in by email",
  stage: "Lost", stageSince: ago(60), archived: ago(58), archivedReason: "Bought with his cousin's agent in Athens",
});
person("carmen", {
  name: "Carmen Ortiz", email: "carmen.ortiz@example.com", side: "buy", created: ago(11), replied: ago(11, -3),
  lead: { timing: "9 to 12 months", completion: 1, value: 285000, monthsToReady: 7, coBuyer: false, source: "google" },
  readout: { county: "Henry", figures: { cashToClose: 14900, gap: 6800, monthly: 2020, assistance: 10000, verdict: "Seven months of saving, or Georgia Dream, gets you to Henry County." } },
  attr: ["google", "organic", null, "/buy/timeline"], stage: "Building readiness", stageSince: ago(10),
  rep: ["expired"], next: ["Credit check-in", day(21)],
});

/* People who sent an offer through /offer. Intake makes each of them a
   funnel lead (lib/db/offer-intake.ts); the fourth offer below has none, the
   "the lead write did not land" case. */
const offerLead = (key, name, email, price, representing, daysAgo, replied) => person(key, {
  name, email, side: "buy", created: ago(daysAgo), replied: replied ? ago(daysAgo - 0.3) : null,
  lead: { timing: "Submitted an offer", completion: 1, value: price, monthsToReady: 0, coBuyer: representing === "buyer", source: "offer" },
});
offerLead("hill", "Marcus Hill for the Delgado family", "marcus.hill@example.com", 735000, "buyer", 1.5, true);
offerLead("shah", "Priya Shah", "priya.shah@example.com", 715000, "self", 0.5, false);
offerLead("tony", "Tony Alvarez, Keller Williams", "tony.alvarez@example.com", 380000, "buyer", 3, true);

/* ------------------------------------------------------------------ */
/* Leads, their assessments, readouts, consents, attribution, events    */
/* ------------------------------------------------------------------ */

const ANSWER_KEYS = ["county", "price", "savings", "income", "credit", "household"];

for (const [key, p] of Object.entries(P)) {
  if (p.readout || p.partial) {
    const aId = id("assessment");
    p.assessmentId = aId;
    ins("rift_assessments", {
      id: aId, agent_id: AGENT, session_id: p.session, side: p.readout?.side ?? p.side, started_at: new Date(Date.parse(p.created) - 12 * MIN).toISOString(),
      completed_at: p.partial ? null : p.created, abandoned_at: p.partial ? p.created : null,
      county: p.readout?.county ?? null, created_at: p.created,
    });
    const keys = p.partial ? ANSWER_KEYS.slice(0, 3) : ANSWER_KEYS;
    for (const k of keys) {
      ins("rift_answers", {
        id: id("answer"), assessment_id: aId, question_key: k, answered_at: p.created,
        value: json(k === "county" ? p.readout?.county ?? "DeKalb" : k === "price" ? p.input?.value ?? 300000 : k === "credit" ? "700-739" : k === "household" ? 2 : 50000),
      });
    }
    if (p.readout) {
      const rId = id("readout");
      p.readoutId = rId;
      ins("rift_readouts", {
        id: rId, agent_id: AGENT, assessment_id: aId, side: p.readout.side ?? p.side, share_token: `demo-${key}-${sha(`r-${key}`).slice(0, 20)}`,
        inputs: json({ county: p.readout.county, price: p.input?.value ?? null, side: p.side }),
        figures: json(p.readout.figures), matched: json(p.side === "buy" && p.readout.figures.assistance ? ["ga-dream"] : []), created_at: p.created,
      });
    }
  }
}

for (const { row, referredBy } of leadRows) {
  const p = Object.values(P).find((x) => x.id === row.id);
  row.assessment_id = p.assessmentId ?? null;
  row.referred_by = referredBy ? P[referredBy].id : null;
  ins("rift_leads", row);
}

for (const [key, p] of Object.entries(P)) {
  if (p.email) {
    ins("rift_consents", {
      id: id("consent"), agent_id: AGENT, assessment_id: p.assessmentId ?? null, session_id: p.session, kind: "email",
      wording: "Email me my readout and follow-ups about it. I can stop them at any time.", version: "2026-09", granted: true,
      ip: "203.0.113.24", user_agent: "Mozilla/5.0 (demo)", at: p.created,
    });
  }
  if (p.phoneConsent !== undefined) {
    ins("rift_consents", {
      id: id("consent"), agent_id: AGENT, assessment_id: p.assessmentId ?? null, session_id: p.session, kind: "phone",
      wording: "Kaleb may call or text me about this readout. Consent is not a condition of anything.", version: "2026-09",
      granted: p.phoneConsent, ip: "203.0.113.24", user_agent: "Mozilla/5.0 (demo)", at: p.created,
    });
  }
  if (p.attr) {
    const [source, medium, campaign, landing, refBy] = p.attr;
    const visits = 1 + (key.length % 4);
    ins("rift_attributions", {
      session_id: p.session, agent_id: AGENT,
      first_source: source, first_medium: medium, first_campaign: campaign, first_referrer: source === "(direct)" ? null : `https://${source}.com/`,
      first_landing: landing, first_at: p.created, first_ref: refBy ? P[refBy].token : null,
      last_source: visits > 2 ? "(direct)" : source, last_medium: visits > 2 ? null : medium, last_campaign: visits > 2 ? null : campaign,
      last_referrer: null, last_landing: landing, last_at: p.created, last_ref: null, visits,
    });
  }
}

/* Telemetry: what each visitor opened and answered, never what they said. */
const TOOLS_BUY = ["cash", "monthly", "afford", "assistance", "timeline"];
const TOOLS_SELL = ["proceeds", "costs", "prepare"];
const TOOLS_ABROAD = ["eligibility", "abroad-cost", "abroad-return"];
function visit(session, side, when, { tools, questions = 0, finish = true, capture = false, book = false, page }) {
  const e = (name, extra = {}, offsetMin = 0) => ins("rift_events", {
    agent_id: AGENT, session_id: session, name, side: extra.side === undefined ? side : extra.side,
    question_key: extra.question_key ?? null, dwell_ms: extra.dwell_ms ?? null,
    payload: json(extra.payload ?? {}), at: new Date(Date.parse(when) + offsetMin * MIN).toISOString(),
  });
  e("landing_view", { payload: { page } });
  let m = 1;
  for (const [i, t] of tools.entries()) {
    e("value_view", { payload: { tool: t } }, m++);
    if (finish || i === 0) e("value_answer", { payload: { tool: t } }, m++);
  }
  if (questions) {
    e("assessment_start", {}, m++);
    for (let i = 0; i < questions; i++) {
      const k = ANSWER_KEYS[i];
      e("question_view", { question_key: k, payload: { step: i + 1, of: ANSWER_KEYS.length } }, m++);
      if (finish || i < questions - 1) e("question_answer", { question_key: k, dwell_ms: 4000 + ((i * 3517 + session.length * 911) % 21000), payload: { answered: true } }, m++);
    }
    if (!finish) e("assessment_abandon", { payload: { step: questions } }, m++);
    else e("readout_view", {}, m++);
  }
  if (capture) e("email_capture", { payload: { consent: true } }, m++);
  if (book) { e("booking_start", {}, m++); e("booking_complete", { payload: { slot: "call" } }, m++); }
}
for (const [key, p] of Object.entries(P)) {
  if (!p.attr) continue;
  const tools = p.abroad ? TOOLS_ABROAD.slice(0, 2) : p.side === "sell" ? TOOLS_SELL.slice(0, 1 + (key.length % 3)) : TOOLS_BUY.slice(0, 1 + (key.length % 4));
  visit(p.session, p.abroad ? null : p.side, ago(0, 0, 30) > p.created ? new Date(Date.parse(p.created) - 20 * MIN).toISOString() : p.created, {
    tools, questions: p.partial ? 3 : p.readout ? ANSWER_KEYS.length : 0, finish: !p.partial, capture: Boolean(p.email), book: ["marcus", "alvarez", "rachel"].includes(key), page: p.attr[3],
  });
}
/* Visitors who never left a name: the funnel is mostly these. */
for (let i = 1; i <= 36; i++) {
  const side = i % 5 === 0 ? "sell" : "buy";
  const tools = i % 7 === 0 ? TOOLS_ABROAD.slice(0, 1 + (i % 3)) : side === "sell" ? TOOLS_SELL.slice(0, 1 + (i % 3)) : TOOLS_BUY.slice(i % 3, 1 + (i % 3) + (i % 3));
  visit(`demo-visitor-${String(i).padStart(2, "0")}`, i % 7 === 0 ? null : side, ago(i * 2 % 60, i % 24), {
    tools, questions: i % 3 === 0 ? 1 + (i % ANSWER_KEYS.length) : 0, finish: i % 2 === 0, page: side === "sell" ? "/sell" : "/buy",
  });
}

/* ------------------------------------------------------------------ */
/* Follow-up sequences                                                  */
/* ------------------------------------------------------------------ */

for (const [key, p] of Object.entries(P)) {
  if ((p.source ?? "funnel") !== "funnel" || !p.score) continue;
  const eId = id("enrolment");
  const stopped = p.stopped ? ago(p.stopped[1]) : null;
  ins("rift_enrolments", {
    id: eId, agent_id: AGENT, lead_id: p.id, band: p.score.band, entered_at: p.created,
    stopped_at: stopped, stop_reason: p.stopped?.[0] ?? null, phone_consent: p.phoneConsent === true,
  });
  const daysIn = Math.floor((NOW - Date.parse(p.created)) / DAY);
  /* Sent what was due, except the last due step on a few leads, so Today
     has follow-ups that need Kaleb. */
  const steps = sequenceFor(p.score.band).steps.filter((s) => s.day <= daysIn);
  const hold = ["harold", "olivia", "lena", "carmen"].includes(key) ? 1 : 0;
  for (const s of steps.slice(0, steps.length - hold)) {
    const sentAt = new Date(Math.min(NOW, Date.parse(p.created) + s.day * DAY + 5 * MIN)).toISOString();
    if (stopped && sentAt > stopped) continue;
    const downgraded = s.channel === "text" && p.phoneConsent !== true;
    ins("rift_touches", {
      id: id("touch"), enrolment_id: eId, step_id: s.id, channel: downgraded ? "email" : s.channel,
      downgraded_reason: downgraded ? "No written consent to text; sent by email instead" : null,
      sent_at: sentAt, outcome: key === "jamal" && s.day > 0 ? "skipped" : "sent", detail: s.auto ? "Brevo accepted it" : "Done by Kaleb",
    });
  }
}

/* ------------------------------------------------------------------ */
/* Notes, plans, decisions                                             */
/* ------------------------------------------------------------------ */

const note = (key, kind, body, daysAgo, stages = []) => ins("rift_lead_notes", {
  id: id("note"), lead_id: P[key].id, agent_id: AGENT, kind, body, from_stage: stages[0] ?? null, to_stage: stages[1] ?? null, at: ago(daysAgo),
});
note("olivia", "call", "Twenty minutes. Wants DeKalb or south Decatur, nervous about the down payment.", 2);
note("olivia", "stage", "Unplaced → Exploring", 2, [null, "Exploring"]);
note("harold", "call", "Roof is 22 years old. Getting a quote before deciding to list.", 6);
note("lena", "email", "Sent the foreign national overview and asked about her timing on the Berlin sale.", 4);
note("alvarez", "meeting", "Met both at the office. Daniel cares about the commute to Emory; Sofia about a yard.", 14);
note("alvarez", "stage", "Financing → Searching", 10, ["Financing", "Searching"]);
note("alvarez", "text", "Sent three Decatur listings, they liked the Oakview Rd one.", 3);
note("chris", "call", "Toured four in Duluth. Wants a basement.", 8);
note("rachel", "call", "Talked through the counter. She will stretch to $424k, not further.", 1);
note("rachel", "stage", "Searching → Reviewing offers", 3, ["Searching", "Reviewing offers"]);
note("brooks", "email", "Inspection report shared with both. Repair request drafted.", 7);
note("brooks", "stage", "Reviewing offers → Under contract", 12, ["Reviewing offers", "Under contract"]);
note("ethan", "meeting", "Walked the house again; he is fine with the water heater as is.", 5);
note("nia", "stage", "Closing → Closed", 20, ["Closing", "Closed"]);
note("nia", "call", "Thirty-day check-in: settled, loves the porch, asked about a referral for her brother.", 1);
note("samuel", "email", "Sent the ITIN lender list and the proof-of-funds checklist.", 8);
note("linda", "call", "Terminated on the inspection: foundation. Back to searching, a bit deflated.", 6);
note("robert", "note", "Paused the search while his mother moves in. Check again in October.", 30);
note("ellis", "meeting", "Walked the house with the stager. Kitchen and front beds first.", 9);
note("owens", "call", "Weekly review: 11 showings, two second visits, no offers yet.", 8);
note("patricia", "call", "She chose the Harper offer on her plan page; wants to talk about the closing date.", 1);
note("holloway", "stage", "Reviewing offers → Under contract", 15, ["Reviewing offers", "Under contract"]);
note("wright", "stage", "Closing → Closed", 212, ["Closing", "Closed"]);
note("anthony", "email", "Intro from Nia. Wants something near her in East Atlanta.", 5);
note("keisha", "meeting", "Walked the house. Paint, carpet in two bedrooms, a pre-listing inspection.", 20);
note("keisha", "stage", "Added at Preparing the property.", 33, [null, "Preparing the property"]);
note("frank", "note", "Archived: Bought with his cousin's agent in Athens", 58);
note("carmen", "call", "Credit is 640 today; wants to be at 680 before applying.", 10);

const planItem = (key, title, owner, dueOffset, done = false, ownerName = null) => ins("rift_plan_items", {
  id: id("plan"), agent_id: AGENT, lead_id: P[key].id, title, owner, owner_name: ownerName,
  due_on: dueOffset === null ? null : day(dueOffset), done_at: done ? ago(Math.max(0, -dueOffset + 1)) : null,
  sort: (counts.rift_plan_items ?? 0) % 10, created_at: ago(15),
});
planItem("alvarez", "Get the pre-approval letter from Peach State Mortgage", "client", -6, true);
planItem("alvarez", "Send the DeKalb HomeStart application", "client", -1);
planItem("alvarez", "Book the Oakview Rd showing", "agent", 1);
planItem("alvarez", "Ask the lender about PMI at 10% down", "other", 4, false, "Dana at Peach State Mortgage");
planItem("brooks", "Wire the earnest money", "client", -9, true);
planItem("brooks", "Choose the homeowner's insurance quote", "client", 0);
planItem("brooks", "Send the repair amendment to the listing agent", "agent", -1);
planItem("brooks", "Order the survey", "other", 6, false, "Smith Law");
planItem("olivia", "Take the Georgia Dream homebuyer class", "client", 12);
planItem("olivia", "Pull the credit report", "client", 2);
planItem("keisha", "Painter walkthrough", "agent", -3);
planItem("keisha", "Order the pre-listing inspection", "agent", 5);
planItem("ellis", "Stage the living room and kitchen", "other", 3, false, "Maple & Co. Staging");
planItem("ellis", "Photographer booked", "agent", 7);
planItem("rachel", "Send the signed counter back", "agent", 0);
planItem("samuel", "Collect 2 months of bank statements, translated", "client", 9);
planItem("carmen", "Pay down the Capital One card below 30%", "client", 25);

function decision(key, d) {
  const dId = id("decision");
  const options = d.options.map((o, i) => ({ id: id("option"), ...o, sort: i }));
  const chosen = d.chosen === undefined ? null : options[d.chosen].id;
  ins("rift_decisions", {
    id: dId, agent_id: AGENT, lead_id: P[key].id, kind: d.kind, question: d.question, context: d.context ?? null,
    decide_by: d.decideBy ?? null, released_at: d.released ?? null, decided_at: chosen ? d.decidedAt : null,
    chosen_option_id: chosen, outcome_note: d.outcome ?? null, created_at: d.created,
  });
  for (const o of options) {
    ins("rift_decision_options", {
      id: o.id, agent_id: AGENT, decision_id: dId, label: o.label, detail: o.detail ?? null,
      amount_cents: o.amount ?? null, amount_label: o.amount ? o.amountLabel : null, upside: o.upside ?? null, downside: o.downside ?? null, sort: o.sort, created_at: d.created,
    });
  }
}
decision("rachel", {
  kind: "offers", question: "How should we answer the seller's counter on Pebblebrook Dr?", context: "They countered at $428,000 with a 7 day due diligence period.",
  decideBy: day(0), released: ago(1), created: ago(1, 2),
  options: [
    { label: "Accept $428,000", amount: 42800000, amountLabel: "Price", upside: "The house is yours today", downside: "$4,000 above what you said was your ceiling" },
    { label: "Counter at $423,500, 10 days", amount: 42350000, amountLabel: "Price", upside: "Inside your number, keeps the inspection time", downside: "They may take the backup offer" },
    { label: "Walk away", upside: "Nothing spent", downside: "Back to touring in a thin month" },
  ],
});
decision("alvarez", {
  kind: "affordability", question: "Which price should the search stop at?", created: ago(12), released: ago(12), decidedAt: ago(11),
  chosen: 1, outcome: "They chose $360,000 so the monthly stays under $2,600.",
  options: [
    { label: "Up to $340,000", amount: 34000000, amountLabel: "Top of search", upside: "Monthly about $2,380" },
    { label: "Up to $360,000", amount: 36000000, amountLabel: "Top of search", upside: "Monthly about $2,520", downside: "Uses most of the cushion" },
    { label: "Up to $385,000", amount: 38500000, amountLabel: "Top of search", downside: "Monthly about $2,700, over their comfort line" },
  ],
});
decision("olivia", {
  kind: "timing", question: "Buy this spring, or wait for the second assistance round?", created: ago(1),
  options: [{ label: "Spring, with Georgia Dream" }, { label: "Wait for the January round" }],
});

/* ------------------------------------------------------------------ */
/* Journeys                                                             */
/* ------------------------------------------------------------------ */

const J = {};
function journey(key, jkey, side, label, createdDays) {
  const jId = id("journey");
  ins("rift_journeys", { id: jId, agent_id: AGENT, origin_lead_id: P[key].id, side, label, created_at: ago(createdDays) });
  J[jkey] = { id: jId, side, lead: key, seq: 0, members: {}, homes: {}, label };
  return J[jkey];
}
function member(j, mkey, email, name, role, state, daysAgo, scopes) {
  const mId = id("member");
  const accepted = state === "accepted" ? ago(daysAgo - 0.5) : null;
  const pending = state === "pending" || state === "expired";
  ins("rift_journey_members", {
    id: mId, agent_id: AGENT, journey_id: j.id, email, display_name: name, role,
    scopes: arr(scopes ?? (role === "viewer" ? ["search", "homes"] : ["search", "homes", "money"]), "text"),
    invite_token_hash: pending ? sha(`invite-${mId}`) : null,
    invite_expires_at: pending ? (state === "expired" ? ago(1) : ahead(10)) : null,
    invited_at: ago(daysAgo), accepted_at: accepted, revoked_at: state === "revoked" ? ago(daysAgo - 2) : null,
  });
  j.members[mkey] = { id: mId, name };
  return mId;
}
function jevent(j, kind, from, to, reason, daysAgo, extra = {}) {
  j.seq += 1;
  ins("rift_journey_events", {
    id: id("jevent"), agent_id: AGENT, journey_id: j.id, seq: j.seq, kind, from_value: from, to_value: to, reason,
    evidence: extra.evidence ?? null, transaction_id: extra.tx ?? null, actor_label: KALEB, request_id: rid(), created_at: ago(daysAgo),
  });
}
/** Walk a journey through its stages, one event per move. */
function stages(j, moves) {
  let from = "prepare";
  for (const [to, daysAgo, reason, extra] of moves) {
    jevent(j, "stage", from, to, reason, daysAgo, extra);
    from = to;
  }
}
function home(j, hkey, address, facts, daysAgo, by = null, extra = {}) {
  const hId = id("home");
  ins("rift_shortlist_homes", {
    id: hId, agent_id: AGENT, journey_id: j.id, address, url: extra.url ?? `https://www.fmls.com/listing/demo-${hkey}`,
    facts: json(facts), facts_source: extra.source ?? "FMLS listing sheet", facts_as_of: day(-daysAgo),
    added_by_kind: by ? "client" : "agent", added_by_member: by ? j.members[by].id : null, added_by_label: by ? j.members[by].name : KALEB,
    created_at: ago(daysAgo), withdrawn_at: extra.withdrawn ? ago(extra.withdrawn[0]) : null, withdrawn_reason: extra.withdrawn?.[1] ?? null,
  });
  j.homes[hkey] = hId;
  return hId;
}
const F = (price, bedrooms, bathrooms, city, extra = {}) => ({
  price, bedrooms, bathrooms, propertyType: "detached", city, lotAcres: 0.25, hoaMonthly: 0, basement: "no", garageSpaces: 2, ...extra,
});
function reaction(j, hkey, mkey, reaction, reason, daysAgo) {
  ins("rift_home_reactions", {
    id: id("reaction"), agent_id: AGENT, journey_id: j.id, home_id: j.homes[hkey], member_id: mkey ? j.members[mkey].id : null,
    actor_label: mkey ? j.members[mkey].name : KALEB, reaction, reason, created_at: ago(daysAgo),
  });
}

/* Search briefs */
const crit = (field, operator, value, unit, strength, by, daysAgo, n) => ({
  id: `c${n}`, field, operator, value, unit, strength, statedBy: by, statedAt: ago(daysAgo), sourceRef: "First call notes",
});
function revision(j, n, criteria, questions, daysAgo, by = null, note = null) {
  const rId = id("revision");
  ins("rift_search_revisions", {
    id: rId, agent_id: AGENT, journey_id: j.id, revision: n, schema_version: 1, criteria: json(criteria), questions: json(questions),
    note, author_kind: by ? "client" : "agent", author_member_id: by ? j.members[by].id : null, author_label: by ? j.members[by].name : KALEB, created_at: ago(daysAgo),
  });
  j.revisions = { ...(j.revisions ?? {}), [n]: { id: rId, criteria, questions } };
  return rId;
}
function searchPackage(j, n, cadence, status, daysAgo, extra = {}) {
  const r = j.revisions[n];
  const built = buildPackage({ criteria: r.criteria, questions: r.questions }, n, cadence, []);
  if (!built.ok) throw new Error(`package for ${j.label} r${n}: ${built.blockers.join("; ")}`);
  const live = status === "active-confirmed" || status === "paused";
  const ended = status === "superseded" || status === "cancelled";
  ins("rift_search_packages", {
    id: id("package"), agent_id: AGENT, journey_id: j.id, revision_id: r.id, destination: "matrix", cadence,
    package: json(built.pkg), package_hash: sha(canonicalPackage(built.pkg)), approved_at: ago(daysAgo), approved_by: KALEB, request_id: rid(),
    status, external_ref: live || ended ? `Matrix: ${P[j.lead].name.split(" ")[1]} ${n}` : null,
    external_url: live ? `https://matrix.fmlsd.mlsmatrix.com/Matrix/SavedSearches/demo-${j.id.slice(-4)}` : null,
    confirmed_at: live || ended ? ago(daysAgo - 0.2) : null, confirm_note: live ? "Set up and sent the first batch" : null,
    confirm_request_id: live || ended ? rid() : null, ended_at: ended ? ago(extra.endedDays ?? daysAgo - 1) : null,
    ended_reason: ended ? (extra.endedReason ?? "Replaced by a newer revision") : null,
  });
}
const priceCrit = (v, by, d, n = 1) => crit("price", "atMost", v, "USD", "hard", by, d, n);
const geoCrit = (places, by, d, n = 2) => crit("geography", "oneOf", places, null, "hard", by, d, n);
const bedCrit = (v, by, d, n = 3) => crit("bedrooms", "atLeast", v, "count", "hard", by, d, n);
const typeCrit = (types, by, d, n = 4) => crit("propertyType", "oneOf", types, "code", "preference", by, d, n);

/* Tours */
function tour(j, hkey, by, availability, daysAgo, steps, feedback = []) {
  const sId = id("stop");
  ins("rift_tour_stops", {
    id: sId, agent_id: AGENT, journey_id: j.id, home_id: j.homes[hkey], requested_by_kind: by ? "client" : "agent",
    requested_by_member: by ? j.members[by].id : null, requested_by_label: by ? j.members[by].name : KALEB, availability, created_at: ago(daysAgo),
  });
  let seq = 0;
  for (const [status, whenDays, slot, noteText] of [["requested", daysAgo, null, null], ...steps]) {
    seq += 1;
    ins("rift_tour_steps", {
      id: id("step"), agent_id: AGENT, journey_id: j.id, stop_id: sId, seq, status,
      starts_at: slot ? slot : null, ends_at: slot ? new Date(Date.parse(slot) + 30 * MIN).toISOString() : null,
      ref: status === "confirmed" ? "ShowingTime confirmation" : null, note: noteText ?? null,
      actor_label: seq === 1 && by ? j.members[by].name : KALEB, request_id: rid(), created_at: ago(whenDays),
    });
  }
  for (const [mkey, offer, reason, change, whenDays] of feedback) {
    ins("rift_tour_feedback", {
      id: id("feedback"), agent_id: AGENT, journey_id: j.id, stop_id: sId, member_id: mkey ? j.members[mkey].id : null,
      actor_label: mkey ? j.members[mkey].name : KALEB, offer, reason, search_change: change, created_at: ago(whenDays),
    });
  }
}

/* Offers the household makes (bids) */
const terms = (price, extra = {}) => ({
  price, earnestMoney: 5000, financing: "conventional", downPct: 10, concessions: 0, dueDiligenceDays: 10,
  financingContingency: true, appraisalContingency: true, closingDate: day(35), respondBy: ahead(1), respondBySource: "Offer paragraph 14", other: null, ...extra,
});
function bid(j, hkey, steps, responses) {
  const bId = id("bid");
  ins("rift_bids", { id: bId, agent_id: AGENT, journey_id: j.id, home_id: j.homes[hkey], actor_label: KALEB, created_at: ago(steps[0][1]) });
  let seq = 0;
  for (const [kind, daysAgo, extra = {}] of steps) {
    seq += 1;
    ins("rift_bid_steps", {
      id: id("bidstep"), agent_id: AGENT, journey_id: j.id, bid_id: bId, seq, kind, version: extra.version ?? 1,
      terms: extra.terms ? json(extra.terms) : null, origin: kind === "terms" ? (extra.origin ?? "ours") : null,
      required: json(kind === "ask" ? Object.values(j.members).filter((m) => m.decider).map((m) => ({ memberId: m.id, name: m.name })) : []),
      document_ids: arr(extra.docs ?? [], "uuid"), note: extra.note ?? null, actor_label: KALEB, request_id: rid(), created_at: ago(daysAgo),
    });
  }
  for (const [mkey, version, instruction, noteText, daysAgo, told] of responses) {
    ins("rift_bid_responses", {
      id: id("bidresp"), agent_id: AGENT, journey_id: j.id, bid_id: bId, version, member_id: j.members[mkey].id, instruction,
      note: noteText, told_agent: told ?? null, actor_label: told ? KALEB : j.members[mkey].name, request_id: rid(), created_at: ago(daysAgo),
    });
  }
}

/* Contracts */
function contract(j, hkey, financing, evidence, daysAgo) {
  const tId = id("tx");
  ins("rift_transactions", {
    id: tId, agent_id: AGENT, journey_id: j.id, home_id: j.homes[hkey], financing, evidence, actor_label: KALEB, request_id: rid(), created_at: ago(daysAgo),
  });
  j.tx = tId;
  j.work = {};
  for (const { workstream, input } of initialWork(financing, j.side)) {
    j.work[workstream] = { seq: 1, owner: input.owner, ownerName: input.ownerName ?? null };
    ins("rift_workstream_updates", {
      id: id("work"), agent_id: AGENT, journey_id: j.id, transaction_id: tId, workstream, seq: 1, state: input.state,
      owner: input.owner, owner_name: input.ownerName ?? null, source: null, confirmed_on: null, note: input.note ?? null,
      actor_kind: "agent", member_id: null, actor_label: KALEB, request_id: rid(), created_at: ago(daysAgo),
    });
  }
  return tId;
}
function work(j, workstream, state, daysAgo, extra = {}) {
  const w = j.work[workstream];
  w.seq += 1;
  const owner = extra.owner ?? w.owner;
  const ownerName = owner === "other" ? (extra.ownerName ?? w.ownerName) : null;
  ins("rift_workstream_updates", {
    id: id("work"), agent_id: AGENT, journey_id: j.id, transaction_id: j.tx, workstream, seq: w.seq, state, owner, owner_name: ownerName,
    source: extra.source ?? null, confirmed_on: state === "confirmed" ? day(-Math.ceil(daysAgo)) : null, note: extra.note ?? null,
    actor_kind: extra.member ? "client" : "agent", member_id: extra.member ? j.members[extra.member].id : null,
    actor_label: extra.member ? j.members[extra.member].name : KALEB, request_id: rid(), created_at: ago(daysAgo),
  });
  w.owner = owner; w.ownerName = ownerName;
}
function ended(j, outcome, reason, daysAgo) {
  ins("rift_transaction_outcomes", { id: id("outcome"), agent_id: AGENT, journey_id: j.id, transaction_id: j.tx, outcome, reason, actor_label: KALEB, created_at: ago(daysAgo) });
}
function deadline(j, label, kind, workstream, revisions) {
  const dId = id("deadline");
  ins("rift_deadlines", { id: dId, agent_id: AGENT, journey_id: j.id, transaction_id: j.tx, label, kind, workstream, actor_label: KALEB, request_id: rid(), created_at: ago(revisions[0].daysAgo) });
  let seq = 0;
  for (const r of revisions) {
    seq += 1;
    const input = {
      rule: r.rule ?? "as-written", date: r.date ?? null, time: r.time ?? null, timezone: "America/New_York",
      triggerLabel: r.triggerLabel ?? null, triggerDate: r.triggerDate ?? null, days: r.days ?? null,
      sourceTerm: r.term, sourcePage: r.page ?? null, verified: r.verified ?? false,
    };
    const res = resolveDeadline(input);
    if (!res) throw new Error(`deadline ${label} revision ${seq} does not resolve`);
    ins("rift_deadline_revisions", {
      id: id("drev"), agent_id: AGENT, journey_id: j.id, deadline_id: dId, seq, state: r.state ?? "active",
      due_date: res.dueDate, due_time: res.dueTime, timezone: res.timezone, due_at: res.dueAt, rule: input.rule,
      trigger_label: input.rule === "as-written" ? null : input.triggerLabel, trigger_date: input.rule === "as-written" ? null : input.triggerDate,
      days: input.rule === "as-written" ? null : input.days, source_term: input.sourceTerm, source_page: input.sourcePage,
      source_document_id: r.doc ?? null, amendment: r.amendment ?? null, verified: input.verified, note: r.note ?? null,
      actor_label: KALEB, request_id: rid(), created_at: ago(r.daysAgo),
    });
  }
}
function doc(j, family, label, filename, daysAgo) {
  const dId = id("doc");
  ins("rift_documents", {
    id: dId, agent_id: AGENT, journey_id: j.id, family, label, filename, kind: "pdf", bytes: 180000 + (counts.rift_documents ?? 0) * 7919,
    sha256: sha(`doc-${dId}`), storage_path: `clean/demo/${j.id}/${dId}.pdf`, actor_label: KALEB, created_at: ago(daysAgo),
  });
  return dId;
}
function moneyFact(j, kind, dollars, source, asOfDays, createdDays = asOfDays) {
  ins("rift_money_facts", {
    id: id("money"), agent_id: AGENT, journey_id: j.id, kind, amount_cents: Math.round(dollars * 100), source, as_of: day(-asOfDays),
    actor_label: KALEB, request_id: rid(), created_at: ago(createdDays),
  });
}

/* -- Sofia & Daniel Alvarez: buying, early (search) ------------------- */
const alv = journey("alvarez", "alvarez", "buy", "First home in Decatur", 14);
member(alv, "sofia", "sofia.alvarez@example.com", "Sofia Alvarez", "buyer", "accepted", 14);
member(alv, "daniel", "daniel.alvarez@example.com", "Daniel Alvarez", "co-buyer", "accepted", 13);
member(alv, "rosa", "rosa.mendez@example.com", "Rosa Mendez", "viewer", "pending", 2, ["homes"]);
alv.members.sofia.decider = alv.members.daniel.decider = true;
stages(alv, [["search", 10, "Pre-approval letter in hand, agreement signed", { evidence: "Peach State Mortgage pre-approval, $372,000" }]]);
revision(alv, 1, [priceCrit(360000, "Sofia Alvarez", 11), geoCrit(["Decatur", "Avondale Estates", "East Lake"], "Sofia Alvarez", 11), bedCrit(3, "Daniel Alvarez", 11)], ["Is a carport acceptable?"], 11);
revision(alv, 2, [priceCrit(360000, "Sofia Alvarez", 11), geoCrit(["Decatur", "Avondale Estates", "East Lake", "Kirkwood"], "Daniel Alvarez", 3), bedCrit(3, "Daniel Alvarez", 11), crit("basement", "equals", "yes", null, "preference", "Daniel Alvarez", 3, 5)], [], 3, "daniel", "Added Kirkwood; a basement would be nice");
ins("rift_search_responses", { id: id("response"), agent_id: AGENT, journey_id: alv.id, revision_id: alv.revisions[2].id, member_id: alv.members.daniel.id, response: "confirmed", note: null, created_at: ago(2, 20) });
ins("rift_search_responses", { id: id("response"), agent_id: AGENT, journey_id: alv.id, revision_id: alv.revisions[2].id, member_id: alv.members.sofia.id, response: "changes-requested", note: "Kirkwood is over our budget for anything with a yard. Leave it out?", created_at: ago(1, 6) });
home(alv, "oakview", "1418 Oakview Rd, Decatur, GA 30030", F(355000, 3, 2, "Decatur", { basement: "yes" }), 6);
home(alv, "hillyer", "212 Hillyer Pl, Decatur, GA 30030", F(349000, 3, 1.5, "Decatur", { lotAcres: 0.18 }), 5, "daniel");
home(alv, "ashford", "3 Ashford Ct, Avondale Estates, GA 30002", F(372000, 4, 2.5, "Avondale Estates", { hoaMonthly: 45 }), 4);
home(alv, "maple", "90 Maple St, East Lake, GA 30317", F(339000, 3, 2, "Atlanta"), 8, null, { withdrawn: [3, "Went under contract with another buyer"] });
reaction(alv, "oakview", "sofia", "interested", "The yard is exactly it", 5);
reaction(alv, "oakview", "daniel", "tour-requested", "Can we see it Saturday?", 4);
reaction(alv, "hillyer", "sofia", "maybe", "Only one full bath", 4);
reaction(alv, "ashford", "daniel", "pass", "Over the top of our range", 3);
tour(alv, "oakview", "daniel", "Saturday morning, or weekday after 5", 4, [["awaiting-confirmation", 3.9], ["confirmed", 3, local(2, "10:30")]]);
tour(alv, "hillyer", null, null, 3, [["awaiting-confirmation", 2.8]]);

/* -- Chris Nguyen: buying, touring with a live Matrix search --------- */
const chr = journey("chris", "chris", "buy", "Gwinnett with a basement", 38);
member(chr, "chris", "chris.nguyen@example.com", "Chris Nguyen", "buyer", "accepted", 38);
chr.members.chris.decider = true;
stages(chr, [["search", 30, "Agreement signed, pre-approved", { evidence: "Buyer brokerage agreement, 19 Aug" }], ["tour", 12, "First tour booked"]]);
revision(chr, 1, [priceCrit(425000, "Chris Nguyen", 33), geoCrit(["Duluth", "Suwanee", "Lawrenceville"], "Chris Nguyen", 33), bedCrit(4, "Chris Nguyen", 33)], [], 33);
revision(chr, 2, [priceCrit(425000, "Chris Nguyen", 33), geoCrit(["Duluth", "Suwanee", "Lawrenceville"], "Chris Nguyen", 33), bedCrit(4, "Chris Nguyen", 33), crit("basement", "equals", "yes", null, "hard", "Chris Nguyen", 9, 5)], [], 9, null, "Basement became a requirement after the Duluth tours");
searchPackage(chr, 1, "daily", "superseded", 32, { endedDays: 8 });
searchPackage(chr, 2, "instant", "active-confirmed", 8.5);
ins("rift_search_responses", { id: id("response"), agent_id: AGENT, journey_id: chr.id, revision_id: chr.revisions[2].id, member_id: chr.members.chris.id, response: "confirmed", note: null, created_at: ago(8.8) });
home(chr, "peachtree", "4120 Peachtree Industrial Blvd, Duluth, GA 30097", F(419000, 4, 3, "Duluth", { basement: "yes" }), 14);
home(chr, "sugarloaf", "77 Sugarloaf Way, Suwanee, GA 30024", F(424900, 4, 2.5, "Suwanee", { basement: "yes", hoaMonthly: 60 }), 12);
home(chr, "pike", "15 Pike St, Lawrenceville, GA 30046", F(389000, 4, 2, "Lawrenceville"), 13);
home(chr, "mill", "902 Old Mill Rd, Duluth, GA 30096", F(410000, 5, 3, "Duluth", { basement: "yes" }), 3, "chris");
reaction(chr, "peachtree", "chris", "interested", null, 12);
reaction(chr, "sugarloaf", "chris", "tour-requested", "Want to see the basement", 11);
reaction(chr, "pike", "chris", "pass", "No basement", 10);
reaction(chr, "mill", "chris", "interested", "Five bedrooms, room for my parents", 2);
tour(chr, "peachtree", "chris", "Weekends", 12, [["confirmed", 11, local(-9, "10:00")], ["completed", 9]], [["chris", "maybe", "Loved the basement, the road noise is loud", "Nothing on Peachtree Industrial", 8.8]]);
tour(chr, "sugarloaf", "chris", "Weekends", 11, [["confirmed", 10, local(-8, "11:30")], ["completed", 8]], [["chris", "yes", "This is the one if the inspection is clean", null, 7.8]]);
tour(chr, "pike", null, null, 13, [["cancelled", 10, null, "Chris passed after the listing photos"]]);
tour(chr, "mill", "chris", "Thursday after 6", 2, [["awaiting-confirmation", 1.8], ["changed", 1, local(1, "18:30"), "Listing agent moved it to Friday"]]);

/* -- Rachel Kim: buying, offer in play (counter to answer) ----------- */
const rac = journey("rachel", "rachel", "buy", "Smyrna townhome or small house", 55);
member(rac, "rachel", "rachel.kim@example.com", "Rachel Kim", "buyer", "accepted", 55);
member(rac, "jae", "jae.kim@example.com", "Jae Kim", "viewer", "revoked", 50, ["homes"]);
rac.members.rachel.decider = true;
stages(rac, [["search", 48, "Agreement signed"], ["tour", 20, "Touring Smyrna and Vinings"], ["offer", 3, "Writing on Pebblebrook Dr"]]);
revision(rac, 1, [priceCrit(430000, "Rachel Kim", 50), geoCrit(["Smyrna", "Vinings"], "Rachel Kim", 50), bedCrit(2, "Rachel Kim", 50), typeCrit(["townhouse", "detached"], "Rachel Kim", 50)], [], 50);
searchPackage(rac, 1, "daily", "active-confirmed", 47);
home(rac, "pebble", "2240 Pebblebrook Dr SE, Smyrna, GA 30080", F(429000, 3, 2.5, "Smyrna", { propertyType: "townhouse", hoaMonthly: 210, lotAcres: 0.05 }), 18);
home(rac, "vinings", "18 Vinings Pkwy, Atlanta, GA 30339", F(415000, 2, 2.5, "Atlanta", { propertyType: "townhouse", hoaMonthly: 290 }), 25);
home(rac, "concord", "1190 Concord Rd, Smyrna, GA 30080", F(399000, 3, 2, "Smyrna"), 22);
reaction(rac, "pebble", "rachel", "interested", "Walk to the Market Village", 17);
reaction(rac, "vinings", "rachel", "maybe", "HOA is steep", 21);
tour(rac, "pebble", "rachel", null, 17, [["confirmed", 16, local(-15, "17:30")], ["completed", 15]], [["rachel", "yes", null, null, 14.8]]);
tour(rac, "vinings", "rachel", null, 21, [["confirmed", 20, local(-19, "12:00")], ["completed", 19]], [["rachel", "no", "Too dark, and the HOA", null, 18.8]]);
const racOfferDoc = doc(rac, "offer", "Purchase and Sale Agreement, as sent", "pebblebrook-offer-v1.pdf", 2.5);
doc(rac, "counter", "Seller's counter-offer 1", "pebblebrook-counter-1.pdf", 1.2);
bid(rac, "pebble", [
  ["terms", 3, { terms: terms(419000, { dueDiligenceDays: 10, closingDate: day(33) }) }],
  ["ask", 2.9], ["prepared", 2.6], ["signed", 2.55, { note: "Signed in Remine at 4:12pm" }],
  ["submitted", 2.5, { note: "Emailed to the listing agent, read receipt", docs: [racOfferDoc] }],
  ["terms", 1.2, { version: 2, origin: "theirs", terms: terms(428000, { dueDiligenceDays: 7, closingDate: day(30) }) }],
  ["ask", 1.1, { version: 2 }],
], [["rachel", 1, "proceed", null, 2.8]]);
bid(rac, "vinings", [
  ["terms", 14, { terms: terms(405000) }], ["ask", 13.9], ["prepared", 13.5], ["signed", 13.4, { note: "Signed at the office" }],
  ["submitted", 13.3, { note: "Delivered by email" }], ["rejected", 12, { note: "Seller took a cash offer" }],
], [["rachel", 1, "proceed", null, 13.8]]);

/* -- Michael & Tanya Brooks: buying under contract, and selling ------- */
const brb = journey("brooks", "brooks-buy", "buy", "Move-up in Oakhurst", 60);
member(brb, "michael", "michael.brooks@example.com", "Michael Brooks", "buyer", "accepted", 60);
member(brb, "tanya", "tanya.brooks@example.com", "Tanya Brooks", "co-buyer", "accepted", 59);
brb.members.michael.decider = brb.members.tanya.decider = true;
revision(brb, 1, [priceCrit(475000, "Michael Brooks", 55), geoCrit(["Oakhurst", "Decatur"], "Tanya Brooks", 55), bedCrit(4, "Tanya Brooks", 55)], [], 55);
searchPackage(brb, 1, "instant", "active-confirmed", 54);
home(brb, "oakhurst", "318 Oakhurst Ave, Decatur, GA 30030", F(465000, 4, 3, "Decatur", { lotAcres: 0.3 }), 25);
home(brb, "winnona", "44 Winnona Dr, Decatur, GA 30030", F(472000, 4, 2.5, "Decatur"), 27);
reaction(brb, "oakhurst", "tanya", "interested", "The kitchen!", 24);
reaction(brb, "oakhurst", "michael", "interested", null, 24);
tour(brb, "oakhurst", "tanya", null, 24, [["confirmed", 23, local(-22, "16:00")], ["completed", 22]], [["tanya", "yes", null, null, 21.8], ["michael", "yes", null, null, 21.7]]);
const brContract = doc(brb, "contract", "Executed Purchase and Sale Agreement", "oakhurst-psa-executed.pdf", 12);
doc(brb, "disclosure", "Seller's Property Disclosure Statement", "oakhurst-spds.pdf", 12);
const brInspect = doc(brb, "inspection", "Home inspection report", "oakhurst-inspection.pdf", 7);
doc(brb, "lender", "Loan estimate", "oakhurst-loan-estimate.pdf", 10);
bid(brb, "oakhurst", [
  ["terms", 16, { terms: terms(460000, { closingDate: day(23) }) }], ["ask", 15.9], ["prepared", 15.5], ["signed", 15.4, { note: "Both signed in Remine" }],
  ["submitted", 15.3, { note: "Emailed to Keller Williams, confirmed received" }],
  ["terms", 14, { version: 2, origin: "theirs", terms: terms(465000, { closingDate: day(23) }) }], ["ask", 13.9, { version: 2 }],
  ["accepted", 12.5, { version: 2, note: "Seller signed the counter at 9:40pm", docs: [brContract] }],
], [["michael", 1, "proceed", null, 15.8], ["tanya", 1, "proceed", null, 15.7], ["michael", 2, "proceed", null, 13.5], ["tanya", 2, "proceed", "Fine, it is worth it", 13.4]]);
stages(brb, [["search", 55, "Agreement signed"], ["tour", 26, "Touring Oakhurst"], ["offer", 16, "Offer on Oakhurst Ave"]]);
contract(brb, "oakhurst", "financed", "Executed purchase agreement, binding " + day(-12), 12);
jevent(brb, "stage", "offer", "under-contract", "Contract recorded", 12, { tx: brb.tx, evidence: "Executed purchase agreement" });
work(brb, "earnest-money", "confirmed", 9, { source: "Smith Law, the escrow holder", note: "$5,000 received" });
work(brb, "inspection", "in-progress", 8);
work(brb, "inspection", "reported", 6, { member: "tanya", note: "Inspector sent the report to us too" });
work(brb, "repairs", "blocked", 4, { note: "The seller has not answered the repair amendment" });
work(brb, "financing", "waiting", 9, { owner: "other", ownerName: "Dana at Peach State Mortgage", note: "Waiting on the appraisal before clear to close" });
work(brb, "appraisal", "in-progress", 5);
work(brb, "title", "in-progress", 10, { owner: "other", ownerName: "Smith Law" });
work(brb, "insurance", "waiting", 3, { note: "Two quotes in, choosing" });
deadline(brb, "Earnest money due", "contractual", "earnest-money", [
  { date: day(-9), term: "Paragraph 2(c), earnest money", page: "2", verified: true, daysAgo: 12 },
  { date: day(-9), term: "Paragraph 2(c), earnest money", page: "2", verified: true, state: "met", note: "Receipt from Smith Law", daysAgo: 9 },
]);
deadline(brb, "Due diligence period ends", "contractual", "inspection", [
  { rule: "calendar-days-v1", triggerLabel: "Binding agreement date", triggerDate: day(-12), days: 10, term: "Special stipulation 1, due diligence", page: "7", verified: true, daysAgo: 12 },
  { date: day(2), time: "17:00", term: "Amendment 1, due diligence extended", amendment: "Amendment 1 to extend due diligence", verified: true, daysAgo: 3, doc: brInspect },
]);
deadline(brb, "Appraisal contingency ends", "contractual", "appraisal", [{ date: day(5), term: "Exhibit C, appraisal contingency", verified: false, daysAgo: 12 }]);
deadline(brb, "Financing contingency ends", "contractual", "financing", [{ date: day(9), time: "17:00", term: "Exhibit B, financing contingency", page: "11", verified: true, daysAgo: 12 }]);
deadline(brb, "Closing", "contractual", "closing", [{ date: day(23), term: "Paragraph 3, closing date", page: "3", verified: true, daysAgo: 12, doc: brContract }]);
deadline(brb, "Insurance bound", "target", "insurance", [{ date: day(0), term: "Our own target: lender wants the binder a week before closing", verified: false, daysAgo: 6 }]);
deadline(brb, "Seller disclosure questions answered", "target", null, [{ date: day(-1), term: "Our own target, asked on the 20th", verified: false, daysAgo: 8 }]);
deadline(brb, "HOA documents reviewed", "contractual", null, [
  { date: day(4), term: "Special stipulation 4, HOA review", verified: true, daysAgo: 12 },
  { date: day(4), term: "Special stipulation 4, HOA review", verified: true, state: "removed", note: "Confirmed there is no HOA; the stipulation does not apply", daysAgo: 10 },
]);
moneyFact(brb, "price", 465000, "Executed purchase agreement", 12);
moneyFact(brb, "earnest", 5000, "Smith Law receipt", 9);
moneyFact(brb, "inspection", 575, "Inspector's invoice", 7);
moneyFact(brb, "appraisal", 650, "Peach State Mortgage loan estimate", 10);
moneyFact(brb, "closing-costs", 9840, "Peach State Mortgage loan estimate", 10);
moneyFact(brb, "prepaids", 3120, "Peach State Mortgage loan estimate", 10);
moneyFact(brb, "seller-credit", 4000, "Executed purchase agreement, stipulation 2", 12);
ins("rift_summary_links", { id: id("link"), agent_id: AGENT, journey_id: brb.id, token_hash: sha("demo-summary-1"), label: "For Tanya's mother", scopes: arr(["progress", "dates"], "text"), expires_at: ahead(25), created_by: KALEB, created_at: ago(5) });
ins("rift_summary_links", { id: id("link"), agent_id: AGENT, journey_id: brb.id, token_hash: sha("demo-summary-2"), label: "Relocation coordinator", scopes: arr(["progress"], "text"), expires_at: ahead(40), created_by: KALEB, created_at: ago(10), revoked_at: ago(4), revoked_by: KALEB });

const brs = journey("brooks", "brooks-sell", "sell", "Selling 88 Wren Ct", 45);
member(brs, "michael", "michael.brooks@example.com", "Michael Brooks", "buyer", "accepted", 45);
member(brs, "tanya", "tanya.brooks@example.com", "Tanya Brooks", "co-buyer", "accepted", 45);
home(brs, "wren", "88 Wren Ct, Tucker, GA 30084", F(389000, 3, 2, "Tucker"), 45, null, { source: "Tax record and Kaleb's walkthrough" });
stages(brs, [["price-launch", 30, "Pricing agreed"], ["market", 18, "Live on FMLS", { evidence: "FMLS #7412290" }]]);
ins("rift_pricing_opinions", { id: id("opinion"), agent_id: AGENT, journey_id: brs.id, version: 1, list_price_cents: 38900000, low_cents: 37500000, high_cents: 39900000,
  comps: json([{ address: "102 Wren Ct, Tucker", price: 384000, status: "sold", on: day(-50), note: "Same plan, older kitchen" }, { address: "7 Lark Ln, Tucker", price: 395000, status: "pending", on: day(-12), note: "Finished basement" }]),
  rationale: "Two sales on the street support the high 380s; the kitchen update is worth listing at $389,000.", review_on: day(3), actor_label: KALEB, request_id: rid(), created_at: ago(31) });
for (const [kind, detail, daysAgo, extra] of [
  ["photos", "Photos taken by Brightside Media", 25], ["measurements", "Measured at 1,860 sq ft", 25], ["copy", "Listing description approved by Tanya", 22],
  ["disclosures", "Seller's disclosure signed", 21], ["mls-live", "Live on FMLS as #7412290", 18, { url: "https://www.fmls.com/listing/demo-7412290" }],
  ["syndicated", "Showing on Zillow and Realtor.com", 17],
]) ins("rift_listing_events", { id: id("levent"), agent_id: AGENT, journey_id: brs.id, kind, detail, url: extra?.url ?? null, price_cents: null, actor_label: KALEB, request_id: rid(), created_at: ago(daysAgo) });
ins("rift_listing_reviews", { id: id("lreview"), agent_id: AGENT, journey_id: brs.id, week_of: day(-11), metrics: "9 showings, 412 Zillow views, 1 second showing", summary: "Steady traffic, the feedback is about the small back yard.", decision: "keep", decision_note: null, actor_label: KALEB, request_id: rid(), created_at: ago(11) });
ins("rift_listing_reviews", { id: id("lreview"), agent_id: AGENT, journey_id: brs.id, week_of: day(-4), metrics: "6 showings, 290 views", summary: "Quieter week. Two agents said the price is fair for the kitchen.", decision: "keep", decision_note: null, actor_label: KALEB, request_id: rid(), created_at: ago(4) });
ins("rift_dependencies", { id: id("dep"), agent_id: AGENT, sale_journey_id: brs.id, purchase_journey_id: brb.id, kind: "proceeds", note: "The Oakhurst down payment comes from the Wren Ct sale; it must close first.", owner: KALEB, actor_label: KALEB, request_id: rid(), created_at: ago(12) });

/* -- Ethan Walker: buying, closing this week (cash) ------------------- */
const eth = journey("ethan", "ethan", "buy", "Kirkwood bungalow", 80);
member(eth, "ethan", "ethan.walker@example.com", "Ethan Walker", "buyer", "accepted", 80);
eth.members.ethan.decider = true;
home(eth, "kirkwood", "1935 Hosea L Williams Dr NE, Atlanta, GA 30317", F(398000, 3, 2, "Atlanta", { lotAcres: 0.2 }), 40);
stages(eth, [["search", 75, "Agreement signed"], ["tour", 50, "Touring Kirkwood"], ["offer", 30, "Cash offer on Hosea L Williams"]]);
contract(eth, "kirkwood", "cash", "Executed purchase agreement, all cash", 26);
jevent(eth, "stage", "offer", "under-contract", "Contract recorded", 26, { tx: eth.tx, evidence: "Executed purchase agreement" });
work(eth, "earnest-money", "confirmed", 24, { source: "Weissman PC, holder", note: "$10,000" });
work(eth, "inspection", "confirmed", 18, { source: "Ethan, after the inspection", note: "Water heater noted, accepted as is" });
work(eth, "title", "confirmed", 6, { source: "Weissman PC", note: "Title clear" });
work(eth, "insurance", "confirmed", 5, { source: "State Farm binder" });
work(eth, "repairs", "not-applicable", 18, { note: "Buying as is" });
work(eth, "walkthrough", "in-progress", 1);
work(eth, "closing", "in-progress", 4, { owner: "other", ownerName: "Weissman PC" });
jevent(eth, "stage", "under-contract", "close", "Closing scheduled", 4, { evidence: "Closing set with Weissman PC for " + day(2) });
deadline(eth, "Closing", "contractual", "closing", [{ date: day(2), time: "10:00", term: "Paragraph 3, closing date", verified: true, daysAgo: 26 }]);
deadline(eth, "Final walkthrough", "target", "walkthrough", [{ date: day(1), term: "Our own target, the day before closing", verified: false, daysAgo: 4 }]);
moneyFact(eth, "price", 398000, "Executed purchase agreement", 26);
moneyFact(eth, "earnest", 10000, "Weissman PC receipt", 24);
moneyFact(eth, "official-cash-to-close", 391240, "Weissman PC settlement statement draft", 2);

/* -- Nia Johnson: bought, closed three weeks ago ---------------------- */
const nia = journey("nia", "nia", "buy", "East Atlanta starter home", 110);
member(nia, "nia", "nia.johnson@example.com", "Nia Johnson", "buyer", "accepted", 110);
nia.members.nia.decider = true;
home(nia, "moreland", "1276 Moreland Ave SE, Atlanta, GA 30316", F(338000, 3, 2, "Atlanta"), 70);
stages(nia, [["search", 105, "Agreement signed"], ["tour", 80, "Touring East Atlanta"], ["offer", 62, "Offer on Moreland Ave"]]);
contract(nia, "moreland", "financed", "Executed purchase agreement", 58);
jevent(nia, "stage", "offer", "under-contract", "Contract recorded", 58, { tx: nia.tx });
for (const w of ["earnest-money", "inspection", "financing", "appraisal", "title", "insurance", "walkthrough"]) work(nia, w, "confirmed", 25, { source: "Closing file", owner: "agent" });
work(nia, "repairs", "not-applicable", 40, { note: "Seller credit instead of repairs" });
work(nia, "closing", "confirmed", 20, { source: "Smith Law, settlement statement", owner: "other", ownerName: "Smith Law" });
work(nia, "possession", "confirmed", 20, { source: "Keys handed over at the table" });
jevent(nia, "stage", "under-contract", "close", "Clear to close", 24, { evidence: "Clear to close from Peach State Mortgage" });
jevent(nia, "stage", "close", "own", "Closed: keys at Smith Law", 20, { tx: nia.tx });
ended(nia, "closed", "Keys at Smith Law", 20);
jevent(nia, "status", "active", "completed", "The home is hers", 20);
moneyFact(nia, "price", 338000, "Settlement statement", 20);
moneyFact(nia, "assistance-approved", 10000, "ATL HomeNOW approval letter", 40);
moneyFact(nia, "official-cash-to-close", 9420, "Settlement statement", 20);

/* -- Samuel Adeyemi: buying from abroad, search waiting on setup ------ */
const sam = journey("samuel", "samuel", "buy", "Gwinnett rental from Lagos", 18);
member(sam, "samuel", "samuel.adeyemi@example.com", "Samuel Adeyemi", "buyer", "accepted", 18);
member(sam, "tolu", "tolu.adeyemi@example.com", "Tolu Adeyemi", "co-buyer", "expired", 17);
stages(sam, [["search", 8, "Agreement signed, portfolio lender term sheet in hand"]]);
revision(sam, 1, [priceCrit(400000, "Samuel Adeyemi", 9), geoCrit(["Lawrenceville", "Snellville"], "Samuel Adeyemi", 9), bedCrit(3, "Samuel Adeyemi", 9), typeCrit(["detached", "townhouse"], "Samuel Adeyemi", 9)], [], 9);
searchPackage(sam, 1, "weekly", "manual-action-needed", 1);

/* -- Linda Patterson: contract terminated, back to searching ---------- */
const lin = journey("linda", "linda", "buy", "Marietta, one level", 88);
member(lin, "linda", "linda.patterson@example.com", "Linda Patterson", "buyer", "accepted", 88);
lin.members.linda.decider = true;
revision(lin, 1, [priceCrit(450000, "Linda Patterson", 85), geoCrit(["Marietta", "East Cobb"], "Linda Patterson", 85), bedCrit(3, "Linda Patterson", 85)], [], 85);
searchPackage(lin, 1, "daily", "active-confirmed", 84);
revision(lin, 2, [priceCrit(450000, "Linda Patterson", 85), geoCrit(["Marietta", "East Cobb", "Kennesaw"], "Linda Patterson", 5), bedCrit(3, "Linda Patterson", 85), crit("otherPropertyAttribute", "equals", "Primary bedroom on the main floor", null, "hard", "Linda Patterson", 5, 6)], [], 5, null, "After the termination: main-floor primary is now a must");
home(lin, "whitlock", "550 Whitlock Ave NW, Marietta, GA 30064", F(439000, 3, 2, "Marietta"), 40);
home(lin, "powers", "2811 Powers Ferry Rd, Marietta, GA 30067", F(447000, 3, 2.5, "Marietta", { basement: "yes" }), 4);
stages(lin, [["search", 85, "Agreement signed"], ["tour", 45, "Touring Marietta"], ["offer", 38, "Offer on Whitlock Ave"]]);
contract(lin, "whitlock", "financed", "Executed purchase agreement", 34);
jevent(lin, "stage", "offer", "under-contract", "Contract recorded", 34, { tx: lin.tx });
work(lin, "earnest-money", "confirmed", 32, { source: "Cobb Title, holder" });
work(lin, "inspection", "blocked", 26, { note: "Structural engineer found foundation movement" });
ended(lin, "terminated", "Terminated in due diligence: foundation movement", 25);
jevent(lin, "stage", "under-contract", "search", "Contract terminated: foundation movement", 25, { tx: lin.tx });
deadline(lin, "Due diligence period ends", "contractual", "inspection", [{ date: day(-24), term: "Special stipulation 1", verified: true, daysAgo: 34 }]);

/* -- Robert Chen: search paused --------------------------------------- */
const rob = journey("robert", "robert", "buy", "Sandy Springs, room for his mother", 140);
member(rob, "robert", "robert.chen@example.com", "Robert Chen", "buyer", "accepted", 140);
stages(rob, [["search", 130, "Agreement signed"]]);
revision(rob, 1, [priceCrit(600000, "Robert Chen", 130), geoCrit(["Sandy Springs", "Dunwoody"], "Robert Chen", 130), bedCrit(4, "Robert Chen", 130)], [], 130);
searchPackage(rob, 1, "weekly", "paused", 129);
jevent(rob, "status", "active", "paused", "His mother's move is delayed; picking up in October", 30);

/* -- Holloway: selling under contract, and buying (dependency met) ----- */
const hos = journey("holloway", "holloway-sell", "sell", "Selling 61 Ridgecrest Rd", 80);
member(hos, "james", "james.holloway@example.com", "James Holloway", "buyer", "accepted", 80);
home(hos, "ridgecrest", "61 Ridgecrest Rd, Decatur, GA 30030", F(525000, 4, 3, "Decatur", { lotAcres: 0.4, basement: "yes" }), 80, null, { source: "Tax record and Kaleb's walkthrough" });
ins("rift_pricing_opinions", { id: id("opinion"), agent_id: AGENT, journey_id: hos.id, version: 1, list_price_cents: 52500000, low_cents: 51000000, high_cents: 54000000,
  comps: json([{ address: "40 Ridgecrest Rd, Decatur", price: 518000, status: "sold", on: day(-90), note: "Smaller lot" }, { address: "12 Glendale Ave, Decatur", price: 539000, status: "sold", on: day(-70), note: "Renovated baths" }]),
  rationale: "The lot is the biggest on the street; $525,000 sits between the two recent sales.", review_on: day(-50), actor_label: KALEB, request_id: rid(), created_at: ago(70) });
for (const [kind, detail, daysAgo, extra] of [
  ["photos", "Photos by Brightside Media", 60], ["mls-live", "Live on FMLS as #7398812", 55, { url: "https://www.fmls.com/listing/demo-7398812" }], ["syndicated", "On Zillow and Realtor.com", 54],
]) ins("rift_listing_events", { id: id("levent"), agent_id: AGENT, journey_id: hos.id, kind, detail, url: extra?.url ?? null, price_cents: null, actor_label: KALEB, request_id: rid(), created_at: ago(daysAgo) });
stages(hos, [["price-launch", 70, "Pricing agreed"], ["market", 55, "Live on FMLS"], ["offers", 18, "Two offers in"]]);
contract(hos, "ridgecrest", "financed", "Executed purchase agreement with the Harpers' buyers", 15);
jevent(hos, "stage", "offers", "under-contract", "Contract recorded", 15, { tx: hos.tx });
work(hos, "earnest-money", "confirmed", 13, { source: "Buyer's attorney, holder" });
work(hos, "inspection", "confirmed", 8, { source: "Buyer's agent, email" });
work(hos, "repairs", "in-progress", 6, { note: "Gutter repair booked" });
work(hos, "appraisal", "waiting", 5);
work(hos, "title", "in-progress", 10);
deadline(hos, "Due diligence period ends", "contractual", "inspection", [{ date: day(-5), term: "Special stipulation 1", verified: true, daysAgo: 15 }, { date: day(-5), term: "Special stipulation 1", verified: true, state: "met", note: "Buyer's agent confirmed they are proceeding", daysAgo: 5 }]);
deadline(hos, "Repairs complete", "contractual", "repairs", [{ date: day(6), term: "Amendment 1, repairs", verified: true, amendment: "Amendment 1 to address repairs", daysAgo: 7 }]);
deadline(hos, "Closing", "contractual", "closing", [{ date: day(16), term: "Paragraph 3, closing date", verified: false, daysAgo: 15 }]);
doc(hos, "contract", "Executed Purchase and Sale Agreement", "ridgecrest-psa.pdf", 15);
doc(hos, "disclosure", "Seller's Property Disclosure Statement", "ridgecrest-spds.pdf", 60);
for (const [kind, price, owed, source, asOf, extra] of [
  ["planning", 525000, 99000, "Kaleb's pricing, version 1", 70, { owed_source: "balance" }],
  ["offer", 531000, 99000, "Accepted offer", 15, { owed_source: "balance", credits_cents: 500000, note: "$5,000 toward buyer's closing costs" }],
  ["revised", 531000, 98700, "Payoff statement from Truist", 6, { owed_source: "payoff-statement", credits_cents: 500000 }],
]) ins("rift_seller_figures", { id: id("sfig"), agent_id: AGENT, journey_id: hos.id, kind, price_cents: price * 100, owed_cents: owed * 100, owed_source: extra.owed_source, commission_pct: 5.0, credits_cents: extra.credits_cents ?? 0, official_net_cents: null, source, as_of: day(-asOf), note: extra.note ?? null, actor_label: KALEB, request_id: rid(), created_at: ago(asOf) });

const hob = journey("holloway", "holloway-buy", "buy", "Downsizing to a Decatur condo", 30);
member(hob, "james", "james.holloway@example.com", "James Holloway", "buyer", "accepted", 30);
stages(hob, [["search", 20, "Agreement signed"]]);
const hosDep = id("dep");
ins("rift_dependencies", { id: hosDep, agent_id: AGENT, sale_journey_id: hos.id, purchase_journey_id: hob.id, kind: "timing", note: "Needs to be under contract on Ridgecrest before writing on a condo.", owner: KALEB, actor_label: KALEB, request_id: rid(), created_at: ago(28) });
ins("rift_dependency_events", { id: id("depev"), agent_id: AGENT, dependency_id: hosDep, state: "met", evidence: "Ridgecrest under contract " + day(-15), actor_label: KALEB, request_id: rid(), created_at: ago(15) });
ins("rift_dependencies", { id: id("dep"), agent_id: AGENT, sale_journey_id: hos.id, purchase_journey_id: hob.id, kind: "possession", note: "Rent-back of two weeks after the Ridgecrest closing, until the condo closes.", owner: "James Holloway", actor_label: KALEB, request_id: rid(), created_at: ago(14) });

/* -- Margaret Ellis: selling, preparing ------------------------------- */
const ell = journey("ellis", "ellis", "sell", "Selling 27 Kings Hwy", 9);
member(ell, "margaret", "margaret.ellis@example.com", "Margaret Ellis", "buyer", "accepted", 9);
home(ell, "kings", "27 Kings Hwy, Decatur, GA 30030", F(610000, 4, 3.5, "Decatur", { lotAcres: 0.35, basement: "yes" }), 9, null, { source: "Tax record and Kaleb's walkthrough" });
ins("rift_pricing_opinions", { id: id("opinion"), agent_id: AGENT, journey_id: ell.id, version: 1, list_price_cents: 61000000, low_cents: 59000000, high_cents: 63500000,
  comps: json([{ address: "15 Kings Hwy, Decatur", price: 598000, status: "sold", on: day(-45), note: "No basement" }, { address: "300 Clairmont Ave, Decatur", price: 629000, status: "active", on: day(-10), note: "Fully renovated" }, { address: "88 Oakdale Rd, Decatur", price: 605000, status: "pending", on: day(-20), note: "Same size, smaller lot" }]),
  rationale: "Between the Kings Hwy sale and the renovated Clairmont listing; staging should hold the top of the range.", review_on: day(5), actor_label: KALEB, request_id: rid(), created_at: ago(6) });
ins("rift_seller_figures", { id: id("sfig"), agent_id: AGENT, journey_id: ell.id, kind: "planning", price_cents: 61000000, owed_cents: 16400000, owed_source: "balance", commission_pct: 5.5, credits_cents: 0, official_net_cents: null, source: "Kaleb's pricing, version 1", as_of: day(-6), note: null, actor_label: KALEB, request_id: rid(), created_at: ago(6) });
for (const [kind, detail, daysAgo] of [["measurements", "Measured at 2,640 sq ft", 5], ["access", "Lockbox on the side door; Supra code set", 3]])
  ins("rift_listing_events", { id: id("levent"), agent_id: AGENT, journey_id: ell.id, kind, detail, url: null, price_cents: null, actor_label: KALEB, request_id: rid(), created_at: ago(daysAgo) });

/* -- David & Karen Owens: selling, listed, weekly reviews, pricing v2 --- */
const owe = journey("owens", "owens", "sell", "Selling 1402 Briarcliff Rd", 40);
member(owe, "david", "david.owens@example.com", "David Owens", "buyer", "accepted", 40);
member(owe, "karen", "karen.owens@example.com", "Karen Owens", "co-buyer", "accepted", 39);
home(owe, "briarcliff", "1402 Briarcliff Rd NE, Atlanta, GA 30306", F(749000, 4, 3, "Atlanta", { lotAcres: 0.3 }), 40, null, { source: "Tax record and Kaleb's walkthrough" });
const owe1 = id("opinion"), owe2 = id("opinion");
ins("rift_pricing_opinions", { id: owe1, agent_id: AGENT, journey_id: owe.id, version: 1, list_price_cents: 77500000, low_cents: 74000000, high_cents: 79000000,
  comps: json([{ address: "1380 Briarcliff Rd NE", price: 765000, status: "sold", on: day(-60), note: "Renovated kitchen" }, { address: "990 Lenox Rd NE", price: 739000, status: "sold", on: day(-40), note: "Smaller lot" }]),
  rationale: "Listed at $775,000 to test the top of the Druid Hills range.", review_on: day(-15), actor_label: KALEB, request_id: rid(), created_at: ago(36) });
ins("rift_pricing_opinions", { id: owe2, agent_id: AGENT, journey_id: owe.id, version: 2, list_price_cents: 74900000, low_cents: 73000000, high_cents: 76000000,
  comps: json([{ address: "1380 Briarcliff Rd NE", price: 765000, status: "sold", on: day(-60), note: "Renovated kitchen" }, { address: "990 Lenox Rd NE", price: 739000, status: "sold", on: day(-40), note: "Smaller lot" }, { address: "1422 Briarcliff Rd NE", price: 735000, status: "active", on: day(-14), note: "New competition two doors down" }]),
  rationale: "Three weeks of showings without an offer; the feedback is all about the kitchen. $749,000 meets the market.", review_on: day(-1), actor_label: KALEB, request_id: rid(), created_at: ago(14) });
ins("rift_pricing_responses", { id: id("presp"), agent_id: AGENT, opinion_id: owe1, member_id: owe.members.david.id, response: "agree", note: null, created_at: ago(35) });
ins("rift_pricing_responses", { id: id("presp"), agent_id: AGENT, opinion_id: owe2, member_id: owe.members.david.id, response: "agree", note: null, created_at: ago(13) });
ins("rift_pricing_responses", { id: id("presp"), agent_id: AGENT, opinion_id: owe2, member_id: owe.members.karen.id, response: "discuss", note: "Can we wait one more week before dropping it?", created_at: ago(1, 4) });
ins("rift_seller_figures", { id: id("sfig"), agent_id: AGENT, journey_id: owe.id, kind: "planning", price_cents: 74900000, owed_cents: 21300000, owed_source: "balance", commission_pct: 5.5, credits_cents: 0, official_net_cents: null, source: "Kaleb's pricing, version 2", as_of: day(-14), note: null, actor_label: KALEB, request_id: rid(), created_at: ago(14) });
stages(owe, [["price-launch", 36, "Pricing agreed at $775,000"], ["market", 30, "Live on FMLS", { evidence: "FMLS #7405561" }], ["offers", 2, "First offer arrived"]]);
for (const [kind, detail, daysAgo, extra] of [
  ["photos", "Twilight photos by Brightside Media", 33], ["measurements", "Measured at 2,980 sq ft", 33], ["copy", "Description approved by Karen", 32],
  ["disclosures", "Seller's disclosure signed by both", 31], ["access", "ShowingTime, one hour notice", 31],
  ["mls-live", "Live on FMLS as #7405561", 30, { url: "https://www.fmls.com/listing/demo-7405561" }], ["syndicated", "On Zillow, Realtor.com and Redfin", 29],
  ["price-change", "Reduced to $749,000 after pricing version 2", 13, { price: 74900000 }],
]) ins("rift_listing_events", { id: id("levent"), agent_id: AGENT, journey_id: owe.id, kind, detail, url: extra?.url ?? null, price_cents: extra?.price ?? null, actor_label: KALEB, request_id: rid(), created_at: ago(daysAgo) });
const showing = (whenDays, states, agentName) => {
  const key = id("showkey");
  for (const [state, recordedDays, fb, interest] of states) {
    ins("rift_listing_showings", { id: id("showing"), agent_id: AGENT, journey_id: owe.id, showing_key: key, starts_at: local(-whenDays, ["11:00", "14:00", "16:30", "18:00"][(counts.rift_listing_showings ?? 0) % 4]), state, showing_agent: agentName, feedback: fb ?? null, interest: interest ?? null, actor_label: KALEB, request_id: rid(), created_at: ago(recordedDays) });
  }
};
showing(20, [["requested", 21], ["confirmed", 20.5], ["done", 19.8, "Loved the lot, kitchen needs work for the price", "some"]], "Alicia Grant, Compass");
showing(15, [["requested", 16], ["confirmed", 15.5], ["done", 14.8, "Second visit likely; buyers want to bring a contractor", "strong"]], "Marcus Hill, Harry Norman");
showing(9, [["requested", 10], ["confirmed", 9.5], ["done", 8.8, "Too much work for them", "none"]], "Jen Park, Keller Williams");
showing(6, [["requested", 7], ["cancelled", 6.5]], "Tom Reyes, eXp");
showing(3, [["requested", 4], ["confirmed", 3.5], ["done", 2.8, "Writing an offer tonight", "offer-likely"]], "Marcus Hill, Harry Norman");
showing(-1, [["requested", 1], ["confirmed", 0.5]], "Dana Wu, Atlanta Fine Homes");
showing(-2, [["requested", 0.2]], "Chris Bell, Coldwell Banker");
for (const [weekDays, metrics, summary, decision, dnote] of [
  [28, "7 showings, 980 Zillow views, 3 saves", "Strong first week, no offers. Kitchen comments on every showing.", "keep", null],
  [21, "5 showings, 510 views", "Traffic falling. Two agents said $775,000 is ambitious for the kitchen.", "change", "Prepare pricing version 2 at $749,000"],
  [14, "8 showings after the reduction, 640 views", "The reduction brought traffic back; one second visit booked.", "keep", null],
  [8, "4 showings, 1 offer likely", "The Hill buyers are writing.", "undecided", null],
]) ins("rift_listing_reviews", { id: id("lreview"), agent_id: AGENT, journey_id: owe.id, week_of: day(-weekDays), metrics, summary, decision, decision_note: dnote, actor_label: KALEB, request_id: rid(), created_at: ago(weekDays) });

/* Offers that came in through the public form, one on the Owens listing. */
const inbound = [
  ["1402 Briarcliff Rd NE, Atlanta, GA 30306", "Marcus Hill for the Delgado family", "marcus.hill@example.com", "(404) 555-0181", "Harry Norman Realtors", "buyer", 735000, 5000, 0, 10000, "conventional", 30, ["Due diligence 10 days", "Financing", "Appraisal"], true, false, "Flexible on closing; buyers are relocating from Denver.", 1.5],
  ["1402 Briarcliff Rd NE, Atlanta, GA 30306", "Priya Shah", "priya.shah@example.com", null, null, "self", 715000, 0, 8000, 5000, "fha", 45, ["Due diligence 14 days", "Financing", "Appraisal", "Sale of buyer's home"], true, false, null, 0.5],
  ["88 Wren Ct, Tucker, GA 30084", "Tony Alvarez, Keller Williams", "tony.alvarez@example.com", "(678) 555-0160", "Keller Williams Realty", "buyer", 380000, 6000, 0, 3000, "va", 28, ["Due diligence 7 days", "Financing"], true, false, "VA buyer, pre-approved with Navy Federal.", 3],
  ["4410 Roswell Rd, Atlanta, GA 30342", "Evergreen Homebuyers LLC", "offers@evergreen.example.com", null, null, "other", 290000, 0, 0, 1000, "cash", 10, [], false, true, "Cash, as-is, close in ten days.", 6],
];
const inboundIds = [];
for (const [address, by, email, phone, firm, representing, price, conc, repair, earnest, fin, closeIn, conts, pre, pof, noteText, daysAgo] of inbound) {
  const oId = id("offer");
  inboundIds.push(oId);
  ins("rift_offers", {
    id: oId, agent_id: AGENT, lead_id: null, offered_by: by, price_cents: price * 100, concessions_cents: conc * 100, repair_credit_cents: repair * 100,
    earnest_cents: earnest * 100, financing: fin, close_on: day(closeIn), contingencies: arr(conts, "text"), preapproval: pre, proof_of_funds: pof,
    note: noteText, released_at: null, created_at: ago(daysAgo), source: "inbound", property_address: address, submitted_email: email,
    submitted_phone: phone, submitted_firm: firm, representing, submitter_lead_id: Object.values(P).find((x) => x.email === email)?.id ?? null, due_diligence_days: conts[0]?.match(/\d+/) ? Number(conts[0].match(/\d+/)[0]) : null,
  });
}

/* -- Patricia Moore: selling, offers released, she chose one ---------- */
const pat = journey("patricia", "patricia", "sell", "Selling 5120 Lost Mountain Rd", 60);
member(pat, "patricia", "patricia.moore@example.com", "Patricia Moore", "buyer", "accepted", 60);
home(pat, "lostmtn", "5120 Lost Mountain Rd, Powder Springs, GA 30127", F(475000, 4, 2.5, "Powder Springs", { lotAcres: 1.1 }), 60, null, { source: "Tax record and Kaleb's walkthrough" });
ins("rift_pricing_opinions", { id: id("opinion"), agent_id: AGENT, journey_id: pat.id, version: 1, list_price_cents: 47500000, low_cents: 46000000, high_cents: 49000000,
  comps: json([{ address: "5300 Lost Mountain Rd", price: 468000, status: "sold", on: day(-80), note: "Half the acreage" }]), rationale: "Acreage in west Cobb is scarce; list at $475,000 and let the lot do the work.", review_on: day(6), actor_label: KALEB, request_id: rid(), created_at: ago(55) });
stages(pat, [["price-launch", 55, "Pricing agreed"], ["market", 45, "Live on FMLS"], ["offers", 4, "Three offers in"]]);
for (const [kind, detail, daysAgo, extra] of [["photos", "Drone and interior photos", 48], ["mls-live", "Live on FMLS as #7401122", 45, { url: "https://www.fmls.com/listing/demo-7401122" }]])
  ins("rift_listing_events", { id: id("levent"), agent_id: AGENT, journey_id: pat.id, kind, detail, url: extra?.url ?? null, price_cents: null, actor_label: KALEB, request_id: rid(), created_at: ago(daysAgo) });
for (const [weekDays, metrics, summary, decision] of [
  [38, "6 showings, 700 views", "The acreage draws people; the dated kitchen is the objection.", "keep"],
  [31, "5 showings", "Two second showings.", "keep"],
  [24, "3 showings", "Quiet week; the county fair weekend.", "keep"],
  [17, "4 showings", "One buyer asking about the barn's permits.", "keep"],
  [10, "5 showings, 2 likely offers", "Harper and Nguyen both writing.", "keep"],
  [3, "3 offers in", "Offers presented on her plan page.", "undecided"],
]) ins("rift_listing_reviews", { id: id("lreview"), agent_id: AGENT, journey_id: pat.id, week_of: day(-weekDays), metrics, summary, decision, decision_note: null, actor_label: KALEB, request_id: rid(), created_at: ago(weekDays) });
const patOffers = [
  ["The Harper family (Ansley Real Estate)", 478000, 3000, 0, 5000, "conventional", 32, ["Due diligence 10 days", "Financing", "Appraisal"], true, false, "Loved the barn. Will waive appraisal gap up to $5,000.", 3.5, true],
  ["Kim Nguyen (Keller Williams)", 482000, 9000, 2500, 3000, "fha", 45, ["Due diligence 14 days", "Financing", "Appraisal", "Sale of buyer's home"], true, false, null, 3, true],
  ["Ridge Capital LLC", 455000, 0, 0, 10000, "cash", 14, [], false, true, "As-is cash.", 2, false],
];
const patIds = [];
for (const [by, price, conc, repair, earnest, fin, closeIn, conts, pre, pof, noteText, daysAgo, released] of patOffers) {
  const oId = id("offer");
  patIds.push({
    id: oId, released, from: by, price, concessions: conc, repairCredit: repair, financing: fin, earnest, closeOn: day(closeIn),
    contingencies: conts, preapproval: pre, proofOfFunds: pof, note: noteText, releasedAt: released ? ago(2.5) : null, createdAt: ago(daysAgo),
  });
  ins("rift_offers", {
    id: oId, agent_id: AGENT, lead_id: P.patricia.id, offered_by: by, price_cents: price * 100, concessions_cents: conc * 100, repair_credit_cents: repair * 100,
    earnest_cents: earnest * 100, financing: fin, close_on: day(closeIn), contingencies: arr(conts, "text"), preapproval: pre, proof_of_funds: pof,
    note: noteText, released_at: released ? ago(2.5) : null, created_at: ago(daysAgo), source: "agent",
  });
}
const harper = patIds[0];
const patTake = "I would take the Harper offer: it nets more than Nguyen's once you count what each asks back, and it has no home-sale contingency.";
/* What she was shown when she chose, computed the way the plan page computes it. */
const patSeen = snapshotOf(harper, patIds.filter((o) => o.released), { payoff: 168000, commissionPct: 5.0 }, patTake);
ins("rift_offer_rooms", {
  lead_id: P.patricia.id, agent_id: AGENT, prepared: "Two offers are worth your time. Harper nets more once the concessions and the sale contingency are counted.",
  take: patTake,
  approved_at: ago(2.4), approved_for: arr(patIds.filter((o) => o.released).map((o) => o.id), "uuid"),
  chosen_offer_id: harper.id, chosen_at: ago(1, 2),
  chosen_seen: json(patSeen),
  client_note: "Harper, please. Can closing be the week after Thanksgiving?", updated_at: ago(1, 2),
});
ins("rift_seller_figures", { id: id("sfig"), agent_id: AGENT, journey_id: pat.id, kind: "offer", price_cents: 47800000, owed_cents: 16800000, owed_source: "balance", commission_pct: 5.0, credits_cents: 300000, official_net_cents: null, source: "The Harper offer", as_of: day(-3), note: "Before the repair request", actor_label: KALEB, request_id: rid(), created_at: ago(3) });

/* -- Barbara Wright: sold seven months ago ---------------------------- */
const wri = journey("wright", "wright", "sell", "Selling 9 Adams St", 280);
member(wri, "barbara", "barbara.wright@example.com", "Barbara Wright", "buyer", "accepted", 280);
home(wri, "adams", "9 Adams St, Decatur, GA 30030", F(455000, 3, 2, "Decatur"), 280, null, { source: "Tax record" });
stages(wri, [["price-launch", 270, "Pricing agreed"], ["market", 260, "Live on FMLS"], ["offers", 245, "Offer in"]]);
contract(wri, "adams", "financed", "Executed purchase agreement", 242);
jevent(wri, "stage", "offers", "under-contract", "Contract recorded", 242, { tx: wri.tx });
for (const w of ["earnest-money", "inspection", "financing", "appraisal", "title", "repairs", "walkthrough", "possession"]) work(wri, w, "confirmed", 213, { source: "Closing file" });
work(wri, "closing", "confirmed", 212, { source: "Settlement statement", owner: "other", ownerName: "Smith Law" });
jevent(wri, "stage", "under-contract", "close", "Clear to close", 215, { evidence: "Buyer's lender cleared to close" });
jevent(wri, "stage", "close", "continue", "Closed: signed at Smith Law", 212, { tx: wri.tx });
ended(wri, "closed", "Signed at Smith Law", 212);
jevent(wri, "status", "active", "completed", "Sold", 212);
ins("rift_seller_figures", { id: id("sfig"), agent_id: AGENT, journey_id: wri.id, kind: "official", price_cents: 45500000, owed_cents: 0, owed_source: "none", commission_pct: 5.0, credits_cents: 0, official_net_cents: 42310000, source: "Settlement statement", as_of: day(-212), note: null, actor_label: KALEB, request_id: rid(), created_at: ago(212) });

/* Pilot checks against Matrix and the documents. */
{
  const livePkg = (j) => `(select id from rift_search_packages where journey_id = '${j.id}' and status in ('active-confirmed','paused') limit 1)`;
  ins("rift_reconciliations", { id: id("recon"), agent_id: AGENT, journey_id: chr.id, search_package_id: raw(livePkg(chr)), search: "matches", dates: "none", note: null, actor_label: KALEB, request_id: rid(), created_at: ago(6) });
  ins("rift_reconciliations", { id: id("recon"), agent_id: AGENT, journey_id: brb.id, search_package_id: raw(livePkg(brb)), search: "matches", dates: "differs", note: "Matrix still shows the original due diligence date; the amendment moved it.", actor_label: KALEB, request_id: rid(), created_at: ago(2) });
  ins("rift_reconciliations", { id: id("recon"), agent_id: AGENT, journey_id: rac.id, search_package_id: raw(livePkg(rac)), search: "matches", dates: "none", note: null, actor_label: KALEB, request_id: rid(), created_at: ago(30) });
}

/* ------------------------------------------------------------------ */
/* Referral moments                                                     */
/* ------------------------------------------------------------------ */

const moment = (key, momentId, state, daysAgo, noteText = null, occurrence = 0) => ins("rift_referral_moments", {
  id: id("moment"), agent_id: AGENT, lead_id: P[key].id, moment_id: momentId, occurrence, state, note: noteText, decided_at: ago(daysAgo), created_at: ago(daysAgo),
});
moment("nia", "value_delivered", "acted", 100, "Shared her readout with her brother");
moment("nia", "under_contract", "sent", 57);
moment("nia", "closing_day", "sent", 20, "Card and the review link at the closing table");
moment("brooks", "under_contract", "held", 11, "Wait until the repairs are settled");
moment("patricia", "plan_published", "declined", 50, "She said she does not want to be asked while selling");
moment("wright", "closing_day", "sent", 212, "Card at the closing table");
moment("wright", "day_30", "acted", 180, "Left a Google review");
moment("wright", "month_6", "sent", 30);
moment("chris", "value_delivered", "sent", 40);

/* ------------------------------------------------------------------ */
/* Figures asked to be checked                                          */
/* ------------------------------------------------------------------ */

for (const [key, what, claim, hours, resolved] of [
  ["alvarez", "Cash to close", "We think the closing costs are lower than $9,800; our lender quoted $7,900.", 30, false],
  ["olivia", "Assistance", "Georgia Dream says $10,000 but the class instructor said $7,500 for us.", 5, false],
  ["destiny", "Monthly payment", "Is the $2,240 with or without the HOA?", 80, true],
]) {
  const p = P[key];
  const fId = id("figure");
  ins("rift_figures", {
    id: fId, agent_id: AGENT, readout_id: p.readoutId, label: what, value_cents: Math.round((Number(p.readout.figures[what === "Cash to close" ? "cashToClose" : what === "Assistance" ? "assistance" : "monthly"]) || 0) * 100),
    trust_state: resolved ? "verified" : "pending-review", ceiling: "verified",
    assumptions: json([{ label: "Down payment", value: "10%" }, { label: "Rate", value: "6.18%, Freddie Mac this week" }]),
    could_be_wrong: "Closing costs vary by lender and by the day you lock; this uses the Georgia average for the price.",
    confirmed_by: resolved ? "Dana at Peach State Mortgage" : null, created_at: ago(0, hours + 1),
  });
  ins("rift_review_items", {
    id: id("review"), agent_id: AGENT, readout_id: p.readoutId, who: p.name, kind: "figure", what, claim,
    state: resolved ? "verified" : "pending-review", ceiling: "verified", raised_by: "client",
    to_advance: "A lender's written figure, or Kaleb's check against their loan estimate", confirmed_by: resolved ? "Dana at Peach State Mortgage" : null,
    raised_at: ago(0, hours), resolved_at: resolved ? ago(0, hours - 20) : null, figure_id: fId,
  });
}

/* ------------------------------------------------------------------ */
/* Outbox: program alerts in every state                                */
/* ------------------------------------------------------------------ */

function outbox(key, subject, body, daysAgo, states, replaces = null) {
  const p = P[key];
  const oId = id("outbox");
  const draft = { channel: "email", purpose: "program-alert", to: p.email, name: p.name, subject, body };
  const hash = sha(canonical(draft));
  ins("rift_outbox", { id: oId, agent_id: AGENT, lead_id: p.id, channel: "email", purpose: "program-alert", to_address: p.email, to_name: p.name, subject, body, content_hash: hash, replaces, created_at: ago(daysAgo) });
  let seq = 0;
  for (const [state, hoursAfter, detail] of [["prepared", 0, null], ...states]) {
    seq += 1;
    ins("rift_outbox_events", { id: id("oevent"), agent_id: AGENT, outbox_id: oId, state, at: new Date(Date.parse(ago(daysAgo)) + hoursAfter * HOUR).toISOString(), by_name: state === "prepared" && !replaces ? "Rift" : KALEB, hash: state === "approved" ? hash : null, detail, seq });
  }
  return oId;
}
const alert = (program, county) => `A program you may fit changed.\n\n${program} in ${county} County reopened for new applications this week. Nothing changes in your plan unless you want it to; your numbers are at the same link.\n\nKaleb`;
outbox("olivia", "Georgia Dream reopened for DeKalb buyers", alert("Georgia Dream", "DeKalb"), 0.2, []);
outbox("marcus", "Gwinnett Homestretch has funds again", alert("Gwinnett Homestretch", "Gwinnett"), 0.1, []);
outbox("alvarez", "DeKalb HomeStart is taking applications", alert("DeKalb HomeStart", "DeKalb"), 1, [["approved", 2, "Held back: they replied after this was approved; read their reply first"]]);
outbox("olivia", "ATL HomeNOW round two opens Monday", alert("ATL HomeNOW", "Fulton"), 6, [["approved", 1, null], ["running", 1.01, null], ["succeeded", 1.02, "Brevo <202609231512.demo@smtp-relay.brevo.com>"]]);
outbox("marcus", "FHLBank Atlanta first-time buyer funds opened", alert("FHLBank Atlanta First-time Homebuyer Product", "Gwinnett"), 3, [["approved", 1, null], ["running", 1.01, null], ["failed", 1.02, "Brevo answered 401: the API key is not valid"]]);
outbox("alvarez", "Georgia Dream limits went up", alert("Georgia Dream", "DeKalb"), 2, [["approved", 0.5, null], ["running", 0.51, null], ["unknown", 0.6, "Brevo did not answer within 10 seconds"]]);
const firstDraft = outbox("marcus", "Gwinnet Homestretch reopened", alert("Gwinnett Homestretch", "Gwinnett"), 9, [["cancelled", 2, "Replaced by an edit"]]);
outbox("marcus", "Gwinnett Homestretch reopened", alert("Gwinnett Homestretch", "Gwinnett"), 8.9, [["approved", 0.2, null], ["running", 0.21, null], ["succeeded", 0.22, "Brevo <202609201101.demo@smtp-relay.brevo.com>"]], firstDraft);
outbox("olivia", "Invest Atlanta changed its income limits", alert("Invest Atlanta", "Fulton"), 12, [["cancelled", 3, "Not relevant to her price"]]);

/* ------------------------------------------------------------------ */
/* Campaigns                                                            */
/* ------------------------------------------------------------------ */

function campaign(slug, name, daysAgo, versions, publications) {
  const cId = id("campaign");
  ins("rift_campaigns", { id: cId, agent_id: AGENT, slug, name, actor_label: KALEB, created_at: ago(daysAgo) });
  versions.forEach(([recipe, noteText, vDays], i) => ins("rift_campaign_revisions", { id: id("crev"), agent_id: AGENT, campaign_id: cId, version: i + 1, recipe: json(recipe), note: noteText, actor_label: KALEB, request_id: rid(), created_at: ago(vDays) }));
  for (const [action, version, pDays] of publications) ins("rift_campaign_publications", { id: id("cpub"), agent_id: AGENT, campaign_id: cId, action, version, actor_label: KALEB, request_id: rid(), created_at: ago(pDays) });
  return cId;
}
const heading = (title, lede) => ({ type: "heading", title, lede });
const C = {};
C.fulton = campaign("demo-fulton-first-home", "Fulton first-home help", 30, [
  [{ blocks: [heading("Help buying a home in Fulton County", "See which Georgia programs may fit you and the most they could add up to."), { type: "programs", county: "Fulton" }, { type: "cta", label: "Check my programs", valueId: "assistance" }] }, "First version", 30],
  [{ blocks: [heading("Help buying a home in Fulton County", "See which Georgia programs may fit you, what each one checks, and the most they could add up to."), { type: "text", body: "Most first-time buyers in Fulton never hear about the county's own program. It takes two minutes to see where you stand." }, { type: "programs", county: "Fulton" }, { type: "value", valueId: "cash" }, { type: "cta", label: "Check my programs", valueId: "assistance" }] }, "Added the cash-to-close tool", 12],
], [["publish", 1, 29], ["publish", 2, 11]]);
C.cobb = campaign("demo-cobb-sellers", "Cobb sellers: what you'd keep", 45, [
  [{ blocks: [heading("What you would keep selling in Cobb", "Your payoff, the costs, and the number that is left, before anyone visits."), { type: "value", valueId: "proceeds" }] }, "First version", 45],
  [{ blocks: [heading("What you would keep selling in Cobb", "Your payoff, the costs, and what is left."), { type: "value", valueId: "proceeds" }, { type: "value", valueId: "costs" }] }, "Two tools", 20],
  [{ blocks: [heading("Selling in Cobb this fall", "Start with what you would keep, then decide what to fix."), { type: "value", valueId: "prepare" }, { type: "cta", label: "See what I would keep", valueId: "proceeds" }] }, "Fall version", 6],
], [["publish", 1, 44], ["publish", 2, 19], ["publish", 3, 5], ["rollback", 2, 3]]);
C.decatur = campaign("demo-decatur-monthly", "Decatur monthly cost", 4, [
  [{ blocks: [heading("What a Decatur home costs a month", "Taxes, insurance and the payment, worked out from your numbers."), { type: "value", valueId: "monthly" }] }, "Draft", 4],
], []);
C.abroad = campaign("demo-buying-from-abroad", "Buying in Atlanta from abroad", 60, [
  [{ blocks: [heading("Buying a home in Atlanta from another country", "What a lender will need from you, and what it costs to own."), { type: "value", valueId: "eligibility" }, { type: "cta", label: "See the cost to own", valueId: "abroad-cost" }] }, "First version", 60],
], [["publish", 1, 58], ["unpublish", null, 20]]);

/* ------------------------------------------------------------------ */
/* Program checks, jobs, rates, rules, desk marks                        */
/* ------------------------------------------------------------------ */

const urls = sourcesToCheck(GEORGIA_PROGRAMS);
const pageText = (url, variant) => [
  `Official program page: ${new URL(url).hostname}`,
  "Down payment assistance for first-time homebuyers in Georgia.",
  variant === "changed" ? "Assistance amount: up to $12,500 for eligible buyers." : "Assistance amount: up to $10,000 for eligible buyers.",
  variant === "changed" ? "Household income limits updated for the 2026 program year." : "Household income limits apply by household size.",
  "A homebuyer education course is required before closing.",
  "Funds are available on a first-come, first-served basis while funding lasts.",
  "Contact a participating lender to apply. The program and the lender decide eligibility.",
].join("\n");
const checkIds = {};
function check(url, outcome, daysAgo, variant = "base") {
  const cId = id("check");
  const body = outcome === "unreachable" ? null : pageText(url, variant);
  ins("rift_program_checks", {
    id: cId, source_url: url, checked_at: ago(daysAgo), outcome, http_status: outcome === "unreachable" ? 503 : 200,
    fingerprint: body ? sha(body) : null, body, detail: outcome === "unreachable" ? "the page did not answer in 20 seconds" : null,
    summary: outcome === "changed" ? "The page now says up to $12,500 (the record says $10,000), and the income limits were updated for 2026." : null,
  });
  return cId;
}
for (const url of urls) {
  const host = new URL(url).hostname;
  check(url, "baseline", 35);
  if (host.includes("dca.georgia.gov")) {
    for (const d of [28, 21, 14, 7]) check(url, "unchanged", d);
    checkIds.flagged = check(url, "changed", 1, "changed");
  } else if (host.includes("investatlanta")) {
    for (const d of [28, 21]) check(url, "unchanged", d);
    checkIds.stillRight = check(url, "changed", 14, "changed");
    for (const d of [7, 1]) check(url, "unchanged", d, "changed");
  } else if (host.includes("clayton")) {
    for (const d of [28, 21, 14, 7]) check(url, "unchanged", d);
    check(url, "unreachable", 1);
  } else if (host.includes("cobbcounty")) {
    for (const d of [28, 21]) check(url, "unchanged", d);
    checkIds.needsUpdate = check(url, "changed", 14, "changed");
    for (const d of [7, 1]) check(url, "unchanged", d, "changed");
  } else {
    for (const d of [28, 21, 14, 7, 1]) check(url, "unchanged", d);
  }
}
if (checkIds.stillRight) ins("rift_program_reviews", { id: id("creview"), check_id: checkIds.stillRight, outcome: "still-right", reviewed_by: KALEB, note: "A new photo and a date stamp; the amounts did not change.", reviewed_at: ago(13) });
if (checkIds.needsUpdate) ins("rift_program_reviews", { id: id("creview"), check_id: checkIds.needsUpdate, outcome: "needs-update", reviewed_by: KALEB, note: "Cobb raised the price cap; the record needs rewriting before it is shown again.", reviewed_at: ago(12) });

const JOBS = [
  ["nurture-run", [0.3, 1.3, 2.3, 3.3, 4.3], []],
  ["retention-sweep", [0.4, 1.4, 2.4], []],
  ["daily-summary", [0.45, 1.45, 4.45], [[2.45, "Supabase did not answer in time (cold start)"]]],
  ["rates-refresh", [3, 10], []],
  ["program-check", [8], [[1, "3 of 7 pages could not be read: fetch failed"]]],
];
for (const [job, oks, fails] of JOBS) {
  for (const d of oks) ins("rift_job_runs", { id: id("job"), job, ok: true, detail: null, started_at: ago(d), finished_at: new Date(Date.parse(ago(d)) + 40_000).toISOString() });
  for (const [d, detail] of fails) ins("rift_job_runs", { id: id("job"), job, ok: false, detail, started_at: ago(d), finished_at: new Date(Date.parse(ago(d)) + 60_000).toISOString() });
}

for (const [pct, d] of [[6.18, 3], [6.26, 10], [6.31, 17], [6.35, 24], [6.42, 31]]) {
  ins("rift_rate_snapshots", { id: id("rate"), rate_pct: pct, term_years: 30, product: "conventional-30-fixed", source: "Freddie Mac PMMS", source_url: "https://www.freddiemac.com/pmms", as_of: day(-d), created_at: ago(d) }, " on conflict (product, as_of) do nothing");
}

const DEMO_RULER = "Kaleb Befekadu (demo)";
for (const [key, value, d] of [["commissionPct", 2.5, 40], ["registryOwner", "Kaleb", 40], ["registryDays", 90, 25]]) {
  ins("rift_business_rules", { agent_id: AGENT, key, value: json(value), decided_at: ago(d), decided_by: DEMO_RULER, updated_at: ago(d) }, " on conflict (agent_id, key) do nothing");
}

const mark = (itemKey, kind, extra, daysAgo = 0.5) => ins("rift_desk_marks", {
  id: id("mark"), agent_id: AGENT, item_key: itemKey, kind, until_at: extra.until ?? null, person: extra.person ?? null, reason: extra.reason ?? null, by_name: KALEB, request_id: rid(), created_at: ago(daysAgo),
});
mark(`touch:${P.lena.id}`, "snooze", { until: ahead(2), person: KALEB, reason: "She is travelling until Thursday" });
mark(`work:${brb.tx}:repairs`, "pin", { until: ahead(3), reason: "The repair amendment decides whether this closes on time" });
mark(`agreement:${P.robert.id}`, "delegate", { person: "Jordan Lee (transaction coordinator)", reason: "Renewal paperwork" });

/* ------------------------------------------------------------------ */
/* Output                                                               */
/* ------------------------------------------------------------------ */

const DEMO = "like 'de30%'";
const del = (table, where = `id::text ${DEMO}`) => `delete from ${table} where ${where};`;
const header = [
  "-- Generated by scripts/local/seed-demo.mjs. LOCAL demo data only; see that file.",
  "\\set ON_ERROR_STOP on",
  "begin;",
  "set local lock_timeout = '5s';",
  "",
  "-- Out with the previous demo book. Only rows seeded by this script.",
  /* Contract dates first: deleting a document would otherwise try to update a
     date revision that cites it, and revisions are history. */
  del("rift_deadlines"),
  del("rift_offer_rooms", `lead_id::text ${DEMO}`),
  del("rift_outbox", `id::text ${DEMO} and replaces is not null`),
  del("rift_outbox"),
  del("rift_review_items"),
  del("rift_desk_marks"),
  del("rift_reconciliations"),
  del("rift_dependencies"),
  del("rift_journeys"),
  del("rift_offers"),
  del("rift_leads"),
  del("rift_consents"),
  del("rift_assessments"),
  del("rift_attributions", "session_id like 'demo-%'"),
  del("rift_events", "session_id like 'demo-%'"),
  del("rift_campaigns"),
  del("rift_job_runs"),
  del("rift_rate_snapshots"),
  del("rift_business_rules", `decided_by = '${DEMO_RULER}'`),
  /* Program checks and their reviews refuse deletes by trigger (they are the
     record of what an official page said). The demo ones are not a record of
     anything, so the triggers are bypassed for exactly those rows. */
  "set local session_replication_role = replica;",
  del("rift_program_reviews"),
  del("rift_program_checks"),
  "set local session_replication_role = origin;",
  "",
  "-- The demo book.",
];
const footer = [
  "commit;",
  "",
  "select 'demo book loaded' as status,",
  "  (select count(*) from rift_leads where id::text like 'de30%') as people,",
  "  (select count(*) from rift_journeys where id::text like 'de30%') as journeys,",
  "  (select count(*) from rift_transactions where id::text like 'de30%') as contracts;",
];

process.stdout.write([...header, ...out, ...footer].join("\n") + "\n");
process.stderr.write(`demo seed: ${Object.entries(counts).map(([t, n]) => `${t.replace("rift_", "")} ${n}`).join(", ")}\n`);
