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
export function buildReadout(r: ReadoutEmail): { subject: string; html: string } {
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

  return { subject: `Your numbers: ${money(r.cashToClose)} to close in ${r.county} County`, html };
}

export async function sendReadout(r: ReadoutEmail): Promise<SendResult> {
  const { subject, html } = buildReadout(r);
  return send({
    to: [{ email: r.to, ...(r.name ? { name: r.name } : {}) }],
    subject,
    htmlContent: html,
    tags: ["readout"],
  }, "email.readout");
}

export interface TouchEmail {
  to: string;
  name?: string;
  /** The step's own subject line, from the cadence definition. */
  says: string;
  /** The opening line the person reads. Never `gives`, which is a design note. */
  body: string;
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
export function buildTouch(t: TouchEmail): { subject: string; html: string } | null {
  if (!t.figures || t.figures.cashToClose === undefined) return null;

  const cash = Number(t.figures.cashToClose) || 0;
  const gap = Number(t.figures.gap) || 0;
  const where = t.county ? `${escapeHtml(t.county)} County` : "your area";

  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a;line-height:1.6">
  <p style="font-size:15px">${t.name ? `${escapeHtml(t.name)},` : "Hello,"}</p>
  <p style="font-size:15px">${escapeHtml(t.body)}</p>
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

  return { subject: t.says, html };
}

export async function sendTouch(t: TouchEmail): Promise<SendResult> {
  const built = buildTouch(t);
  if (!built) {
    return { ok: true, skipped: true, reason: "no readout figures for this lead — nothing worth sending" };
  }
  return send({
    to: [{ email: t.to, ...(t.name ? { name: t.name } : {}) }],
    subject: built.subject,
    htmlContent: built.html,
    tags: ["nurture"],
  }, "email.touch");
}

export interface ResumeEmail {
  to: string;
  name?: string;
  says: string;
  body: string;
  resumeUrl: string;
  answered: number;
  of: number;
  /** True for the closing touch of the dormant sequence. */
  last?: boolean;
}

/**
 * Recovery, for somebody who started and stopped.
 *
 * A separate email because these people have NO readout — that is the whole
 * reason they are in this sequence — so the ordinary touch, which leads with
 * their figures, refuses to send and would silently never reach the largest
 * population in the funnel.
 *
 * Recovery, not pursuit. It carries how far they got and a link back, says
 * nothing about what they might be missing, and the closing touch says outright
 * that it is the last one. A list you cannot stop sending to is not a list, it
 * is a liability — and saying so is the only version of this email that earns
 * being sent at all.
 */
export function buildResume(r: ResumeEmail): { subject: string; html: string } {
  const progress = r.of > 0 ? `${r.answered} of ${r.of} questions` : "part of the way";

  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a;line-height:1.6">
  <p style="font-size:15px">${r.name ? `${escapeHtml(r.name)},` : "Hello,"}</p>
  <p style="font-size:15px">${escapeHtml(r.body)}</p>
  <p style="font-size:15px">
    You got through ${progress}.
    <a href="${r.resumeUrl}" style="color:#e8442a">Pick it up where you stopped</a> — about two
    minutes from here — or don't. Either is fine.
  </p>
  ${r.last ? `<p style="font-size:15px">
    This is the last email we will send about it. If it becomes useful later, the questions are
    where they were.
  </p>` : ""}
  <p style="font-size:12px;color:#888">
    You started an assessment at Rift and gave us this address for it. We do not run a
    newsletter and we do not sell anything on.
    <a href="{{ unsubscribe }}" style="color:#888">Unsubscribe</a> — one click, and it stops
    everything.
  </p>
</div>`.trim();

  return { subject: r.says, html };
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

/** Minimal escaping. Names come from a public form and end up in markup. */
function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ?? c));
}
