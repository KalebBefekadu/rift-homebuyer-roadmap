/**
 * Every email this product sends, as a pure function from facts to markup.
 *
 * These lived beside the Brevo client in `lib/db/email.ts`, which is
 * `server-only`: so none of them could be imported by a test, and
 * `lib/core/email.test.ts` had resorted to re-implementing `escapeHtml` and
 * asserting against its own copy. That is a test of the test.
 *
 * It is not a hypothetical cost. The seller's readout email was addressed
 * "Buying in DeKalb County takes $0 at the table": buyer copy, with a zero
 * where the figure should be: because the capture route sent `netProceeds`
 * and this file only ever read `cashToClose`. Nothing failed, nothing was
 * typed wrong, and no test could have reached it. Email has never been
 * switched on in production, so nobody received it; it was armed and waiting
 * for the day somebody set BREVO_FROM_EMAIL.
 *
 * Building is here. Sending stays in lib/db/email.ts, where the I/O belongs.
 */

import { money } from "./compute";
import { BAND_LABEL, type Band, type Signal } from "./lead";

export interface ReadoutEmail {
  to: string;
  name?: string;
  shareUrl: string;
  county: string;
  /** Which readout this is. The two say different things and always did; only
   *  one of them had copy written for it. */
  side: "buy" | "sell";
  /** Buyer. */
  cashToClose?: number;
  gap?: number;
  monthsToClose?: number | null;
  /** Seller. Negative means they must bring money to closing. */
  net?: number;
  price?: number;
}

/**
 * The readout, delivered.
 *
 * Carries the figures that matter in the body rather than only a link, because
 * the email is often read on a locked phone at a bus stop and a link is a
 * decision. Whether this sends automatically on completion or only when asked
 * for is `autoEmailReadout`, a business rule, not a constant.
 *
 * Returns null when the figure this email is *about* is missing, the same rule
 * `buildTouch` already applied and for the same reason: there is no version of
 * this message worth sending with a zero in it. `buildTouch`'s own comment
 * calls that failure "the most damaging possible way" to break trust: "by
 * proving nobody is paying attention, to somebody deciding whether to trust us
 * with their finances": and this function was doing exactly that to every
 * seller, because it read a field the caller never sent.
 */
export function buildReadout(r: ReadoutEmail): { subject: string; html: string } | null {
  const where = `${escapeHtml(r.county)} County`;
  const greeting = r.name ? `${escapeHtml(r.name)},` : "Here it is,";

  let lead: string;
  let subject: string;

  if (r.side === "sell") {
    if (typeof r.net !== "number" || typeof r.price !== "number") return null;

    /* Underwater gets its own sentence here too. An email saying somebody
       "keeps -$73,575" is the same defect as the page had, arriving in an
       inbox where it cannot be corrected. */
    if (r.net < 0) {
      subject = `Your numbers: ${money(Math.abs(r.net))} short of your payoff`;
      lead = `A ${money(r.price)} sale in ${where} does not cover what you owe: you would need
    to bring about <strong>${money(Math.abs(r.net))}</strong> to the closing table. That is a
    conversation with your lender, and it is better had early.`;
    } else {
      subject = `Your numbers: ${money(r.net)} from a sale in ${r.county} County`;
      lead = `Selling in ${where} leaves you about <strong>${money(r.net)}</strong> after the
    payoff and the cost of selling, not the ${money(r.price)} list price most people plan
    against.`;
    }
  } else {
    if (typeof r.cashToClose !== "number") return null;
    const gap = r.gap ?? 0;
    const gapLine = gap <= 0
      ? "Your savings already cover what it takes to close."
      : r.monthsToClose !== null && r.monthsToClose !== undefined
        ? `You are about ${r.monthsToClose} months from covering it on your own.`
        : "Tell us what you set aside each month and we can put a date on it.";

    subject = `Your numbers: ${money(r.cashToClose)} to close in ${r.county} County`;
    lead = `Buying in ${where} takes <strong>${money(r.cashToClose)}</strong> at the
    table, not the down payment figure most people are quoted. ${gapLine}`;
  }

  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a;line-height:1.6">
  <p style="font-size:15px">${greeting}</p>
  <p style="font-size:15px">
    ${lead}
  </p>
  <p style="font-size:15px">
    <a href="${r.shareUrl}" style="color:#e8442a">Your full readout is here</a>. Every line of
    that figure${r.side === "buy" ? ", the Georgia programs you may qualify for, and what to ask a lender" : ", what it is worth fixing first, and what you may be able to claim"}.
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

  return { subject, html };
}

export interface NewLeadEmail {
  /** Kaleb's own address. */
  to: string;
  name?: string;
  email?: string;
  phone?: string;
  side: "buy" | "sell";
  band: Band;
  score: number;
  /** The scorer's own one-line reason, and what it says to do about it. */
  headline: string;
  action: string;
  signals: Signal[];
  /** Verbatim, in their words. Empty when the funnel never asked. */
  timing: string;
  county?: string;
  /** Purchase price or estimated sale price. */
  value: number;
  /** Where they came from: "abroad" means a different conversation entirely. */
  source: string;
  /** Straight to this person in Studio. */
  studioUrl: string;
}

/* How long the agent has, by band. Mirrors `sla()` in lib/core/lead.ts, which
   takes a whole lead rather than a band and cannot be reached from here
   without one. */
const REPLY_WITHIN: Record<Band, string> = {
  now: "within 15 minutes",
  soon: "within 4 hours",
  later: "within a day",
  nurture: "within a day",
};

/**
 * "Somebody just finished a readout."
 *
 * Nothing told the agent a lead had arrived. Studio ranked them, timed the
 * SLA against them and showed the cadence they were owed: all of which
 * required him to already be looking at the screen. A stranger who handed
 * over their savings balance and their timeline at eleven at night sat
 * invisible until he next opened a browser, while a `now` band lead has a
 * fifteen-minute target on it.
 *
 * So this carries the facts rather than a notification. "You have a new lead"
 * sends him to a laptop to find out whether it mattered; the band, the
 * figure, their own words about timing and the two strongest signals let him
 * decide from a phone screen, which is where he actually is.
 *
 * It refuses to send without a way to reach the person, and that is not a
 * validation detail. An alert about somebody who left no address is an
 * interruption with no available action at the end of it, and an alert stream
 * that is sometimes not worth opening stops being opened.
 */
export function buildNewLead(l: NewLeadEmail): { subject: string; html: string } | null {
  const reachable: [string, string][] = [];
  if (l.email) reachable.push(["Email", l.email]);
  if (l.phone) reachable.push(["Phone", l.phone]);
  if (reachable.length === 0) return null;

  const who = l.name ? escapeHtml(l.name) : "Someone";
  const where = l.county ? ` in ${escapeHtml(l.county)} County` : "";
  const doing = l.side === "buy" ? "buying" : "selling";

  /* Abroad is not a channel, it is a different conversation: no Georgia
     Dream, no Social Security number, and a wire from another country. Worth
     the two words in the subject line. */
  const abroad = l.source === "abroad";

  const subject = `${BAND_LABEL[l.band]}: ${who}, ${doing}${where}${abroad ? ", from abroad" : ""}`;

  const top = l.signals
    .slice()
    .sort((a, b) => Math.abs(b.points) - Math.abs(a.points))
    .slice(0, 3);

  const row = (label: string, value: string) => `
    <tr>
      <td style="padding:6px 0;color:#666;font-size:13px;width:130px;vertical-align:top">${label}</td>
      <td style="padding:6px 0;font-size:14px">${value}</td>
    </tr>`;

  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a;line-height:1.6">
  <p style="font-size:13px;color:#666;margin:0 0 4px">${BAND_LABEL[l.band]} · score ${l.score} · reply ${REPLY_WITHIN[l.band]}</p>
  <p style="font-size:17px;font-weight:600;margin:0 0 14px">${escapeHtml(l.headline)}</p>

  <table style="border-collapse:collapse;width:100%">
    ${row("Who", who)}
    ${reachable.map(([label, value]) => row(label, escapeHtml(value))).join("")}
    ${row("Doing", `${doing}${where}${abroad ? ", buying from outside the U.S." : ""}`)}
    ${l.value > 0 ? row(l.side === "buy" ? "Target price" : "Sale price", money(l.value)) : ""}
    ${l.timing ? row("Their timing", `&ldquo;${escapeHtml(l.timing)}&rdquo;`) : ""}
  </table>

  ${top.length ? `<p style="font-size:13px;color:#666;margin:16px 0 6px">What moved the ranking</p>
  <ul style="font-size:13px;color:#444;margin:0;padding-left:18px">
    ${top.map((s) => `<li>${escapeHtml(s.label)}: ${escapeHtml(s.note)}</li>`).join("")}
  </ul>` : ""}

  <p style="font-size:15px;margin:18px 0">
    <strong>${escapeHtml(l.action)}</strong>
  </p>
  <p style="font-size:15px">
    <a href="${l.studioUrl}" style="color:#e8442a">Open them in Operations</a>
  </p>
  <p style="font-size:12px;color:#888">
    Sent because a readout was completed. The cadence has already started; replying in Operations
    stops it.
  </p>
</div>`.trim();

  return { subject, html };
}

export interface OfferChosenEmail {
  /** Kaleb's own address. */
  to: string;
  /** The seller, as Studio names them. */
  seller: string;
  from: string;
  price: number;
  /** Null when the seller's costs were not recorded, so no net was shown to them. */
  net: number | null;
  /** Whether it was the best net on the table, when that was computable. */
  bestNet: boolean | null;
  of: number;
  /** Their own words, if they left any. */
  note: string | null;
  studioUrl: string;
}

/**
 * "Your seller picked one."
 *
 * The one moment in a listing when minutes matter to somebody other than the
 * agent: a buyer's offer carries a response deadline, and a seller who has
 * made up their mind at 9pm is waiting on a signature, not on a Studio login.
 *
 * It says plainly that this is not an acceptance. The agent knows that; the
 * point is that the words in his inbox should match the words on the seller's
 * page, so nobody reads the other one's record as a stronger thing than it is.
 */
export function buildOfferChosen(c: OfferChosenEmail): { subject: string; html: string } {
  const seller = escapeHtml(c.seller);
  const from = escapeHtml(c.from);
  const subject = `${c.seller} chose the offer from ${c.from}`;

  const netLine = c.net === null
    ? "No net was shown to them; their payoff is not recorded."
    : `About ${money(c.net)} to them after costs${c.bestNet === true ? ", the best net of the " + c.of : c.bestNet === false ? ", not the best net of the " + c.of : ""}.`;

  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a;line-height:1.6">
  <p style="font-size:17px;font-weight:600;margin:0 0 10px">${seller} chose the offer from ${from}, at ${money(c.price)}.</p>
  <p style="font-size:14px;margin:0 0 10px">${escapeHtml(netLine)}</p>
  ${c.note ? `<p style="font-size:14px;margin:0 0 10px">In their words: &ldquo;${escapeHtml(c.note)}&rdquo;</p>` : ""}
  <p style="font-size:13px;color:#666;margin:0 0 14px">
    This is their choice, not an acceptance. Nothing is binding until they sign it.
  </p>
  <p style="font-size:15px"><a href="${c.studioUrl}" style="color:#e8442a">Open them in Operations</a></p>
</div>`.trim();

  return { subject, html };
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
 * email for every step, with zeroes in place of the person's figures, so a
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
    <a href="${t.shareUrl}" style="color:#e8442a">Open it here</a>. It is kept up to date and it stays yours.
  </p>
  <p style="font-size:13px;color:#666">
    Every figure is a planning estimate, not a lending commitment or approval. Nothing here
    requires you to work with us.
  </p>
  <p style="font-size:12px;color:#888">
    You asked for your readout at Rift. We do not run a newsletter and we do not sell anything
    on. <a href="{{ unsubscribe }}" style="color:#888">Unsubscribe</a>: one click, and it stops
    everything.
  </p>
</div>`.trim();

  return { subject: t.says, html };
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
 * A separate email because these people have NO readout: that is the whole
 * reason they are in this sequence, so the ordinary touch, which leads with
 * their figures, refuses to send and would silently never reach the largest
 * population in the funnel.
 *
 * Recovery, not pursuit. It carries how far they got and a link back, says
 * nothing about what they might be missing, and the closing touch says outright
 * that it is the last one. A list you cannot stop sending to is not a list, it
 * is a liability, and saying so is the only version of this email that earns
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
    <a href="${r.resumeUrl}" style="color:#e8442a">Pick it up where you stopped</a>, about two
    minutes from here, or don't. Either is fine.
  </p>
  ${r.last ? `<p style="font-size:15px">
    This is the last email we will send about it. If it becomes useful later, the questions are
    where they were.
  </p>` : ""}
  <p style="font-size:12px;color:#888">
    You started an assessment at Rift and gave us this address for it. We do not run a
    newsletter and we do not sell anything on.
    <a href="{{ unsubscribe }}" style="color:#888">Unsubscribe</a>: one click, and it stops
    everything.
  </p>
</div>`.trim();

  return { subject: r.says, html };
}

/** Minimal escaping. Names come from a public form and end up in markup. */
export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ?? c));
}
