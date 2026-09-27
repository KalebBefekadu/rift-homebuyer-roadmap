"use server";

import { revalidatePath } from "next/cache";
import { currentAgent } from "@/lib/db/session";
import { approveAndSend, discard, edit, resolveUnknown } from "@/lib/db/outbox";

/**
 * Outbox actions (Blueprint v5 §10.2). Each re-checks the session, and the
 * name on every step comes from it, never from the form.
 */
const ID = /^[0-9a-f-]{36}$/i;

export async function outboxAction(form: FormData) {
  const agent = await currentAgent();
  if (!agent) return;
  const id = String(form.get("id") ?? "");
  if (!ID.test(id)) return;
  const what = String(form.get("what") ?? "");
  if (what === "send") await approveAndSend(agent.agentId, id, agent.name);
  else if (what === "discard") await discard(agent.agentId, id, agent.name);
  else if (what === "edit") await edit(agent.agentId, id, agent.name, String(form.get("subject") ?? ""), String(form.get("body") ?? ""));
  else if (what === "sent" || what === "not-sent") await resolveUnknown(agent.agentId, id, agent.name, what === "sent" ? "succeeded" : "failed");
  revalidatePath("/operations/outbox");
  revalidatePath("/operations");
}
