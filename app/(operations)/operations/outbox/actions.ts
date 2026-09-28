"use server";

import { revalidatePath } from "next/cache";
import { currentAgent } from "@/lib/db/session";
import { approveAndSend, discard, edit, resolveUnknown } from "@/lib/db/outbox";
import { isUuid } from "@/lib/core/ids";
import { sendNotice, stepNotice, type Notice } from "./notice";

/**
 * Outbox actions (Blueprint v5 §10.2). Each re-checks the session, and the
 * name on every step comes from it, never from the form.
 *
 * Each returns what happened, in words, for the item it was taken on (why:
 * ./notice.ts).
 */

export async function outboxAction(input: { id: string; what: string; subject?: string; body?: string }): Promise<Notice> {
  const agent = await currentAgent();
  if (!agent) return { ok: false, text: "You are signed out. Nothing was changed or sent." };
  const id = String(input.id ?? "");
  if (!isUuid(id)) return { ok: false, text: "Reload the page and try again. Nothing was changed or sent." };
  const what = String(input.what ?? "");
  let out: Notice;
  if (what === "send") out = sendNotice(await approveAndSend(agent.agentId, id, agent.name));
  else if (what === "discard") out = stepNotice(await discard(agent.agentId, id, agent.name), "Discarded.");
  else if (what === "edit") {
    out = stepNotice(
      await edit(agent.agentId, id, agent.name, String(input.subject ?? ""), String(input.body ?? "")),
      "Saved as a new draft. Approve it when it reads right.",
    );
  } else if (what === "sent" || what === "not-sent") {
    out = stepNotice(await resolveUnknown(agent.agentId, id, agent.name, what === "sent" ? "succeeded" : "failed"), "Recorded.");
  } else return { ok: false, text: "Reload the page and try again. Nothing was changed or sent." };
  revalidatePath("/operations/outbox");
  revalidatePath("/operations");
  return out;
}
