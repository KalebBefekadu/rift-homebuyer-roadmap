import { GA_TRANSFER_TAX_RATE } from "./compute";
import { gapsIn, type Financing, type Offer } from "./offers";
import { isUuid } from "./ids";

/**
 * An offer submitted from outside, by somebody with no account.
 *
 * `docs/vision.md` names Rift Offer as a lead-generation channel that works
 * fully without an account, and `docs/benchmark.md` tracks "offer-sourced
 * relationships" at two a month. The shipped product could compare offers
 * inside Studio and had no way for anybody to submit one, so that channel
 * produced nothing at all.
 *
 * WHAT A SUBMITTER GETS, AND WHY IT IS NOT THE SELLER'S NET.
 *
 * The obvious thing to show is what the seller walks away with. It cannot be
 * shown: that needs the seller's mortgage payoff and their commission rate,
 * and neither is a submitting agent's business. Printing a net against an
 * assumed payoff would be arithmetically perfect and wrong by the size of
 * somebody's mortgage.
 *
 * What CAN be computed without knowing either is more useful anyway, because
 * it is the thing that actually decides whether an offer wins.
 *
 * A dollar asked back is not a dollar off the price. Commission and transfer
 * tax are charged on the headline, so a seller giving back $8,000 in
 * concessions loses $8,000 flat, while dropping the price by $8,000 costs them
 * only what is left after the percentage-based costs come off it. The ratio is
 * 1/(1 − k) where k is commission plus transfer tax: at a 6% commission in
 * Georgia, about $1.06 of price for every $1 asked back.
 *
 * So the same offer, restated as a clean price, is a lower number than its
 * author thinks. A buyer's agent who knows that can write an offer that reads
 * better to the seller and costs their client the same or less, which is a
 * genuinely valuable thing to hand somebody for free before asking them
 * anything.
 *
 * The commission rate is an ASSUMPTION and is carried as one. It is the
 * seller's private arrangement, this product does not know it, and the figure
 * is labelled and adjustable rather than quietly baked in.
 */

/** The commission this arithmetic assumes when nobody has said otherwise. */
export const ASSUMED_COMMISSION_PCT = 6;
export const MIN_COMMISSION_PCT = 0;
export const MAX_COMMISSION_PCT = 10;

export const MIN_PRICE = 10_000;
export const MAX_PRICE = 100_000_000;

/**
 * The largest offer PDF the page will send to be read.
 *
 * Set by the host, not by us. The route said 10 MB, but Vercel refuses a
 * request body over about 4.5 MB before the route ever runs, so a 6 MB file
 * got the platform's error page instead of our sentence and the promise of
 * 10 MB was never true. 4 MB leaves room for the multipart wrapping. The
 * form checks it before sending and the route checks it again.
 */
export const MAX_OFFER_PDF_BYTES = 4 * 1024 * 1024;
export const MAX_OFFER_PDF_SAY =
  "That file is over 4 MB, which is the most we can read. Fill in the boxes instead, or save a smaller copy of the PDF and try again.";

export interface Submission {
  address: string;
  price: number;
  concessions: number;
  repairCredit: number;
  earnest: number;
  financing: Financing;
  /** What "other" financing is. Required when financing is other (§5.9). */
  financingOther: string | null;
  closeOn: string | null;
  /** The due diligence period, in days (§5.9). */
  dueDiligenceDays: number | null;
  /** The uploaded PDF, waiting to be attached (lib/db/offer-read.ts). */
  documentToken: string | null;
  contingencies: string[];
  preapproval: boolean;
  proofOfFunds: boolean;
  /** Who is making it, as the seller would read it. */
  from: string;
  email: string;
  phone: string;
  firm: string | null;
  note: string | null;
  /** "self": the buyer. "buyer": a real estate agent representing the buyer. Always said, never assumed. */
  representing: "self" | "buyer";
}

export interface Reading {
  askedBack: number;
  /** Commission and transfer tax on the headline, at the stated assumption. */
  proportionalCosts: number;
  /**
   * The clean price (nothing asked back) that leaves the seller exactly
   * where this offer does. Lower than the headline whenever anything is asked
   * back, and that difference is the whole point of the page.
   */
  equivalentCleanPrice: number;
  /** What the headline overstates by, in the seller's terms. */
  headlineOverstatesBy: number;
  /** Dollars of price each dollar asked back is worth. */
  costPerDollarBack: number;
  /** Facts about the paperwork. Never a judgement about the offer. */
  gaps: string[];
  commissionPct: number;
}

const clampNumber = (v: unknown, lo: number, hi: number, fallback: number) => {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, n));
};

const FINANCINGS: Financing[] = ["cash", "conventional", "fha", "va", "usda", "other"];

export const isFinancing = (v: unknown): v is Financing =>
  FINANCINGS.includes(v as Financing);

/**
 * Read the submission, refusing rather than repairing.
 *
 * A price of zero, a missing address or an unparseable email are not things to
 * guess at: an offer is a document somebody may act on, and a submission
 * silently corrected into something the sender did not write is worse than one
 * refused with a reason.
 */
export type SubmissionField =
  | "address" | "price" | "from" | "email" | "financing" | "financingOther"
  | "representing" | "phone" | "dueDiligenceDays" | "closeOn";
export type FieldErrors = Partial<Record<SubmissionField, string>>;

export function readSubmission(raw: Record<string, unknown>): { ok: true; value: Submission } | { ok: false; errors: string[]; fields: FieldErrors } {
  const errors: string[] = [];
  /* Each refusal also keyed to its box, so the form can put the message under
     the box itself (manual review WS8.4). The first message per box wins. */
  const fields: FieldErrors = {};
  const bad = (f: SubmissionField, msg: string) => { errors.push(msg); fields[f] ??= msg; };

  const address = String(raw.address ?? "").trim();
  if (address.length < 6) bad("address", "A property address is needed: street, city and state.");
  if (address.length > 200) bad("address", "That address is too long to be one.");

  const price = Number(raw.price);
  if (!Number.isFinite(price) || price < MIN_PRICE || price > MAX_PRICE) {
    bad("price", "An offer price is needed, and it has to be a plausible one.");
  }

  const from = String(raw.from ?? "").trim();
  if (from.length < 2 || from.length > 120) bad("from", "A name is needed, the one the seller should see.");

  const email = String(raw.email ?? "").trim().toLowerCase();
  /* Deliberately loose. The only thing worth rejecting here is something that
     cannot be an address at all; a stricter pattern turns valid addresses away
     and the confirmation is what proves it, not a regex. */
  if (!/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(email) || email.length > 200) {
    bad("email", "An email address is needed so somebody can reply to this.");
  }

  const financing = isFinancing(raw.financing) ? raw.financing : null;
  if (!financing) bad("financing", "Say how this is being financed.");
  const financingOther = String(raw.financingOther ?? "").trim();
  if (financing === "other" && (financingOther.length < 2 || financingOther.length > 80)) {
    bad("financingOther", "Say what kind of financing \"other\" is.");
  }

  /* Blueprint v5 §5.9: sending is the point of the page, so who is sending
     it and how to reach them by phone are required, not optional. */
  const representing = raw.representing === "self" || raw.representing === "buyer" ? raw.representing : null;
  if (!representing) bad("representing", "Say whether you are the buyer or a real estate agent.");
  const phone = String(raw.phone ?? "").trim();
  if (phone.replace(/\D/g, "").length < 10 || phone.length > 40) bad("phone", "A phone number is needed, with its area code.");

  const ddRaw = String(raw.dueDiligenceDays ?? "").trim();
  const dueDiligenceDays = ddRaw === "" ? null : Number(ddRaw);
  if (dueDiligenceDays !== null && (!Number.isInteger(dueDiligenceDays) || dueDiligenceDays < 0 || dueDiligenceDays > 60)) {
    bad("dueDiligenceDays", "Due diligence is a number of days, from 0 to 60.");
  }

  const closeOnRaw = String(raw.closeOn ?? "").trim();
  const closeOn = /^\d{4}-\d{2}-\d{2}$/.test(closeOnRaw) ? closeOnRaw : null;
  if (closeOnRaw && !closeOn) bad("closeOn", "A closing date has to be a calendar date.");

  if (errors.length) return { ok: false, errors, fields };

  const contingencies = (Array.isArray(raw.contingencies) ? raw.contingencies : [])
    .map((c) => String(c).trim())
    .filter((c) => c.length > 0 && c.length <= 80)
    .slice(0, 12);

  const trimmed = (v: unknown, max: number) => {
    const s = String(v ?? "").trim();
    return s ? s.slice(0, max) : null;
  };

  return {
    ok: true,
    value: {
      address, price: Math.round(price),
      concessions: Math.round(clampNumber(raw.concessions, 0, price, 0)),
      repairCredit: Math.round(clampNumber(raw.repairCredit, 0, price, 0)),
      earnest: Math.round(clampNumber(raw.earnest, 0, price, 0)),
      financing: financing!,
      financingOther: financing === "other" ? financingOther : null,
      closeOn,
      dueDiligenceDays,
      documentToken: isUuid(String(raw.documentToken ?? "")) ? String(raw.documentToken) : null,
      contingencies,
      preapproval: raw.preapproval === true,
      proofOfFunds: raw.proofOfFunds === true,
      from, email,
      phone: phone.slice(0, 40),
      firm: trimmed(raw.firm, 120),
      note: trimmed(raw.note, 2000),
      representing: representing!,
    },
  };
}

/** The submission as the offer engine sees it, so both use one shape. */
export function asOffer(s: Submission): Offer {
  return {
    id: "submitted",
    from: s.from,
    price: s.price,
    concessions: s.concessions,
    repairCredit: s.repairCredit,
    financing: s.financing,
    earnest: s.earnest,
    closeOn: s.closeOn,
    contingencies: s.contingencies,
    preapproval: s.preapproval,
    proofOfFunds: s.proofOfFunds,
    releasedAt: null,
    note: s.note,
  } as Offer;
}

/**
 * What this offer is actually worth to a seller, without knowing their payoff.
 *
 * The payoff is the same constant under every offer on the same house, so it
 * cancels out of every comparison, which is why this can say something true
 * while knowing nothing private.
 */
export function read(s: Submission, commissionPct = ASSUMED_COMMISSION_PCT): Reading {
  const pct = Math.min(MAX_COMMISSION_PCT, Math.max(MIN_COMMISSION_PCT, commissionPct));
  const k = pct / 100 + GA_TRANSFER_TAX_RATE;

  const askedBack = s.concessions + s.repairCredit;
  const proportionalCosts = s.price * k;

  /* P(1 − k) = price(1 − k) − askedBack, solved for P. `k` cannot reach 1:
     it is capped at 10% commission plus 0.1% transfer tax, so this cannot
     divide by zero however the assumption is set. */
  const costPerDollarBack = 1 / (1 - k);
  const equivalentCleanPrice = Math.round(s.price - askedBack * costPerDollarBack);

  return {
    askedBack,
    proportionalCosts: Math.round(proportionalCosts),
    equivalentCleanPrice,
    headlineOverstatesBy: s.price - equivalentCleanPrice,
    costPerDollarBack: Math.round(costPerDollarBack * 1000) / 1000,
    gaps: gapsIn(asOffer(s)),
    commissionPct: pct,
  };
}

