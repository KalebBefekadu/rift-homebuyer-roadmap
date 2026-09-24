import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { serviceClient, currentAgentId } from "./service";
import { boundedRead, boundedTransfer, boundedWrite } from "./bounded";
import { done, failed, skipped, type DbResult } from "./result";
import { journeyTablesMissing } from "./journeys";
import { checkFile, cleanFilename, labelError, type DocKind, type Family } from "@/lib/core/document";

/**
 * Documents (blueprint v4 W08; REQ-DOC-01, AT25). The only writer of
 * rift_documents and of the private 'rift-documents' bucket.
 *
 * The path of a file:
 *
 *   1. The server hands the agent's browser a one-time upload link into
 *      quarantine/<agent>/<random>. The browser sends the bytes straight to
 *      Storage, so a 15 MB PDF never passes through a Vercel function (whose
 *      request limit is 4.5 MB).
 *   2. The browser says it is done. The server downloads the file from
 *      quarantine and runs lib/core/document.ts `checkFile` on the bytes.
 *   3. Pass: the file is moved to clean/<agent>/<journey>/<id>.<ext>, its
 *      SHA-256 recorded, and only then does a row exist. Fail: the upload is
 *      deleted and the reasons are shown. Nothing is ever served from
 *      quarantine.
 *
 * Nobody gets a permanent link. Opening a document mints a signed link that
 * lasts a minute, after the caller has been checked.
 */

export const BUCKET = "rift-documents";
const QUARANTINE_HOURS = 24;
const LINK_SECONDS = 60;

export interface DocumentRecord {
  id: string;
  family: Family;
  label: string;
  filename: string;
  kind: DocKind;
  bytes: number;
  sha256: string;
  by: string;
  at: string;
}

const NOT_YET = "Documents need a database update that has not been applied yet (migration 20260924020000).";

const shape = (r: Record<string, unknown>): DocumentRecord => ({
  id: r.id as string, family: r.family as Family, label: r.label as string, filename: r.filename as string,
  kind: r.kind as DocKind, bytes: r.bytes as number, sha256: r.sha256 as string,
  by: r.actor_label as string, at: r.created_at as string,
});

export async function readDocuments(journeyId: string, agentId: string): Promise<DbResult<{ documents: DocumentRecord[]; unavailable?: string }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const r = await boundedRead(
    db.from("rift_documents").select("id,family,label,filename,kind,bytes,sha256,actor_label,created_at")
      .eq("journey_id", journeyId).eq("agent_id", agentId).order("created_at", { ascending: false }).limit(200),
    "the documents",
  );
  if (!r.ok) return journeyTablesMissing(r.error) ? done({ documents: [], unavailable: NOT_YET }) : r;
  return done({ documents: (("data" in r ? r.data : []) as Record<string, unknown>[]).map(shape) });
}

export async function documentsFor(journeyId: string) {
  const agentId = await currentAgentId();
  if (!agentId) return skipped("no agent row exists yet");
  return readDocuments(journeyId, agentId);
}

/**
 * A one-time link to upload into quarantine. Also clears this agent's
 * quarantine of anything older than a day: an upload somebody started and
 * never finished is deleted, not kept.
 */
export async function uploadSlot(journeyId: string): Promise<DbResult<{ path: string; url: string }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agentId = await currentAgentId();
  if (!agentId) return skipped("no agent row exists yet");
  const j = await boundedRead(db.from("rift_journeys").select("id").eq("id", journeyId).eq("agent_id", agentId).maybeSingle(), "the journey");
  if (!j.ok) return j;
  if (!("data" in j) || !j.data) return failed("That journey could not be found");

  await sweepQuarantine(agentId);
  const path = `quarantine/${agentId}/${randomUUID()}`;
  const slot = await boundedWrite(db.storage.from(BUCKET).createSignedUploadUrl(path), "the upload link");
  if (!slot.ok) return /not found|bucket/i.test(slot.error) ? failed("File storage is not set up yet (migration 20260924020000)") : slot;
  return done({ path, url: ("data" in slot && slot.data ? slot.data.signedUrl : "") });
}

async function sweepQuarantine(agentId: string): Promise<void> {
  const db = serviceClient();
  if (!db) return;
  const list = await boundedRead(db.storage.from(BUCKET).list(`quarantine/${agentId}`, { limit: 100 }), "the quarantine");
  if (!list.ok || !("data" in list)) return;
  const cutoff = Date.now() - QUARANTINE_HOURS * 3_600_000;
  const old = (list.data ?? [])
    .filter((f) => f.created_at && Date.parse(f.created_at) < cutoff)
    .map((f) => `quarantine/${agentId}/${f.name}`);
  if (old.length) await boundedWrite(db.storage.from(BUCKET).remove(old), "the quarantine");
}

/**
 * The browser finished uploading: check the file and, if it passes, keep it.
 * `path` came from the browser, so it must be one of this agent's quarantine
 * paths, exactly, or nothing is read.
 */
export async function finishUpload(
  journeyId: string, path: string, filename: string, declaredType: string, family: string, label: string, agentLabel: string,
): Promise<DbResult<{ id: string } | { refused: string[] }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agentId = await currentAgentId();
  if (!agentId) return skipped("no agent row exists yet");
  if (!new RegExp(`^quarantine/${agentId}/[0-9a-f-]{36}$`).test(path)) return failed("That upload could not be found. Try again");
  const bad = labelError(label, family);
  if (bad) return failed(bad);
  const j = await boundedRead(db.from("rift_journeys").select("id").eq("id", journeyId).eq("agent_id", agentId).maybeSingle(), "the journey");
  if (!j.ok) return j;
  if (!("data" in j) || !j.data) return failed("That journey could not be found");

  const got = await boundedTransfer(db.storage.from(BUCKET).download(path), "the uploaded file");
  if (!got.ok) return failed("The upload did not arrive. Try again");
  const bytes = new Uint8Array(await ((got as { data: Blob }).data).arrayBuffer());
  const name = cleanFilename(filename);
  const check = checkFile(bytes, name, declaredType);
  if (!check.ok || !check.kind) {
    await boundedWrite(db.storage.from(BUCKET).remove([path]), "the refused file");
    return done({ refused: check.reasons });
  }

  const id = randomUUID();
  const clean = `clean/${agentId}/${journeyId}/${id}.${check.kind === "jpeg" ? "jpg" : check.kind}`;
  const moved = await boundedTransfer(db.storage.from(BUCKET).move(path, clean), "the checked file");
  if (!moved.ok) return failed("The file passed its checks but could not be kept. Try again");
  const row = await boundedWrite(
    db.from("rift_documents").insert({
      id, agent_id: agentId, journey_id: journeyId, family, label: label.trim(), filename: name, kind: check.kind,
      bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), storage_path: clean,
      actor_label: agentLabel.slice(0, 120),
    }),
    "the document",
  );
  if (!row.ok) {
    /* A file with no record is a file nobody can find to delete. */
    await boundedWrite(db.storage.from(BUCKET).remove([clean]), "the document");
    return row;
  }
  return done({ id });
}

/** A link to one document that works for a minute. The caller has checked who is asking. */
export async function documentLink(journeyId: string, agentId: string, documentId: string): Promise<DbResult<{ url: string }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const r = await boundedRead(
    db.from("rift_documents").select("storage_path,filename").eq("id", documentId).eq("journey_id", journeyId).eq("agent_id", agentId).maybeSingle(),
    "the document",
  );
  if (!r.ok) return r;
  const row = ("data" in r ? r.data : null) as { storage_path: string; filename: string } | null;
  if (!row) return failed("That document could not be found");
  const link = await boundedWrite(db.storage.from(BUCKET).createSignedUrl(row.storage_path, LINK_SECONDS, { download: row.filename }), "the document link");
  if (!link.ok) return link;
  return done({ url: ("data" in link && link.data ? link.data.signedUrl : "") });
}

export async function documentLinkForAgent(journeyId: string, documentId: string) {
  const agentId = await currentAgentId();
  if (!agentId) return skipped("no agent row exists yet");
  return documentLink(journeyId, agentId, documentId);
}

/**
 * Remove the files of these journeys from Storage. Called by `forget` BEFORE
 * the journeys are deleted: the rows are how the files are found, so doing it
 * the other way round would leave files nobody can locate.
 */
export async function removeJourneyFiles(agentId: string, journeyIds: string[]): Promise<DbResult<{ removed: number }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  if (!journeyIds.length) return done({ removed: 0 });
  const r = await boundedRead(
    db.from("rift_documents").select("storage_path").eq("agent_id", agentId).in("journey_id", journeyIds).limit(5000),
    "their documents",
  );
  if (!r.ok) return journeyTablesMissing(r.error) ? done({ removed: 0 }) : r;
  const paths = (("data" in r ? r.data : []) as { storage_path: string }[]).map((x) => x.storage_path);
  for (let i = 0; i < paths.length; i += 100) {
    const gone = await boundedTransfer(db.storage.from(BUCKET).remove(paths.slice(i, i + 100)), "their files");
    if (!gone.ok) return gone;
  }
  return done({ removed: paths.length });
}
