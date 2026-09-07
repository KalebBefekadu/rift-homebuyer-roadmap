"use client";

import { useEffect, useRef } from "react";
import { sessionId } from "./session";

/**
 * Client-side telemetry.
 *
 * Events are queued and flushed, never sent one at a time. A seven-question
 * assessment on a phone with two bars would otherwise make seven blocking
 * round trips through the exact flow the business depends on.
 *
 * Three rules the implementation keeps:
 *
 *   1. It never blocks the UI and never surfaces a failure. Instrumentation
 *      that can break a funnel is worse than no instrumentation.
 *   2. It flushes on `visibilitychange` and `pagehide`, not `unload`. Mobile
 *      Safari commonly never fires `unload`, and that is precisely where the
 *      abandonment events — the most valuable ones — would be lost.
 *   3. It carries the question and the timing, never the answer.
 */

export type EventName =
  | "landing_view" | "hero_answer" | "assessment_start" | "question_view"
  | "question_answer" | "assessment_abandon" | "assessment_resume" | "readout_view"
  | "email_capture" | "share_sent" | "booking_start" | "booking_complete"
  | "review_requested" | "data_deleted";

export interface TrackInput {
  name: EventName;
  side?: "buy" | "sell";
  questionKey?: string;
  dwellMs?: number;
  meta?: Record<string, string | number | boolean>;
}

type Queued = TrackInput & { sessionId: string };

let queue: Queued[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let listening = false;

const FLUSH_MS = 1500;
const MAX_BATCH = 40;

function post(events: Queued[]) {
  if (!events.length) return;
  const body = JSON.stringify({ events });
  try {
    /* sendBeacon survives the page going away, which is the whole point for
       abandonment. Where it is unavailable, fetch with keepalive so the request
       is not cancelled mid-navigation. */
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon && navigator.sendBeacon("/api/events", blob)) return;
  } catch {
    /* fall through to fetch */
  }
  fetch("/api/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => { /* never surfaces */ });
}

export function flush() {
  if (timer) { clearTimeout(timer); timer = null; }
  const batch = queue;
  queue = [];
  for (let i = 0; i < batch.length; i += MAX_BATCH) post(batch.slice(i, i + MAX_BATCH));
}

export function track(input: TrackInput) {
  if (typeof window === "undefined") return;
  queue.push({ ...input, sessionId: sessionId() });

  if (!listening) {
    listening = true;
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flush();
    });
    window.addEventListener("pagehide", flush);
  }

  if (queue.length >= MAX_BATCH) { flush(); return; }
  if (!timer) timer = setTimeout(flush, FLUSH_MS);
}

/** Fires once per mount, surviving React's development double-invocation. */
export function useTrack(input: TrackInput | null) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !input) return;
    done.current = true;
    track(input);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/** Records where this visit came from. Runs once per mount, never repeatedly. */
export function useCaptureTouch() {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    fetch("/api/attribution", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: sessionId(), url: window.location.href }),
    }).catch(() => { /* attribution is never worth a visible failure */ });
  }, []);
}
