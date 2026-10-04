import "server-only";
import { serviceClient, currentAgentId } from "./service";
import { done, failed, skipped, type DbResult } from "./result";
import { boundedWrite } from "./bounded";
import type { NoteKind } from "@/lib/core/pipeline";

/**
 * One line in a relationship's history (rift_lead_notes, append-only). Its own
 * module because the board, a stage change and a recorded agreement all write
 * one, and clients.ts and representation.ts would otherwise import each other.
 */
export async function addNote(
  leadId: string,
  kind: NoteKind,
  body: string,
  stages?: { fromStage?: string | null; toStage?: string | null },
): Promise<DbResult<{ id: string }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agent_id = await currentAgentId();
  if (!agent_id) return skipped("no agent row exists yet");
  if (!body.trim()) return failed("an empty note is not a note");

  const res = await boundedWrite(
    db.from("rift_lead_notes").insert({
      lead_id: leadId,
      agent_id,
      kind,
      body: body.trim(),
      from_stage: stages?.fromStage ?? null,
      to_stage: stages?.toStage ?? null,
    }).select("id").single(),
    "saving the note",
  );
  if (!res.ok || !("data" in res)) return res as DbResult<{ id: string }>;
  return done({ id: (res.data as { id: string }).id });
}
