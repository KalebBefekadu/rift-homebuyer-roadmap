import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * A short-lived token that names one record and proves we issued it.
 *
 * For the two-step Equb form (manual review WS2.10): step 1 creates the lead
 * and gets one of these back; step 2 may update that lead and no other. A
 * bare lead id from the browser would let anybody who saw one rewrite a
 * stranger's request. No table, so no migration: the signature is the proof
 * and the expiry is inside what is signed.
 *
 * The secret is passed in, so this stays free of process.env (AGENTS.md: the
 * domain layer is I/O-free).
 */
const b64 = (b: Buffer) => b.toString("base64url");

function mac(secret: string, purpose: string, body: string): string {
  return b64(createHmac("sha256", secret).update(`${purpose}\n${body}`).digest());
}

export function signRecord(secret: string, purpose: string, id: string, ttlMs: number, now = Date.now()): string {
  const body = `${id}.${(now + ttlMs).toString(36)}`;
  return `${body}.${mac(secret, purpose, body)}`;
}

/** The id the token names, or null if it is forged, for another purpose, or expired. */
export function readRecord(secret: string, purpose: string, token: string, now = Date.now()): string | null {
  if (!secret || typeof token !== "string" || token.length > 300) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [id, exp, sig] = parts as [string, string, string];
  const want = Buffer.from(mac(secret, purpose, `${id}.${exp}`));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  const expires = parseInt(exp, 36);
  if (!Number.isFinite(expires) || expires < now) return null;
  return id;
}
