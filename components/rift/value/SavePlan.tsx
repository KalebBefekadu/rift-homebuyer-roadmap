"use client";

import { useState } from "react";
import { Ico } from "@/components/rift/icons";
import { EMAIL_NOTE, PHONE_CONSENT } from "@/lib/core/privacy";
import { readAnswers } from "@/lib/rift/answers";
import { sessionId } from "@/lib/rift/session";
import { track, flush } from "@/lib/rift/track";
import type { PlanEntry } from "@/lib/rift/plan";

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
export function SavePlan({ side, mode, plan, onClose }: {
  side: "buy" | "sell" | "abroad";
  mode: "save" | "review";
  plan: PlanEntry[];
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneOk, setPhoneOk] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [result, setResult] = useState<{ emailed: boolean; url: string | null } | null>(null);
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
          sessionId: sessionId(),
        }),
      });
      const d = (await res.json()) as { ok: boolean; error?: string; emailed?: boolean; url?: string | null };
      if (!d.ok) { setError(d.error ?? "That did not go through."); setState("error"); return; }
      track({ name: "email_capture", side: side === "abroad" ? undefined : side, meta: { via: mode === "review" ? "review" : "plan", answered: plan.length } });
      flush();
      setResult({ emailed: Boolean(d.emailed), url: d.url ?? null });
      setState("done");
    } catch {
      setError("That did not go through. Nothing on this page has changed; try again.");
      setState("error");
    }
  };

  const tone = side === "sell" ? "sell" : side === "abroad" ? "abroad" : "buy";

  return (
    <div className="cmdk-veil" style={{ alignItems: "center" }} onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="save-h" className={`card fade-in ${tone}`}
        style={{ maxWidth: 460, width: "100%", padding: 28, maxHeight: "calc(100vh - 32px)", overflowY: "auto" }}
        onMouseDown={(e) => e.stopPropagation()}>
        {state === "done" ? (
          <>
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
            <button className="btn btn-p btn-lg mt-2" style={{ width: "100%" }} onClick={onClose}>Back to my answer</button>
          </>
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

            {error ? <p role="alert" className="t-sm c-neg mt-3">{error}</p> : null}

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
