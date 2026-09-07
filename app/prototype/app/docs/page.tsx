"use client";

import { useState } from "react";
import { Ico } from "@/components/rift/icons";

const DOCS = [
  { n: "Your readiness package", m: "PDF · 6 pages", d: "2 Sep", who: "Rift", state: "Reviewed" },
  { n: "Lender question sheet", m: "PDF · 1 page", d: "2 Sep", who: "Rift", state: "Reviewed" },
  { n: "Meeting recap — 2 September", m: "PDF · 2 pages", d: "2 Sep", who: "Kaleb", state: "Reviewed" },
  { n: "Buyer agency agreement", m: "Awaiting Kaleb", d: "—", who: "Kaleb", state: "Waiting" },
  { n: "Pay stubs — August", m: "Requested from you", d: "Due 1 Oct", who: "You", state: "Needed" },
  { n: "Bank statements — Jul, Aug", m: "Requested from you", d: "Due 1 Oct", who: "You", state: "Needed" },
];

const CHIP: Record<string, string> = { Reviewed: "chip-pos", Waiting: "chip-warn", Needed: "chip-neg" };

export default function Docs() {
  const [drag, setDrag] = useState(false);
  return (
    <>
      <div className="between wrap gap-3" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="serif d3">Documents</h1>
          <p className="t-sm c-4" style={{ marginTop: 3 }}>Everything in one place, originals kept exactly as they came.</p>
        </div>
        <button className="btn btn-p"><Ico.plus size={15} />Upload</button>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); }}
        style={{
          border: `1.5px dashed ${drag ? "var(--ink)" : "var(--line)"}`, borderRadius: 12,
          padding: "28px 20px", textAlign: "center", marginBottom: 18,
          background: drag ? "var(--sunk)" : "transparent", transition: "all .14s",
        }}
      >
        <Ico.doc size={20} className="c-4" />
        <div className="t-md w55" style={{ marginTop: 8 }}>Drop files here</div>
        <div className="t-xs c-4" style={{ marginTop: 3 }}>PDF, images, or photos of paperwork</div>
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
        {DOCS.map((d) => (
          <div key={d.n} className="between link-row" style={{ padding: "13px 16px", borderBottom: "1px solid var(--line-3)", gap: 12, cursor: "pointer" }}>
            <div className="row gap-3 grow" style={{ minWidth: 0 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 7, flex: "none", display: "grid", placeItems: "center",
                background: d.state === "Needed" ? "var(--neg-wash)" : "var(--sunk)",
                color: d.state === "Needed" ? "var(--neg)" : "var(--ink-3)",
              }}><Ico.doc size={15} /></div>
              <div style={{ minWidth: 0 }}>
                <div className="t-md w55 trunc">{d.n}</div>
                <div className="t-xs c-4">{d.m}</div>
              </div>
            </div>
            <span className="t-xs c-4 hide-sm">{d.who}</span>
            <span className="t-xs c-4 num hide-sm">{d.d}</span>
            <span className={`chip ${CHIP[d.state]}`}>{d.state}</span>
            {d.state === "Needed"
              ? <button className="btn btn-s btn-sm">Upload</button>
              : <Ico.chevR size={14} className="c-4" />}
          </div>
        ))}
      </div>
    </>
  );
}
