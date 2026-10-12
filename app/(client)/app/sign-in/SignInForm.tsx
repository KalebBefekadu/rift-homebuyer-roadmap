"use client";

import { useState } from "react";
import { Ico } from "@/components/rift/icons";
import { post } from "../post";
import { translator, type Locale } from "@/lib/core/i18n";

/* The confirmation replaces the button that was pressed; without this, focus
   drops to the top of the page. Stable, so it runs once when it appears. */
const focusOnShow = (el: HTMLElement | null) => el?.focus();

type Mode = "password" | "link" | "reset";

/**
 * Password or an email link, the person's choice (manual review WS1.2). Both
 * only ever reach what an invitation granted: a login proves an address, and
 * /app shows nothing for an address nobody invited.
 */
export function SignInForm({ next, locale = "en" }: { next: string; locale?: Locale }) {
  const t = translator(locale);
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
      if (!r.ok) { setError(r.error ?? t("pt.f.failed")); setState("idle"); return; }
      /* A full load: the session cookie arrived with that response. */
      window.location.assign(next);
      return;
    }
    const r = await post({ action: mode === "reset" ? "reset" : "signin", email });
    if (!r.ok) { setError(r.error ?? t("pt.f.failed")); setState("idle"); return; }
    setError(null);
    setState("sent");
  };

  const switchTo = (m: Mode) => { setMode(m); setError(null); };

  if (state === "sent") {
    return (
      <div role="status" tabIndex={-1} ref={focusOnShow} style={{ marginTop: 16 }}>
        <div className="row gap-2"><Ico.mail size={16} className="c-pos" /><span className="t-md w6">{t("pt.f.check")}</span></div>
        <p className="t-sm c-3" style={{ marginTop: 8, lineHeight: 1.6 }}>
          {t(mode === "reset" ? "pt.f.sentBodyReset" : "pt.f.sentBody", { email: email.trim() })}
        </p>
        <button type="button" className="btn-link t-xs" style={{ marginTop: 10 }} onClick={() => { setState("idle"); switchTo("password"); }}>
          {t("pt.f.back")}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit}>
      <label className="field" style={{ marginTop: 16 }}>
        <span className="label">{t("pt.f.email")}</span>
        <input className="input" type="email" autoComplete="email" value={email} placeholder="you@example.com" required
          onChange={(e) => setEmail(e.target.value)} />
      </label>
      {mode === "password" ? (
        <label className="field" style={{ marginTop: 12 }}>
          <span className="label">{t("pt.f.password")}</span>
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
          ? (mode === "password" ? t("pt.f.signingIn") : t("pt.f.sending"))
          : mode === "password" ? t("pt.f.signin") : mode === "reset" ? t("pt.f.reset") : t("pt.f.link")}
      </button>
      <div className="t-xs c-3" style={{ marginTop: 12, lineHeight: 1.8, display: "grid" }}>
        {mode === "password" ? (
          <>
            <button type="button" className="btn-link" style={{ justifySelf: "start" }} onClick={() => switchTo("reset")}>{t("pt.f.forgot")}</button>
            <button type="button" className="btn-link" style={{ justifySelf: "start" }} onClick={() => switchTo("link")}>{t("pt.f.linkInstead")}</button>
          </>
        ) : (
          <button type="button" className="btn-link" style={{ justifySelf: "start" }} onClick={() => switchTo("password")}>{t("pt.f.withPassword")}</button>
        )}
      </div>
    </form>
  );
}
