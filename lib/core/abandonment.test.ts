import { describe, it, expect } from "vitest";
import { unfinishedValues, type ValueEvent } from "./abandonment";

/**
 * Who started a value and left with nothing (Blueprint v5 §5.1).
 *
 * `abandoned()` read only v4 assessments, and since D31 nothing writes one,
 * so "Started, not finished" read "Nobody in the last 30 days" for a funnel
 * that was losing people every day. The values' own events are what is left
 * to count from.
 */

const NOW = Date.parse("2026-09-30T12:00:00Z");
const ago = (h: number) => new Date(NOW - h * 3_600_000).toISOString();
const ev = (session: string, name: ValueEvent["name"], tool: string, h: number, extra: Partial<ValueEvent> = {}): ValueEvent =>
  ({ session, name, tool, at: ago(h), ...extra });
const run = (events: ValueEvent[], over: Partial<Parameters<typeof unfinishedValues>[1]> = {}) =>
  unfinishedValues(events, { now: NOW, minHoursQuiet: 2, ...over });

describe("unfinishedValues", () => {
  it("lists somebody who opened a value and never saw its answer", () => {
    const [row] = run([ev("s1", "value_view", "cash", 5, { answered: 0, of: 3 })]);
    expect(row).toMatchObject({ sessionId: "s1", tool: "cash", side: "buy", hoursQuiet: 5, answered: 0, of: 3 });
  });

  it("counts the questions reached, not only those they arrived with", () => {
    const [row] = run([
      ev("s1", "value_view", "cash", 6, { answered: 1, of: 3 }),
      ev("s1", "question_view", "cash", 6, { step: 1 }),
      ev("s1", "question_view", "cash", 5, { step: 2 }),
    ]);
    /* Reaching the second question means one was answered, on top of the one
       they brought with them. */
    expect(row!.answered).toBe(2);
  });

  it("does not list somebody who saw an answer: they left with something", () => {
    expect(run([
      ev("s1", "value_view", "cash", 8, { answered: 0, of: 3 }),
      ev("s1", "value_answer", "cash", 7),
      ev("s1", "value_view", "monthly", 6, { answered: 3, of: 3 }),
    ])).toEqual([]);
  });

  it("does not list somebody still in the middle of it", () => {
    /* Ten minutes quiet has abandoned nothing. */
    expect(run([ev("s1", "value_view", "cash", 0.2, { answered: 0, of: 3 })])).toEqual([]);
  });

  it("measures quiet from their last move on any value, not the first", () => {
    expect(run([
      ev("s1", "value_view", "cash", 9, { answered: 0, of: 3 }),
      ev("s1", "value_view", "monthly", 0.5, { answered: 0, of: 3 }),
    ])).toEqual([]);
  });

  it("does not list a session that saved a plan", () => {
    expect(run([ev("s1", "value_view", "cash", 5, { answered: 0, of: 3 })], { saved: new Set(["s1"]) })).toEqual([]);
  });

  it("gives one row per person: the value they touched last", () => {
    const rows = run([
      ev("s1", "value_view", "cash", 9, { answered: 0, of: 3 }),
      ev("s1", "value_view", "timeline", 4, { answered: 0, of: 4 }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ tool: "timeline", hoursQuiet: 4 });
  });

  it("reads the side from the value, so a seller and a buyer abroad are named as such", () => {
    const rows = run([
      ev("a", "value_view", "proceeds", 5, { answered: 0, of: 4 }),
      ev("b", "value_view", "eligibility", 5, { answered: 0, of: 1 }),
    ]);
    expect(new Map(rows.map((r) => [r.sessionId, r.side]))).toEqual(new Map([["a", "sell"], ["b", "abroad"]]));
  });

  it("ignores a tool it does not know rather than guessing a side", () => {
    expect(run([ev("s1", "value_view", "retired-tool", 5, { answered: 0, of: 2 })])).toEqual([]);
  });

  it("lists the most recently quiet first", () => {
    const rows = run([
      ev("old", "value_view", "cash", 30, { answered: 0, of: 3 }),
      ev("new", "value_view", "cash", 3, { answered: 0, of: 3 }),
    ]);
    expect(rows.map((r) => r.sessionId)).toEqual(["new", "old"]);
  });
});
