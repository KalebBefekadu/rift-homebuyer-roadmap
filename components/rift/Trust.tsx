"use client";

import { Ico } from "./icons";
import type { TrustState } from "@/lib/core/review";

/**
 * The trust ladder, rendered.
 *
 * Rift's whole model rests on a person being able to tell, at a glance, whether
 * a figure is something we worked out, something Kaleb has looked at, or
 * something a lender has committed to. That distinction lived in
 * `REVIEW_LABEL` and was never once put on screen: which meant a computed
 * estimate and a lender-confirmed figure looked identical, and the product was
 * quietly making the exact claim it promised never to make.
 *
 * Never colour alone (benchmark 3.3 and D3.5): every state carries an icon and
 * a word as well as a colour, so it survives monochrome, colourblindness, and a
 * phone screen in sunlight.
 */

/* Re-exported so existing component imports keep working; the type is owned
   by lib/core/review.ts. */
export type { TrustState };

const S: Record<TrustState, {
  label: string; short: string; chip: string;
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  meaning: string;
}> = {
  preliminary: {
    label: "Preliminary estimate", short: "Estimate", chip: "chip",
    icon: Ico.info,
    meaning: "Worked out from what you told us. Nobody has checked it against your documents.",
  },
  "pending-review": {
    label: "Pending review", short: "Pending", chip: "chip-warn",
    icon: Ico.clock,
    meaning: "With Kaleb. Treat it as an estimate until he has been through it.",
  },
  reviewed: {
    label: "Reviewed by your agent", short: "Reviewed", chip: "chip-acc",
    icon: Ico.check,
    meaning: "Kaleb has been through this and stands behind the reasoning. Still not a lender's commitment.",
  },
  verified: {
    label: "Verified by lender", short: "Verified", chip: "chip-pos",
    icon: Ico.shield,
    meaning: "Confirmed in writing by the party who actually decides. This is the only state that is not an estimate.",
  },
};

export function Trust({ state, short, title }: { state: TrustState; short?: boolean; title?: boolean }) {
  const s = S[state];
  const I = s.icon;
  return (
    <span className={`chip ${s.chip}`} title={title === false ? undefined : s.meaning}>
      <I size={11} />
      {short ? s.short : s.label}
    </span>
  );
}
