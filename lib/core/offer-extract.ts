/**
 * Reading an offer PDF into the offer form (Blueprint v5 §5.9, DOC-02).
 *
 * What the model returns is a list of CANDIDATES, each with the page it came
 * from and the exact words it was read from. Nothing here is a figure Rift
 * shows as its own: the candidates fill the boxes of a form the sender then
 * checks against their own document and confirms before anything is sent.
 * The reading of what the offer is worth to a seller is arithmetic on the
 * boxes, as it always was (rule 1: no number is produced by a model; this
 * one is read by a model and confirmed by a person).
 *
 * Every candidate is re-checked here as if a stranger typed it: a value
 * outside the form's own limits, a date that is not a date, a financing type
 * the form does not have, or a candidate with no page and no quote is
 * dropped, and the box is left for the sender. A wrong box the sender has to
 * notice is worse than an empty one they have to fill.
 *
 * Pure: no I/O.
 */

import {
  MAX_DUE_DILIGENCE_DAYS, MAX_PRICE, MIN_PRICE, OFFER_CONTINGENCIES, isFinancing,
} from "./offer-intake";
import type { Financing } from "./offers";

/** Bumped whenever the prompt or schema changes, and recorded with every call. */
export const EXTRACT_PROMPT_VERSION = "offer-extract-1";

export const EXTRACT_FIELDS = [
  "address", "price", "earnest", "concessions", "financing", "financingDetail",
  "dueDiligenceDays", "closeOn", "contingency",
] as const;
export type ExtractField = (typeof EXTRACT_FIELDS)[number];

export const EXTRACT_SYSTEM = `You read a residential purchase offer for a home in Georgia, USA, usually on the Georgia Association of Realtors Purchase and Sale Agreement form, and report the terms written in it.

Report only what the document states. Never infer, calculate, assume a default or fill a blank: if a term is missing, blank, crossed out without a replacement, or unreadable, leave it out. For every term you report, give the page number (the first page is 1) and quote the exact words from the document it came from, including the figure.

Terms:
- address: the property's street address, city, state and ZIP as written.
- price: the purchase price, as a whole number of US dollars with no symbols or commas.
- earnest: the earnest money amount, whole US dollars.
- concessions: the amount the seller pays at closing toward the buyer's costs (the seller's contribution), whole US dollars. Not a percentage: if only a percentage is given, leave it out.
- financing: one of cash, conventional, fha, va, usda, other.
- financingDetail: only when financing is other, what the financing is, in a few words.
- dueDiligenceDays: the length of the Due Diligence Period in days, as a whole number.
- closeOn: the closing date as YYYY-MM-DD.
- contingency: one entry per contingency the offer includes, each exactly one of: ${OFFER_CONTINGENCIES.join(", ")}.

Set readable to false if this is not a purchase offer or the document cannot be read.`;

export const EXTRACT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["readable", "found"],
  properties: {
    readable: { type: "boolean" },
    found: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["field", "value", "page", "quote"],
        properties: {
          field: { type: "string", enum: [...EXTRACT_FIELDS] },
          value: { type: "string" },
          page: { type: "integer" },
          quote: { type: "string" },
        },
      },
    },
  },
} as const;

export interface Source { page: number; quote: string }

export interface Extracted {
  address?: string;
  price?: number;
  earnest?: number;
  concessions?: number;
  financing?: Financing;
  financingDetail?: string;
  dueDiligenceDays?: number;
  closeOn?: string;
  contingencies?: string[];
  /** Where each filled box came from, for the sender to check. */
  sources: Partial<Record<Exclude<ExtractField, "contingency"> | "contingencies", Source>>;
  /** Candidates that did not survive the checks. Counted, never shown as values. */
  dropped: number;
}

const dollars = (v: string) => {
  const t = v.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(Number(t));
};

/** Candidates as the model returned them, checked one by one. */
export function acceptCandidates(raw: unknown): Extracted {
  const out: Extracted = { sources: {}, dropped: 0 };
  const body = (raw ?? {}) as { readable?: unknown; found?: unknown };
  const found = Array.isArray(body.found) ? body.found.slice(0, 40) : [];

  for (const c of found as Record<string, unknown>[]) {
    const field = String(c?.field ?? "") as ExtractField;
    const value = typeof c?.value === "string" ? c.value.trim() : "";
    const page = Number(c?.page);
    const quote = typeof c?.quote === "string" ? c.quote.trim().slice(0, 300) : "";
    const src = { page, quote };
    /* No source, no value: the sender must be able to find it in their PDF. */
    if (!EXTRACT_FIELDS.includes(field) || !value || !Number.isInteger(page) || page < 1 || page > 200 || quote.length < 2) {
      out.dropped++; continue;
    }

    const once = (k: keyof Extracted["sources"]) => out.sources[k] === undefined;
    let ok = false;
    switch (field) {
      case "address":
        if (once("address") && value.length >= 6 && value.length <= 200) { out.address = value; out.sources.address = src; ok = true; }
        break;
      case "price": {
        const n = dollars(value);
        if (once("price") && n !== null && n >= MIN_PRICE && n <= MAX_PRICE) { out.price = n; out.sources.price = src; ok = true; }
        break;
      }
      case "earnest":
      case "concessions": {
        const n = dollars(value);
        if (once(field) && n !== null && n >= 0 && n <= MAX_PRICE) { out[field] = n; out.sources[field] = src; ok = true; }
        break;
      }
      case "financing": {
        const f = value.toLowerCase();
        if (once("financing") && isFinancing(f)) { out.financing = f; out.sources.financing = src; ok = true; }
        break;
      }
      case "financingDetail":
        if (once("financingDetail") && value.length >= 2 && value.length <= 120) { out.financingDetail = value; out.sources.financingDetail = src; ok = true; }
        break;
      case "dueDiligenceDays": {
        const n = Number(value);
        if (once("dueDiligenceDays") && Number.isInteger(n) && n >= 0 && n <= MAX_DUE_DILIGENCE_DAYS) { out.dueDiligenceDays = n; out.sources.dueDiligenceDays = src; ok = true; }
        break;
      }
      case "closeOn":
        if (once("closeOn") && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`))
          && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value) {
          out.closeOn = value; out.sources.closeOn = src; ok = true;
        }
        break;
      case "contingency": {
        const match = OFFER_CONTINGENCIES.find((x) => x.toLowerCase() === value.toLowerCase());
        if (match) {
          out.contingencies = [...new Set([...(out.contingencies ?? []), match])];
          out.sources.contingencies ??= src;
          ok = true;
        }
        break;
      }
    }
    if (!ok) out.dropped++;
  }
  /* Detail without "other" means nothing to the form, which drops it too. */
  if (out.financing !== "other") { delete out.financingDetail; delete out.sources.financingDetail; }
  return out;
}

/** Whether the model said this was an offer it could read. */
export const readableFrom = (raw: unknown) => (raw as { readable?: unknown } | null)?.readable === true;

/** A PDF, by its first bytes: the file name and type header are the sender's to set. */
export function isPdf(bytes: Uint8Array): boolean {
  return bytes.length > 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
}

export const MAX_PDF_BYTES = 8 * 1024 * 1024;
