"use client";

import { useState } from "react";
import { useGo } from "@/components/rift/useRefresh";
import { Ico } from "@/components/rift/icons";
import { PASSWORD_MIN } from "@/lib/core/password";
import { post } from "../../post";

/* The confirmation replaces the button that was pressed; without this, focus
   drops to the top of the page. Stable, so it runs once when it appears. */
const focusOnShow = (el: HTMLElement | null) => el?.focus();

/**
 * Two ways in from an invitation (docs/audit/manual-review-2026-10-05.md,
 * WS1.1). Creating a password is the default: it signs the client in and joins
 * in one step, from this one link, with no second email to wait for. The
 * email link is still here for anybody who would rather not have a password.
 */
export function InviteActions({ token, signedIn, mismatch, masked }: {
  token: string;
  signedIn: boolean;
  mismatch: string | null;
  masked: string;
}) {
  const go = useGo();
  const [state, setState] = useState<"idle" | "busy" | "sent">("idle");
  const [mode, setMode] = useState<"password" | "link">("password");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [exists, setExists] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const back = `/app/sign-in?next=${encodeURIComponent(`/app/invite/${token}`)}`;

  /* A button, and a full reload after. It was a link to "#" that posted and
     then relied on `router.refresh()`, which components/rift/useRefresh.ts
     records as sometimes never landing, and it said nothing while it worked.
     The reload shows whichever state is true, even when the request failed. */
  const signOut = async () => {
    setLeaving(true);
    try { await fetch("/app/sign-out", { method: "POST" }); } catch { /* the reload shows where things stand */ }
    window.location.reload();
  };

  const sendLink = async () => {
    setState("busy");
    const r = await post({ action: "invite-link", token });
    if (!r.ok) { setError(r.error ?? "That did not work."); setState("idle"); return; }
    setError(null);
    setState("sent");
  };

  const createPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state === "busy") return;
    setState("busy");
    const r = await post({ action: "invite-password", token, password });
    if (!r.ok) {
      setExists(Boolean(r.exists));
      setError(r.error ?? "That did not work.");
      setState("idle");
      return;
    }
    /* A full load, not a client navigation: the session cookie was set by the
       response just now, and the journey page reads it on the server. */
    window.location.assign(`/app/j/${String(r.journeyId)}`);
  };

  const accept = async () => {
    setState("busy");
    const r = await post({ action: "accept", token });
    if (!r.ok) { setError(r.error ?? "That did not work."); setState("idle"); return; }
    go(`/app/j/${String(r.journeyId)}`);
  };

  if (state === "sent") {
    return (
      <div role="status" tabIndex={-1} ref={focusOnShow} style={{ marginTop: 16 }}>
        <div className="row gap-2"><Ico.mail size={16} className="c-pos" /><span className="t-md w6">Check {masked}.</span></div>
        <p className="t-sm c-3" style={{ marginTop: 8, lineHeight: 1.6 }}>
          We sent a sign-in link. Open it, press Continue, and you will come straight back here to join.
        </p>
      </div>
    );
  }

  const errorLine = error ? (
    <p role="alert" className="t-xs c-neg row gap-2" style={{ marginBottom: 10 }}>
      <Ico.alert size={12} style={{ flex: "none", marginTop: 2 }} />
      <span>{error}{exists ? <> <a className="btn-link" href={back}>Sign in</a></> : null}</span>
    </p>
  ) : null;

  if (signedIn && !mismatch) {
    return (
      <div style={{ marginTop: 16 }}>
        {errorLine}
        <button className="btn btn-p" style={{ width: "100%" }} disabled={state === "busy"} onClick={accept}>
          {state === "busy" ? "Joining…" : "Join"}
        </button>
      </div>
    );
  }

  if (signedIn && mismatch) {
    return (
      <div style={{ marginTop: 16 }}>
        {errorLine}
        <p className="t-xs c-3" style={{ lineHeight: 1.6 }}>
          {mismatch}{" "}
          <button type="button" className="btn-link" disabled={leaving} onClick={() => void signOut()}>
            {leaving ? "Signing out…" : "Sign out"}
          </button>{leaving ? null : " first."}
        </p>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 16 }}>
      {errorLine}
      {mode === "password" ? (
        <form onSubmit={createPassword}>
          <label className="field">
            <span className="label">Create a password</span>
            <input className="input" type="password" autoComplete="new-password" value={password} minLength={PASSWORD_MIN} required
              onChange={(e) => setPassword(e.target.value)} aria-describedby="pw-hint" />
          </label>
          <p id="pw-hint" className="t-2xs c-4" style={{ marginTop: 6 }}>At least {PASSWORD_MIN} characters. A short phrase works well.</p>
          <button type="submit" className="btn btn-p" style={{ width: "100%", marginTop: 12 }} disabled={state === "busy" || password.length < PASSWORD_MIN}>
            {state === "busy" ? "Joining…" : "Create password and join"}
          </button>
          <p className="t-xs c-3" style={{ marginTop: 12, lineHeight: 1.6 }}>
            Rather not have a password?{" "}
            <button type="button" className="btn-link" onClick={() => { setMode("link"); setError(null); }}>Email me a sign-in link instead</button>.
            {" "}Already have a login? <a className="btn-link" href={back}>Sign in</a>.
          </p>
        </form>
      ) : (
        <>
          <button className="btn btn-p" style={{ width: "100%" }} disabled={state === "busy"} onClick={sendLink}>
            {state === "busy" ? "Sending…" : `Email a sign-in link to ${masked}`}
          </button>
          <p className="t-xs c-3" style={{ marginTop: 12, lineHeight: 1.6 }}>
            The link works once and on any device.{" "}
            <button type="button" className="btn-link" onClick={() => { setMode("password"); setError(null); }}>Create a password instead</button>.
          </p>
        </>
      )}
    </div>
  );
}
