"use client";

import { useState } from "react";
import { Ico } from "@/components/rift/icons";
import { PASSWORD_MIN } from "@/lib/core/password";
import { post } from "../post";
import { translator, type Locale } from "@/lib/core/i18n";

const focusOnShow = (el: HTMLElement | null) => el?.focus();

/** Set or change the password. A person who came from Forgot password lands here already signed in. */
export function PasswordForm({ reset, email, locale = "en" }: { reset: boolean; email: string | null; locale?: Locale }) {
  const t = translator(locale);
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
        <Ico.check size={16} className="c-pos" /><span className="t-sm w6">{t("pt.pw.saved")}</span>
      </div>
    );
  }

  return (
    <form onSubmit={save} style={{ marginTop: 14 }}>
      {/* For password managers: which account this password belongs to. */}
      <input type="email" autoComplete="username" value={email ?? ""} readOnly hidden />
      <label className="field">
        <span className="label">{t(reset ? "pt.pw.new" : "pt.pw.set")}</span>
        <input className="input" type="password" autoComplete="new-password" value={password} minLength={PASSWORD_MIN} required
          autoFocus={reset} onChange={(e) => setPassword(e.target.value)} aria-describedby="pw-hint" />
      </label>
      <p id="pw-hint" className="t-2xs c-4" style={{ marginTop: 6 }}>{t("pt.pw.hint", { n: PASSWORD_MIN })}</p>
      {error ? (
        <p role="alert" className="t-xs c-neg row gap-2" style={{ marginTop: 8 }}>
          <Ico.alert size={12} style={{ flex: "none", marginTop: 2 }} /><span>{error}</span>
        </p>
      ) : null}
      <button type="submit" className="btn btn-p" style={{ marginTop: 12 }} disabled={state === "busy" || password.length < PASSWORD_MIN}>
        {state === "busy" ? t("pt.pw.saving") : t("pt.pw.save")}
      </button>
    </form>
  );
}
