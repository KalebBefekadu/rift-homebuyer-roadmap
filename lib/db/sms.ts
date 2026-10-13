import "server-only";

import { smsNumber } from "@/lib/core/sms";
import { currentAgentPhone } from "@/lib/db/service";
import { captureOpError } from "@/lib/monitoring/capture";
import type { SendResult } from "@/lib/db/email";

/* The email sender's deadline (lib/db/email.ts), not imported: email.ts calls
   this module, and the type-only import keeps the two from loading each other. */
const SEND_DEADLINE_MS = 10_000;

/**
 * A text to the agent's own phone, through Brevo's transactional SMS
 * (audit 12 Oct §3 #4, D40). Only ever to his number from Settings: nothing
 * here can text a lead, so there is no consent to record or STOP to honour.
 *
 * Off, and saying why, until three things exist: the Brevo key, a sender name
 * (`BREVO_SMS_SENDER`, up to 11 letters or a number Brevo allows) with SMS
 * credits on the account, and a phone number in Settings it can read. The
 * email alert goes either way; this is the faster second channel, never the
 * only one.
 */
export async function sendAgentText(content: string): Promise<SendResult> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return { ok: true, skipped: true, reason: "BREVO_API_KEY not set, so no text was sent" };
  const sender = process.env.BREVO_SMS_SENDER?.trim();
  if (!sender) return { ok: true, skipped: true, reason: "BREVO_SMS_SENDER not set, so lead alerts go by email only" };
  const raw = await currentAgentPhone();
  const recipient = smsNumber(raw);
  if (!recipient) {
    return { ok: true, skipped: true, reason: raw ? "the phone number in Settings could not be read as a mobile number" : "no phone number in Settings" };
  }

  try {
    const res = await fetch("https://api.brevo.com/v3/transactionalSMS/send", {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json", "api-key": apiKey },
      body: JSON.stringify({ sender, recipient, content, type: "transactional", tag: "agent-alert" }),
      signal: AbortSignal.timeout(SEND_DEADLINE_MS),
    });
    if (!res.ok) throw new Error(`Brevo SMS ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = (await res.json().catch(() => ({}))) as { messageId?: string | number };
    return { ok: true, messageId: data.messageId === undefined ? undefined : String(data.messageId) };
  } catch (error) {
    captureOpError(error, { op: "sms.newLead", extra: { hasKey: true } });
    return { ok: false, error: error instanceof Error ? error.message : "text failed" };
  }
}
