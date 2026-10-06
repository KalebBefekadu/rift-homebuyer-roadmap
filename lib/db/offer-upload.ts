import "server-only";
import { randomUUID } from "node:crypto";
import { serviceClient, currentAgentId, currentAgentEmail } from "./service";
import { boundedRead, boundedReport, boundedTransfer, boundedWrite } from "./bounded";
import { done, failed, skipped, type DbResult } from "./result";
import { sendOfferUploaded } from "./email";
import { captureOpError } from "@/lib/monitoring/capture";
import { readRecord, signRecord } from "@/lib/core/signed";
import { siteUrl } from "@/lib/core/site";
import { isUuid } from "@/lib/core/ids";
import { MAX_OFFER_FILES, UPLOAD_PURPOSE, UPLOAD_TTL_MS, cleanFileName, type Sender } from "@/lib/core/offer-upload";
import type { Candidates } from "@/lib/core/offer-extract";

/**
 * Offer PDFs, stored the moment they arrive (manual review WS8.2, WS8.3).
 *
 * The first file makes the upload row and alerts Kaleb; later files on the
 * same upload are addenda. The browser holds a signed token naming its
 * upload, so it can add to that upload and to no other: a bare id would let
 * anybody who saw one attach files to a stranger's offer.
 *
 * Until the migration is applied the tables are missing; the upload says it
 * could not be kept and the form still works, as it did before (the boxes
 * are what get sent).
 */

const BUCKET = "rift-documents";
/* Its own secret when set; otherwise derived from the service key, which is
   already a secret only the server holds (as app/api/equb/route.ts). */
const secret = () => process.env.RIFT_SIGNING_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export const uploadIdOf = (token: string | null | undefined): string | null => {
  if (!token) return null;
  const id = readRecord(secret(), UPLOAD_PURPOSE, token);
  return id && isUuid(id) ? id : null;
};

export interface StoredFile { name: string }
export interface Kept {
  /** Signed, for the browser to send back with an addendum or the form. Null without a secret. */
  token: string | null;
  uploadId: string;
  /** True for the upload's first file: the one the automatic read is run on. */
  first: boolean;
  files: StoredFile[];
}

/**
 * Keep one PDF. With no valid token, a new upload from this sender; with one,
 * another file on the same upload.
 */
export async function keepOfferFile(input: { token: string | null; sender: Sender; fileName: string; bytes: Uint8Array }): Promise<DbResult<Kept>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured, so the PDF could not be kept");
  const agent_id = await currentAgentId();
  if (!agent_id) return skipped("no agent row exists yet, so the PDF could not be kept");

  let uploadId = uploadIdOf(input.token);
  let first = false;
  try {
    if (uploadId) {
      const n = await boundedReport(db.from("rift_offer_files").select("id").eq("upload_id", uploadId).limit(MAX_OFFER_FILES + 1), "the PDFs on this offer");
      if (!n.ok) return n;
      if ((("data" in n ? n.data : []) as unknown[]).length >= MAX_OFFER_FILES) return failed(`One offer can carry ${MAX_OFFER_FILES} PDFs. Send this one to Kaleb by email.`);
    } else {
      const made = await boundedWrite(
        db.from("rift_offer_uploads").insert({
          agent_id, sender_name: input.sender.name, sender_phone: input.sender.phone, sender_email: input.sender.email,
        }).select("id").maybeSingle(),
        "the offer upload",
      );
      if (!made.ok) return made;
      uploadId = ("data" in made ? (made.data as { id: string } | null)?.id : null) ?? null;
      if (!uploadId) return failed("the offer upload was not recorded");
      first = true;
    }

    const fileId = randomUUID();
    const path = `offers/uploads/${uploadId}/${fileId}.pdf`;
    const up = await boundedTransfer(
      db.storage.from(BUCKET).upload(path, Buffer.from(input.bytes), { contentType: "application/pdf", upsert: false }),
      "the offer PDF",
    );
    if (!up.ok) {
      /* A first upload with no file is no upload: remove the row rather than
         put an empty "PDF only" on the board. */
      if (first) await boundedWrite(db.from("rift_offer_uploads").delete().eq("id", uploadId), "the empty upload");
      return up;
    }
    const row = await boundedWrite(
      db.from("rift_offer_files").insert({ id: fileId, agent_id, upload_id: uploadId, path, file_name: cleanFileName(input.fileName), size_bytes: input.bytes.length }),
      "the offer PDF record",
    );
    if (!row.ok) {
      await boundedWrite(db.storage.from(BUCKET).remove([path]), "the unrecorded PDF");
      if (first) await boundedWrite(db.from("rift_offer_uploads").delete().eq("id", uploadId), "the empty upload");
      return row;
    }

    const list = await boundedReport(db.from("rift_offer_files").select("file_name").eq("upload_id", uploadId).order("created_at"), "the PDFs on this offer");
    const files = (list.ok && "data" in list ? (list.data as { file_name: string }[]) : []).map((f) => ({ name: f.file_name }));

    /* Kaleb hears about it on the first file, like every other lead: the
       sender may never press Send. Awaited, because a serverless response
       ends the run. A failed alert never fails the upload; the board has it. */
    if (first) {
      const to = await currentAgentEmail();
      if (to) {
        const sent = await sendOfferUploaded({
          to, sender: input.sender.name, phone: input.sender.phone, email: input.sender.email,
          fileName: cleanFileName(input.fileName), boardUrl: `${siteUrl() ?? ""}/operations/offers?show=inbound#upload-${uploadId}`,
        });
        if (!sent.ok) captureOpError(new Error(sent.error), { op: "email.offerUploaded" });
      }
    }

    const key = secret();
    return done({ token: key ? signRecord(key, UPLOAD_PURPOSE, uploadId, UPLOAD_TTL_MS) : null, uploadId, first, files });
  } catch (e) {
    return failed(e);
  }
}

/** What the automatic read proposed for an upload's first file, kept to set beside what is sent. */
export async function saveUploadRead(uploadId: string, candidates: Candidates): Promise<void> {
  const db = serviceClient();
  if (!db || !isUuid(uploadId)) return;
  const w = await boundedWrite(db.from("rift_offer_uploads").update({ read_candidates: candidates }).eq("id", uploadId), "the offer read");
  if (!w.ok) captureOpError(new Error(w.error), { op: "offer.upload.read" });
}

/**
 * The upload becomes this offer. Its first PDF is the offer's document (what
 * Operations has always opened), and what the read proposed goes beside it.
 * Only an upload not already sent: sending twice makes one offer, not two
 * pointing at the same files.
 */
export async function linkUploadToOffer(uploadId: string, offerId: string): Promise<void> {
  const db = serviceClient();
  if (!db || !isUuid(uploadId) || !isUuid(offerId)) return;
  const linked = await boundedWrite(
    db.from("rift_offer_uploads").update({ offer_id: offerId }).eq("id", uploadId).is("offer_id", null).select("read_candidates").maybeSingle(),
    "the offer PDFs",
  );
  if (!linked.ok) { captureOpError(new Error(linked.error), { op: "offer.upload.link" }); return; }
  const row = ("data" in linked ? linked.data : null) as { read_candidates: Candidates | null } | null;
  if (!row) return;
  const firstFile = await boundedReport(db.from("rift_offer_files").select("path").eq("upload_id", uploadId).order("created_at").limit(1).maybeSingle(), "the offer PDF");
  const path = firstFile.ok && "data" in firstFile ? (firstFile.data as { path: string } | null)?.path ?? null : null;
  const u = await boundedWrite(
    db.from("rift_offers").update({ document_path: path, read_candidates: row.read_candidates }).eq("id", offerId),
    "the offer PDF",
  );
  if (!u.ok) captureOpError(new Error(u.error), { op: "offer.upload.attach" });
}

export interface UploadFile { name: string; url: string | null; at: string }
export interface PendingUpload {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  at: string;
  files: UploadFile[];
  read: Candidates | null;
}

/** Ten minutes: long enough to open, short enough that a copied link does not become a way in. */
async function links(paths: string[]): Promise<Map<string, string>> {
  const db = serviceClient();
  const out = new Map<string, string>();
  if (!db || !paths.length) return out;
  const r = await boundedRead(db.storage.from(BUCKET).createSignedUrls(paths, 600), "the PDF links");
  if (r.ok && "data" in r) for (const l of (r.data ?? []) as { path: string | null; signedUrl: string }[]) if (l.path) out.set(l.path, l.signedUrl);
  return out;
}

/** Every PDF on these offers, by offer, oldest first (the offer, then its addenda). */
export async function filesForOffers(offerIds: string[]): Promise<Map<string, UploadFile[]>> {
  const db = serviceClient();
  const out = new Map<string, UploadFile[]>();
  if (!db || !offerIds.length) return out;
  const ups = await boundedReport(db.from("rift_offer_uploads").select("id,offer_id").in("offer_id", offerIds), "the offer uploads");
  if (!ups.ok) return out;
  const offerOf = new Map((("data" in ups ? ups.data : []) as { id: string; offer_id: string }[]).map((u) => [u.id, u.offer_id]));
  if (!offerOf.size) return out;
  const files = await boundedReport(db.from("rift_offer_files").select("upload_id,path,file_name,created_at").in("upload_id", [...offerOf.keys()]).order("created_at"), "the offer PDFs");
  if (!files.ok) return out;
  const rows = ("data" in files ? files.data : []) as { upload_id: string; path: string; file_name: string; created_at: string }[];
  const urls = await links(rows.map((f) => f.path));
  for (const f of rows) {
    const offerId = offerOf.get(f.upload_id)!;
    out.set(offerId, [...(out.get(offerId) ?? []), { name: f.file_name, url: urls.get(f.path) ?? null, at: f.created_at }]);
  }
  return out;
}

/**
 * Uploads whose form was never sent: on the Offers board as "PDF only", so a
 * PDF somebody believes they delivered is never in a table nobody reads.
 * Null when the tables are not migrated yet, which the board treats as none.
 */
export async function pendingUploads(limit = 100): Promise<DbResult<PendingUpload[] | null>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agent_id = await currentAgentId();
  if (!agent_id) return skipped("not signed in");
  const r = await boundedReport(
    db.from("rift_offer_uploads").select("id,sender_name,sender_phone,sender_email,read_candidates,created_at")
      .eq("agent_id", agent_id).is("offer_id", null).order("created_at", { ascending: false }).limit(limit),
    "the offer PDFs sent without the form",
  );
  if (!r.ok) return /rift_offer_uploads/.test(r.error) ? done(null) : r;
  const ups = ("data" in r ? r.data : []) as Record<string, unknown>[];
  if (!ups.length) return done([]);
  const files = await boundedReport(db.from("rift_offer_files").select("upload_id,path,file_name,created_at").in("upload_id", ups.map((u) => u.id as string)).order("created_at"), "their PDFs");
  if (!files.ok) return files;
  const rows = ("data" in files ? files.data : []) as { upload_id: string; path: string; file_name: string; created_at: string }[];
  const urls = await links(rows.map((f) => f.path));
  return done(ups.map((u) => ({
    id: u.id as string,
    name: u.sender_name as string,
    phone: u.sender_phone as string,
    email: (u.sender_email as string | null) ?? null,
    at: u.created_at as string,
    read: (u.read_candidates as Candidates | null) ?? null,
    files: rows.filter((f) => f.upload_id === u.id).map((f) => ({ name: f.file_name, url: urls.get(f.path) ?? null, at: f.created_at })),
  })));
}

/**
 * Remove an upload that will never be an offer (a test, a duplicate, the
 * wrong file). Files first: a row deleted with its file left behind is a
 * document nobody can find to delete.
 */
export async function removeUpload(uploadId: string): Promise<DbResult<{ removed: true }>> {
  const db = serviceClient();
  if (!db) return skipped("no database configured");
  const agent_id = await currentAgentId();
  if (!agent_id) return skipped("not signed in");
  if (!isUuid(uploadId)) return failed("That upload could not be found");
  const files = await boundedReport(db.from("rift_offer_files").select("path").eq("upload_id", uploadId).eq("agent_id", agent_id), "its PDFs");
  if (!files.ok) return files;
  const paths = (("data" in files ? files.data : []) as { path: string }[]).map((f) => f.path);
  if (paths.length) {
    const gone = await boundedWrite(db.storage.from(BUCKET).remove(paths), "its PDFs");
    if (!gone.ok) return gone;
  }
  const del = await boundedWrite(db.from("rift_offer_uploads").delete().eq("id", uploadId).eq("agent_id", agent_id).is("offer_id", null), "the upload");
  if (!del.ok) return del;
  return done({ removed: true as const });
}
