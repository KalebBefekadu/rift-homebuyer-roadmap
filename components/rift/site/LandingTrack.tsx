"use client";

import { useCaptureTouch, useTrack } from "@/lib/rift/track";

/**
 * A landing view and the first touch, for pages that are otherwise rendered
 * on the server. Carries no answers: there are none on a landing page.
 */
export function LandingTrack({ side, meta }: { side?: "buy" | "sell"; meta?: Record<string, string | number | boolean> }) {
  useCaptureTouch();
  useTrack({ name: "landing_view", side, meta });
  return null;
}
