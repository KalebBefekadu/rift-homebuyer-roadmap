import "server-only";
import type { Revision, RevisionState, RuleId } from "@/lib/core/deadline";

/**
 * A contract date revision as stored, and how it is read back. Shared by the
 * one journey's dates (lib/db/deadlines.ts) and every contract at once
 * (lib/db/transactions.ts), so the two cannot shape a row differently.
 */

export const REVISION_COLUMNS = "deadline_id,seq,state,due_date,due_time,timezone,due_at,rule,trigger_label,trigger_date,days,source_term,source_page,source_document_id,amendment,verified,note,actor_label,created_at";

export const shapeRevision = (r: Record<string, unknown>): Revision => ({
  seq: r.seq as number, state: r.state as RevisionState, dueDate: r.due_date as string,
  dueTime: r.due_time ? String(r.due_time).slice(0, 5) : null, timezone: r.timezone as string, dueAt: (r.due_at as string | null) ?? null,
  rule: r.rule as RuleId, triggerLabel: (r.trigger_label as string | null) ?? null, triggerDate: (r.trigger_date as string | null) ?? null,
  days: (r.days as number | null) ?? null, sourceTerm: r.source_term as string, sourcePage: (r.source_page as string | null) ?? null,
  sourceDocumentId: (r.source_document_id as string | null) ?? null, amendment: (r.amendment as string | null) ?? null,
  verified: r.verified as boolean, note: (r.note as string | null) ?? null, by: r.actor_label as string, at: r.created_at as string,
});
