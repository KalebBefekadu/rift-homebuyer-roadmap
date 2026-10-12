"use client";

import { useState } from "react";
import { Ico } from "@/components/rift/icons";
import { LiveRegion } from "@/components/rift/Live";
import { track, flush } from "@/lib/rift/track";
import { sessionId } from "@/lib/rift/session";
import { ETHIOPIC_STACK, translator, type Locale } from "@/lib/core/i18n";
import { EQUB_TIMELINES } from "@/lib/core/equb";

const focusOnShow = (el: HTMLElement | null) => el?.focus();

async function post(body: Record<string, unknown>): Promise<{ ok: boolean; error?: string; token?: string | null }> {
  const res = await fetch("/api/equb", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return (await res.json().catch(() => ({ ok: false }))) as { ok: boolean; error?: string; token?: string | null };
}

/**
 * The Equb seat request in two steps (manual review WS2.10), used on
 * /equb/reserve and at the foot of /equb.
 *
 * Step 1 (name, phone, email) is saved the moment Next is pressed, so a
 * person who stops there still reaches Kaleb. Step 2 updates that same lead
 * with a token step 1 returned, never a lead id from the browser.
 *
 * Telemetry carries which step was reached, never what was typed (rule 6).
 * The consent wording stays in English on both languages: it is the version
 * that is recorded, and the record must hold the words that were shown.
 */
export function EqubForm({ locale, phoneConsent, emailNote }: { locale: Locale; phoneConsent: string; emailNote: string }) {
  const t = translator(locale);
  const am = locale === "am";
  const script: React.CSSProperties = am ? { fontFamily: ETHIOPIC_STACK } : {};

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [token, setToken] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [household, setHousehold] = useState("");
  const [lang, setLang] = useState<Locale>(locale);
  const [price, setPrice] = useState("");
  const [timeline, setTimeline] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const phoneOk = phone.replace(/\D/g, "").length >= 10;
  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const reachable = emailOk || phoneOk;
  const blocked = Boolean(phone) && !consent;
  const ready = Boolean(name.trim()) && reachable && !blocked;

  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true); setError("");
    try {
      const r = await post({ step: "start", sessionId: sessionId(), name, phone, email: emailOk ? email : "", phoneConsent: consent });
      if (!r.ok) { setError(r.error ?? t("eq.f.err.save")); return; }
      track({ name: "hero_answer", side: "buy", meta: { qid: "equb_step1", page: "equb" } });
      flush();
      setToken(r.token ?? null);
      setStep(r.token ? 2 : 3);
    } catch {
      setError(t("eq.f.err.net"));
    } finally {
      setBusy(false);
    }
  };

  const finish = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try {
      const r = await post({ step: "finish", token, household, language: lang, price, timeline });
      if (!r.ok) { setError(r.error ?? t("eq.f.err.save")); return; }
      track({ name: "booking_complete", side: "buy", meta: { live: false } });
      flush();
      setStep(3);
    } catch {
      setError(t("eq.f.err.net"));
    } finally {
      setBusy(false);
    }
  };

  const errorLine = (
    <LiveRegion kind="alert">
      {error ? (
        <p className="t-xs c-neg row gap-2" style={{ marginTop: 12 }}>
          <Ico.alert size={12} style={{ flex: "none", marginTop: 2 }} />{error}
        </p>
      ) : null}
    </LiveRegion>
  );

  if (step === 3) {
    return (
      <div className="card p-5" role="status" tabIndex={-1} ref={focusOnShow} style={{ maxWidth: 600, margin: "20px auto 0", ...script }}>
        <div className="row gap-2">
          <Ico.checkCircle size={18} className="c-pos" />
          <span className="t-md w6">{t("eq.f.done.h")}</span>
        </div>
        <p className="t-sm c-3" style={{ marginTop: 10, lineHeight: 1.65 }}>{t("eq.f.done.b")}</p>
      </div>
    );
  }

  return (
    <div className="card p-5" style={{ maxWidth: 600, margin: "20px auto 0" }}>
      <div className="row gap-2" aria-hidden style={{ marginBottom: 12 }}>
        {[1, 2].map((n) => (
          <span key={n} style={{ height: 4, flex: 1, borderRadius: 2, background: n <= step ? "var(--brand)" : "var(--line-2)" }} />
        ))}
      </div>
      <h3 className="t-md w6" style={script} tabIndex={-1} ref={step === 2 ? focusOnShow : undefined}>{t(step === 1 ? "eq.f.step1" : "eq.f.step2")}</h3>

      {step === 1 ? (
        <form onSubmit={start}>
          <label className="field" style={{ marginTop: 12 }}>
            <span className="label" style={script}>{t("eq.f.name")}</span>
            <input className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field" style={{ marginTop: 12 }}>
            <span className="label" style={script}>{t("eq.f.phone")}</span>
            <input className="input" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(404) 555-0100" />
          </label>
          {phone ? (
            <label className="opt fade-in" data-on={consent} style={{ marginTop: 12, alignItems: "flex-start" }}>
              <input type="checkbox" checked={consent} onChange={() => setConsent(!consent)} style={{ marginTop: 3 }} />
              <span className="t-xs c-2" lang="en" style={{ lineHeight: 1.55 }}>{phoneConsent}</span>
            </label>
          ) : null}
          <label className="field" style={{ marginTop: 12 }}>
            <span className="label" style={script}>{t("eq.f.email")}</span>
            <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            <span className="t-2xs c-4" lang="en" style={{ marginTop: 5, display: "block", lineHeight: 1.5 }}>{emailNote}</span>
          </label>
          {am ? <p className="t-2xs c-4" style={{ marginTop: 8, ...script }}>{t("eq.f.consentNote")}</p> : null}
          {errorLine}
          <button type="submit" className="btn btn-p" style={{ width: "100%", marginTop: 16, ...script }} disabled={!ready || busy}>
            {busy ? t("eq.f.sending") : !name.trim() ? t("eq.f.addName") : !reachable ? t("eq.f.addReach") : blocked ? t("eq.f.tick") : t("eq.f.next")}
            {!busy && ready ? <Ico.arrowR size={15} /> : null}
          </button>
          <p className="t-2xs c-4" style={{ marginTop: 10, lineHeight: 1.5, ...script }}>{t("eq.f.nocommit")}</p>
        </form>
      ) : (
        <form onSubmit={finish}>
          <p className="t-sm c-3" style={{ marginTop: 6, lineHeight: 1.6, ...script }}>{t("eq.f.saved")}</p>
          <label className="field" style={{ marginTop: 12 }}>
            <span className="label" style={script}>{t("eq.f.household")}</span>
            <input className="input" inputMode="numeric" value={household} onChange={(e) => setHousehold(e.target.value.replace(/\D/g, "").slice(0, 2))} />
          </label>
          <div className="field" style={{ marginTop: 12 }}>
            <span className="label" id="eq-lang" style={script}>{t("eq.f.lang")}</span>
            <div className="g2 gap-2" style={{ marginTop: 6 }} role="radiogroup" aria-labelledby="eq-lang">
              {([["en", "English"], ["am", "አማርኛ"]] as const).map(([id, l]) => (
                <label key={id} className="opt" data-on={lang === id}>
                  <input type="radio" name="eq-lang" checked={lang === id} onChange={() => setLang(id)} />
                  <span className="t-sm" lang={id} style={id === "am" ? { fontFamily: ETHIOPIC_STACK } : undefined}>{l}</span>
                </label>
              ))}
            </div>
          </div>
          <label className="field" style={{ marginTop: 12 }}>
            <span className="label" style={script}>{t("eq.f.price")}</span>
            <input className="input" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d$,]/g, "").slice(0, 12))} placeholder="$350,000" />
          </label>
          <div className="field" style={{ marginTop: 12 }}>
            <span className="label" id="eq-time" style={script}>{t("eq.f.when")}</span>
            <div className="g2 gap-2" style={{ marginTop: 6 }} role="radiogroup" aria-labelledby="eq-time">
              {EQUB_TIMELINES.map((x, i) => (
                <label key={x} className="opt" data-on={timeline === x}>
                  <input type="radio" name="eq-timeline" checked={timeline === x} onChange={() => setTimeline(x)} />
                  <span className="t-sm" style={script}>{t(`eq.t.${i}`)}</span>
                </label>
              ))}
            </div>
          </div>
          {errorLine}
          <button type="submit" className="btn btn-p" style={{ width: "100%", marginTop: 16, ...script }} disabled={busy}>
            {busy ? t("eq.f.sending") : t("eq.f.send")}
          </button>
          <button type="button" className="btn-link t-xs" style={{ marginTop: 10, ...script }} onClick={() => setStep(3)}>{t("eq.f.skip")}</button>
        </form>
      )}
    </div>
  );
}
