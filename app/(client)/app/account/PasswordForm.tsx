"use client";

import { useState } from "react";
import { Ico } from "@/components/rift/icons";
import { PASSWORD_MIN } from "@/lib/core/password";
import { post } from "../post";

const focusOnShow = (el: HTMLElement | null) => el?.focus();

/** Set or change the password. A person who came from Forgot password lands here already signed in. */
export function PasswordForm({ reset, email }: { reset: boolean; email: string | null }) {
  const [password, setPassword] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state === "busy") return;
    setState("busy");
    const r = await post({ action: "set-password", password });
    if (!r.ok) { setError(r.error ?? "That did not work."); setState("idle"); return; }
    setError(null);
    setPassword("");
    setState("saved");
  };

  if (state === "saved") {
    return (
      <div role="status" tabIndex={-1} ref={focusOnShow} className="row gap-2" style={{ marginTop: 14 }}>
        <Ico.check size={16} className="c-pos" /><span className="t-sm w6">Password saved. Use it next time you sign in.</span>
      </div>
    );
  }

  return (
    <form onSubmit={save} style={{ marginTop: 14 }}>
      {/* For password managers: which account this password belongs to. */}
      <input type="email" autoComplete="username" value={email ?? ""} readOnly hidden />
      <label className="field">
        <span className="label">{reset ? "Choose a new password" : "Set or change your password"}</span>
        <input className="input" type="password" autoComplete="new-password" value={password} minLength={PASSWORD_MIN} required
          autoFocus={reset} onChange={(e) => setPassword(e.target.value)} aria-describedby="pw-hint" />
      </label>
      <p id="pw-hint" className="t-2xs c-4" style={{ marginTop: 6 }}>At least {PASSWORD_MIN} characters. You can still sign in with an email link any time.</p>
      {error ? (
        <p role="alert" className="t-xs c-neg row gap-2" style={{ marginTop: 8 }}>
          <Ico.alert size={12} style={{ flex: "none", marginTop: 2 }} /><span>{error}</span>
        </p>
      ) : null}
      <button type="submit" className="btn btn-p" style={{ marginTop: 12 }} disabled={state === "busy" || password.length < PASSWORD_MIN}>
        {state === "busy" ? "Saving…" : "Save password"}
      </button>
    </form>
  );
}
