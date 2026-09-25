/**
 * A saved plan (Blueprint v5 §5.5): the values a person found, as they were
 * shown, and the answers behind them.
 *
 * Everything here arrives from a public form, so it is rebuilt field by field
 * rather than stored as sent: a value that is not in the catalogue is
 * dropped, an address that is not that value's own page is dropped, answers
 * are re-read through the same parser the value pages use, and every string
 * is length-capped.
 *
 * Pure: no React, no I/O.
 */

import { ASKS, parseAnswers, answersToQuery, type Answers } from "./asks";
import { valueById, type InputKey } from "./values";

export interface SavedValue {
  tool: string;
  label: string;
  figure: string;
  /** The value's page with its answers: reopening it recomputes today. */
  href: string;
}

export interface SavedPlan {
  mode: "save" | "review";
  side: "buy" | "sell" | "abroad";
  values: SavedValue[];
  answers: Answers;
  savedOn: string;
}

const cap = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");

export function cleanPlan(body: Record<string, unknown>, today = new Date()): SavedPlan {
  const side = body.side === "sell" ? "sell" : body.side === "abroad" ? "abroad" : "buy";
  const mode = body.mode === "review" ? "review" : "save";

  const raw = (body.answers && typeof body.answers === "object" ? body.answers : {}) as Record<string, unknown>;
  const byParam = new Map<string, string>();
  for (const def of Object.values(ASKS)) {
    const v = raw[def.key];
    if (typeof v === "string" || typeof v === "number") byParam.set(def.param, String(v));
  }
  const answers = parseAnswers((p) => byParam.get(p));

  const seen = new Set<string>();
  const values: SavedValue[] = [];
  for (const item of Array.isArray(body.values) ? body.values.slice(0, 12) : []) {
    const v = (item ?? {}) as Record<string, unknown>;
    const def = valueById(cap(v.tool, 40));
    if (!def || seen.has(def.id)) continue;
    const href = cap(v.href, 600);
    if (href !== def.href && !href.startsWith(`${def.href}?`)) continue;
    seen.add(def.id);
    values.push({ tool: def.id, label: def.name, figure: cap(v.figure, 60), href });
  }

  return { mode, side, values, answers, savedOn: today.toISOString().slice(0, 10) };
}

/** The value's page with the saved answers, for a plan that was saved with none. */
export function hrefFor(tool: string, answers: Answers): string | null {
  const def = valueById(tool);
  if (!def) return null;
  const q = answersToQuery(answers, def.asks as InputKey[]);
  return q ? `${def.href}?${q}` : def.href;
}

/**
 * One line for the agent: what this person did (§5.5, v3 §46.7). Built from
 * what they saved, never from browsing.
 */
export function planSummary(p: SavedPlan): string {
  if (!p.values.length) return p.mode === "review" ? "Asked for a review" : "Saved a plan";
  const parts = p.values.map((v) => `${v.label.toLowerCase()} ${v.figure}`);
  const price = typeof p.answers.price === "number" ? ` on a $${Math.round(p.answers.price / 1000)}k plan` : "";
  return `${p.mode === "review" ? "Asked for a review" : "Saved a plan"}${price}: ${parts.join(", ")}`;
}
