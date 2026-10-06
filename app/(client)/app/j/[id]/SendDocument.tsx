"use client";

import { useState } from "react";
import { Ico } from "@/components/rift/icons";
import { CLIENT_KINDS, type ClientKind } from "@/lib/core/document";
import { post } from "../../post";

/**
 * Send a document to the agent (manual review WS11.3): a pre-approval
 * letter, proof of funds, an ID. The same path as the agent's own upload:
 * the bytes go straight to private storage with a one-time link, then the
 * server checks them before keeping anything (lib/db/documents.ts). The
 * agent is emailed that it arrived.
 */
export function SendDocument({ journeyId, agentFirst }: { journeyId: string; agentFirst: string }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<ClientKind>("preapproval");
  const [label, setLabel] = useState<string>(CLIENT_KINDS[0].label);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const choose = (k: ClientKind) => {
    setKind(k);
    setLabel(CLIENT_KINDS.find((x) => x.id === k)?.label ?? "");
  };

  const send = async () => {
    if (!file) return;
    setResult(null);
    setBusy("Getting ready…");
    const slot = await post({ action: "doc-slot", journeyId });
    if (!slot.ok) { setBusy(null); setResult({ ok: false, text: slot.error ?? "That did not work. Try again." }); return; }
    setBusy("Sending…");
    try {
      const form = new FormData();
      form.append("cacheControl", "3600");
      form.append("", file);
      const put = await fetch(String(slot.url), { method: "PUT", body: form, headers: { "x-upsert": "false" } });
      if (!put.ok) throw new Error(String(put.status));
    } catch {
      setBusy(null);
      setResult({ ok: false, text: "The file did not go through. Nothing was kept. Try again." });
      return;
    }
    setBusy("Checking the file…");
    const done = await post({ action: "doc-finish", journeyId, path: slot.path, filename: file.name, type: file.type, kind, label });
    setBusy(null);
    if (!done.ok) { setResult({ ok: false, text: done.error ?? "That did not work. Try again." }); return; }
    setResult({ ok: true, text: `Sent. ${agentFirst} has "${label.trim()}".` });
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
          <Ico.doc size={14} />Send {agentFirst} a document
        </button>
      ) : (
        <div>
          <div className="t-sm w6">Send {agentFirst} a document</div>
          <div className="row gap-2 wrap" style={{ marginTop: 8 }}>
            <label className="field" style={{ flex: "1 1 160px" }}>
              <span className="label">What it is</span>
              <select className="input" value={kind} onChange={(e) => choose(e.target.value as ClientKind)}>
                {CLIENT_KINDS.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
              </select>
            </label>
            <label className="field" style={{ flex: "2 1 200px" }}>
              <span className="label">Name it</span>
              <input className="input" value={label} maxLength={160} placeholder="For example, bank statement for September"
                onChange={(e) => setLabel(e.target.value)} />
            </label>
          </div>
          <label className="field" style={{ marginTop: 8 }}>
            <span className="label">File</span>
            <input className="input" type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <p className="t-2xs c-4" style={{ marginTop: 6, lineHeight: 1.5 }}>
            PDF, JPEG or PNG, up to 20 MB. Only {agentFirst} and the people buying with you can open it.
          </p>
          <div className="row gap-2" style={{ marginTop: 8 }}>
            <button type="button" className="btn btn-p btn-sm" disabled={!!busy || !file || label.trim().length < 2} onClick={send}>{busy ?? "Send it"}</button>
            <button type="button" className="btn btn-g btn-sm" disabled={!!busy} onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
