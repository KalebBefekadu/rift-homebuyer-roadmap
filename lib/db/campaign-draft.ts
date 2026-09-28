import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { mayCall, recordCall } from "./ai";
import { captureOpError } from "@/lib/monitoring/capture";
import { MODEL_FOR } from "@/lib/core/ai";
import { PROMPT_VERSION, SCHEMA, instructions, readDraft, type Draft } from "@/lib/core/campaign-draft";

/**
 * Asking for a campaign draft (Blueprint v5 §5.10, CAMP-01). A convenience
 * with a named degraded state for each way it can fail; the composer works
 * the same without it. Rules: lib/core/campaign-draft.ts.
 */

export type DraftStatus = "drafted" | "not-configured" | "over-limit" | "refused" | "failed" | "empty";

export interface DraftResult {
  status: DraftStatus;
  /** What to tell the agent, in a sentence. */
  say: string;
  draft: Draft | null;
}

export async function draftCampaign(brief: string): Promise<DraftResult> {
  const may = await mayCall("campaign-draft");
  if (!may.ok) return { status: may.reason, say: `${may.say} The blocks can be written by hand.`, draft: null };

  const model = MODEL_FOR["campaign-draft"];
  try {
    const client = new Anthropic();
    const res = await client.messages.create({
      model,
      max_tokens: 3_000,
      output_config: { format: { type: "json_schema", schema: SCHEMA as unknown as Record<string, unknown> } },
      messages: [{ role: "user", content: `${instructions()}\n\n<brief>\n${brief.trim()}\n</brief>` }],
    }, { timeout: 60_000, maxRetries: 1 });

    await recordCall({ workflow: "campaign-draft", model: res.model, promptVersion: PROMPT_VERSION, usage: res.usage, outcome: res.stop_reason === "refusal" ? "refused" : "ok" });
    if (res.stop_reason === "refusal") return { status: "refused", say: "That brief could not be drafted. The blocks can be written by hand.", draft: null };
    const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    let parsed: unknown = null;
    try { parsed = JSON.parse(text); } catch { parsed = null; }
    const draft = readDraft(parsed);
    if (!draft) return { status: "empty", say: "Nothing in the draft passed the checks. Try a more specific brief, or write the blocks by hand.", draft: null };
    return {
      status: "drafted",
      say: `A draft of ${draft.recipe.blocks.length} block${draft.recipe.blocks.length === 1 ? "" : "s"} is in the editor. Read every word before saving; nothing is saved until you save it.`,
      draft,
    };
  } catch (e) {
    captureOpError(e, { op: "campaign.draft" });
    await recordCall({ workflow: "campaign-draft", model, promptVersion: PROMPT_VERSION, usage: null, outcome: "failed" });
    return { status: "failed", say: "Drafting did not work this time. The blocks can be written by hand.", draft: null };
  }
}
