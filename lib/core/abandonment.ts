/**
 * Who started a value (Blueprint v5 §5.1) and left without its answer.
 *
 * `abandoned()` in lib/db/recovery.ts counted v4 assessments, and since D31
 * retired the questionnaire nothing writes one, so the report read "nobody"
 * about a funnel losing people every day. What a visitor leaves behind now is
 * telemetry: `value_view`, `question_view` and `value_answer`, keyed on their
 * session, carrying the value's id and never an answer (rule 6).
 *
 * Pure: no I/O.
 */

import { valueById, type ValueSide } from "./values";

export interface ValueEvent {
  session: string;
  name: "value_view" | "value_answer" | "question_view";
  tool: string;
  /** ISO instant. */
  at: string;
  /** From `value_view`: how many of the value's questions they arrived with answered. */
  answered?: number;
  of?: number;
  /** From `question_view`: which question, 1-based, of those still to ask. */
  step?: number;
}

export interface StartedValue {
  sessionId: string;
  tool: string;
  side: ValueSide;
  /** Questions answered by the furthest point they reached. */
  answered: number;
  of: number | null;
  /** The first time they opened this value. */
  startedAt: string;
  /** Their last move on any value. */
  lastAt: string;
  hoursQuiet: number;
}

/**
 * Sessions that opened a value, saw no answer from any value, saved no plan,
 * and have been quiet for `minHoursQuiet`.
 *
 * "Saw no answer from ANY value" is the line, not "this one": somebody who got
 * their cash to close and wandered off in the middle of monthly cost left with
 * something, and listing them next to people who left with nothing makes the
 * list about the product's reach rather than about who was lost. One row per
 * person, for the value they touched last.
 *
 * Quiet is measured from their last event on anything, so a visitor moving
 * between values is mid-session, not gone.
 */
export function unfinishedValues(
  events: ValueEvent[],
  opts: { now: number; minHoursQuiet: number; saved?: ReadonlySet<string> },
): StartedValue[] {
  const bySession = new Map<string, ValueEvent[]>();
  for (const e of events) {
    if (!e.session || !e.tool || !valueById(e.tool)) continue;
    const list = bySession.get(e.session) ?? [];
    list.push(e);
    bySession.set(e.session, list);
  }

  const at = (e: ValueEvent) => Date.parse(e.at);
  const out: StartedValue[] = [];
  for (const [sessionId, all] of bySession) {
    if (opts.saved?.has(sessionId)) continue;
    if (all.some((e) => e.name === "value_answer")) continue;
    if (!all.some((e) => e.name === "value_view")) continue;

    const last = Math.max(...all.map(at));
    const quiet = (opts.now - last) / 3_600_000;
    if (!(quiet >= opts.minHoursQuiet)) continue;

    /* The value they touched last. */
    const tool = all.reduce((a, b) => (at(b) >= at(a) ? b : a)).tool;
    const mine = all.filter((e) => e.tool === tool);
    const opened = mine.filter((e) => e.name === "value_view");
    const arrivedWith = Math.max(0, ...opened.map((e) => e.answered ?? 0));
    const reached = Math.max(0, ...mine.filter((e) => e.name === "question_view").map((e) => e.step ?? 0));
    const of = opened.map((e) => e.of).find((n): n is number => typeof n === "number") ?? null;

    out.push({
      sessionId,
      tool,
      side: valueById(tool)!.side,
      answered: arrivedWith + Math.max(0, reached - 1),
      of,
      startedAt: new Date(Math.min(...mine.map(at))).toISOString(),
      lastAt: new Date(last).toISOString(),
      hoursQuiet: Math.floor(quiet),
    });
  }
  return out.sort((a, b) => Date.parse(b.lastAt) - Date.parse(a.lastAt));
}
