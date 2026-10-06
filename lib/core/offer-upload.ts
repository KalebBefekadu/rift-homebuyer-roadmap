/**
 * Who is uploading an offer PDF, asked before the file (manual review WS8.2).
 *
 * The upload is the delivery: the moment the PDF is stored, Kaleb has it,
 * whether or not the sender ever finishes the form below it. An offer nobody
 * can be called about is one he cannot answer, so the upload asks for a name
 * and a phone number first. Email is optional here; the form still asks for
 * it before Send.
 *
 * Pure, so the page can say what is missing before anything is sent, and the
 * route refuses exactly what the page refuses.
 */

/** The most PDFs one offer carries: the offer and its addenda (WS8.3). */
export const MAX_OFFER_FILES = 10;

/** What the signed upload token is for, so a token minted elsewhere is never accepted here. */
export const UPLOAD_PURPOSE = "offer-upload";
/** Long enough to read the offer, fix the boxes and add an addendum; short enough that a copied token goes stale. */
export const UPLOAD_TTL_MS = 12 * 60 * 60 * 1000;

export interface Sender { name: string; phone: string; email: string | null }
export type SenderField = "name" | "phone" | "email";

export function readSender(raw: Record<string, unknown>): { ok: true; value: Sender } | { ok: false; fields: Partial<Record<SenderField, string>> } {
  const fields: Partial<Record<SenderField, string>> = {};
  const name = String(raw.name ?? "").trim();
  if (name.length < 2 || name.length > 120) fields.name = "Your name is needed, so Kaleb knows who sent it.";
  const phone = String(raw.phone ?? "").trim();
  if (phone.replace(/\D/g, "").length < 10 || phone.length > 40) fields.phone = "A phone number is needed, with its area code.";
  const emailRaw = String(raw.email ?? "").trim().toLowerCase();
  const email = emailRaw || null;
  if (email && (!/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(email) || email.length > 200)) fields.email = "That email address does not look right. Leave it blank if you like.";
  if (Object.keys(fields).length) return { ok: false, fields };
  return { ok: true, value: { name, phone, email } };
}

/** A file name to show and store: no folders, nothing a person would not type, and never empty. */
export function cleanFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const kept = base.replace(/[^\p{L}\p{N} ._()-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 120);
  return kept || "offer.pdf";
}
