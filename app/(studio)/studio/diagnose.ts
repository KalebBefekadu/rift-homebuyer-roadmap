import type { StepStat } from "@/lib/db/events";

/**
 * What a drop-off actually means.
 *
 * A percentage alone cannot separate the two cases that matter, and they want
 * opposite remedies:
 *
 *   A high drop with a LONG dwell is a question people understood and chose not
 *   to answer. It is too personal, or the reason for asking is not obvious. It
 *   wants a reason attached, not rewording.
 *
 *   A high drop with a SHORT dwell is a question people bounced off without
 *   engaging. It wants rewording, and rewording the first case would make it
 *   worse.
 *
 * Verified against seeded traffic: two questions with the same 50%-ish drop
 * produced opposite diagnoses purely on dwell.
 */
export function diagnose(s: StepStat): { label: string; tone: string; advice: string } | null {
  if (s.dropPct < 12) return null;

  if (s.medianSec >= 12) {
    return {
      label: "Too personal",
      tone: "chip-neg",
      advice: "They read it and chose not to answer. Say why it is being asked, or make it optional — rewording a question people understood will not help.",
    };
  }
  if (s.medianSec < 4) {
    return {
      label: "Bounced off",
      tone: "chip-warn",
      advice: "They left without engaging with it. That is a wording or format problem, not a sensitivity one.",
    };
  }
  return {
    label: "Losing people",
    tone: "chip-warn",
    advice: "A real drop with an ordinary dwell. Worth reading the question aloud before changing anything.",
  };
}
