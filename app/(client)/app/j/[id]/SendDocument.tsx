"use client";

import { useState } from "react";
import { Ico } from "@/components/rift/icons";
import { CLIENT_KINDS, type ClientKind } from "@/lib/core/document";
import { translator, type Locale } from "@/lib/core/i18n";
import { post } from "../../post";

/**
 * Send a document to the agent (manual review WS11.3): a pre-approval
 * letter, proof of funds, an ID. The same path as the agent's own upload:
 * the bytes go straight to private storage with a one-time link, then the
 * server checks them before keeping anything (lib/db/documents.ts). The
 * agent is emailed that it arrived.
 */
export function SendDocument({ journeyId, agentFirst, locale = "en" }: { journeyId: string; agentFirst: string; locale?: Locale }) {
  const t = translator(locale);
  const A = { agent: agentFirst };
  /* The name a kind starts with, in the page's language: the label is what
     the client called it, and Kaleb reads both. */
  const nameOf = (k: ClientKind) => (k === "other" ? "" : t(`pt.kind.${k}`));
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<ClientKind>("preapproval");
  const [label, setLabel] = useState<string>(nameOf("preapproval"));
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const choose = (k: ClientKind) => {
    setKind(k);
    setLabel(nameOf(k));
  };

  const send = async () => {
    if (!file) return;
    setResult(null);
    setBusy(t("pt.send.ready"));
    const slot = await post({ action: "doc-slot", journeyId });
    if (!slot.ok) { setBusy(null); setResult({ ok: false, text: slot.error ?? t("pt.send.error") }); return; }
    setBusy(t("pt.send.sending"));
    try {
      const form = new FormData();
      form.append("cacheControl", "3600");
      form.append("", file);
      const put = await fetch(String(slot.url), { method: "PUT", body: form, headers: { "x-upsert": "false" } });
      if (!put.ok) throw new Error(String(put.status));
    } catch {
      setBusy(null);
      setResult({ ok: false, text: t("pt.send.failed") });
      return;
    }
    setBusy(t("pt.send.checking"));
    const done = await post({ action: "doc-finish", journeyId, path: slot.path, filename: file.name, type: file.type, kind, label });
    setBusy(null);
    if (!done.ok) { setResult({ ok: false, text: done.error ?? t("pt.send.error") }); return; }
    setResult({ ok: true, text: t("pt.send.sent", { ...A, label: label.trim() }) });
    setOpen(false); setFile(null); choose("preapproval");
    window.setTimeout(() => window.location.reload(), 1200);
  };

  return (
    <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--line-2)" }}>
      {result ? (
        <p role={result.ok ? "status" : "alert"} className={`t-sm row gap-2 ${result.ok ? "c-pos" : "c-neg"}`} style={{ marginBottom: 8 }}>
          {result.ok ? <Ico.check size={14} style={{ flex: "none", marginTop: 3 }} /> : <Ico.alert size={14} style={{ flex: "none", marginTop: 3 }} />}
          {result.text}
        </p>
      ) : null}
      {!open ? (
        <button type="button" className="btn btn-s btn-sm" onClick={() => setOpen(true)}>
          <Ico.doc size={14} />{t("pt.send.btn", A)}
        </button>
      ) : (
        <div>
          <div className="t-sm w6">{t("pt.send.btn", A)}</div>
          <div className="row gap-2 wrap" style={{ marginTop: 8 }}>
            <label className="field" style={{ flex: "1 1 160px" }}>
              <span className="label">{t("pt.send.what")}</span>
              <select className="input" value={kind} onChange={(e) => choose(e.target.value as ClientKind)}>
                {CLIENT_KINDS.map((k) => <option key={k.id} value={k.id}>{t(`pt.kind.${k.id}`)}</option>)}
              </select>
            </label>
            <label className="field" style={{ flex: "2 1 200px" }}>
              <span className="label">{t("pt.send.name")}</span>
              <input className="input" value={label} maxLength={160} placeholder={t("pt.send.namePh")}
                onChange={(e) => setLabel(e.target.value)} />
            </label>
          </div>
          <label className="field" style={{ marginTop: 8 }}>
            <span className="label">{t("pt.send.file")}</span>
            <input className="input" type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <p className="t-2xs c-4" style={{ marginTop: 6, lineHeight: 1.5 }}>
            {t("pt.send.note", A)}
          </p>
          <div className="row gap-2" style={{ marginTop: 8 }}>
            <button type="button" className="btn btn-p btn-sm" disabled={!!busy || !file || label.trim().length < 2} onClick={send}>{busy ?? t("pt.send.go")}</button>
            <button type="button" className="btn btn-g btn-sm" disabled={!!busy} onClick={() => setOpen(false)}>{t("pt.send.cancel")}</button>
          </div>
        </div>
      )}
    </div>
  );
}
