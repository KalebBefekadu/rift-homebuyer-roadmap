/**
 * A buyer's offer on one home, from strategy to the other side's answer
 * (blueprint v4 W08; journey contracts B08 to B10; REQ-DEC-01 to 03).
 *
 * Called a "bid" in code because lib/core/offers.ts is the seller's side:
 * offers received and compared. On screen it is "your offer".
 *
 * An offer is a list of steps, one row each and never edited, like a
 * showing. The current state is the latest step:
 *
 *   terms      a version of the terms: ours (a proposal, or our counter) or
 *              theirs (a counter received). Every change is a new version.
 *   ask        the agent asks the household how to proceed on the CURRENT
 *              version. The people whose say is needed are fixed at that
 *              moment.
 *   prepared   the offer is drafted on the licensed forms, in Remine.
 *   signed     the buyers signed it, in Remine.
 *   submitted  it was delivered to the listing side, and how.
 *   accepted / rejected / expired / withdrawn   how it ended.
 *
 * Three rules make the record worth trusting:
 *
 *   AN ANSWER BELONGS TO ONE VERSION (AT22). A response names the version it
 *     answers; once a counter makes a new version, the old answers stop
 *     counting, and are kept.
 *   NOBODY ANSWERS FOR THE HOUSEHOLD (AT23). Every person whose say is needed
 *     must say go ahead. One yes and one no is a disagreement, left for the
 *     people involved to settle, never resolved by whoever clicked first.
 *   GO AHEAD IS AN INSTRUCTION, NOT A SIGNATURE (AT24). It lets the agent
 *     prepare the forms. Drafted, signed, submitted and accepted are separate
 *     steps with their own evidence, and even "accepted" is not a contract:
 *     that is recorded under Where it stands, from the executed agreement.
 *
 * Money is in whole dollars, like the rest of the buyer's numbers. Nothing
 * here estimates closing costs; the effects below are only arithmetic on the
 * terms themselves.
 *
 * Pure, like every rule in lib/core.
 */

export type BidFinancing = "conventional" | "fha" | "va" | "usda" | "cash" | "other";
export const BID_FINANCING: BidFinancing[] = ["conventional", "fha", "va", "usda", "cash", "other"];
export const BID_FINANCING_LABEL: Record<BidFinancing, string> = {
  conventional: "Conventional loan", fha: "FHA loan", va: "VA loan", usda: "USDA loan", cash: "Cash", other: "Other",
};

export interface Terms {
  price: number;
  earnestMoney: number;
  financing: BidFinancing;
  /** Percent of the price paid down. Ignored for cash. */
  downPct: number | null;
  /** Money asked back from the seller at closing. */
  concessions: number;
  /** Due diligence (inspection) period, in days. Null when there is none. */
  dueDiligenceDays: number | null;
  financingContingency: boolean;
  appraisalContingency: boolean;
  /** YYYY-MM-DD, or null while open. */
  closingDate: string | null;
  /** When the offer stops being open, and where that date comes from. */
  respondBy: string | null;
  respondBySource: string | null;
  /** Anything else, in words. */
  other: string | null;
}

export const EMPTY_TERMS: Terms = {
  price: 0, earnestMoney: 0, financing: "conventional", downPct: 20, concessions: 0,
  dueDiligenceDays: 10, financingContingency: true, appraisalContingency: true,
  closingDate: null, respondBy: null, respondBySource: null, other: null,
};

const MAX_PRICE = 50_000_000;
export const OTHER_MAX = 1000;
export const NOTE_MAX = 500;
export const EVIDENCE_MAX = 300;

const whole = (n: unknown) => typeof n === "number" && Number.isInteger(n) && n >= 0;

/** Why these terms cannot be recorded, or null. */
export function termsError(t: Terms): string | null {
  if (!whole(t.price) || t.price <= 0 || t.price > MAX_PRICE) return "Give the price in whole dollars";
  if (!whole(t.earnestMoney) || t.earnestMoney > t.price) return "Earnest money must be whole dollars, no more than the price";
  if (!BID_FINANCING.includes(t.financing)) return "Choose how it is paid for";
  if (t.financing !== "cash") {
    if (t.downPct === null || typeof t.downPct !== "number" || t.downPct < 0 || t.downPct > 100) return "Give the down payment as a percent of the price";
  }
  if (!whole(t.concessions) || t.concessions >= t.price) return "Seller concessions must be whole dollars, less than the price";
  if (t.dueDiligenceDays !== null && (!whole(t.dueDiligenceDays) || t.dueDiligenceDays > 90)) return "The due diligence period is a number of days, 90 at most";
  if (t.financing === "cash" && t.financingContingency) return "A cash offer has no financing contingency";
  if (t.closingDate && !isDay(t.closingDate)) return "That closing date could not be read";
  if (t.respondBy) {
    if (Number.isNaN(Date.parse(t.respondBy))) return "That response deadline could not be read";
    if (!t.respondBySource?.trim()) return "Say where the response deadline comes from, like \"Offer paragraph 12\"";
  }
  if (t.other && t.other.length > OTHER_MAX) return `Keep the other terms under ${OTHER_MAX} characters`;
  return null;
}

const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

export interface TermsEffects {
  downPayment: number;
  loanAmount: number;
  /** The price less what is asked back. Not the seller's net: their costs are theirs. */
  priceAfterConcessions: number;
  /** Known cash, and when. Closing costs are not estimated here. */
  cashAtContract: number;
  cashAtClosingBeforeCosts: number;
}

/** Arithmetic on the terms, nothing more. The same numbers on both screens. */
export function termsEffects(t: Terms): TermsEffects {
  const downPayment = t.financing === "cash" ? t.price : Math.round((t.price * (t.downPct ?? 0)) / 100);
  return {
    downPayment,
    loanAmount: t.price - downPayment,
    priceAfterConcessions: t.price - t.concessions,
    cashAtContract: t.earnestMoney,
    /* Earnest money is applied at closing, so it is not paid twice. */
    cashAtClosingBeforeCosts: Math.max(0, downPayment - t.earnestMoney - t.concessions),
  };
}

export interface TermsChange { field: keyof Terms; label: string; before: string; after: string }

const TERM_LABEL: Record<keyof Terms, string> = {
  price: "Price", earnestMoney: "Earnest money", financing: "Paying by", downPct: "Down payment",
  concessions: "Seller concessions", dueDiligenceDays: "Due diligence period",
  financingContingency: "Financing contingency", appraisalContingency: "Appraisal contingency",
  closingDate: "Closing date", respondBy: "Respond by", respondBySource: "Deadline source", other: "Other terms",
};

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function termText(field: keyof Terms, t: Terms): string {
  const v = t[field];
  switch (field) {
    case "price": case "earnestMoney": case "concessions": return usd(v as number);
    case "financing": return BID_FINANCING_LABEL[t.financing];
    case "downPct": return t.financing === "cash" ? "All cash" : `${t.downPct}%`;
    case "dueDiligenceDays": return t.dueDiligenceDays === null ? "None" : `${t.dueDiligenceDays} days`;
    case "financingContingency": case "appraisalContingency": return v ? "Yes" : "No";
    default: return (v as string | null) ?? "Not set";
  }
}

/** What changed from one version to the next, in words, so nobody has to compare two lists. */
export function termsDiff(before: Terms | null, after: Terms): TermsChange[] {
  if (!before) return [];
  return (Object.keys(TERM_LABEL) as (keyof Terms)[])
    .filter((f) => f !== "respondBySource" && termText(f, before) !== termText(f, after))
    .map((f) => ({ field: f, label: TERM_LABEL[f], before: termText(f, before), after: termText(f, after) }));
}

/* ------------------------------------------------------------------ *
 * Steps and state
 * ------------------------------------------------------------------ */

export type StepKind = "terms" | "ask" | "prepared" | "signed" | "submitted" | "accepted" | "rejected" | "expired" | "withdrawn";
export const STEP_KINDS: StepKind[] = ["terms", "ask", "prepared", "signed", "submitted", "accepted", "rejected", "expired", "withdrawn"];

export interface BidStep {
  seq: number;
  kind: StepKind;
  /** The terms version this step is about. A "terms" step makes a new one. */
  version: number;
  terms: Terms | null;
  origin: "ours" | "theirs" | null;
  /** For "ask": the members whose say is needed, fixed when asked. */
  required: { memberId: string; name: string }[];
  documentIds: string[];
  /** Evidence or a note: how it was delivered, why it was withdrawn. */
  note: string | null;
  by: string;
  at: string;
}

export type Instruction = "proceed" | "change" | "stop";
export const INSTRUCTION_LABEL: Record<Instruction, string> = {
  proceed: "Go ahead with these terms",
  change: "Change something first",
  stop: "Do not make this offer",
};

export interface BidResponse {
  memberId: string;
  name: string;
  version: number;
  instruction: Instruction;
  note: string | null;
  /** Set when the agent recorded it from a call or a message, and how. */
  toldAgent: string | null;
  at: string;
}

export type BidStatus =
  | "drafting" | "countered" | "awaiting" | "instructed" | "disagreement" | "changes" | "stopped"
  | "prepared" | "signed" | "submitted" | "accepted" | "rejected" | "expired" | "withdrawn";

export const BID_STATUS_LABEL: Record<BidStatus, string> = {
  drafting: "Terms drafted",
  countered: "Counter received",
  awaiting: "Waiting for the household",
  instructed: "Household said go ahead",
  disagreement: "Household disagrees",
  changes: "Changes asked for",
  stopped: "Household said stop",
  prepared: "Prepared in Remine",
  signed: "Signed",
  submitted: "Submitted",
  accepted: "Accepted, contract not recorded yet",
  rejected: "Rejected",
  expired: "Expired",
  withdrawn: "Withdrawn",
};

export const FINAL: BidStatus[] = ["accepted", "rejected", "expired", "withdrawn"];

export interface Resolution {
  state: "waiting" | "agreed" | "disagree" | "change" | "stop";
  /** Everyone whose say is needed and has not given it on this version. */
  waitingOn: string[];
  /** The latest answer of each person on this version. */
  answers: BidResponse[];
}

/**
 * Where the household stands on one version. Each person's LATEST answer on
 * THIS version counts; answers on other versions never do (AT22). Agreed
 * needs every required person to have said go ahead (AT23).
 */
export function resolve(required: { memberId: string; name: string }[], responses: BidResponse[], version: number): Resolution {
  const latest = new Map<string, BidResponse>();
  for (const r of [...responses].filter((x) => x.version === version).sort((a, b) => a.at.localeCompare(b.at))) {
    latest.set(r.memberId, r);
  }
  const answers = required.map((m) => latest.get(m.memberId)).filter((x): x is BidResponse => !!x);
  const waitingOn = required.filter((m) => !latest.has(m.memberId)).map((m) => m.name);
  const said = new Set(answers.map((a) => a.instruction));
  if (!required.length) return { state: "waiting", waitingOn, answers };
  if (said.has("proceed") && (said.has("stop") || said.has("change"))) return { state: "disagree", waitingOn, answers };
  if (said.has("stop")) return { state: "stop", waitingOn, answers };
  if (said.has("change")) return { state: "change", waitingOn, answers };
  if (!waitingOn.length) return { state: "agreed", waitingOn, answers };
  return { state: "waiting", waitingOn, answers };
}

export interface BidView {
  status: BidStatus;
  /** The current version of the terms. */
  version: number;
  terms: Terms | null;
  /** Who proposed the current version. */
  origin: "ours" | "theirs" | null;
  /** Set once the current version has been put to the household. */
  asked: { required: { memberId: string; name: string }[]; resolution: Resolution } | null;
  changes: TermsChange[];
  nextStep: string;
  final: boolean;
}

const RES_STATUS: Record<Resolution["state"], BidStatus> = {
  waiting: "awaiting", agreed: "instructed", disagree: "disagreement", change: "changes", stop: "stopped",
};

export function bidView(steps: BidStep[], responses: BidResponse[], agentFirst: string): BidView {
  const ordered = [...steps].sort((a, b) => a.seq - b.seq);
  const termsSteps = ordered.filter((s) => s.kind === "terms");
  const current = termsSteps[termsSteps.length - 1] ?? null;
  const previous = termsSteps[termsSteps.length - 2] ?? null;
  const version = current?.version ?? 0;
  const latest = ordered[ordered.length - 1];
  const ask = [...ordered].reverse().find((s) => s.kind === "ask" && s.version === version) ?? null;
  const asked = ask ? { required: ask.required, resolution: resolve(ask.required, responses, version) } : null;

  let status: BidStatus;
  if (!latest) status = "drafting";
  else if (latest.kind === "terms") status = latest.origin === "theirs" ? "countered" : "drafting";
  else if (latest.kind === "ask") status = RES_STATUS[asked!.resolution.state];
  else status = latest.kind as BidStatus;

  const nextStep = NEXT_STEP[status](agentFirst, asked?.resolution.waitingOn ?? []);
  return {
    status, version, terms: current?.terms ?? null, origin: current?.origin ?? null, asked,
    changes: current && previous ? termsDiff(previous.terms, current.terms!) : [],
    nextStep, final: FINAL.includes(status),
  };
}

const list = (names: string[]) => (names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0] ?? "");

const NEXT_STEP: Record<BidStatus, (agent: string, waiting: string[]) => string> = {
  drafting: () => "Ask the household how to proceed on these terms.",
  countered: () => "Ask the household how to answer the counter.",
  awaiting: (_, w) => (w.length ? `Waiting for ${list(w)}.` : "Waiting for the household."),
  instructed: () => "Prepare it on the forms in Remine, then record that you did.",
  disagreement: () => "They do not agree. Talk it through with them; nothing goes ahead until they do.",
  changes: () => "Change the terms as asked, then ask again.",
  stopped: () => "They said not to make this offer. Withdraw it, or change the terms and ask again.",
  prepared: () => "Get it signed in Remine, then record that it was.",
  signed: () => "Deliver it to the listing side, then record how.",
  submitted: () => "Waiting for the listing side. Record their answer when it comes.",
  accepted: () => "Accepted is not a contract. Record the executed contract under Where it stands.",
  rejected: () => "Finished. The offer and its versions stay on file.",
  expired: () => "Finished. The offer and its versions stay on file.",
  withdrawn: () => "Finished. The offer and its versions stay on file.",
};

/** What the agent can record next, from each status. */
export const NEXT: Record<BidStatus, StepKind[]> = {
  drafting: ["terms", "ask", "withdrawn"],
  countered: ["terms", "ask", "withdrawn", "rejected", "expired"],
  awaiting: ["terms", "withdrawn"],
  instructed: ["terms", "prepared", "withdrawn"],
  disagreement: ["terms", "withdrawn"],
  changes: ["terms", "withdrawn"],
  stopped: ["terms", "withdrawn"],
  prepared: ["terms", "signed", "withdrawn"],
  signed: ["submitted", "withdrawn"],
  submitted: ["terms", "accepted", "rejected", "expired", "withdrawn"],
  accepted: [],
  rejected: [],
  expired: [],
  withdrawn: [],
};

export interface StepInput {
  kind: StepKind;
  terms?: Terms | null;
  /** For "terms": ours, or theirs (a counter received). */
  origin?: "ours" | "theirs";
  note?: string | null;
  documentIds?: string[];
}

export interface BidContext {
  covered: boolean;
  coverageNote: string;
  homeWithdrawn: boolean;
  /** Members who can answer (buyer and co-buyer roles, active). */
  deciders: number;
}

const EVIDENCE: Partial<Record<StepKind, string>> = {
  signed: "Say what shows it was signed, like \"Signed by both in Remine, 3:40 PM\"",
  submitted: "Say how it was delivered, like \"Emailed to the listing agent at 4:05 PM\"",
  accepted: "Say what shows it was accepted, like \"Seller signed acceptance, received 6:10 PM\"",
  rejected: "Say what the listing side said",
  expired: "Say when it expired and what showed it",
  withdrawn: "Say why it was withdrawn",
};

/**
 * Why a step may not be recorded, or null.
 *
 * Going toward a contract (asking, preparing, signing, submitting) needs a
 * signed buyer agreement in force and the home still on the list. Recording
 * what the other side did, or withdrawing, never does. A counter from them
 * is only recordable once ours was submitted.
 */
export function bidStepError(view: BidView, input: StepInput, ctx: BidContext): string | null {
  if (!STEP_KINDS.includes(input.kind)) return "That is not a step an offer can take";
  if (view.final) return "This offer is finished. Start a new one instead";
  if (!NEXT[view.status].includes(input.kind)) {
    return `An offer that is "${BID_STATUS_LABEL[view.status].toLowerCase()}" cannot be ${input.kind === "terms" ? "given new terms" : `marked ${input.kind}`} yet`;
  }
  const toward = input.kind === "ask" || input.kind === "prepared" || input.kind === "signed" || input.kind === "submitted"
    || (input.kind === "terms" && input.origin !== "theirs");
  if (toward && ctx.homeWithdrawn) return "That home is off the list. Withdraw this offer instead";
  if (toward && !ctx.covered) return `No offer can go ahead without a signed buyer agreement in force. ${ctx.coverageNote}`;
  if (input.kind === "terms") {
    if (!input.terms) return "Give the terms";
    if (input.origin === "theirs" && view.status !== "submitted") return "A counter comes after our offer was submitted";
    const bad = termsError(input.terms);
    if (bad) return bad;
  }
  if (input.kind === "ask" && ctx.deciders === 0) {
    return "Nobody in the household can answer yet. Add the buyer under Household first; you can then record what they tell you by phone";
  }
  const needs = EVIDENCE[input.kind];
  if (needs && !input.note?.trim()) return needs;
  if (input.note && input.note.length > NOTE_MAX) return `Keep it under ${NOTE_MAX} characters`;
  return null;
}

/** Why a member's answer cannot be taken, or null. The version must be the one being asked about now. */
export function responseError(view: BidView, memberId: string, version: number, instruction: Instruction, note: string | null): string | null {
  if (!["proceed", "change", "stop"].includes(instruction)) return "Choose an answer";
  if (!view.asked || view.status === "prepared" || view.status === "signed" || view.status === "submitted" || view.final) {
    return "Nothing is waiting for your answer on this offer";
  }
  if (version !== view.version) return "These terms have changed since you opened the page. Look at the new version first";
  if (!view.asked.required.some((m) => m.memberId === memberId)) return "Your answer is not one this offer was waiting for";
  if (instruction !== "proceed" && !note?.trim()) return "Say what should change, or why not";
  if (note && note.length > NOTE_MAX) return `Keep it under ${NOTE_MAX} characters`;
  return null;
}

/**
 * How an offer reads on the buyer's page. Accepted is never called a
 * contract; a finished offer says so without judging it.
 */
export function buyerBidLine(view: BidView, agentFirst: string): string {
  switch (view.status) {
    case "drafting": return `${agentFirst} is drafting terms.`;
    case "countered": return `The listing side answered. ${agentFirst} will go over their counter with you.`;
    case "awaiting": return `${agentFirst} is asking how to proceed on version ${view.version}.`;
    case "instructed": return `Everyone said go ahead. ${agentFirst} will prepare it on the official forms; nothing is signed or sent yet.`;
    case "disagreement": return `Your household does not agree yet. ${agentFirst} will not go ahead until you do.`;
    case "changes": return `${agentFirst} has your answers and will change the terms.`;
    case "stopped": return `${agentFirst} has your answers and will not make this offer as it is.`;
    case "prepared": return "Prepared on the official forms. Waiting for signatures.";
    case "signed": return "Signed. Not yet delivered to the listing side.";
    case "submitted": return "Delivered to the listing side. Waiting for their answer.";
    case "accepted": return `Accepted by the seller. It becomes a contract once ${agentFirst} confirms the signed agreement.`;
    case "rejected": return "Not accepted.";
    case "expired": return "Expired without an answer.";
    case "withdrawn": return "Withdrawn.";
  }
}

/** An offer as a household member may see it (lib/db/client.ts `clientBids`). */
export interface BuyerBid {
  id: string;
  address: string;
  status: BidStatus;
  line: string;
  /** The latest version the agent asked the household about. Drafts are never shown. */
  asked: {
    version: number;
    terms: Terms;
    effects: TermsEffects;
    changes: TermsChange[];
    fromThem: boolean;
    documents: { id: string; label: string; family: string }[];
    answers: { name: string; instruction: Instruction; note: string | null; mine: boolean }[];
    waitingOn: string[];
    /** Answers are being taken on this version now. */
    open: boolean;
    myAnswer: Instruction | null;
    /** My say was asked for on this version. */
    mineNeeded: boolean;
  } | null;
  /** The agent is working on a version the household has not been asked about. */
  newerDraft: boolean;
  /** Every document on a version the household was asked about, current or earlier. */
  sharedDocumentIds: string[];
}
