import { captureOpError } from "@/lib/monitoring/capture";
import type { TimeToBuy, ClientStage } from "@/lib/roadmap/types";

export type BrevoSyncPayload = {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  timeToBuy: TimeToBuy;
  stage: ClientStage;
  event: "roadmap_completed" | "roadmap_updated" | "stage_changed";
  clientId: string;
};

export type BrevoSyncResult =
  | { ok: true; skipped?: boolean; reason?: string }
  | { ok: false; error: string };

/**
 * Upsert contact + attributes into Brevo.
 * No-ops cleanly when BREVO_API_KEY is missing (local/dev).
 * Failures are never silent — captured in Sentry.
 */
export async function syncContactToBrevo(payload: BrevoSyncPayload): Promise<BrevoSyncResult> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    return { ok: true, skipped: true, reason: "BREVO_API_KEY not set" };
  }

  if (!payload.email?.trim()) {
    return { ok: true, skipped: true, reason: "no email on contact" };
  }

  try {
    const res = await fetch("https://api.brevo.com/v3/contacts", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        email: payload.email.trim().toLowerCase(),
        updateEnabled: true,
        attributes: {
          FIRSTNAME: payload.firstName,
          LASTNAME: payload.lastName,
          SMS: payload.phone || undefined,
          STAGE: payload.stage,
          TIME_TO_BUY: payload.timeToBuy,
          RIFT_CLIENT_ID: payload.clientId,
          RIFT_EVENT: payload.event,
        },
      }),
    });

    // 204 = created/updated success for Brevo contact upsert in some cases; 201 create; 204 update
    if (!res.ok && res.status !== 204) {
      const body = await res.text();
      // 400 duplicate with updateEnabled should be rare; treat other errors as failure
      if (res.status === 400 && body.includes("already exist")) {
        return { ok: true };
      }
      throw new Error(`Brevo ${res.status}: ${body.slice(0, 300)}`);
    }

    return { ok: true };
  } catch (error) {
    captureOpError(error, {
      op: "brevo.syncContact",
      extra: {
        clientId: payload.clientId,
        event: payload.event,
        stage: payload.stage,
        timeToBuy: payload.timeToBuy,
        hasEmail: Boolean(payload.email),
      },
    });
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Brevo sync failed",
    };
  }
}
