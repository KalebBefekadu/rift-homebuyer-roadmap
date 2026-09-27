"use client";

import { useState } from "react";
import { DATES_CHECK_LABEL, SEARCH_CHECK_LABEL, checkError, type Checkable, type CheckResult } from "@/lib/core/pilot";
import { useWrite } from "../journey/[id]/useWrite";

const newRequest = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
        (Number(c) ^ (Math.random() * 16) >> (Number(c) / 4)).toString(16));

/**
 * Record one check of a buyer's search and dates against Matrix and the
 * documents. Only what the journey has is asked about; the server works that
 * out again for itself and refuses a check of something that is not there.
 */
export function Check({ journeyId, has, stamp }: { journeyId: string; has: Checkable; stamp: string }) {
  const { busy, error, setError, write } = useWrite(stamp);
  const [open, setOpen] = useState(false);
  const [req, setReq] = useState(newRequest);
  const [search, setSearch] = useState<CheckResult>(has.search ? "matches" : "none");
  const [dates, setDates] = useState<CheckResult>(has.dates ? "matches" : "none");
  const [note, setNote] = useState("");

  if (!has.search && !has.dates) {
    return <p className="t-xs c-4" style={{ marginTop: 8 }}>Nothing to check yet: no search recorded in Matrix and no contract dates.</p>;
  }
  if (!open) {
    return <button type="button" className="btn btn-s btn-sm no-print" style={{ marginTop: 10 }} onClick={() => setOpen(true)}>Record a check</button>;
  }

  const differs = search === "differs" || dates === "differs";
  const save = async () => {
    const bad = checkError({ search, dates, note }, has);
    if (bad) return setError(bad);
    const r = await write("reconcile", { journeyId, search, dates, note: note.trim() || null, requestId: req });
    if (r.ok) {
      setReq(newRequest());
      setOpen(false);
      setNote("");
    }
  };
  const pick = (id: string, label: string, value: CheckResult, set: (v: CheckResult) => void, labels: Record<CheckResult, string>) => (
    <label className="t-xs" htmlFor={id} style={{ display: "grid", gap: 4 }}>
      <span className="w6">{label}</span>
      <select id={id} className="select" value={value} onChange={(e) => set(e.target.value as CheckResult)}>
        <option value="matches">{labels.matches}</option>
        <option value="differs">{labels.differs}</option>
      </select>
    </label>
  );

  return (
    <div className="no-print" style={{ marginTop: 10, display: "grid", gap: 10, maxWidth: 520 }}>
      {has.search
        ? pick(`s-${journeyId}`, "Matrix search, against the approved priorities", search, setSearch, SEARCH_CHECK_LABEL)
        : <p className="t-xs c-4">{SEARCH_CHECK_LABEL.none}.</p>}
      {has.dates
        ? pick(`d-${journeyId}`, "Contract dates, against the signed documents", dates, setDates, DATES_CHECK_LABEL)
        : <p className="t-xs c-4">{DATES_CHECK_LABEL.none}.</p>}
      <label className="t-xs" htmlFor={`n-${journeyId}`} style={{ display: "grid", gap: 4 }}>
        <span className="w6">{differs ? "What differed, and what you did about it" : "Note (optional)"}</span>
        <textarea id={`n-${journeyId}`} className="input" style={{ height: "auto", paddingBlock: 8 }} rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      {error ? <p className="t-xs c-neg" role="alert">{error}</p> : null}
      <div className="row gap-2">
        <button type="button" className="btn btn-p btn-sm" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save the check"}</button>
        <button type="button" className="btn btn-g btn-sm" disabled={busy} onClick={() => { setOpen(false); setError(null); }}>Cancel</button>
      </div>
    </div>
  );
}
