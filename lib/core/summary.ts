import { escapeHtml } from "./email";
import { isBusinessDay } from "./deadline";
import { marketDay, WORKSTREAM_LABEL, type Workstream } from "./progress";
import { REACTION_LABEL, type Reaction } from "./search";
import { OFFER_LABEL, type OfferInterest } from "./tour";
import { INSTRUCTION_LABEL, type Instruction } from "./bid";
import { BAND_LABEL, type Band } from "./lead";

/**
 * The agent's daily summary (blueprint v4 W12; decision D07).
 *
 * D07 set the pilot's operating promise: business hours only, replies the
 * same business day, and one summary a day to the agent instead of instant
 * alerts. This is that summary: what buyers did since the last business
 * morning, the contract dates that need him, the people who arrived, and any
 * scheduled job that failed. Everything in it is also on Studio Today; the
 * email is the nudge to open it, not a second place where work lives.
 *
 * Pure. Reading the rows is lib/db/summary.ts; sending is lib/db/email.ts.
 */

export const SUMMARY_TZ = "America/New_York";

/**
 * What one summary covers: from the same time on the previous business day
 * until now. Monday's covers the weekend; the day after a holiday covers the
 * holiday. Worked out from the calendar, not from the last run, so a run that
 * failed does not make the next one reach back further than a person would
 * expect; what it missed is still on Studio Today.
 */
export function summaryWindow(now: Date): { since: Date; businessDay: boolean; day: string } {
  const day = marketDay(now, SUMMARY_TZ);
  let since = new Date(now.getTime() - 86_400_000);
  for (let i = 0; i < 10 && !isBusinessDay(marketDay(since, SUMMARY_TZ)); i++) since = new Date(since.getTime() - 86_400_000);
  return { since, businessDay: isBusinessDay(day), day };
}

/** Something a household member did, as the summary reports it. */
export type Activity = { journeyId: string; journey: string; person: string; who: string; at: string } & (
  | { kind: "joined" }
  | { kind: "reaction"; home: string; reaction: Reaction; reason: string | null }
  | { kind: "home-added"; home: string }
  | { kind: "tour-request"; home: string }
  | { kind: "tour-answer"; home: string; offer: OfferInterest }
  | { kind: "offer-answer"; home: string; version: number; instruction: Instruction }
  | { kind: "brief-answer"; response: "confirmed" | "changes-requested" }
  | { kind: "brief-proposal" }
  | { kind: "work"; workstream: Workstream }
);

/** One sentence per thing done, in the words the screens use. */
export function activityLine(a: Activity): string {
  switch (a.kind) {
    case "joined": return `${a.who} accepted the invitation and can now see the journey.`;
    case "reaction": return `${a.who} on ${a.home}: ${REACTION_LABEL[a.reaction]}${a.reason ? ` ("${clip(a.reason)}")` : ""}.`;
    case "home-added": return `${a.who} added ${a.home} to the shortlist.`;
    case "tour-request": return `${a.who} asked to see ${a.home}. Nothing is booked until you arrange it.`;
    case "tour-answer": return `${a.who} after seeing ${a.home}: ${OFFER_LABEL[a.offer]}.`;
    case "offer-answer": return `${a.who} on version ${a.version} of the offer on ${a.home}: ${INSTRUCTION_LABEL[a.instruction]}.`;
    case "brief-answer": return a.response === "confirmed"
      ? `${a.who} confirmed the search priorities.`
      : `${a.who} asked for changes to the search priorities.`;
    case "brief-proposal": return `${a.who} proposed a change to the search priorities. The active search is unchanged until you approve it.`;
    case "work": return `${a.who} reported ${WORKSTREAM_LABEL[a.workstream].toLowerCase()} as done. It needs your confirmation.`;
  }
}

const clip = (s: string, n = 120) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

export interface SummaryDate {
  person: string;
  label: string;
  when: string;
  why: "missed" | "unchecked" | "soon";
}

export interface SummaryLead {
  name: string | null;
  side: "buy" | "sell";
  band: Band;
}

export interface DailySummary {
  day: string;
  activity: Activity[];
  dates: SummaryDate[];
  /** Each failed or missed scheduled job, as the sentence Studio Today shows. */
  jobs: string[];
  leads: SummaryLead[];
  studioUrl: string;
}

const DAY = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" });
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The subject and body, or null when there is nothing to say: an empty summary is not sent. */
export function buildDailySummary(s: DailySummary): { subject: string; html: string } | null {
  const missed = s.dates.filter((d) => d.why === "missed");
  const other = s.dates.filter((d) => d.why !== "missed");
  if (!s.activity.length && !s.dates.length && !s.jobs.length && !s.leads.length) return null;

  const parts = [
    missed.length ? plural(missed.length, "date passed", "dates passed") : "",
    s.jobs.length ? plural(s.jobs.length, "job problem") : "",
    s.activity.length ? `${plural(s.activity.length, "thing")} from buyers` : "",
    other.length ? plural(other.length, "date to look at", "dates to look at") : "",
    s.leads.length ? plural(s.leads.length, "new person", "new people") : "",
  ].filter(Boolean);
  const subject = `Rift, ${DAY(s.day)}: ${parts.join(", ")}`;

  const h = (t: string) => `<p style="font-size:13px;color:#666;margin:18px 0 6px;text-transform:uppercase;letter-spacing:.04em">${t}</p>`;
  const list = (items: string[]) => `<ul style="font-size:14px;margin:0;padding-left:18px">${items.map((i) => `<li style="margin:4px 0">${i}</li>`).join("")}</ul>`;

  const byJourney = new Map<string, Activity[]>();
  for (const a of [...s.activity].sort((x, y) => x.at.localeCompare(y.at))) {
    byJourney.set(a.journeyId, [...(byJourney.get(a.journeyId) ?? []), a]);
  }

  const DATE_WHY = { missed: "passed and not recorded as met", unchecked: "not checked against the document yet", soon: "coming up" } as const;
  const dateItem = (d: SummaryDate) => `<strong>${escapeHtml(d.person)}: ${escapeHtml(d.label)}</strong>, ${escapeHtml(d.when)}, ${DATE_WHY[d.why]}.`;

  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a;line-height:1.6">
  <p style="font-size:17px;font-weight:600;margin:0 0 4px">Your ${escapeHtml(DAY(s.day))} summary</p>
  <p style="font-size:13px;color:#666;margin:0">Since the last business morning.</p>
  ${missed.length || s.jobs.length ? `${h("Needs you first")}${list([
    ...missed.map((d) => `${dateItem(d)} Record what actually happened.`),
    ...s.jobs.map((j) => escapeHtml(j)),
  ])}` : ""}
  ${byJourney.size ? `${h("From your buyers")}${[...byJourney.values()].map((acts) => `
    <p style="font-size:14px;font-weight:600;margin:10px 0 2px">${escapeHtml(acts[0].person)} <span style="color:#666;font-weight:400">· ${escapeHtml(acts[0].journey)}</span></p>
    ${list(acts.map((a) => escapeHtml(activityLine(a))))}`).join("")}` : ""}
  ${other.length ? `${h("Contract dates")}${list(other.map(dateItem))}` : ""}
  ${s.leads.length ? `${h("New people")}${list(s.leads.map((l) => `${escapeHtml(l.name ?? "Someone")}, ${l.side === "buy" ? "buying" : "selling"} · ${BAND_LABEL[l.band]}`))}` : ""}
  <p style="font-size:15px;margin:22px 0 8px"><a href="${s.studioUrl}" style="color:#c2351e">Open Today in Operations</a></p>
  <p style="font-size:12px;color:#888">
    One summary each business morning. Everything here is also on Today in Operations.
  </p>
</div>`.trim();

  return { subject, html };
}
