/**
 * A journey's History tab, newest first: every recorded change with who and
 * why. Nothing in it is ever edited (each source is history-only).
 *
 * Stages and statuses are said in the words the rest of the page uses, not
 * their stored ids ("Stage Price & launch to Market & show", not
 * "price-launch to market"). A sale's own records are part of its history
 * too: each pricing version, each proceeds version, each listing event and
 * each weekly review.
 *
 * Pure: no I/O.
 */

import { money } from "./compute";
import { showDay } from "./day";
import { STAGE_LABEL, STATUS_LABEL, type JourneyEvent, type JourneyStatus, type Stage } from "./progress";
import { FIGURE_LABEL, type Figure } from "./proceeds";
import { LISTING_LABEL, type ListingEvent, type Review } from "./listing";
import type { Opinion } from "./pricing";

export interface HistoryRow { at: string; key: string; text: string; who: string; note: string }

/* Days are said as people read them, never as 2026-09-28. */
const DAY: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };

const word = (e: JourneyEvent, v: string) =>
  e.kind === "stage" ? STAGE_LABEL[v as Stage] ?? v : STATUS_LABEL[v as JourneyStatus] ?? v;

const DECISION: Record<Review["decision"], string> = { keep: "keep the course", change: "change something", undecided: "not decided yet" };

export function journeyHistory(input: {
  events: JourneyEvent[];
  revisions: { id: string; revision: number; createdAt: string; authorLabel: string; note: string | null }[];
  opinions?: Opinion[];
  figures?: Figure[];
  listing?: { events: ListingEvent[]; reviews: Review[] } | null;
}): HistoryRow[] {
  const rows: HistoryRow[] = [
    ...input.events.map((e) => ({
      at: e.at, key: `e${e.seq}`, who: e.by,
      text: `${e.kind === "stage" ? "Stage" : "Status"} ${e.from ? `${word(e, e.from)} to ` : ""}${word(e, e.to)}`,
      note: [e.reason, e.evidence].filter(Boolean).join(" · "),
    })),
    ...input.revisions.map((r) => ({ at: r.createdAt, key: `r${r.id}`, text: `Brief revision ${r.revision}`, who: r.authorLabel, note: r.note ?? "" })),
    ...(input.opinions ?? []).map((o) => ({
      at: o.at, key: `p${o.version}`, who: o.by,
      text: `Pricing version ${o.version}: list at ${money(o.listPrice)}, range ${money(o.low)} to ${money(o.high)}`,
      note: `Review with them on ${showDay(o.reviewOn, DAY)}`,
    })),
    ...(input.figures ?? []).map((f, i) => ({
      at: f.at, key: `f${i}`, who: f.by,
      text: `Proceeds: ${FIGURE_LABEL[f.kind]} at ${money(f.price)}`,
      note: `From ${f.source}, as of ${showDay(f.asOf, DAY)}`,
    })),
    ...(input.listing?.events ?? []).map((e, i) => ({
      at: e.at, key: `l${i}`, who: e.by,
      text: `${LISTING_LABEL[e.kind]}${e.price !== null ? ` at ${money(e.price)}` : ""}`,
      note: e.detail,
    })),
    ...(input.listing?.reviews ?? []).map((r, i) => ({
      at: r.at, key: `w${i}`, who: r.by,
      text: `Weekly review, week of ${showDay(r.weekOf, DAY)}: ${DECISION[r.decision]}`,
      note: [r.summary, r.decisionNote].filter(Boolean).join(" · "),
    })),
  ];
  return rows.sort((a, b) => b.at.localeCompare(a.at));
}
