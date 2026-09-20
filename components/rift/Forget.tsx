"use client";

import { useState } from "react";
import { Ico } from "@/components/rift/icons";
import { track } from "@/lib/rift/track";
import { sessionId } from "@/lib/rift/session";

/**
 * "Delete all of it" — the one that actually does.
 *
 * This lived inside the buyer readout, and the seller readout had a different
 * one: `PrivacyPanel`, which called `forgetMe()` from lib/prototype/privacy.
 * That function clears four localStorage keys and returns true. It does not
 * call /api/forget, so the assessment, the lead, the email address and the
 * consent record all stayed exactly where they were — and the panel then said
 * "Deleted. Nothing about this visit is left on this device."
 *
 * Which was true. That is what made it the worst version of this product's
 * recurring bug: the sentence was accurate, the button worked, nothing threw,
 * and a seller who asked to be forgotten was not forgotten. It was also
 * DISABLED whenever localStorage happened to be empty — so the people most
 * likely to want this, the ones who had given an email address and had a real
 * server-side record, were the ones shown a greyed-out button.
 *
 * One component now, used by both readouts and by the abroad page. The device
 * and the server are cleared in that order, and the three outcomes are
 * reported apart: deleted, cleared-here-but-nothing-there, and we-could-not-
 * reach-the-server. A delete button is the one control in a product where
 * "probably worked" is not an acceptable thing to imply.
 */
export interface ForgetLabels {
  /** The line above the button. `null` when the caller has said it already. */
  blurb?: string | null;
  cta: string;
  working: string;
  done: string;
  partial: string;
}

/* English, and the default rather than the only option. The abroad readout
   renders this under an Amharic paragraph and passes its own, out of the same
   dictionary the rest of that page reads from — an English button below
   Amharic prose is the half-translated seam that page exists to remove. */
const EN: ForgetLabels = {
  blurb: "Changed your mind? Remove everything now rather than waiting for the schedule.",
  cta: "Delete all of it",
  working: "Deleting\u2026",
  done:
    "Deleted. Nothing about this visit is left on this device or on our side. The numbers on " +
    "this page are still on screen and will disappear when you close it.",
  partial:
    "Cleared from this device. Nothing was stored on our side to remove \u2014 or the request " +
    "did not reach us, in which case the retention schedule removes it on its own.",
};

export function ForgetMe({ side, labels, style }: {
  side?: "buy" | "sell";
  labels?: ForgetLabels;
  style?: React.CSSProperties;
}) {
  const l = labels ?? EN;
  const [state, setState] = useState<"idle" | "working" | "done" | "partial">("idle");

  const forget = async () => {
    setState("working");
    const sid = sessionId();

    try {
      window.localStorage.removeItem("rift.buy.draft");
      window.localStorage.removeItem("rift.sell.draft");
      window.localStorage.removeItem("rift.attr");
      window.localStorage.removeItem("rift.events");
      window.sessionStorage.removeItem("rift.sid");
    } catch { /* storage already unavailable — nothing to clear */ }

    try {
      const r = await fetch("/api/forget", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: sid }),
      }).then((x) => x.json());
      track({ name: "data_deleted", ...(side ? { side } : {}) });
      setState(r?.ok && !r?.skipped ? "done" : "partial");
    } catch {
      setState("partial");
    }
  };

  if (state === "done") {
    return (
      <div className="card p-3" style={{ borderColor: "var(--pos, #2f7a52)" }}>
        <div className="row-t gap-2">
          <Ico.checkCircle size={14} className="c-pos" style={{ flex: "none", marginTop: 2 }} />
          <p className="t-xs c-3" style={{ lineHeight: 1.55, ...style }}>{l.done}</p>
        </div>
      </div>
    );
  }

  if (state === "partial") {
    return (
      <div className="card p-3">
        <p className="t-xs c-3" style={{ lineHeight: 1.55, ...style }}>{l.partial}</p>
      </div>
    );
  }

  return (
    <div className="card p-3" style={{ background: "var(--paper)" }}>
      <div className="between wrap gap-2">
        {/* Suppressed, not translated, when the caller has its own heading and
            body above this card. The abroad readout does, and rendering this
            as well printed the English sentence directly beneath the Amharic
            one saying the same thing. */}
        {l.blurb === null ? <span /> : (
          <p className="t-xs c-3" style={{ lineHeight: 1.55, maxWidth: 360, ...style }}>
            {l.blurb ?? EN.blurb}
          </p>
        )}
        {/* Never disabled. The previous seller-side version switched itself off
            when localStorage was empty, which is exactly the state of somebody
            on a second device — or anybody whose record is only on our side. */}
        <button className="btn btn-g btn-sm" onClick={forget} disabled={state === "working"}>
          <Ico.x size={12} /><span style={style}>{state === "working" ? l.working : l.cta}</span>
        </button>
      </div>
    </div>
  );
}
