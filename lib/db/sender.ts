import "server-only";
import { senderVerdict, type SenderVerdict } from "@/lib/core/setup";

/**
 * Whether Brevo will send from BREVO_FROM_EMAIL, asked of Brevo.
 *
 * Moved here from /api/health so the settings page can ask the same question
 * and get the same answer. The rules it was written under still hold:
 *
 *   - It is only ever asked on purpose: by the health check holding the cron
 *     secret, or by the agent pressing "Ask Brevo". Never on a public request
 *     and never on page load: each call from a new serverless address can
 *     make Brevo email the account owner a security alert.
 *   - Cached for ten minutes, per instance. A definite answer is kept; "Brevo
 *     did not answer" is not, so it clears on the next ask.
 *   - Only a verdict leaves this module: never the key, never an address.
 */

const TTL_MS = 10 * 60_000;
let cached: { at: number; verdict: SenderVerdict } | null = null;

/** The last definite answer, if it is recent. Costs nothing; asks nobody. */
export function lastSenderVerdict(now = Date.now()): SenderVerdict | null {
  return cached && now - cached.at < TTL_MS ? cached.verdict : null;
}

/** Null when there is nothing to ask about: no key or no sending address. */
export async function askBrevoAboutSender(): Promise<SenderVerdict | null> {
  const key = process.env.BREVO_API_KEY;
  const from = process.env.BREVO_FROM_EMAIL;
  if (!key || !from) return null;

  const recent = lastSenderVerdict();
  if (recent) return recent;

  try {
    const res = await fetch("https://api.brevo.com/v3/senders", {
      headers: { accept: "application/json", "api-key": key },
      signal: AbortSignal.timeout(4000),
    });
    const verdict = senderVerdict(res.status, await res.text(), from);
    if (verdict !== "unknown") cached = { at: Date.now(), verdict };
    return verdict;
  } catch {
    /* A timeout is not a verdict. */
    return "unknown";
  }
}

/** The words /api/health has always used, so a monitor matching on them keeps working. */
export const SENDER_HEALTH: Record<SenderVerdict, string> = {
  ready: "ready",
  awaiting: "sender awaiting verification",
  unregistered: "sender not registered in Brevo",
  blocked: "blocked: Brevo's IP allowlist refuses this server",
  refused: "refused by Brevo",
  unknown: "unknown: Brevo did not answer",
};
