"use client";

import { useState } from "react";
import { Ico } from "./icons";
import { askReview, type TrustState } from "@/lib/core/review";

/**
 * The trust ladder, rendered.
 *
 * Rift's whole model rests on a person being able to tell, at a glance, whether
 * a figure is something we worked out, something Kaleb has looked at, or
 * something a lender has committed to. That distinction lived in
 * `REVIEW_LABEL` and was never once put on screen — which meant a computed
 * estimate and a lender-confirmed figure looked identical, and the product was
 * quietly making the exact claim it promised never to make.
 *
 * Never colour alone (benchmark 3.3 and D3.5): every state carries an icon and
 * a word as well as a colour, so it survives monochrome, colourblindness, and a
 * phone screen in sunlight.
 */

/* Re-exported so existing component imports keep working; the type is owned
   by lib/prototype/review.ts. See the note there. */
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

/**
 * The ladder itself, for the one place a person should see all four.
 *
 * It now carries the control that moves them up it. That was the gap: the
 * second rung was described here and could not be reached from anywhere,
 * which meant we were showing somebody a path with no door on it. The ask
 * below creates a real item in Kaleb's review queue.
 */
export function TrustLadder({ at, ask }: {
  at: TrustState;
  /** What the person would be asking him to check. Omit to hide the control. */
  ask?: { what: string; claim: string };
}) {
  const order: TrustState[] = ["preliminary", "pending-review", "reviewed", "verified"];
  const ix = order.indexOf(at);
  const [sent, setSent] = useState(false);
  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <div className="between" style={{ padding: "11px 16px", borderBottom: "1px solid var(--line-2)" }}>
        <span className="t-sm w6">How sure is this number?</span>
        <Trust state={at} short title={false} />
      </div>
      {order.map((k, i) => {
        const s = S[k];
        const I = s.icon;
        const isAt = i === ix;
        return (
          <div key={k} className="row gap-3" style={{
            padding: "11px 16px", alignItems: "flex-start",
            borderBottom: i === order.length - 1 ? undefined : "1px solid var(--line-3)",
            background: isAt ? "var(--sunk)" : undefined,
            opacity: i < ix ? 0.5 : 1,
          }}>
            <I size={14} className={isAt ? "c-acc" : "c-4"} style={{ marginTop: 2, flex: "none" }} />
            <div className="grow">
              <div className="row gap-2">
                <span className={`t-sm ${isAt ? "w6" : "w5"}`}>{s.label}</span>
                {isAt ? <span className="chip chip-acc">You are here</span> : null}
              </div>
              <p className="t-xs c-3" style={{ marginTop: 3, lineHeight: 1.5 }}>{s.meaning}</p>
            </div>
          </div>
        );
      })}
      {ask && at === "preliminary" ? (
        <div style={{ padding: "12px 16px", background: "var(--sunk)", borderTop: "1px solid var(--line-2)" }}>
          {sent ? (
            <div className="row gap-2">
              <Ico.checkCircle size={14} className="c-pos" style={{ flex: "none" }} />
              <p className="t-xs c-3" style={{ lineHeight: 1.55 }}>
                It is with Kaleb. He aims to come back inside a day. Until he does, the number
                on this page is still an estimate — asking does not make it truer, it just
                gets a person looking at it.
              </p>
            </div>
          ) : (
            <div className="between wrap gap-2">
              <p className="t-xs c-3" style={{ lineHeight: 1.55, maxWidth: 380 }}>
                Want a person to go through it? No account, no obligation, and your answer
                comes back whether or not you ever work with him.
              </p>
              <button
                className="btn btn-g btn-sm"
                onClick={() => { askReview({ who: "You", whoId: "self", kind: "figure", ceiling: "verified", ...ask }); setSent(true); }}
              >
                <Ico.shield size={13} />Ask Kaleb to check this
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
