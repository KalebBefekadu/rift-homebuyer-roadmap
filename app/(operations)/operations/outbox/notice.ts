import type { DbResult } from "@/lib/db/result";
import type { OutboxState } from "@/lib/core/outbox";

/**
 * What one outbox step did, in words, for the item it was taken on.
 *
 * The form used to post and return nothing, so every answer that was not a
 * plain success vanished: a send refused because the person had replied or
 * opted out left the item "Approved, not sent yet" with no reason anywhere,
 * and a failed edit or discard looked exactly like one that had not been
 * pressed. The reasons exist; they have to reach the screen.
 *
 * Pure: no I/O.
 */
export interface Notice { ok: boolean; text: string }

/** Mirrors lib/db/outbox.ts SendOutcome, restated so this file stays free of the data layer. */
export interface SendOutcome { state: OutboxState; detail: string | null; blockers: string[] }

const end = (s: string) => (/[.!?]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`);

export function sendNotice(r: DbResult<SendOutcome>): Notice {
  if (!r.ok) return { ok: false, text: `Not sent: ${end(r.error)}` };
  if ("skipped" in r) return { ok: false, text: `Not sent: ${end(r.reason)}` };
  const { state, detail, blockers } = r.data;
  /* Approved and then held back by the last check. It stays approved, so the
     reason is the only thing that tells him what to do next. */
  if (blockers.length) return { ok: false, text: `Approved, not sent: ${end(blockers.join("; "))}` };
  if (state === "succeeded") return { ok: true, text: "Sent." };
  if (state === "unknown") {
    return { ok: false, text: `It may have sent${detail ? ` (${detail.trim()})` : ""}. Check the Brevo log before trying again.` };
  }
  return { ok: false, text: detail ? `Did not send: ${end(detail)}` : "Did not send." };
}

export function stepNotice(r: DbResult<unknown>, did: string): Notice {
  if (!r.ok) return { ok: false, text: end(r.error) };
  if ("skipped" in r) return { ok: false, text: end(r.reason) };
  return { ok: true, text: did };
}
