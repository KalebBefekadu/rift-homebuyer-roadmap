"use client";

import { clearAnswers } from "@/lib/rift/answers";
import { track } from "@/lib/rift/track";

/**
 * "Start over" on every value (manual review WS9.1).
 *
 * Answers come back on purpose: they are kept on this device for thirty days
 * so the next value does not ask them again (lib/rift/answers.ts), and the
 * answer page carries them in its address. Kaleb opened a value days later
 * and found old numbers already filled in, with no visible way to clear them
 * short of "Delete all of it". This clears the answers on this device and
 * reloads the value with a bare address. A saved plan is untouched: it lives
 * on our side under its own link.
 */
export function StartOver({ href, tool, className = "btn btn-g btn-sm" }: { href: string; tool: string; className?: string }) {
  return (
    <button type="button" className={className}
      onClick={() => {
        clearAnswers();
        track({ name: "hero_answer", meta: { qid: "start_over", page: tool } });
        window.location.assign(href);
      }}>
      Start over
    </button>
  );
}
