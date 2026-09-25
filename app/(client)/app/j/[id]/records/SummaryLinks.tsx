"use client";

import { useState } from "react";
import { Ico } from "@/components/rift/icons";
import { EXPIRY_DAYS, PART_LABEL, type SummaryLinkView, type SummaryPart } from "@/lib/core/summary-link";
import { post } from "../../../post";

const DAY = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const STATE: Record<SummaryLinkView["state"], string> = { live: "Open", expired: "Expired", revoked: "Stopped" };

/**
 * Share a read-only summary with somebody outside the household (ACCESS-02):
 * a parent, a lender, a friend helping. The member picks the parts, who it is
 * for and how long it lasts. The link is shown once; after that only its
 * label and state are, and it can be stopped at any time.
 */
export function SummaryLinks({ journeyId, allowed, links }: { journeyId: string; allowed: SummaryPart[]; links: SummaryLinkView[] }) {
  const [parts, setParts] = useState<SummaryPart[]>(["stage"]);
  const [label, setLabel] = useState("");
  const [days, setDays] = useState<number>(30);
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const create = async () => {
    setBusy(true); setError(null);
    const r = await post({ action: "summary-create", journeyId, parts, label, days });
    setBusy(false);
    if (!r.ok) { setError(r.error ?? "That did not work"); return; }
    setMade(String(r.url));
  };
  const revoke = async (linkId: string) => {
    const r = await post({ action: "summary-revoke", journeyId, linkId });
    if (!r.ok) { setError(r.error ?? "That did not work"); return; }
    window.location.reload();
  };

  return (
    <section className="card p-4 no-print" style={{ marginTop: 14 }} aria-labelledby="share-h">
      <h2 id="share-h" className="t-md w6">Share a summary</h2>
      <p className="t-sm c-3" style={{ marginTop: 4, lineHeight: 1.55 }}>
        A read-only link for someone outside your household. They see only the parts you choose, never any money, and nothing they can change.
      </p>

      {made ? (
        <div className="card p-3" style={{ marginTop: 10, background: "var(--sunk)" }} role="status">
          <div className="t-sm w6">Your link. Copy it now: it is not shown again.</div>
          <div className="row gap-2 wrap" style={{ marginTop: 6 }}>
            <input className="input" readOnly value={made} style={{ flex: "1 1 240px" }} aria-label="Summary link" onFocus={(e) => e.target.select()} />
            <button className="btn btn-p btn-sm" style={{ minHeight: 44 }} onClick={async () => { try { await navigator.clipboard.writeText(made); setCopied(true); } catch { /* select and copy by hand */ } }}>
              <Ico.share size={13} />{copied ? "Copied" : "Copy"}
            </button>
          </div>
          <button className="btn btn-g btn-sm" style={{ marginTop: 8 }} onClick={() => window.location.reload()}>Done</button>
        </div>
      ) : (
        <div style={{ marginTop: 10 }}>
          <fieldset>
            <legend className="label">What they see</legend>
            <div className="col gap-2" style={{ marginTop: 4 }}>
              {allowed.map((p) => (
                <label key={p} className="opt" data-on={parts.includes(p)}>
                  <input type="checkbox" checked={parts.includes(p)} onChange={() => setParts((x) => (x.includes(p) ? x.filter((y) => y !== p) : [...x, p]))} />
                  <span className="t-sm">{PART_LABEL[p]}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="row gap-2 wrap" style={{ marginTop: 10 }}>
            <label className="field" style={{ flex: "2 1 200px" }}><span className="label">Who it is for</span>
              <input className="input" value={label} maxLength={80} placeholder="Mum and Dad" onChange={(e) => setLabel(e.target.value)} /></label>
            <label className="field" style={{ flex: "1 1 120px" }}><span className="label">Lasts</span>
              <select className="input" value={days} onChange={(e) => setDays(Number(e.target.value))}>
                {EXPIRY_DAYS.map((d) => <option key={d} value={d}>{d} days</option>)}
              </select></label>
          </div>
          {error ? <p role="alert" className="t-xs c-neg" style={{ marginTop: 8 }}>{error}</p> : null}
          <button className="btn btn-p" style={{ marginTop: 10 }} disabled={busy || !parts.length || !label.trim()} onClick={create}>
            {busy ? "Making the link…" : "Make a link"}
          </button>
        </div>
      )}

      {links.length ? (
        <ul style={{ marginTop: 14, display: "grid", gap: 6 }}>
          {links.map((l) => (
            <li key={l.id} className="between gap-2 wrap t-sm">
              <span>
                <span className="w6">{l.label}</span>{" "}
                <span className="c-4">· {l.parts.map((p) => PART_LABEL[p].toLowerCase()).join(", ")} · {l.state === "live" ? `until ${DAY(l.expiresAt)}` : STATE[l.state]}</span>
              </span>
              {l.state === "live" ? <button className="btn btn-g btn-sm" onClick={() => revoke(l.id)}>Stop this link</button> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
