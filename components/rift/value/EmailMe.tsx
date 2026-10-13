"use client";

import { useEffect, useId, useState } from "react";
import { Ico } from "@/components/rift/icons";
import { EMAIL_NOTE } from "@/lib/core/privacy";
import { readAnswers } from "@/lib/rift/answers";
import { sessionId } from "@/lib/rift/session";
import { track, flush } from "@/lib/rift/track";
import type { PlanEntry } from "@/lib/rift/plan";
import { useAgentFirstName } from "@/components/rift/site/Agent";

const KEY = "rift.emailme.closed";

/**
 * "Email me this": one field, kept in reach (audit 12 Oct §3 #3, D40).
 *
 * Save my plan sat about 2,200px down a phone's answer page, behind a name
 * field. Most people who would like the answer in their inbox never get that
 * far. This asks for an email address only, from a bar that appears once the
 * answer has been read past its headline, and saves the plan exactly as Save
 * my plan does (the same route, the same lead, consent and alert), without a
 * name. Save my plan stays for a name, a phone number and program alerts.
 *
 * It can be closed, and stays closed for the visit. It says "Not saved." when
 * nothing was stored, never "Sent."
 */
export function EmailMe({ side, plan, hidden, wordingVersion }: {
  side: "buy" | "sell" | "abroad";
  plan: PlanEntry[];
  /** While Save my plan is open, so two forms never show at once. */
  hidden: boolean;
  wordingVersion: string | null;
}) {
  const id = useId();
  const who = useAgentFirstName();
  const [shown, setShown] = useState(false);
  const [closed, setClosed] = useState(false);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [result, setResult] = useState<{ stored: boolean; emailed: boolean; url: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try { if (window.sessionStorage.getItem(KEY) === "1") setClosed(true); } catch { /* storage unavailable: shown */ }
    /* After the headline, not on arrival: a bar over the answer before it has
       been read is the "subscribe" pop-up this product refuses to be. */
    const onScroll = () => setShown(window.scrollY > 420);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const close = () => {
    setClosed(true);
    try { window.sessionStorage.setItem(KEY, "1"); } catch { /* the visit only */ }
  };

  const valid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || state === "sending") return;
    setState("sending");
    setError(null);
    try {
      const res = await fetch("/api/plan/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "save", quick: true, side, name: "", email: email.trim(),
          values: plan.map(({ tool, label, figure, href }) => ({ tool, label, figure, href })),
          answers: readAnswers(),
          sessionId: sessionId(),
          wordingVersion,
        }),
      });
      const d = (await res.json()) as { ok: boolean; error?: string; emailed?: boolean; url?: string | null; skipped?: string };
      if (!d.ok) { setError(d.error ?? "That did not go through."); setState("error"); return; }
      track({ name: "email_capture", side: side === "abroad" ? undefined : side, meta: { via: "quick", answered: plan.length } });
      flush();
      setResult({ stored: !d.skipped, emailed: Boolean(d.emailed), url: d.url ?? null });
      setState("done");
    } catch {
      setError("That did not go through. Try again.");
      setState("error");
    }
  };

  if (closed || hidden || !plan.length || (!shown && state === "idle" && !open)) return null;

  return (
    <div className="email-me" role="region" aria-label="Email me this answer">
      <div className="card email-me-in">
        {state === "done" && result ? (
          <div className="row-t gap-2" role="status">
            {result.stored ? <Ico.checkCircle size={16} className="c-pos" style={{ flex: "none", marginTop: 2 }} /> : <Ico.alert size={16} className="c-warn" style={{ flex: "none", marginTop: 2 }} />}
            <p className="t-sm c-2 grow" style={{ lineHeight: 1.55 }}>
              {!result.stored
                ? "Not saved. This copy of the site is not connected to where plans are kept, so nothing was stored. Bookmark this page to come back to it."
                : result.emailed
                  ? `Sent to ${email.trim()}, with a link that reopens your answers on any device.`
                  : result.url
                    ? <>Saved, but email is not sending right now. <a href={result.url} className="c-brand">Open your saved plan</a> and keep the link.</>
                    : `Saved. The link that reopens it could not be made just now; ${who} has your email and can send it.`}
            </p>
            <button type="button" className="btn btn-g btn-ico btn-sm" onClick={close} aria-label="Close"><Ico.x size={14} /></button>
          </div>
        ) : open ? (
          <form onSubmit={send}>
            <div className="row gap-2">
              <label htmlFor={id} className="sr-only">Email</label>
              <input id={id} className="input grow" type="email" autoComplete="email" placeholder="you@example.com"
                value={email} onChange={(e) => setEmail(e.target.value)} autoFocus style={{ minWidth: 0 }} />
              <button type="submit" className="btn btn-brand" disabled={!valid || state === "sending"}>
                {state === "sending" ? "Sending…" : "Send"}
              </button>
              <button type="button" className="btn btn-g btn-ico" onClick={close} aria-label="Close"><Ico.x size={14} /></button>
            </div>
            {error ? <p className="t-xs c-neg mt-2" role="alert">{error}</p> : null}
            <p className="t-2xs c-4 mt-2" style={{ lineHeight: 1.5 }}>
              {email.trim() && !valid ? "That email address does not look complete yet. " : ""}{EMAIL_NOTE}
            </p>
          </form>
        ) : (
          <div className="between gap-2">
            <button type="button" className="btn btn-brand grow" onClick={() => setOpen(true)}>
              <Ico.mail size={14} />Email me this answer
            </button>
            <button type="button" className="btn btn-g btn-ico" onClick={close} aria-label="Close"><Ico.x size={14} /></button>
          </div>
        )}
      </div>
    </div>
  );
}
