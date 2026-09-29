"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Ico } from "@/components/rift/icons";
import { LiveRegion } from "@/components/rift/Live";
import { track } from "@/lib/rift/track";
import { sessionId } from "@/lib/rift/session";
import { CONTACT_EMAIL } from "@/lib/core/privacy";
import { clearAnswers } from "@/lib/rift/answers";
import { clearPlan } from "@/lib/rift/plan";

/**
 * "Delete all of it": the one that actually does.
 *
 * This lived inside the buyer readout, and the seller readout had a different
 * one: `PrivacyPanel`, which called `forgetMe()` from lib/prototype/privacy.
 * That function clears four localStorage keys and returns true. It does not
 * call /api/forget, so the assessment, the lead, the email address and the
 * consent record all stayed exactly where they were, and the panel then said
 * "Deleted. Nothing about this visit is left on this device."
 *
 * Which was true. That is what made it the worst version of this product's
 * recurring bug: the sentence was accurate, the button worked, nothing threw,
 * and a seller who asked to be forgotten was not forgotten. It was also
 * DISABLED whenever localStorage happened to be empty, so the people most
 * likely to want this, the ones who had given an email address and had a real
 * server-side record, were the ones shown a greyed-out button.
 *
 * One component now, used by both readouts and by the abroad page. The device
 * and the server are cleared in that order, and the outcomes are reported
 * apart: deleted, cleared-here-but-nothing-there, this-browser-kept-nothing-
 * to-delete-by, and we-could-not-reach-the-server. A delete button is the one
 * control in a product where "probably worked" is not an acceptable thing to
 * imply. It asks first, in the page, saying what will go.
 */
export interface ForgetLabels {
  /** The line above the button. `null` when the caller has said it already. */
  blurb?: string | null;
  cta: string;
  working: string;
  done: string;
  partial: string;
  /**
   * The request never reached us. Optional because the Amharic for it is owed,
   * not written: a machine-guessed sentence about whether somebody's data was
   * deleted is the worst possible place for a mistranslation. Callers without
   * it fall back to the English: a rare failure state in the wrong script is
   * the lesser harm.
   */
  failed?: string;
  /**
   * Deleted, except a transaction record the privacy page says is kept (W11).
   * Optional for the same reason as `failed`: its Amharic is owed, not
   * guessed, and callers without it fall back to the English.
   */
  held?: string;
  /**
   * The confirmation: what goes, said before it goes, and the two answers.
   * Optional for the same reason as `failed`. A caller without `yes` gets its
   * own `cta` on the button, which says the same thing in its own script.
   */
  confirm?: string;
  yes?: string;
  keep?: string;
  /**
   * This browser never had a session of its own, so nothing on our side can
   * be found by it. Optional for the same reason as `failed`.
   */
  none?: string;
}

/* English, and the default rather than the only option. The abroad readout
   renders this under an Amharic paragraph and passes its own, out of the same
   dictionary the rest of that page reads from: an English button below
   Amharic prose is the half-translated seam that page exists to remove. */
const FORGET_EN: ForgetLabels = {
  blurb: "Changed your mind? Remove everything now rather than waiting for the schedule.",
  cta: "Delete all of it",
  working: "Deleting\u2026",
  done:
    "Deleted. Nothing about this visit is left on this device or on our side. The numbers on " +
    "this page are still on screen and will disappear when you close it.",
  partial:
    "Cleared from this device. Nothing from this visit was stored on our side. If you saved a " +
    "plan on another day, open the link we emailed you and delete it there.",
  /* This was folded into `partial` as "or the request did not reach us, in
     which case the retention schedule removes it on its own": which, for
     somebody who had left an email address, meant up to eighteen months, said
     in a sentence that read like reassurance. Found by a failure drill: with
     the database unreachable, the one control whose outcome matters most
     implied the deletion was taken care of. It was not. */
  failed:
    "Cleared from this device, but the request did not reach our side, so nothing " +
    "stored there has been deleted yet. Try again in a minute" +
    (CONTACT_EMAIL ? `, or write to ${CONTACT_EMAIL} and it will be done by hand.` : "."),
  /* The one exception the privacy page names, said here rather than hidden
     behind "Deleted": a person who reads "nothing is left" and later finds
     their purchase on file has been told something untrue. */
  held:
    "Deleted, except one thing: the record of the purchase we worked on together, which Georgia " +
    "licence law requires us to keep. Nobody can sign in to it any more, and its links are closed. " +
    "Everything else is gone from this device and our side.",
  confirm:
    "This deletes, now and for good: the answers and plan kept on this device, and on our side " +
    "everything this visit sent us, including any name, email address and phone number and the " +
    "consent given with them. It cannot be undone.",
  yes: "Yes, delete all of it",
  keep: "Keep it",
  /* The endpoint refuses a browser that never kept a session (it would have
     shared one id with every other such browser). That refusal read here as
     "the request did not reach our side", which was untrue: it arrived, and
     there was nothing it could name. */
  none:
    "Cleared from this device. This browser kept nothing to delete by: it did not store a session " +
    "of its own, so we cannot tell which records on our side are yours. If you saved a plan, open " +
    "the link we emailed you and delete it there" +
    (CONTACT_EMAIL ? `, or write to ${CONTACT_EMAIL} and it will be done by hand.` : "."),
};

/* On a saved plan's page the blurb names what goes: the plan and the details it was saved with. */
const PLAN: ForgetLabels = {
  ...FORGET_EN,
  blurb: "Delete this plan, your details and everything sent with them, now rather than on the schedule.",
  confirm:
    "This deletes, now and for good: this saved plan and its link, the name, email address and " +
    "phone number it was saved with, the consent given with them, and the answers kept on this " +
    "device. It cannot be undone.",
};

/* What /api/forget says when this browser sent a session id that is not its own. */
const NO_SESSION = "this browser has no session of its own to delete by";

/* The panel or message that replaces the pressed button takes focus, so it is
   read and focus does not drop to the top of the page. Stable, so it runs once
   when the element appears and never pulls focus back later. */
const focusOnShow = (el: HTMLElement | null) => el?.focus();

export function ForgetMe({ side, labels, style, planToken }: {
  side?: "buy" | "sell";
  labels?: ForgetLabels;
  style?: React.CSSProperties;
  /** On a saved plan's page: delete by its private link, since the session that saved it is gone. */
  planToken?: string;
}) {
  const l = labels ?? (planToken ? PLAN : FORGET_EN);
  const [state, setState] = useState<"idle" | "confirm" | "working" | "done" | "held" | "partial" | "failed" | "none">("idle");
  const opener = useRef<HTMLButtonElement>(null);
  const backOut = useRef(false);
  const id = useId();

  /* "Keep it" puts focus back on the button that opened the question, which
     has just been rendered again; without this it falls to the page's top. */
  useEffect(() => {
    if (state === "idle" && backOut.current) {
      backOut.current = false;
      opener.current?.focus();
    }
  }, [state]);

  /* A label the caller did not pass falls back to the English, and the
     English is marked as English and set in its own face rather than in the
     caller's script. */
  const say = (k: "confirm" | "keep" | "none" | "failed") =>
    l[k] ? { text: l[k], lang: undefined, style } : { text: FORGET_EN[k] ?? "", lang: labels ? "en" : undefined, style: labels ? {} : style };

  const forget = async () => {
    if (state === "working") return;
    setState("working");
    const sid = sessionId();

    try {
      window.localStorage.removeItem("rift.buy.draft");
      window.localStorage.removeItem("rift.sell.draft");
      window.localStorage.removeItem("rift.attr");
      window.localStorage.removeItem("rift.events");
      window.sessionStorage.removeItem("rift.sid");
    } catch { /* storage already unavailable: nothing to clear */ }
    /* The values' answers (income, savings) and the plan taking shape. These
       arrived with v5 and were missed here, so "nothing is left on this
       device" was untrue for exactly the figures a person most wants gone. */
    clearAnswers();
    clearPlan();

    try {
      const r = await fetch("/api/forget", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(planToken ? { planToken } : { sessionId: sid }),
      }).then((x) => x.json());
      /* Three answers, not two. "Nothing was there" and "we never heard you"
         are different facts, and only one of them is finished. */
      if (r?.ok && !r?.skipped) {
        track({ name: "data_deleted", ...(side ? { side } : {}) });
        setState(Number(r?.held) > 0 ? "held" : "done");
      } else if (r?.error === NO_SESSION) {
        setState("none");
      } else {
        setState(r?.ok ? "partial" : "failed");
      }
    } catch {
      setState("failed");
    }
  };

  const deleted = state === "done" || state === "held";
  const asking = state === "confirm" || state === "working";
  const confirm = say("confirm");
  const keep = say("keep");
  const none = say("none");
  const failed = say("failed");

  /* One card for every state, so the two message regions inside it are in
     the page before the outcome is. This returned a different card per state,
     each with its role on it, which is a live region that arrives already
     full: the one control where the outcome matters most was often silent to
     a screen reader.

     Each outcome also takes focus, because the button that was pressed is
     gone by the time it arrives. */
  return (
    <div className="card p-3" style={
      deleted ? { borderColor: "var(--pos, #2f7a52)" }
        : state === "failed" || asking ? { borderColor: "var(--warn-line)" }
          : state === "partial" || state === "none" ? undefined
            : { background: "var(--paper)" }
    }>
      <LiveRegion>
        {deleted ? (
          <div className="row-t gap-2" tabIndex={-1} ref={focusOnShow}>
            <Ico.checkCircle size={14} className="c-pos" style={{ flex: "none", marginTop: 2 }} />
            <p className="t-xs c-3" style={{ lineHeight: 1.55, ...(state === "held" && !l.held ? {} : style) }}>{state === "held" ? l.held ?? FORGET_EN.held : l.done}</p>
          </div>
        ) : state === "partial" ? (
          <div className="row-t gap-2" tabIndex={-1} ref={focusOnShow}>
            <Ico.checkCircle size={14} className="c-4" style={{ flex: "none", marginTop: 2 }} />
            <p className="t-xs c-3" style={{ lineHeight: 1.55, ...style }}>{l.partial}</p>
          </div>
        ) : state === "none" ? (
          <div className="row-t gap-2" tabIndex={-1} ref={focusOnShow}>
            <Ico.info size={14} className="c-3" style={{ flex: "none", marginTop: 2 }} />
            <p lang={none.lang} className="t-xs c-3" style={{ lineHeight: 1.55, ...none.style }}>{none.text}</p>
          </div>
        ) : null}
      </LiveRegion>

      <LiveRegion kind="alert">
        {state === "failed" ? (
          <div className="row-t gap-2" tabIndex={-1} ref={focusOnShow}>
            <Ico.alert size={14} className="c-warn" style={{ flex: "none", marginTop: 2 }} />
            <p lang={failed.lang} className="t-xs c-2" style={{ lineHeight: 1.55, ...failed.style }}>{failed.text}</p>
          </div>
        ) : null}
      </LiveRegion>

      {state === "failed" ? (
        <button className="btn btn-g btn-sm" style={{ marginTop: 8 }} onClick={forget}>
          <Ico.refresh size={12} /><span style={style}>{l.cta}</span>
        </button>
      ) : null}

      {/* The question, asked in the page. One press used to erase everything,
          a saved plan included, with nothing between a slip of the finger and
          a deletion that cannot be undone. It says what goes before it goes,
          and "Keep it" is as easy to reach as "Yes". */}
      {asking ? (
        <div role="group" aria-labelledby={`${id}-q`} tabIndex={-1} ref={focusOnShow}>
          <div className="row-t gap-2">
            <Ico.alert size={14} className="c-warn" style={{ flex: "none", marginTop: 2 }} />
            <p id={`${id}-q`} lang={confirm.lang} className="t-xs c-2" style={{ lineHeight: 1.55, ...confirm.style }}>{confirm.text}</p>
          </div>
          <div className="row wrap gap-2" style={{ marginTop: 10 }}>
            {/* aria-disabled rather than disabled while it works: a disabled
                button drops focus, and the outcome is what should take it. */}
            <button className="btn btn-p btn-sm" onClick={forget} aria-disabled={state === "working"}>
              <Ico.x size={12} />
              <span style={style}>{state === "working" ? l.working : l.yes ?? (labels ? l.cta : FORGET_EN.yes)}</span>
            </button>
            {state === "working" ? null : (
              <button className="btn btn-g btn-sm" onClick={() => { backOut.current = true; setState("idle"); }}>
                <span lang={keep.lang} style={keep.style}>{keep.text}</span>
              </button>
            )}
          </div>
        </div>
      ) : null}

      {state === "idle" ? (
        <div className="between wrap gap-2">
          {/* Suppressed, not translated, when the caller has its own heading and
              body above this card. The abroad readout does, and rendering this
              as well printed the English sentence directly beneath the Amharic
              one saying the same thing. */}
          {l.blurb === null ? <span /> : (
            <p className="t-xs c-3" style={{ lineHeight: 1.55, maxWidth: 360, ...style }}>
              {l.blurb ?? FORGET_EN.blurb}
            </p>
          )}
          {/* Never disabled. The previous seller-side version switched itself off
              when localStorage was empty, which is exactly the state of somebody
              on a second device, or anybody whose record is only on our side. */}
          <button ref={opener} className="btn btn-g btn-sm" onClick={() => setState("confirm")}>
            <Ico.x size={12} /><span style={style}>{l.cta}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
