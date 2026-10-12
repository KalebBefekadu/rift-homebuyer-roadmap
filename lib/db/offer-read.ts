import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { mayCall, recordCall } from "./ai";
import { captureOpError } from "@/lib/monitoring/capture";
import { MODEL_FOR } from "@/lib/core/ai";
import { INSTRUCTIONS, PROMPT_VERSION, SCHEMA, readCandidates, type Candidates } from "@/lib/core/offer-extract";

/**
 * Reading an uploaded offer PDF (Blueprint v5 §5.9, DOC-02).
 *
 * The file itself is kept by lib/db/offer-upload.ts before this runs: the
 * upload is the delivery (manual review WS8.2), and the read is only a
 * convenience on top of it, with a named degraded state for every way it can
 * fail. The form works the same without it.
 */

export type ReadStatus = "read" | "not-configured" | "over-limit" | "refused" | "failed";

export interface OfferRead {
  status: ReadStatus;
  /** What to tell the sender, in a sentence. */
  say: string;
  candidates: Candidates;
}

/** Roughly how many pages, to refuse a page reference the document cannot have. */
function pageCount(bytes: Uint8Array): number | null {
  const text = Buffer.from(bytes).toString("latin1");
  const n = (text.match(/\/Type\s*\/Page(?![s\w])/g) ?? []).length;
  return n > 0 ? n : null;
}

export async function readOfferPdf(bytes: Uint8Array): Promise<OfferRead> {
  const may = await mayCall("offer-extraction");
  if (!may.ok) return { status: may.reason, say: `${may.say} Fill in the boxes below from your offer.`, candidates: {} };

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
      return { status: "refused", say: "This document could not be read automatically. Fill in the boxes below from your offer.", candidates: {} };
    }
    const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    let parsed: unknown = null;
    try { parsed = JSON.parse(text); } catch { parsed = null; }
    const candidates = readCandidates(parsed, pageCount(bytes));
    const n = Object.keys(candidates).length;
    return {
      status: "read",
      say: n
        ? `We read ${n} of the boxes from your PDF. Check each one against your offer before you send it.`
        : "Nothing could be read with confidence. Fill in the boxes below from your offer.",
      candidates,
    };
  } catch (e) {
    captureOpError(e, { op: "offer.read" });
    await recordCall({ workflow: "offer-extraction", model, promptVersion: PROMPT_VERSION, usage: null, outcome: "failed" });
    return { status: "failed", say: "The automatic reading did not work this time. Fill in the boxes below from your offer.", candidates: {} };
  }
}
