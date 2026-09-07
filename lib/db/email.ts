import "server-only";
import { captureOpError } from "@/lib/monitoring/capture";
import { money } from "@/lib/core/compute";

/**
 * Transactional email, through Brevo.
 *
 * Follows the degradation rule exactly: no API key means every send returns
 * `{ ok: true, skipped: true, reason }` and nothing is silently swallowed. The
 * caller can always tell "sent" from "not configured", which a bare try/catch
 * loses — and losing it is how a product ends up never emailing anyone in
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
  if (!apiKey) return { ok: true, skipped: true, reason: "BREVO_API_KEY not set — nothing was sent" };
  if (!FROM_EMAIL) {
    return { ok: true, skipped: true, reason: "BREVO_FROM_EMAIL not set — Brevo rejects any send without a verified sender" };
  }

  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json", "api-key": apiKey },
      body: JSON.stringify({ sender: FROM, ...payload }),
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

export interface ReadoutEmail {
  to: string;
  name?: string;
  shareUrl: string;
  cashToClose: number;
  gap: number;
  monthsToClose: number | null;
  county: string;
}

/**
 * The readout, delivered.
 *
 * Carries the two figures that matter in the body rather than only a link,
 * because the email is often read on a locked phone at a bus stop and a link
 * is a decision. Whether this sends automatically on completion or only when
 * asked for is `autoEmailReadout`, a business rule, not a constant.
 */
export async function sendReadout(r: ReadoutEmail): Promise<SendResult> {
  const gapLine = r.gap <= 0
    ? "Your savings already cover what it takes to close."
    : r.monthsToClose !== null
      ? `You are about ${r.monthsToClose} months from covering it on your own.`
      : "Tell us what you set aside each month and we can put a date on it.";

  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a;line-height:1.6">
  <p style="font-size:15px">${r.name ? `${escapeHtml(r.name)},` : "Here it is,"}</p>
  <p style="font-size:15px">
    Buying in ${escapeHtml(r.county)} County takes <strong>${money(r.cashToClose)}</strong> at the
    table — not the down payment figure most people are quoted. ${gapLine}
  </p>
  <p style="font-size:15px">
    <a href="${r.shareUrl}" style="color:#e8442a">Your full readout is here</a> — every line of
    that figure, the Georgia programs you may qualify for, and what to ask a lender.
  </p>
  <p style="font-size:13px;color:#666">
    It is yours to keep and to share. Every figure is a planning estimate, not a lending
    commitment or approval. Nothing here requires you to work with us.
  </p>
  <p style="font-size:12px;color:#888">
    You are getting this because you asked for your readout at Rift. We do not run a newsletter
    and we do not sell anything on. <a href="{{ unsubscribe }}" style="color:#888">Unsubscribe</a>.
  </p>
</div>`.trim();

  return send({
    to: [{ email: r.to, ...(r.name ? { name: r.name } : {}) }],
    subject: `Your numbers: ${money(r.cashToClose)} to close in ${r.county} County`,
    htmlContent: html,
    tags: ["readout"],
  }, "email.readout");
}

export interface TouchEmail {
  to: string;
  name?: string;
  /** The step's own subject line, from the cadence definition. */
  says: string;
  /** What this touch gives them. The cadence forbids a step without one. */
  gives: string;
  shareUrl: string;
  county: string | null;
  figures: Record<string, string | number> | null;
}

/**
 * One step of the cadence.
 *
 * Each touch sends its OWN content. The runner previously sent the same readout
 * email for every step, with zeroes in place of the person's figures — so a
 * five-step sequence was five identical messages saying "Buying in your County
 * takes $0 at the table". That breaks the cadence's first and most important
 * rule, that every touch carries something new, and it does it in the most
 * damaging possible way: by proving nobody is paying attention, to somebody
 * deciding whether to trust us with their finances.
 *
 * A touch with no figures behind it is not sent at all. There is no version of
 * this email that is worth sending with the numbers missing.
 */
export async function sendTouch(t: TouchEmail): Promise<SendResult> {
  if (!t.figures || t.figures.cashToClose === undefined) {
    return { ok: true, skipped: true, reason: "no readout figures for this lead — nothing worth sending" };
  }

  const cash = Number(t.figures.cashToClose) || 0;
  const gap = Number(t.figures.gap) || 0;
  const where = t.county ? `${escapeHtml(t.county)} County` : "your area";

  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a;line-height:1.6">
  <p style="font-size:15px">${t.name ? `${escapeHtml(t.name)},` : "Hello,"}</p>
  <p style="font-size:15px">${escapeHtml(t.gives)}</p>
  <p style="font-size:15px">
    Your readout still says <strong>${money(cash)}</strong> at the table in ${where}${
      gap > 0 ? `, with <strong>${money(gap)}</strong> still to find` : ", and your savings already cover it"
    }.
    <a href="${t.shareUrl}" style="color:#e8442a">Open it here</a> — it is kept up to date and it stays yours.
  </p>
  <p style="font-size:13px;color:#666">
    Every figure is a planning estimate, not a lending commitment or approval. Nothing here
    requires you to work with us.
  </p>
  <p style="font-size:12px;color:#888">
    You asked for your readout at Rift. We do not run a newsletter and we do not sell anything
    on. <a href="{{ unsubscribe }}" style="color:#888">Unsubscribe</a> — one click, and it stops
    everything.
  </p>
</div>`.trim();

  return send({
    to: [{ email: t.to, ...(t.name ? { name: t.name } : {}) }],
    subject: t.says,
    htmlContent: html,
    tags: ["nurture"],
  }, "email.touch");
}

/** Minimal escaping. Names come from a public form and end up in markup. */
function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ?? c));
}
