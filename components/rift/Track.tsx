"use client";

import { useCaptureTouch } from "@/lib/prototype/attribution";

/** Records where this visit came from. Renders nothing, shows nothing. */
export function Track() {
  useCaptureTouch();
  return null;
}
