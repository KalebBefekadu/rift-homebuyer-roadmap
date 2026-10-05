"use client";

import { useState } from "react";
import { Ico } from "@/components/rift/icons";
import { post } from "../post";

/* The confirmation replaces the button that was pressed; without this, focus
   drops to the top of the page. Stable, so it runs once when it appears. */
const focusOnShow = (el: HTMLElement | null) => el?.focus();

type Mode = "password" | "link" | "reset";

/**
 * Password or an email link, the person's choice (manual review WS1.2). Both
 * only ever reach what an invitation granted: a login proves an address, and
 * /app shows nothing for an address nobody invited.
 */
export function SignInForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<Mode>("password");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  /* A form, so Enter and the button are one path. Enter used to call this
     from a key handler that did not check it was already sending, so a
     second press while the first was on its way asked for a second link. */
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || state === "sending") return;
    setState("sending");
    if (mode === "password") {
      const r = await post({ action: "password", email, password });
      if (!r.ok) { setError(r.error ?? "That did not work."); setState("idle"); return; }
      /* A full load: the session cookie arrived with that response. */
      window.location.assign(next);
      return;
    }
    const r = await post({ action: mode === "reset" ? "reset" : "signin", email });
    if (!r.ok) { setError(r.error ?? "That did not work."); setState("idle"); return; }
    setError(null);
    setState("sent");
  };

  const switchTo = (m: Mode) => { setMode(m); setError(null); };

  if (state === "sent") {
    return (
      <div role="status" tabIndex={-1} ref={focusOnShow} style={{ marginTop: 16 }}>
        <div className="row gap-2"><Ico.mail size={16} className="c-pos" /><span className="t-md w6">Check your email.</span></div>
        <p className="t-sm c-3" style={{ marginTop: 8, lineHeight: 1.6 }}>
          If {email.trim()} has been invited, a link is on its way{mode === "reset" ? " to choose a new password" : ""}. It works
          once, on any device. Nothing arrived after a few minutes? Check spam, check the address is spelled the way your
          agent has it, then ask your agent to confirm it.
        </p>
        <button type="button" className="btn-link t-xs" style={{ marginTop: 10 }} onClick={() => { setState("idle"); switchTo("password"); }}>
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit}>
      <label className="field" style={{ marginTop: 16 }}>
        <span className="label">Email</span>
        <input className="input" type="email" autoComplete="email" value={email} placeholder="you@example.com" required
          onChange={(e) => setEmail(e.target.value)} />
      </label>
      {mode === "password" ? (
        <label className="field" style={{ marginTop: 12 }}>
          <span className="label">Password</span>
          <input className="input" type="password" autoComplete="current-password" value={password} required
            onChange={(e) => setPassword(e.target.value)} />
        </label>
      ) : null}
      {error ? (
        <p role="alert" className="t-xs c-neg row gap-2" style={{ marginTop: 8 }}>
          <Ico.alert size={12} style={{ flex: "none", marginTop: 2 }} /><span>{error}</span>
        </p>
      ) : null}
      <button type="submit" className="btn btn-p" style={{ marginTop: 14, width: "100%" }}
        disabled={state === "sending" || !email.trim() || (mode === "password" && !password)}>
        {state === "sending"
          ? (mode === "password" ? "Signing in…" : "Sending…")
          : mode === "password" ? "Sign in" : mode === "reset" ? "Email me a reset link" : "Email me a sign-in link"}
      </button>
      <div className="t-xs c-3" style={{ marginTop: 12, lineHeight: 1.8, display: "grid" }}>
        {mode === "password" ? (
          <>
            <button type="button" className="btn-link" style={{ justifySelf: "start" }} onClick={() => switchTo("reset")}>Forgot password?</button>
            <button type="button" className="btn-link" style={{ justifySelf: "start" }} onClick={() => switchTo("link")}>Email me a sign-in link instead</button>
          </>
        ) : (
          <button type="button" className="btn-link" style={{ justifySelf: "start" }} onClick={() => switchTo("password")}>Sign in with a password</button>
        )}
      </div>
    </form>
  );
}
