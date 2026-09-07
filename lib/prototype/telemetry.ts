"use client";

/**
 * Rift prototype — instrumentation.
 *
 * benchmark.md carries a rule: no score above 84 is validated until field
 * metrics exist. This file is what turns that from an aspiration into a
 * measurement, and it is deliberately written BEFORE the real build rather
 * than bolted on after, because the event you forgot to emit is the one you
 * cannot recover retrospectively.
 *
 * The taxonomy is small on purpose. Six things decide whether this business
 * works, and every event below serves one of them:
 *
 *   1. Did they arrive, and from where           landing_view
 *   2. Did they start                            assessment_start
 *   3. WHERE exactly did they stop               question_view / question_answer / assessment_abandon
 *   4. Did they receive the value                readout_view
 *   5. Did they let us keep talking              email_capture / share_sent
 *   6. Did they convert to a conversation        booking_start / booking_complete
 *
 * Point 3 is the one that pays for the whole file. A funnel that only reports
 * "62% dropped out" tells you to panic. One that reports "41% of the loss is on
 * the savings question, and the median dwell there is 34 seconds" tells you the
 * question is intrusive rather than unclear — which is the difference between
 * deleting it and rewriting it.
 *
 * PRIVACY: events carry the question id and timings, never the answer. We know
 * someone stopped on "how much do you have saved". We do not record what they
 * typed before they stopped.
 */

import { useEffect, useRef } from "react";

export type EventName =
  | "landing_view"
  | "hero_answer"
  | "assessment_start"
  | "question_view"
  | "question_answer"
  | "assessment_abandon"
  | "assessment_resume"
  | "readout_view"
  | "email_capture"
  | "share_sent"
  | "booking_start"
  | "booking_complete"
  | "data_deleted";

export interface Ev {
  name: EventName;
  at: number;
  /** Per-visit id. Without it "how many people reached question 4" degrades
      into de-duplicating on a millisecond timestamp, which silently undercounts
      whenever two events land in the same tick. */
  sid: string;
  side: "buy" | "sell" | "none";
  /** Question id, where the event has one. Never the answer. */
  qid?: string;
  /** Position in the funnel, 1-indexed. */
  step?: number;
  /** Milliseconds spent on the question before answering. */
  dwell?: number;
  /** Which funnel version they were answering. */
  fv?: number;
  /** First-touch source, denormalised so a single event is enough. */
  src?: string;
  meta?: Record<string, string | number | boolean>;
}

const KEY = "rift.events";
const SID_KEY = "rift.sid";
const CAP = 800;

/** One id per browser session. Not an identity — it dies with the tab. */
export function sessionId(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    let s = window.sessionStorage.getItem(SID_KEY);
    if (!s) {
      s = `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      window.sessionStorage.setItem(SID_KEY, s);
    }
    return s;
  } catch { return "anon"; }
}

export function track(e: Omit<Ev, "at" | "sid">) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(KEY);
    const all: Ev[] = raw ? JSON.parse(raw) : [];
    all.push({ ...e, sid: sessionId(), at: Date.now() });
    window.localStorage.setItem(KEY, JSON.stringify(all.slice(-CAP)));
  } catch { /* instrumentation must never break a funnel */ }
}

export function readEvents(): Ev[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Ev[]) : [];
  } catch { return []; }
}

export function clearEvents() {
  try { window.localStorage.removeItem(KEY); } catch { /* ignore */ }
}

/** Fires once per mount. Guards against React 18 double-invocation in dev. */
export function useTrack(e: Omit<Ev, "at" | "sid"> | null) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !e) return;
    done.current = true;
    track(e);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/** Times how long a question was on screen, and reports it when it changes. */
export function useDwell(qid: string | undefined) {
  const start = useRef(Date.now());
  useEffect(() => { start.current = Date.now(); }, [qid]);
  return () => Date.now() - start.current;
}

/* ------------------------------------------------------------------ *
 * Reporting
 * ------------------------------------------------------------------ */

export interface StepStat {
  qid: string;
  step: number;
  reached: number;
  answered: number;
  /** Share of people who saw this question and never answered it. */
  dropPct: number;
  /** Median seconds on the question before answering. */
  medianSec: number;
}

export interface FunnelReport {
  starts: number;
  finished: number;
  readouts: number;
  emails: number;
  bookings: number;
  steps: StepStat[];
  /** The single question losing the most people, or null when it is too early. */
  worst: StepStat | null;
  /** True until there is enough traffic to say anything honest. */
  thin: boolean;
}

const MIN_SAMPLE = 20;

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function funnelReport(events: Ev[], side: "buy" | "sell"): FunnelReport {
  const e = events.filter((x) => x.side === side);
  const by = (n: EventName) => e.filter((x) => x.name === n);

  const views = by("question_view");
  const answers = by("question_answer");

  const order: string[] = [];
  for (const v of views) if (v.qid && !order.includes(v.qid)) order.push(v.qid);
  order.sort((a, b) => {
    const sa = views.find((v) => v.qid === a)?.step ?? 99;
    const sb = views.find((v) => v.qid === b)?.step ?? 99;
    return sa - sb;
  });

  const steps: StepStat[] = order.map((qid, i) => {
    /* Distinct sessions, not distinct timestamps. */
    const reached = new Set(views.filter((v) => v.qid === qid).map((v) => v.sid)).size;
    const ans = answers.filter((a) => a.qid === qid);
    const answered = new Set(ans.map((a) => a.sid)).size;
    return {
      qid,
      step: i + 1,
      reached,
      answered,
      dropPct: reached ? Math.round(((reached - answered) / reached) * 100) : 0,
      medianSec: Math.round(median(ans.map((a) => (a.dwell ?? 0) / 1000)) * 10) / 10,
    };
  });

  const starts = new Set(by("assessment_start").map((x) => x.sid)).size;
  const thin = starts < MIN_SAMPLE;

  return {
    starts,
    finished: new Set(by("readout_view").map((x) => x.sid)).size,
    readouts: new Set(by("readout_view").map((x) => x.sid)).size,
    emails: new Set(by("email_capture").map((x) => x.sid)).size,
    bookings: new Set(by("booking_complete").map((x) => x.sid)).size,
    steps,
    worst: thin || !steps.length ? null : [...steps].sort((a, b) => b.dropPct - a.dropPct)[0],
    thin,
  };
}

/**
 * The reading a drop-off number alone cannot give you. Long dwell plus a high
 * drop is a question people understood and declined to answer; short dwell plus
 * a high drop is one they bounced off without engaging at all.
 */
export function diagnose(s: StepStat): { label: string; tone: string; advice: string } | null {
  if (s.reached < 10) return null;
  if (s.dropPct < 12) return { label: "Healthy", tone: "chip-pos", advice: "Leave it alone." };
  if (s.medianSec >= 12)
    return {
      label: "Too personal",
      tone: "chip-neg",
      advice: "They read it and chose not to answer. Explain why you're asking, or make it optional.",
    };
  if (s.medianSec < 4)
    return {
      label: "Bounced off",
      tone: "chip-warn",
      advice: "They left before engaging. Usually wording or an intimidating control, not the subject.",
    };
  return {
    label: "Losing people",
    tone: "chip-warn",
    advice: "Worth a rewrite or a move further down the funnel.",
  };
}
