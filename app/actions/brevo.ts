"use server";

import { syncContactToBrevo, type BrevoSyncPayload } from "@/lib/brevo/sync";

/** Server Action: sync client to Brevo after roadmap save (never silent on failure). */
export async function syncClientToBrevoAction(payload: BrevoSyncPayload) {
  return syncContactToBrevo(payload);
}
