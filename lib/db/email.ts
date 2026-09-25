import "server-only";
import { captureOpError } from "@/lib/monitoring/capture";

/**
 * Transactional email, through Brevo.
 *
 * Follows the degradation rule exactly: no API key means every send returns
 * `{ ok: true, skipped: true, reason }` and nothing is silently swallowed. The
 * caller can always tell "sent" from "not configured", which a bare try/catch
 * loses, and losing it is how a product ends up never emailing anyone in
 * production while every local run looks fine.
 *
 * One rule beyond delivery: a bounce is not a logging event, it is an agent
 * task. A bounced readout looks exactly like disinterest from the outside, and
 * an agent who writes somebody off for a dead mailbox has lost a client to a
 * typo. Wiring the webhook is phase 3's remaining work; the shape is here.
 */

export type SendResult =
  | { ok: true; messageId?: string }
  | { ok: true; skipped: true; reason: string }
  | { ok: false; error: string };

/**
 * The sending address must be one Brevo has verified, or every send is rejected
 * at the API and the failure looks like a bug in this file. Treated as missing
 * configuration rather than a default, so an unconfigured deployment reports
 * "not configured" instead of failing every message with a confusing 400.
 */
const FROM_EMAIL = process.env.BREVO_FROM_EMAIL;
const FROM = { name: "Rift", email: FROM_EMAIL ?? "" };

async function send(payload: Record<string, unknown>, op: string): Promise<SendResult> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return { ok: true, skipped: true, reason: "BREVO_API_KEY not set, so nothing was sent" };
  if (!FROM_EMAIL) {
    return { ok: true, skipped: true, reason: "BREVO_FROM_EMAIL not set; Brevo rejects any send without a verified sender" };
  }

  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json", "api-key": apiKey },
      /* Reply-To is always the real address. Brevo cannot authenticate a
         free-mail sender such as @gmail.com, so it rewrites the visible From
         to an @brevosend.com address; without this, a client's reply would
         go there instead of to the agent. */
      body: JSON.stringify({ sender: FROM, replyTo: { email: FROM_EMAIL }, ...payload }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Brevo ${res.status}: ${body.slice(0, 300)}`);
    }
    const data = (await res.json()) as { messageId?: string };
    return { ok: true, messageId: data.messageId };
  } catch (error) {
    captureOpError(error, { op, extra: { hasKey: true } });
    return { ok: false, error: error instanceof Error ? error.message : "send failed" };
  }
}

import {
  buildReadout, buildTouch, buildResume, buildNewLead, buildOfferChosen, buildSavedPlan,
  type ReadoutEmail, type TouchEmail, type ResumeEmail, type NewLeadEmail, type OfferChosenEmail, type SavedPlanEmail,
} from "@/lib/core/email";

/* Re-exported so callers keep importing their email types from one place. */
export {
  buildReadout, buildTouch, buildResume, buildNewLead, buildOfferChosen,
  type ReadoutEmail, type TouchEmail, type ResumeEmail, type NewLeadEmail, type OfferChosenEmail,
};

/**
 * Sending. The building is in lib/core/email.ts, where it can be tested:
 * see the note at the top of that file for what living here cost it.
 *
 * Every one of these refuses rather than sends when the builder returns null.
 * A message with a zero where somebody's figure should be is worse than no
 * message: it proves nobody is paying attention, to a person deciding whether
 * to trust us with their finances.
 */
export async function sendReadout(r: ReadoutEmail): Promise<SendResult> {
  const built = buildReadout(r);
  if (!built) {
    return { ok: true, skipped: true, reason: "no figures for this readout, so nothing worth sending" };
  }
  return send({
    to: [{ email: r.to, ...(r.name ? { name: r.name } : {}) }],
    subject: built.subject,
    htmlContent: built.html,
    tags: ["readout"],
  }, "email.readout");
}

export async function sendSavedPlan(p: SavedPlanEmail): Promise<SendResult> {
  const built = buildSavedPlan(p);
  return send({
    to: [{ email: p.to, ...(p.name ? { name: p.name } : {}) }],
    subject: built.subject,
    htmlContent: built.html,
    tags: ["plan"],
  }, "email.plan");
}

export async function sendTouch(t: TouchEmail): Promise<SendResult> {
  const built = buildTouch(t);
  if (!built) {
    return { ok: true, skipped: true, reason: "no readout figures for this lead, so nothing worth sending" };
  }
  return send({
    to: [{ email: t.to, ...(t.name ? { name: t.name } : {}) }],
    subject: built.subject,
    htmlContent: built.html,
    tags: ["nurture"],
  }, "email.touch");
}

/**
 * The addresses Brevo will not send to, with its reason code for each (AT37).
 *
 * Every touch carries Brevo's unsubscribe link, so an opt-out lands there, not
 * here. Brevo then refuses the send, but the refusal comes after the API has
 * already answered 201, and the touch would be recorded as sent while the
 * sequence carried on. Reading the list before a run is how the opt-out
 * reaches the sequence.
 *
 * Newest first, up to a thousand. If it cannot be read, Brevo still enforces
 * the list at send time; the caller says the check did not run.
 */
export type BlockList =
  | { ok: true; codes: Map<string, string> }
  | { ok: true; skipped: true; reason: string }
  | { ok: false; error: string };

export async function blockedContacts(): Promise<BlockList> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return { ok: true, skipped: true, reason: "BREVO_API_KEY not set" };
  const codes = new Map<string, string>();
  try {
    for (let offset = 0; offset < 1000; offset += 100) {
      const res = await fetch(`https://api.brevo.com/v3/smtp/blockedContacts?limit=100&offset=${offset}&sort=desc`, {
        headers: { accept: "application/json", "api-key": apiKey },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`Brevo ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const body = (await res.json()) as { contacts?: { email?: string; reason?: { code?: string } }[] };
      const page = body.contacts ?? [];
      for (const c of page) if (c.email) codes.set(c.email.trim().toLowerCase(), c.reason?.code ?? "unknown");
      if (page.length < 100) break;
    }
    return { ok: true, codes };
  } catch (error) {
    captureOpError(error, { op: "email.blocklist" });
    return { ok: false, error: error instanceof Error ? error.message : "the block list could not be read" };
  }
}

export async function sendResume(r: ResumeEmail): Promise<SendResult> {
  const { subject, html } = buildResume(r);
  return send({
    to: [{ email: r.to, ...(r.name ? { name: r.name } : {}) }],
    subject,
    htmlContent: html,
    tags: ["recovery"],
  }, "email.resume");
}

/**
 * The alert to the agent.
 *
 * Tagged separately so that the day this becomes noisy, it can be silenced
 * without touching anything a client receives, and so a bounce on Kaleb's own
 * address is distinguishable from a bounce on a stranger's, which is a very
 * different problem.
 *
 * No unsubscribe footer: this is not marketing to a contact, it is the product
 * telling its operator that somebody is waiting. Brevo's `{{ unsubscribe }}`
 * on it would let one misclick stop every lead alert.
 */
export async function sendNewLead(l: NewLeadEmail): Promise<SendResult> {
  const built = buildNewLead(l);
  if (!built) {
    return { ok: true, skipped: true, reason: "no way to reach this person; an alert with no action in it" };
  }
  return send({
    to: [{ email: l.to, name: "Kaleb" }],
    subject: built.subject,
    htmlContent: built.html,
    tags: ["agent-alert"],
  }, "email.newLead");
}

/** The alert that a seller has picked an offer. Same tag, same reasons, as the lead alert. */
export async function sendOfferChosen(c: OfferChosenEmail): Promise<SendResult> {
  const { subject, html } = buildOfferChosen(c);
  return send({
    to: [{ email: c.to, name: "Kaleb" }],
    subject,
    htmlContent: html,
    tags: ["agent-alert"],
  }, "email.offerChosen");
}

/**
 * The agent's morning summary (W12, D07). One email a business day, built in
 * lib/core/summary.ts. Tagged apart from the instant alerts so either can be
 * silenced without touching the other.
 */
export async function sendDailySummary(to: string, built: { subject: string; html: string }): Promise<SendResult> {
  return send({
    to: [{ email: to, name: "Kaleb" }],
    subject: built.subject,
    htmlContent: built.html,
    tags: ["agent-summary"],
  }, "email.dailySummary");
}

/**
 * Remove Brevo's log of every transactional email sent to an address, and the
 * stored previews with it (W11, AT36: a provider's copy goes when the person
 * asks to be forgotten). 204 is removed; 404 is nothing there to remove. The
 * block list is left alone on purpose: an opt-out must outlive the record.
 */
export async function forgetAtBrevo(email: string): Promise<{ ok: true; skipped?: true } | { ok: false; error: string }> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return { ok: true, skipped: true };
  try {
    const res = await fetch(`https://api.brevo.com/v3/smtp/log/${encodeURIComponent(email.trim())}`, {
      method: "DELETE",
      headers: { accept: "application/json", "api-key": apiKey },
      signal: AbortSignal.timeout(5000),
    });
    if (res.status === 204 || res.status === 404 || res.ok) return { ok: true };
    return { ok: false, error: `Brevo ${res.status}: ${(await res.text()).slice(0, 200)}` };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Brevo could not be reached" };
  }
}
