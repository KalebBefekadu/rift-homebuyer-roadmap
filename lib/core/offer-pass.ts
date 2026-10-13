import { readRecord, signRecord } from "./signed";

/**
 * The pass the offer upload asks for (audit 12 Oct §3 I and P13, D41).
 *
 * /api/offer/read is the only public route that spends money: every PDF it
 * reads is an AI call. The offer page asks for a pass when it opens, and the
 * upload must carry one that this server signed, that has not expired, and
 * that is at least a few seconds old. A person has typed a name and a phone
 * number by then; a script posting straight at the route has nothing to send.
 *
 * It is a deterrent, not a wall: a script written for this site can ask for a
 * pass and wait. What bounds that one is the money itself, the offer read's
 * own monthly share and daily ceiling (lib/core/ai.ts). A third-party
 * challenge (Turnstile) would be stronger, and would add a company to the
 * privacy page; that is a decision for counsel, not a default.
 *
 * No table: the issue time is what is signed. Pure, with the secret passed in.
 */
const PURPOSE = "offer-pass";
/** Long enough for a page left open over lunch; past it the page asks for a reload. */
export const PASS_TTL_MS = 12 * 60 * 60 * 1000;
/** Quicker than anybody can type a name and phone number and choose a file. */
export const PASS_MIN_AGE_MS = 3_000;

export function issuePass(secret: string, now = Date.now()): string {
  return signRecord(secret, PURPOSE, now.toString(36), PASS_TTL_MS, now);
}

export type PassCheck = "ok" | "missing" | "early" | "bad";

/** Whether an upload's pass will do. Forged, for another purpose and expired are all "bad". */
export function checkPass(secret: string, token: unknown, now = Date.now()): PassCheck {
  if (typeof token !== "string" || !token) return "missing";
  const id = readRecord(secret, PURPOSE, token, now);
  if (!id) return "bad";
  const issued = parseInt(id, 36);
  if (!Number.isFinite(issued) || issued > now) return "bad";
  return now - issued < PASS_MIN_AGE_MS ? "early" : "ok";
}

/** What the sender is told. Neither names the rule: a refusal that explains itself is a tuning guide. */
export const PASS_SAY: Record<Exclude<PassCheck, "ok">, string> = {
  missing: "This page needs reloading before it can take a PDF. Reload it and choose the file again, or fill in the boxes by hand.",
  bad: "This page needs reloading before it can take a PDF. Reload it and choose the file again, or fill in the boxes by hand.",
  early: "That was sent before the page was ready. Wait a moment and choose the file again.",
};
