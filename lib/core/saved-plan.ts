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
import { georgiaDay } from "./day";
import { firstTimeFrom, ownershipOf } from "./funnel";

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
  /** D14 "program alerts": asked to hear when a program they may fit opens,
      changes or runs out of funds. Buyers only; never assumed. */
  alerts?: boolean;
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

  return { mode, side, values, answers, savedOn: georgiaDay(today), alerts: side === "buy" && body.alerts === true };
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
  const plan = typeof p.answers.price === "number" ? `a $${Math.round(p.answers.price / 1000)}k plan` : "a plan";
  const alerts = p.alerts ? "; asked for program alerts" : "";
  return `${p.mode === "review" ? `Asked for a review of ${plan}` : `Saved ${plan}`}: ${parts.join(", ")}${alerts}`;
}

/**
 * What a follow-up may use from a saved plan: where they are buying, whether
 * they count as a first-time buyer, and the page that works a value out again.
 *
 * Deliberately not the figures. `values[].figure` is a string the browser
 * sent, kept so the plan can show them what they saw. Quoted in an email it
 * would be a number about their money that compute.ts never produced (rule
 * 1), and a way for anyone who can post to the save route to have us mail
 * text of their choosing.
 *
 * Read defensively, because the column is jsonb written by whichever build
 * saved it: a county not in the list is no county, the same rule
 * `parseAnswers` applies to an address, and a missing ownership answer counts
 * as first-time, which fails towards showing somebody more help rather than
 * less, as `ownershipOf` does for a readout.
 */
export function planFacts(plan: unknown): { county: string | null; firstTimeBuyer: boolean; againPath: string } | null {
  if (!plan || typeof plan !== "object") return null;
  const p = plan as Partial<SavedPlan>;
  const answers = (p.answers && typeof p.answers === "object" ? p.answers : {}) as Record<string, unknown>;
  const county = typeof answers.county === "string" && ASKS.county.options?.some((o) => o.value === answers.county)
    ? answers.county
    : null;
  const side = p.side === "sell" ? "sell" : p.side === "abroad" ? "abroad" : "buy";
  /* The first value they saved, bare. Not `href`: that carries their answers
     in the query string (savings, income), and a link in an email is read by
     every mail scanner and forwarded with the message. The saved plan page
     reopens each value with its answers; this one is for starting again. */
  const first = Array.isArray(p.values) ? p.values.map((v) => valueById(String(v?.tool ?? ""))).find(Boolean) : undefined;
  return {
    county,
    firstTimeBuyer: firstTimeFrom(ownershipOf(answers.ownership)),
    againPath: first?.href ?? `/${side}`,
  };
}
