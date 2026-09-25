import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { centsFor, worstCaseCents } from "@/lib/core/ai-budget";
import {
  EXTRACT_PROMPT_VERSION, EXTRACT_SCHEMA, EXTRACT_SYSTEM, acceptCandidates, readableFrom, type Extracted,
} from "@/lib/core/offer-extract";
import { reserve, settle } from "@/lib/db/ai-usage";
import { captureOpError } from "@/lib/monitoring/capture";

/**
 * Reads an offer PDF with Claude (decision D16). Returns candidates for the
 * form, or a reason to fill it in by hand, never an exception: every way this
 * can fail ends at the manual form, which is where the page started.
 *
 * The model is the one named here and recorded with every call. D16 asks for
 * the smallest model that passes the extraction accuracy tests; until those
 * tests exist this uses Claude Opus 5, which a few pages of PDF keep to about
 * ten cents a reading, and the per-call ceiling stops a long document before
 * it is sent. The PDF is sent once and not kept by Rift.
 */
export const EXTRACT_MODEL = "claude-opus-5";
const MAX_OUTPUT_TOKENS = 4_000;

export type ExtractResult =
  | { ok: true; extracted: Extracted }
  | { ok: false; manual: true; say: string };

const manual = (say: string): ExtractResult => ({ ok: false, manual: true, say });

export async function extractOffer(pdf: Uint8Array): Promise<ExtractResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return manual("Automatic reading is not switched on yet. Fill in the boxes from your PDF.");
  }
  const client = new Anthropic();
  const data = Buffer.from(pdf).toString("base64");
  const messages: Anthropic.MessageParam[] = [{
    role: "user",
    content: [
      { type: "document", source: { type: "base64", media_type: "application/pdf", data } },
      { type: "text", text: "Report the terms of this offer." },
    ],
  }];

  /* Counted exactly before anything is spent: counting is free, and it is
     what lets the limit refuse a long document instead of paying for it. */
  let inputTokens: number;
  try {
    const counted = await client.messages.countTokens({ model: EXTRACT_MODEL, system: EXTRACT_SYSTEM, messages });
    inputTokens = counted.input_tokens;
  } catch (e) {
    captureOpError(e instanceof Error ? e : new Error(String(e)), { op: "ai.offerExtract.count" });
    return manual("We could not read that PDF automatically. Fill in the boxes from it.");
  }

  const worst = worstCaseCents(EXTRACT_MODEL, inputTokens, MAX_OUTPUT_TOKENS);
  const held = await reserve("offer-extract", EXTRACT_MODEL, EXTRACT_PROMPT_VERSION, worst);
  if (!held.ok) {
    captureOpError(new Error(held.error), { op: "ai.offerExtract.reserve" });
    return manual("We could not read that PDF automatically. Fill in the boxes from it.");
  }
  if ("skipped" in held) return manual("Automatic reading is not switched on yet. Fill in the boxes from your PDF.");
  if ("reason" in held.data) return manual(`${held.data.say} Fill in the boxes from your PDF.`);
  const reservation = held.data;

  try {
    const response = await client.beta.messages.create({
      model: EXTRACT_MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: EXTRACT_SYSTEM,
      messages: messages as Anthropic.Beta.BetaMessageParam[],
      output_config: { effort: "low", format: { type: "json_schema", schema: EXTRACT_SCHEMA as unknown as Record<string, unknown> } },
      /* If the model declines, the request is re-run on a fallback inside
         the same call; the ledger prices that at the dearest model. */
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });

    const fellBack = (response.usage.iterations ?? []).some((i) => i.type === "fallback_message");
    const cents = centsFor(EXTRACT_MODEL, response.usage.input_tokens, response.usage.output_tokens, fellBack);
    await settle(reservation, {
      ok: response.stop_reason !== "refusal", model: response.model, cents,
      inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens,
    });

    if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") {
      return manual("We could not read that PDF automatically. Fill in the boxes from it.");
    }
    const text = response.content.find((b) => b.type === "text");
    let parsed: unknown = null;
    try { parsed = text && text.type === "text" ? JSON.parse(text.text) : null; } catch { parsed = null; }
    if (!readableFrom(parsed)) {
      return manual("That PDF does not look like an offer we can read. Fill in the boxes from it.");
    }
    const extracted = acceptCandidates(parsed);
    if (!Object.keys(extracted.sources).length) {
      return manual("We could not find the terms in that PDF. Fill in the boxes from it.");
    }
    return { ok: true, extracted };
  } catch (e) {
    /* The request may have been billed before it failed (a timeout after the
       model answered), and nothing here can tell. It settles at its worst
       case: the limit has to hold even when the ledger is pessimistic. */
    await settle(reservation, { ok: false, model: EXTRACT_MODEL, cents: worst });
    captureOpError(e instanceof Error ? e : new Error(String(e)), { op: "ai.offerExtract.call" });
    return manual("We could not read that PDF automatically. Fill in the boxes from it.");
  }
}
