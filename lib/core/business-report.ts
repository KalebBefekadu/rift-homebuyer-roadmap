/**
 * The business, as a count: visitors to leads to clients to closings, where
 * each came from, and what the pipeline is worth.
 *
 * Reports used to be about the pilot (same-day replies, Matrix checks) and the
 * questionnaire's drop-off. It had no lead count, no source breakdown, no
 * conversion past "plan saved", and no pipeline value, although every one of
 * those is already recorded. A report on the business that cannot say how many
 * people arrived, from where, and how many became clients is a report about
 * the software.
 *
 * Rules for every figure here, because this is where a business is flattered:
 *
 *   EVERY NUMBER IS COUNTED, NONE IS ESTIMATED. Visitors are browser sessions
 *   that arrived in the period; leads, clients and closings are rows. The only
 *   figure that is not a count is the pipeline's expected commission, which is
 *   a stage-weighted planning figure and is labelled as one, with the
 *   percentage it assumes and whether that percentage was ever decided.
 *
 *   EACH STEP SAYS WHAT IT COUNTS. "Clients" could mean anything: here it is
 *   the leads of the period that have since been given a stage by the agent.
 *   Those steps are a cohort (the people who arrived in the window, and how
 *   far they have got since), so a person who arrived yesterday has had no
 *   time to become a client, and the page says so rather than reading it as a
 *   weak conversion.
 *
 *   A RATE NEEDS A DENOMINATOR AND NEVER EXCEEDS ONE HUNDRED PERCENT. Two of
 *   the steps come from different records (browser sessions, and leads), so a
 *   rate between them can come out above a hundred when tracking missed
 *   someone. That is shown as no rate, not as 130%.
 *
 * Pure: no I/O. The reads are lib/db/business-report.ts.
 */

import { georgiaDay } from "./day";
import { STAGES, TERMINAL, weightFor, commissionOn, type Basis, type Outcome } from "./pipeline";

export type Period = 30 | 90 | 365;
export const PERIODS: { days: Period; label: string }[] = [
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
  { days: 365, label: "12 months" },
];
export const periodFrom = (v: string | undefined): Period => (PERIODS.find((p) => String(p.days) === v)?.days ?? 90);

export interface LeadRow {
  id: string;
  /** How the lead was created: the funnel, by hand, a referral, an import. */
  source: string;
  stage: string | null;
  sessionId: string | null;
  createdAt: string;
  /** Filed away. Still a lead that arrived, so it stays in the funnel; it is not in play, so it is not in the pipeline. */
  archived: boolean;
  closedOn: string | null;
  /** The deal size in dollars when somebody said one, else null. */
  value: number | null;
}

export interface AttributionRow {
  sessionId: string;
  source: string | null;
  medium: string | null;
  referrer: string | null;
  ref: string | null;
  firstAt: string;
}

/* ------------------------------------------------------------------ *
 * Where a visit came from
 * ------------------------------------------------------------------ */

const SOCIAL = new Set(["facebook", "instagram", "x", "twitter", "linkedin", "tiktok", "youtube", "reddit", "pinterest", "nextdoor", "threads"]);

/**
 * A first touch, in the words the agent would use. First touch only (rule 7):
 * the visit that brought somebody in, never the last one that happened to
 * precede a form. Anything with no source at all is "Direct", which means
 * "we cannot tell", and is said that way.
 */
export function channelOf(a: { source: string | null; medium: string | null; referrer?: string | null; ref?: string | null }): string {
  const source = (a.source ?? "").toLowerCase().trim();
  const medium = (a.medium ?? "").toLowerCase().trim();
  if (a.ref || medium === "word-of-mouth" || medium === "share") return "Word of mouth";
  if (medium === "cpm" || (medium.includes("paid") && medium.includes("social"))) return "Paid social";
  if (["cpc", "ppc", "paid", "paid-search", "paid_search"].includes(medium)) return "Paid search";
  if (SOCIAL.has(source) || medium === "social") return "Social";
  if (medium === "email" || source === "newsletter" || source === "email") return "Email";
  if (medium === "organic") return "Organic search";
  if (medium === "referral" || (source && source !== "(direct)" && source !== "direct")) return "Other sites";
  return "Direct or unknown";
}

/* ------------------------------------------------------------------ *
 * The funnel
 * ------------------------------------------------------------------ */

export type StepId = "visitors" | "finished" | "leads" | "clients" | "closed";

export interface FunnelStep {
  id: StepId;
  label: string;
  count: number | null;
  /** What exactly is counted, in a line. */
  counts: string;
  /** The share of the step before, or null when it cannot be said honestly. */
  rate: { pct: number; of: string } | null;
}

export interface BusinessFunnel {
  days: Period;
  sinceDay: string;
  steps: FunnelStep[];
  /** Added by hand in the period: not from a visitor, so not in the funnel. */
  addedByHand: number;
  closings: { count: number; priced: number; volume: number };
}

const inPeriod = (iso: string, sinceDay: string) => georgiaDay(new Date(iso)) >= sinceDay;
const arrived = (l: LeadRow) => l.source === "funnel" || l.source === "referral";

export function businessFunnel(i: {
  leads: LeadRow[];
  attributions: AttributionRow[];
  /** Sessions that finished at least one value in the period, or null when that read failed. */
  finishedOne: number | null;
  /**
   * Sessions seen using a value in the period (from the value events). One
   * with no recorded first visit at all is still a visitor: the first-visit
   * record is written by the landing pages, and a session that opened a value
   * from a shared link never passed one. Counting only first visits made the
   * step below it larger than the step above (63 finished a value, 27 visits).
   */
  sessionsSeen?: string[];
  days: Period;
  now: Date;
}): BusinessFunnel {
  const sinceDay = georgiaDay(i.now, -i.days);
  const cohort = i.leads.filter((l) => arrived(l) && inPeriod(l.createdAt, sinceDay));
  const recorded = new Set(i.attributions.map((a) => a.sessionId));
  /* A session whose first visit WAS recorded, before this period, is not a
     visitor of this period, so only sessions with no record are added. */
  const visitors = new Set([
    ...i.attributions.filter((a) => inPeriod(a.firstAt, sinceDay)).map((a) => a.sessionId),
    ...(i.sessionsSeen ?? []).filter((sid) => !recorded.has(sid)),
  ]).size;
  const clients = cohort.filter((l) => l.stage !== null);
  const closed = cohort.filter((l) => l.stage === "Closed");

  const rate = (n: number | null, of: number | null, label: string): FunnelStep["rate"] =>
    n === null || of === null || of === 0 || n > of ? null : { pct: Math.round((n / of) * 100), of: label };

  const steps: FunnelStep[] = [
    { id: "visitors", label: "Visitors", count: visitors, counts: "Browser sessions whose first visit was in this period, including sessions that used a value with no first visit recorded.", rate: null },
    { id: "finished", label: "Finished a value", count: i.finishedOne, counts: "Sessions that answered at least one value in this period.", rate: rate(i.finishedOne, visitors, "visitors") },
    { id: "leads", label: "Leads", count: cohort.length, counts: "People who left a way to reach them in this period, from the site or a referral.", rate: rate(cohort.length, i.finishedOne ?? visitors, i.finishedOne === null ? "visitors" : "who finished a value") },
    { id: "clients", label: "Taken on", count: clients.length, counts: "Of those leads, the ones you have since given a stage: you are working with them.", rate: rate(clients.length, cohort.length, "leads") },
    { id: "closed", label: "Closed", count: closed.length, counts: "Of those leads, the ones whose home has closed.", rate: rate(closed.length, clients.length, "taken on") },
  ];

  const closings = i.leads.filter((l) => l.closedOn && l.closedOn >= sinceDay);
  const priced = closings.filter((l) => l.value !== null);
  return {
    days: i.days,
    sinceDay,
    steps,
    addedByHand: i.leads.filter((l) => !arrived(l) && inPeriod(l.createdAt, sinceDay)).length,
    closings: { count: closings.length, priced: priced.length, volume: priced.reduce((a, l) => a + (l.value ?? 0), 0) },
  };
}

/* ------------------------------------------------------------------ *
 * Sources
 * ------------------------------------------------------------------ */

export interface SourceRow {
  channel: string;
  visitors: number;
  leads: number;
  clients: number;
  closed: number;
  /** Leads as a share of visitors, or null when there is no honest one. */
  rate: number | null;
}

export const BY_HAND = "Added by hand";
export const REFERRAL = "Client referral";
export const UNTRACKED = "Direct or unknown";

/**
 * Leads and visitors by where they first came from. A lead's channel is its
 * first touch (its session's attribution); a referral is a referral whatever
 * the browser said; a lead added by hand has no visit to attribute and is its
 * own row. Leads whose session was never recorded are "Direct or unknown",
 * said as such: the alternative is dropping them and flattering every other row.
 */
export function bySource(i: { leads: LeadRow[]; attributions: AttributionRow[]; days: Period; now: Date }): SourceRow[] {
  const sinceDay = georgiaDay(i.now, -i.days);
  const attrOf = new Map(i.attributions.map((a) => [a.sessionId, a]));
  const rows = new Map<string, SourceRow>();
  const row = (channel: string) => {
    let r = rows.get(channel);
    if (!r) { r = { channel, visitors: 0, leads: 0, clients: 0, closed: 0, rate: null }; rows.set(channel, r); }
    return r;
  };

  for (const a of i.attributions) if (inPeriod(a.firstAt, sinceDay)) row(channelOf(a)).visitors += 1;

  for (const l of i.leads) {
    if (!inPeriod(l.createdAt, sinceDay)) continue;
    const a = l.sessionId ? attrOf.get(l.sessionId) : undefined;
    const channel = l.source === "referral" ? REFERRAL : !arrived(l) ? BY_HAND : a ? channelOf(a) : UNTRACKED;
    const r = row(channel);
    r.leads += 1;
    if (l.stage !== null) r.clients += 1;
    if (l.stage === "Closed") r.closed += 1;
  }

  return [...rows.values()]
    .map((r) => ({ ...r, rate: r.visitors > 0 && r.leads <= r.visitors ? Math.round((r.leads / r.visitors) * 100) : null }))
    .sort((a, b) => b.leads - a.leads || b.visitors - a.visitors || a.channel.localeCompare(b.channel));
}

/* ------------------------------------------------------------------ *
 * The pipeline
 * ------------------------------------------------------------------ */

export interface LiveRow { stage: string; value: number; valueKnown: boolean }

export interface PipelineStage {
  stage: string;
  people: number;
  priced: number;
  /** Deal volume of the priced ones. */
  value: number;
  /** The share of this stage that closes, and what that rests on. */
  weight: number;
  basis: Basis;
  weighted: number;
  commission: number;
}

export interface Pipeline {
  stages: PipelineStage[];
  people: number;
  priced: number;
  unpriced: number;
  value: number;
  weighted: number;
  commission: number;
  commissionPct: number;
}

/**
 * What the people in play are worth, at the commission setting.
 *
 * Volume is the sum of deal sizes somebody recorded: a person nobody priced
 * counts as a person and adds nothing to the money, and the count of them is
 * returned so the page can say so. The expected figure weights each stage by
 * how often that stage closes (the agent's own history once there is enough of
 * it, a stated assumption before then: lib/core/pipeline.ts), and multiplies
 * by the commission percentage. It is a planning figure, not a receivable.
 */
export function pipelineOf(live: LiveRow[], history: Outcome[], commissionPct: number): Pipeline {
  const order = new Map<string, number>(STAGES.map((s, i) => [s.stage, i] as [string, number]));
  const byStage = new Map<string, LiveRow[]>();
  for (const l of live) {
    if ((TERMINAL as readonly string[]).includes(l.stage)) continue;
    byStage.set(l.stage, [...(byStage.get(l.stage) ?? []), l]);
  }
  const stages: PipelineStage[] = [...byStage.entries()]
    .sort(([a], [b]) => (order.get(a) ?? 99) - (order.get(b) ?? 99))
    .map(([stage, list]) => {
      const w = weightFor(stage, history);
      const priced = list.filter((l) => l.valueKnown);
      const value = priced.reduce((a, l) => a + l.value, 0);
      const weighted = value * w.weight;
      return { stage, people: list.length, priced: priced.length, value, weight: w.weight, basis: w.basis, weighted, commission: commissionOn(weighted, commissionPct) };
    });
  const sum = (f: (s: PipelineStage) => number) => stages.reduce((a, s) => a + f(s), 0);
  return {
    stages,
    people: sum((s) => s.people),
    priced: sum((s) => s.priced),
    unpriced: sum((s) => s.people - s.priced),
    value: sum((s) => s.value),
    weighted: sum((s) => s.weighted),
    commission: sum((s) => s.commission),
    commissionPct,
  };
}

/** The people in play: given a stage, not finished, not filed away. */
export const liveOf = (leads: LeadRow[]): LiveRow[] =>
  leads
    .filter((l) => l.stage !== null && !l.archived && !(TERMINAL as readonly string[]).includes(l.stage))
    .map((l) => ({ stage: l.stage!, value: l.value ?? 0, valueKnown: l.value !== null }));
