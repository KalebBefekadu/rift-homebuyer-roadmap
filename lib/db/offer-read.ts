import "server-only";
import { randomUUID } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { serviceClient } from "./service";
import { boundedRead, boundedTransfer, boundedWrite } from "./bounded";
import { mayCall, recordCall } from "./ai";
import { captureOpError } from "@/lib/monitoring/capture";
import { MODEL_FOR } from "@/lib/core/ai";
import { INSTRUCTIONS, PROMPT_VERSION, SCHEMA, readCandidates, type Candidates } from "@/lib/core/offer-extract";
import { isUuid } from "@/lib/core/ids";

/**
 * Reading an uploaded offer PDF (Blueprint v5 §5.9, DOC-02).
 *
 * The file waits in the private bucket's incoming area under a random token
 * until the sender presses send, when lib/db/offer-intake.ts moves it beside
 * the offer. A file nobody sends is removed after a day. The automatic read
 * is a convenience with a named degraded state for every way it can fail:
 * the form works the same without it.
 */

const BUCKET = "rift-documents";
const INCOMING = "offers/incoming";
const DAY_MS = 86_400_000;

export type ReadStatus = "read" | "not-configured" | "over-limit" | "refused" | "failed";

export interface OfferRead {
  status: ReadStatus;
  /** What to tell the sender, in a sentence. */
  say: string;
  candidates: Candidates;
  /** Sent back with the offer so the file is attached. Null when it could not be kept. */
  token: string | null;
}

/** Roughly how many pages, to refuse a page reference the document cannot have. */
function pageCount(bytes: Uint8Array): number | null {
  const text = Buffer.from(bytes).toString("latin1");
  const n = (text.match(/\/Type\s*\/Page(?![s\w])/g) ?? []).length;
  return n > 0 ? n : null;
}

async function keep(bytes: Uint8Array): Promise<string | null> {
  const db = serviceClient();
  if (!db) return null;
  /* Clear anything nobody sent within a day, while we are here. */
  const list = await boundedRead(db.storage.from(BUCKET).list(INCOMING, { limit: 200 }), "the incoming offers");
  if (list.ok && "data" in list) {
    const old = ((list.data ?? []) as { name: string; created_at?: string }[])
      .filter((f) => f.created_at && Date.now() - Date.parse(f.created_at) > DAY_MS)
      .map((f) => `${INCOMING}/${f.name}`);
    if (old.length) await boundedWrite(db.storage.from(BUCKET).remove(old), "the unsent offers");
  }
  const token = randomUUID();
  const up = await boundedTransfer(
    db.storage.from(BUCKET).upload(`${INCOMING}/${token}.pdf`, Buffer.from(bytes), { contentType: "application/pdf", upsert: false }),
    "the offer PDF",
  );
  if (!up.ok) { captureOpError(new Error(up.error), { op: "offer.keep" }); return null; }
  return token;
}

async function keepCandidates(token: string, c: Candidates) {
  const db = serviceClient();
  if (!db) return;
  await boundedWrite(
    db.storage.from(BUCKET).upload(`${INCOMING}/${token}.json`, Buffer.from(JSON.stringify(c)), { contentType: "application/json", upsert: true }),
    "the offer read",
  );
}

export async function readOfferPdf(bytes: Uint8Array): Promise<OfferRead> {
  const token = await keep(bytes);
  const may = await mayCall("offer-extraction");
  if (!may.ok) return { status: may.reason, say: `${may.say} Fill in the boxes below from your offer.`, candidates: {}, token };

  const model = MODEL_FOR["offer-extraction"];
  try {
    const client = new Anthropic();
    const res = await client.beta.messages.create({
      model,
      max_tokens: 16_000,
      /* A decline falls back to the previous Opus inside the same call,
         rather than leaving the sender with an empty form. */
      betas: ["server-side-fallback-2026-06-01"],
      fallbacks: [{ model: "claude-opus-4-8" }],
      output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA as unknown as Record<string, unknown> } },
      messages: [{
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: Buffer.from(bytes).toString("base64") } },
          { type: "text", text: INSTRUCTIONS },
        ],
      }],
    }, { timeout: 90_000, maxRetries: 1 });

    /* Billed at the rates of the model that served it. */
    await recordCall({ workflow: "offer-extraction", model: res.model, promptVersion: PROMPT_VERSION, usage: res.usage, outcome: res.stop_reason === "refusal" ? "refused" : "ok" });
    if (res.stop_reason === "refusal") {
      return { status: "refused", say: "This document could not be read automatically. Fill in the boxes below from your offer.", candidates: {}, token };
    }
    const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    let parsed: unknown = null;
    try { parsed = JSON.parse(text); } catch { parsed = null; }
    const candidates = readCandidates(parsed, pageCount(bytes));
    if (token) await keepCandidates(token, candidates);
    const n = Object.keys(candidates).length;
    return {
      status: "read",
      say: n
        ? `We read ${n} of the boxes from your PDF. Check each one against your offer before you send it.`
        : "Nothing could be read with confidence. Fill in the boxes below from your offer.",
      candidates,
      token,
    };
  } catch (e) {
    captureOpError(e, { op: "offer.read" });
    await recordCall({ workflow: "offer-extraction", model, promptVersion: PROMPT_VERSION, usage: null, outcome: "failed" });
    return { status: "failed", say: "The automatic reading did not work this time. Fill in the boxes below from your offer.", candidates: {}, token };
  }
}

/** Moves a sent offer's PDF beside it, and returns its place and what the read proposed. */
export async function attachOfferPdf(token: string, offerId: string): Promise<{ path: string; candidates: Candidates | null } | null> {
  const db = serviceClient();
  if (!db || !isUuid(token) || !isUuid(offerId)) return null;
  const path = `offers/${offerId}.pdf`;
  const moved = await boundedTransfer(db.storage.from(BUCKET).move(`${INCOMING}/${token}.pdf`, path), "the offer PDF");
  if (!moved.ok) { captureOpError(new Error(moved.error), { op: "offer.attach" }); return null; }
  let candidates: Candidates | null = null;
  const got = await boundedTransfer(db.storage.from(BUCKET).download(`${INCOMING}/${token}.json`), "the offer read");
  if (got.ok && "data" in got && got.data) {
    try { candidates = JSON.parse(await (got.data as Blob).text()) as Candidates; } catch { candidates = null; }
    await boundedWrite(db.storage.from(BUCKET).remove([`${INCOMING}/${token}.json`]), "the offer read");
  }
  return { path, candidates };
}
