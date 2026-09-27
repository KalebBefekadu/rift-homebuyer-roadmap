/**
 * The value ladder (Blueprint v5 §5.1; requirements §12 "Value ladder"):
 * of the visitors who finish one value, how many take a second.
 *
 * Built from `value_view` and `value_answer` events, which carry the value's
 * id and never an answer (lib/core/telemetry.ts). A visitor is a session.
 * Only what the events say is counted; nothing is estimated.
 *
 * Pure: no I/O.
 */

export interface LadderEvent { session: string; name: "value_view" | "value_answer"; tool: string }

export interface LadderRow { tool: string; opened: number; finished: number }

export interface Ladder {
  /** Sessions that finished at least one value. */
  finishedOne: number;
  /** Of those, sessions that finished two or more different values. */
  finishedTwo: number;
  /** finishedTwo / finishedOne, or null when nobody finished one. */
  rate: number | null;
  byValue: LadderRow[];
}

export function valueLadder(events: LadderEvent[]): Ladder {
  const done = new Map<string, Set<string>>();
  const opened = new Map<string, Set<string>>();
  const finished = new Map<string, Set<string>>();
  for (const e of events) {
    if (!e.tool) continue;
    const bucket = e.name === "value_answer" ? finished : opened;
    bucket.set(e.tool, (bucket.get(e.tool) ?? new Set()).add(e.session));
    if (e.name === "value_answer") done.set(e.session, (done.get(e.session) ?? new Set()).add(e.tool));
  }
  const finishedOne = done.size;
  const finishedTwo = [...done.values()].filter((t) => t.size >= 2).length;
  const tools = [...new Set([...opened.keys(), ...finished.keys()])];
  return {
    finishedOne,
    finishedTwo,
    rate: finishedOne ? finishedTwo / finishedOne : null,
    byValue: tools.map((tool) => ({ tool, opened: opened.get(tool)?.size ?? 0, finished: finished.get(tool)?.size ?? 0 }))
      .sort((a, b) => b.finished - a.finished || a.tool.localeCompare(b.tool)),
  };
}
