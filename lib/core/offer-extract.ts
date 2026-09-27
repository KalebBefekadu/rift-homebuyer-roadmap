/**
 * Reading an offer PDF into the offer form (Blueprint v5 §5.9, DOC-02).
 *
 * The model reads the document and proposes a value for each box, with the
 * page it is on and the words it read. That is a CANDIDATE: the form fills
 * the box, marks it as read from the PDF, and the person checks it before
 * sending. Nothing read here is stored as a fact, and nothing reaches a
 * figure without a person pressing send on the form they could edit.
 *
 * A candidate that fails the same checks the form applies is dropped, not
 * repaired: an offer price of "$41,000" read from "$410,000" is exactly the
 * kind of confident wrong number a person skims past, and a blank box is
 * safer than a wrong one.
 *
 * Pure: no I/O. The call is lib/db/offer-read.ts.
 */

import { MIN_PRICE, MAX_PRICE, isFinancing } from "./offer-intake";

/** Bumped whenever the instructions or the schema change; stored with every call. */
export const PROMPT_VERSION = "offer-extract-2026-09-27";

export const FIELDS = ["address", "price", "earnest", "concessions", "financing", "financingOther", "closeOn", "dueDiligenceDays", "contingencies"] as const;
export type Field = (typeof FIELDS)[number];

export const INSTRUCTIONS = `You read a residential real estate offer for a property in Georgia, usually a Georgia Association of REALTORS Purchase and Sale Agreement (form F201) or an amendment to one. Fill in each field from what the document says.

For every field, report whether you found it, the value, the page number (1 is the first page of the PDF), and the exact words on the page you took it from. If a field is not in the document, or you are not sure, set found to false and leave value, quote empty and page 0. Never infer a value that is not written down, and never calculate one.

Fields:
- address: the property's street address, city, state and ZIP.
- price: the purchase price, digits only (410000).
- earnest: the earnest money amount, digits only.
- concessions: the amount the seller pays toward the buyer's closing costs (often "Seller's Contribution at Closing"), digits only. If it is written as a percentage, set found to false.
- financing: one of cash, conventional, fha, va, usda, other.
- financingOther: only when financing is other, what kind it is, in a few words.
- closeOn: the closing date as YYYY-MM-DD.
- dueDiligenceDays: the length of the due diligence period in days, digits only. If it is given as a date rather than a number of days, set found to false.
- contingencies: the contingencies the offer is subject to, as a comma-separated list using these words where they apply: Inspection, Appraisal, Financing, Sale of buyer's home, Survey.`;

const field = {
  type: "object",
  properties: {
    found: { type: "boolean" },
    value: { type: "string" },
    page: { type: "integer" },
    quote: { type: "string" },
  },
  required: ["found", "value", "page", "quote"],
  additionalProperties: false,
} as const;

/** The JSON schema the response is constrained to (structured outputs). */
export const SCHEMA = {
  type: "object",
  properties: Object.fromEntries(FIELDS.map((f) => [f, field])),
  required: [...FIELDS],
  additionalProperties: false,
} as const;

export interface Candidate {
  value: string;
  page: number;
  quote: string;
}
export type Candidates = Partial<Record<Field, Candidate>>;

const CONTINGENCIES = ["Inspection", "Appraisal", "Financing", "Sale of buyer's home", "Survey"];

const digits = (v: string) => {
  const n = Number(v.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : NaN;
};

/**
 * The model's answer, checked. Returns only the candidates that pass; the
 * rest are left for the person to type.
 */
export function readCandidates(raw: unknown, pages: number | null = null): Candidates {
  const out: Candidates = {};
  if (!raw || typeof raw !== "object") return out;
  const r = raw as Record<string, { found?: unknown; value?: unknown; page?: unknown; quote?: unknown }>;
  const price = digits(String(r.price?.value ?? ""));

  for (const f of FIELDS) {
    const c = r[f];
    if (!c || c.found !== true) continue;
    const value = String(c.value ?? "").trim();
    const page = Number(c.page);
    const quote = String(c.quote ?? "").trim().slice(0, 300);
    /* A candidate must say where it came from, or a person cannot check it. */
    if (!value || !quote || !Number.isInteger(page) || page < 1 || (pages !== null && page > pages)) continue;

    let v: string | null = value;
    switch (f) {
      case "address":
        v = value.length >= 6 && value.length <= 200 ? value : null; break;
      case "price":
        v = price >= MIN_PRICE && price <= MAX_PRICE ? String(Math.round(price)) : null; break;
      case "earnest":
      case "concessions": {
        const n = digits(value);
        /* Never more than the price: a figure larger than the whole offer
           was read from the wrong line. */
        v = Number.isFinite(n) && n >= 0 && (!Number.isFinite(price) || n <= price) ? String(Math.round(n)) : null;
        break;
      }
      case "financing":
        v = isFinancing(value.toLowerCase()) ? value.toLowerCase() : null; break;
      case "financingOther":
        v = r.financing?.value && String(r.financing.value).toLowerCase() === "other" && value.length <= 80 ? value : null; break;
      case "closeOn":
        v = /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) ? value : null; break;
      case "dueDiligenceDays": {
        const n = digits(value);
        v = Number.isInteger(n) && n >= 0 && n <= 60 ? String(n) : null;
        break;
      }
      case "contingencies": {
        const found = value.split(",").map((s) => s.trim()).filter((s) => CONTINGENCIES.includes(s));
        v = found.length ? [...new Set(found)].join(", ") : null;
        break;
      }
    }
    if (v !== null) out[f] = { value: v, page, quote };
  }
  return out;
}
