"use client";

import { useEffect, useRef, useState } from "react";
import { Ico } from "@/components/rift/icons";
import { LiveRegion } from "@/components/rift/Live";
import { EMAIL_NOTE, PHONE_CONSENT } from "@/lib/core/privacy";
import { readAnswers } from "@/lib/rift/answers";
import { sessionId } from "@/lib/rift/session";
import { track, flush } from "@/lib/rift/track";
import type { PlanEntry } from "@/lib/rift/plan";
import { customFor, type CustomQuestion } from "@/lib/core/question-wording";
import { CustomQuestions } from "./CustomQuestions";

/* Stable, so it runs once when the element appears and never pulls focus back later. */
const focusOnShow = (el: HTMLElement | null) => el?.focus();

/**
 * "Save my plan" and "Ask Kaleb to review my numbers" (Blueprint v5 §5.5,
 * D14): the two things after a value that ask for details, because they give
 * something back that needs them: a plan that reopens on any device, and a
 * person who looks at it.
 *
 * Name and email. A phone number is optional and is only stored with the
 * consent box ticked (the server refuses it otherwise). What they agree to is
 * shown in the words that are recorded.
 */
export function SavePlan({ side, mode, plan, onClose, questions }: {
  side: "buy" | "sell" | "abroad";
  mode: "save" | "review";
  plan: PlanEntry[];
  onClose: () => void;
  /** The published wording this page was rendered with (D37): the agent's questions for this side, and its version. */
  questions?: { custom: CustomQuestion[]; versionId: string | null };
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneOk, setPhoneOk] = useState(false);
  /* Unticked, and only on the buyer side, where programs are (D14). */
  const [alerts, setAlerts] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [result, setResult] = useState<{ emailed: boolean; url: string | null; answerWith: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const phoneGiven = phone.trim().length > 0;
  const ready = name.trim().length > 0 && emailValid && (!phoneGiven || phoneOk);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || state === "sending") return;
    setState("sending");
    setError(null);
    try {
      const res = await fetch("/api/plan/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode, side, name: name.trim(), email: email.trim(),
          phone: phoneGiven ? phone.trim() : "", phoneConsent: phoneGiven && phoneOk,
          values: plan.map(({ tool, label, figure, href }) => ({ tool, label, figure, href })),
          answers: readAnswers(),
          alerts: side === "buy" && alerts,
          sessionId: sessionId(),
          /* Which words they were asked in, recorded on the lead. */
          wordingVersion: questions?.versionId ?? null,
        }),
      });
      const d = (await res.json()) as { ok: boolean; error?: string; emailed?: boolean; url?: string | null; answerWith?: string | null };
      if (!d.ok) { setError(d.error ?? "That did not go through."); setState("error"); return; }
      track({ name: "email_capture", side: side === "abroad" ? undefined : side, meta: { via: mode === "review" ? "review" : "plan", answered: plan.length } });
      flush();
      setResult({ emailed: Boolean(d.emailed), url: d.url ?? null, answerWith: d.answerWith ?? null });
      setState("done");
    } catch {
      setError("That did not go through. Nothing on this page has changed; try again.");
      setState("error");
    }
  };

  const tone = side === "sell" ? "sell" : side === "abroad" ? "abroad" : "buy";
  /* Narrowed to the values in this plan here and again on the server, which
     decides what counts from the version recorded on the lead. */
  const asked = questions ? customFor({ builtin: {}, custom: questions.custom }, side, plan.map((p) => p.tool)) : [];

  /* Behaving like a dialog, which it only looked like. It said aria-modal and
     then left focus on the button behind it, let Tab walk out into the page
     it was covering, ignored Escape, and on close dropped focus to the top of
     the page. For somebody on a keyboard, "Save my plan" opened something
     they could neither reach nor leave. */
  const box = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    box.current?.querySelector<HTMLElement>("input")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); close.current(); return; }
      if (e.key !== "Tab" || !box.current) return;
      const stops = Array.from(box.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
      ));
      if (!stops.length) return;
      const first = stops[0], last = stops[stops.length - 1];
      const at = document.activeElement;
      const inside = box.current.contains(at);
      if (e.shiftKey && (at === first || !inside)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (at === last || !inside)) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      /* Back to "Save my plan" or "Ask Kaleb", whichever opened it. */
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  /* A press on the dim page behind closed the dialog, and the dialog is
     unmounted on close, so a stray click while reaching for the mouse threw
     away a name and email already typed. Once anything is typed, only the
     close button, Escape or "Back to my answer" closes it. The press's own
     default is stopped either way, or it moves focus to the page's top after
     the close has put it back on the opener. */
  const typed = state !== "done" && (name.trim() !== "" || email.trim() !== "" || phone.trim() !== "");

  return (
    <div className="cmdk-veil" style={{ alignItems: "center" }}
      onMouseDown={(e) => { e.preventDefault(); if (!typed) onClose(); }}>
      <div ref={box} role="dialog" aria-modal="true" aria-labelledby="save-h" className={`card fade-in ${tone}`}
        style={{ maxWidth: 460, width: "100%", padding: 28, maxHeight: "calc(100vh - 32px)", overflowY: "auto" }}
        onMouseDown={(e) => e.stopPropagation()}>
        {state === "done" ? (
          /* The submit button that had focus is gone; the answer takes it. */
          <div tabIndex={-1} ref={focusOnShow}>
            <h2 id="save-h" className="serif" style={{ fontSize: 26, letterSpacing: "-0.022em" }}>
              {mode === "review" ? "Kaleb has it." : "Saved."}
            </h2>
            <p className="t-md c-2 mt-2" style={{ lineHeight: 1.6 }}>
              {mode === "review"
                ? "He will look over your numbers and reply by email, on business days usually the same day."
                : "Your plan is saved."}
              {" "}
              {result?.emailed ? `We emailed a link to ${email.trim()} so you can reopen it on any device.` : "Email is not sending right now, so keep the link below."}
            </p>
            {result?.url ? (
              <a href={result.url} className="btn btn-s mt-3" style={{ width: "100%" }}>Open my saved plan</a>
            ) : null}
            {/* Only with the plan's link to answer with: without it there is
                no way to attach the answers to this person, so none are asked. */}
            {result?.answerWith && asked.length ? <CustomQuestions questions={asked} token={result.answerWith} /> : null}
            <button className="btn btn-p btn-lg mt-2" style={{ width: "100%" }} onClick={onClose}>Back to my answer</button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="between">
              <h2 id="save-h" className="serif" style={{ fontSize: 26, letterSpacing: "-0.022em", lineHeight: 1.15 }}>
                {mode === "review" ? "Ask Kaleb to review" : "Save my plan"}
              </h2>
              <button type="button" className="btn btn-g btn-ico" onClick={onClose} aria-label="Close"><Ico.x size={15} /></button>
            </div>
            <p className="t-sm c-2 mt-2" style={{ lineHeight: 1.6 }}>
              {mode === "review"
                ? "Kaleb looks at your answers and replies with what he would do next. No obligation."
                : "Your answers, saved together, with a link that reopens them on any device."}
            </p>

            <label className="field mt-4">
              <span className="label">Your name</span>
              <input className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label className="field mt-3">
              <span className="label">Email</span>
              <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label className="field mt-3">
              <span className="label">Phone <span className="c-4 w4">(optional)</span></span>
              <input className="input" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>
            {phoneGiven ? (
              <label className="opt mt-2" data-on={phoneOk} style={{ alignItems: "flex-start" }}>
                <input type="checkbox" checked={phoneOk} onChange={() => setPhoneOk(!phoneOk)} />
                <span className="t-xs c-2" style={{ lineHeight: 1.55 }}>{PHONE_CONSENT}</span>
              </label>
            ) : null}

            {side === "buy" ? (
              <label className="opt mt-3" data-on={alerts} style={{ alignItems: "flex-start" }}>
                <input type="checkbox" checked={alerts} onChange={() => setAlerts(!alerts)} />
                <span className="t-xs c-2" style={{ lineHeight: 1.55 }}>
                  Tell me when a Georgia program I may fit opens, changes or runs out of funds. Kaleb writes to you himself.
                </span>
              </label>
            ) : null}

            <LiveRegion kind="alert">
              {error ? (
                <p className="t-sm c-neg mt-3 row-t gap-2">
                  <Ico.alert size={13} style={{ flex: "none", marginTop: 3 }} />{error}
                </p>
              ) : null}
            </LiveRegion>

            <button type="submit" className="btn btn-brand btn-lg mt-4" style={{ width: "100%" }} disabled={!ready || state === "sending"}>
              {state === "sending" ? "Saving…" : mode === "review" ? "Send it to Kaleb" : "Save my plan"}
            </button>
            <p className="t-xs c-4 mt-3" style={{ lineHeight: 1.55 }}>{EMAIL_NOTE}</p>
          </form>
        )}
      </div>
    </div>
  );
}
