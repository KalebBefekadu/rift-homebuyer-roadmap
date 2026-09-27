import "server-only";
import { serviceClient } from "./service";
import { boundedRead, boundedWrite } from "./bounded";
import { done, failed, skipped, type DbResult } from "./result";
import { markError, type Mark, type MarkKind } from "@/lib/core/desk";

/**
 * The only reader and writer of rift_desk_marks: snoozes, pins and
 * delegations on Today (OPS-02). Rules: lib/core/desk.ts.
 *
 * Marks older than LOOKBACK_DAYS are not read. A snooze or pin lasts at most
 * that long anyway, and a delegation that old has either been done or needs
 * asking about again, which showing it unmarked does.
 */

const MISSING = /rift_desk_marks|does not exist|schema cache/;
export const LOOKBACK_DAYS = 60;

/** Null when the table is not there yet: the page then offers no marks rather than failing. */
export async function readMarks(agentId: string, now = new Date()): Promise<DbResult<Mark[] | null>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const since = new Date(now.getTime() - LOOKBACK_DAYS * 86_400_000).toISOString();
  const r = await boundedRead(db.from("rift_desk_marks").select("item_key,kind,until_at,person,reason,by_name,created_at")
    .eq("agent_id", agentId).gte("created_at", since).order("created_at").limit(3000), "what you marked on Today");
  if (!r.ok) return MISSING.test(r.error) ? done(null) : r;
  return done((("data" in r ? r.data : []) as Record<string, unknown>[]).map((m) => ({
    key: m.item_key as string, kind: m.kind as MarkKind, until: (m.until_at as string | null) ?? null,
    person: (m.person as string | null) ?? null, reason: (m.reason as string | null) ?? null,
    by: m.by_name as string, at: m.created_at as string,
  })));
}

export async function recordMark(agentId: string, input: {
  key: string; kind: MarkKind; until?: string | null; person?: string | null; reason?: string | null; by: string; requestId: string;
}, now = new Date()): Promise<DbResult<true>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const bad = markError(input.key, input.kind, input, now);
  if (bad) return failed(bad);
  const w = await boundedWrite(db.from("rift_desk_marks").insert({
    agent_id: agentId, item_key: input.key, kind: input.kind,
    until_at: input.kind === "snooze" || input.kind === "pin" ? new Date(input.until!).toISOString() : null,
    person: input.person?.trim() || null, reason: input.reason?.trim() || null,
    by_name: input.by.slice(0, 120), request_id: input.requestId,
  }), "the mark");
  if (!w.ok) {
    /* The same request twice is the same mark: a double click, not an error. */
    if (/rift_desk_marks_request|duplicate key/.test(w.error)) return done(true);
    return MISSING.test(w.error) ? failed("Snooze, pin and delegate need migration 20260928000000") : w;
  }
  return done(true);
}
