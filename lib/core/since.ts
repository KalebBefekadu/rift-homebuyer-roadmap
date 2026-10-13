/**
 * "Since you last looked", at the top of the client's Today (audit
 * portals-2026-10, item 10).
 *
 * Today says what is owed now. It did not say what moved, so a client coming
 * back after three days could not tell whether anything had happened without
 * reading every line, or texting to ask. This is that answer, from the same
 * records the page already shows them and nothing else: a fact a member may
 * not see never reaches this function.
 *
 * Counted by Georgia day. Most of the records carry a day, not a time (a
 * workstream's last word is the day somebody confirmed it), so "after the day
 * you last looked" is the claim that can be kept: a change on that same day
 * is not listed rather than listed wrongly.
 *
 * Pure: no I/O.
 */

import { georgiaDay } from "./day";

/** A visit is new after this long away; moving between tabs is the same visit. */
export const SEEN_GAP_MINUTES = 60;
const MAX_LINES = 6;

export function nextSeen(cur: { seenAt: string | null; seenBefore: string | null }, now = new Date()): {
  write: { seenAt: string; seenBefore: string | null } | null;
  since: string | null;
} {
  const t = cur.seenAt ? Date.parse(cur.seenAt) : NaN;
  if (Number.isFinite(t) && now.getTime() - t < SEEN_GAP_MINUTES * 60_000) return { write: null, since: cur.seenBefore };
  return { write: { seenAt: now.toISOString(), seenBefore: cur.seenAt }, since: cur.seenAt };
}

export interface SinceInput {
  lastSeen: string | null;
  stage: { label: string; since: string | null };
  work: { label: string; stateLabel: string; lastWord: { on: string; from: string } | null }[];
  homes: { address: string; createdAt: string; withdrawnAt: string | null }[];
  decisions: { question: string; releasedAt: string | null }[];
}

export function sinceLastLook(input: SinceInput): { day: string; lines: string[] } | null {
  if (!input.lastSeen) return null;
  const day = georgiaDay(new Date(input.lastSeen));
  const after = (iso: string | null) => Boolean(iso) && georgiaDay(new Date(iso!.length === 10 ? `${iso}T12:00:00Z` : iso!)) > day;
  const lines: string[] = [];
  if (after(input.stage.since)) lines.push(`Your move reached ${input.stage.label}.`);
  for (const d of input.decisions) if (after(d.releasedAt)) lines.push(`A decision for you: ${d.question}`);
  for (const h of input.homes) if (!h.withdrawnAt && after(h.createdAt)) lines.push(`A home was added: ${h.address}.`);
  for (const w of input.work) if (w.lastWord && after(w.lastWord.on)) lines.push(`${w.label}: ${w.stateLabel}, word from ${w.lastWord.from}.`);
  return { day, lines: lines.slice(0, MAX_LINES) };
}
