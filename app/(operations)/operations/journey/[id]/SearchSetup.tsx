"use client";

import { useState } from "react";
import { Ico } from "@/components/rift/icons";
import {
  buildPackage, packageChanges, packageText, CADENCE_LABEL, STATUS_LABEL,
  type Cadence, type SearchBrief, type SearchPackage, type SearchStatus,
} from "@/lib/core/search";
import { useWrite } from "./useWrite";

const DAY = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export interface PackageView {
  id: string;
  revision: number;
  cadence: Cadence;
  pkg: SearchPackage;
  status: string;
  approvedAt: string;
  approvedBy: string;
  externalRef: string | null;
  externalUrl: string | null;
  confirmedAt: string | null;
  confirmNote: string | null;
  endedAt: string | null;
}

const newRequest = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
        (Number(c) ^ (Math.random() * 16) >> (Number(c) / 4)).toString(16));

/**
 * From an approved brief to a search in Matrix.
 *
 * Rift cannot write to Matrix for this account (decision D02: permissions not
 * established), so this is the manual path the blueprint calls production
 * functionality, not a placeholder: approve one exact revision, copy what to
 * set, set it in Matrix, then record where it lives. "Active" appears only
 * after that record, and it always says the confirmation was his (AT11).
 *
 * The request ids are minted once per attempt and reused on a retry, so a
 * double click or a slow network records one approval and one setup (AT13).
 */
export function SearchSetup({ journeyId, person, status, latest, disagreement, active, pending, history }: {
  journeyId: string;
  person: string;
  status: SearchStatus;
  latest: { id: string; revision: number; brief: SearchBrief } | null;
  disagreement: string[];
  active: PackageView | null;
  pending: PackageView | null;
  history: PackageView[];
}) {
  const [cadence, setCadence] = useState<Cadence>("daily");
  const [approveReq, setApproveReq] = useState(newRequest);
  const [confirmReq, setConfirmReq] = useState(newRequest);
  const [ref, setRef] = useState("");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const { busy, error, setError, write } = useWrite(
    `${status}|${latest?.id}|${pending?.id}|${pending?.status}|${active?.id}|${active?.status}`,
  );

  const run = async (op: string, body: Record<string, unknown>, after?: () => void) => {
    const r = await write(op, { journeyId, ...body });
    if (r.ok) after?.();
  };

  const built = latest ? buildPackage(latest.brief, latest.revision, cadence, disagreement) : null;
  const canApprove = latest && (status === "awaiting-approval" || status === "update-pending" || status === "manual-action-needed")
    && (!pending || pending.revision !== latest.revision);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("Could not copy. Select the text and copy it by hand.");
    }
  };

  return (
    <div>
      <div className="row gap-2 wrap">
        <span className={`chip t-2xs ${status === "active-confirmed" ? "chip-pos" : status === "manual-action-needed" || status === "update-pending" ? "chip-warn" : ""}`}>
          {status === "active-confirmed" ? <Ico.check size={10} /> : null}{STATUS_LABEL[status]}
        </span>
        {active?.confirmedAt ? (
          <span className="t-2xs c-4">
            Revision {active.revision}, recorded by you on {DAY(active.confirmedAt)}. Rift cannot see Matrix, so this is your record, not a live check.
          </span>
        ) : null}
      </div>

      {error ? <p role="alert" className="t-xs c-neg" style={{ marginTop: 10 }}>{error}</p> : null}

      {pending ? (
        <div className="card p-3" style={{ marginTop: 12, borderColor: "var(--warn-line, var(--line-2))" }}>
          <div className="t-sm w6">Set up revision {pending.revision} in Matrix</div>
          <p className="t-2xs c-4" style={{ marginTop: 2 }}>
            Approved by {pending.approvedBy} on {DAY(pending.approvedAt)}. {CADENCE_LABEL[pending.cadence]}.
          </p>

          {active ? (() => {
            const ch = packageChanges(active.pkg, pending.pkg);
            return ch.add.length || ch.remove.length ? (
              <div style={{ marginTop: 10 }}>
                <div className="t-xs w6">Change in the existing Matrix search{active.externalRef ? ` (${active.externalRef})` : ""}</div>
                <ul className="t-xs c-2" style={{ marginTop: 4, display: "grid", gap: 2 }}>
                  {ch.remove.map((t) => <li key={`r${t}`}>Remove: {t}</li>)}
                  {ch.add.map((t) => <li key={`a${t}`}>Set: {t}</li>)}
                </ul>
              </div>
            ) : (
              <p className="t-xs c-3" style={{ marginTop: 10 }}>The filters are the same as the running search. Only preferences or checks changed.</p>
            );
          })() : null}

          <pre className="t-xs c-2" style={{ whiteSpace: "pre-wrap", marginTop: 10, padding: 10, background: "var(--sunk)", borderRadius: 8, fontFamily: "inherit", lineHeight: 1.6 }}>
            {packageText(pending.pkg, person)}
          </pre>
          <button className="btn btn-s btn-sm" style={{ marginTop: 6 }} onClick={() => copy(packageText(pending.pkg, person))}>
            {copied ? "Copied" : "Copy criteria"}
          </button>

          <div style={{ marginTop: 14 }}>
            <div className="t-xs w6">Once it is set up in Matrix</div>
            <div className="row gap-2 wrap" style={{ marginTop: 6 }}>
              <label className="field" style={{ flex: "1 1 180px" }}>
                <span className="label">Saved search name in Matrix</span>
                <input className="input" value={ref} maxLength={200} placeholder={`${person.split(/\s+/)[0]} 3bd Gwinnett`} onChange={(e) => setRef(e.target.value)} />
              </label>
              <label className="field" style={{ flex: "2 1 220px" }}>
                <span className="label">Or its link</span>
                <input className="input" value={url} maxLength={500} placeholder="https://" onChange={(e) => setUrl(e.target.value)} />
              </label>
            </div>
            <label className="field" style={{ marginTop: 6 }}>
              <span className="label">Anything you set differently (optional)</span>
              <input className="input" value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} />
            </label>
            <button className="btn btn-p btn-sm" style={{ marginTop: 10 }} disabled={busy || (!ref.trim() && !url.trim())}
              onClick={() => run("confirm-setup", { packageId: pending.id, ref, url, note, requestId: confirmReq },
                () => { setConfirmReq(newRequest()); setRef(""); setUrl(""); setNote(""); })}>
              {busy ? "Recording…" : "I set this up in Matrix"}
            </button>
          </div>
        </div>
      ) : null}

      {canApprove ? (
        <div className="card p-3" style={{ marginTop: 12 }}>
          <div className="t-sm w6">Review revision {latest!.revision} as a Matrix search</div>
          {built && !built.ok ? (
            <>
              <p className="t-xs c-3" style={{ marginTop: 4 }}>Not ready to approve:</p>
              <ul className="t-xs c-3" style={{ marginTop: 4, display: "grid", gap: 3, lineHeight: 1.5 }}>
                {built.blockers.map((b) => <li key={b}>{b}</li>)}
              </ul>
            </>
          ) : built && built.ok ? (
            <>
              <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                <PackageLines title="Filters" lines={built.pkg.filters} />
                <PackageLines title="Checked by hand on each listing" lines={built.pkg.manualChecks} />
                <PackageLines title="Preferences (not filters)" lines={built.pkg.preferences} />
              </div>
              <div className="row gap-2 wrap" style={{ marginTop: 10, alignItems: "flex-end" }}>
                <label className="field" style={{ flex: "0 1 240px" }}>
                  <span className="label">Matrix sends listings</span>
                  <select className="input" value={cadence} onChange={(e) => setCadence(e.target.value as Cadence)}>
                    {(Object.keys(CADENCE_LABEL) as Cadence[]).map((c) => <option key={c} value={c}>{CADENCE_LABEL[c]}</option>)}
                  </select>
                </label>
                <button className="btn btn-p btn-sm" disabled={busy}
                  onClick={() => run("approve", { revisionId: latest!.id, cadence, requestId: approveReq }, () => setApproveReq(newRequest()))}>
                  {busy ? "Approving…" : pending ? "Approve this instead" : "Approve as Matrix search"}
                </button>
              </div>
              <p className="t-2xs c-4" style={{ marginTop: 6, lineHeight: 1.5 }}>
                Approving fixes exactly this revision. If the brief changes before you set it up, Rift refuses the setup and asks you to review the new one.
              </p>
            </>
          ) : null}
        </div>
      ) : !latest ? (
        <p className="t-xs c-4" style={{ marginTop: 10 }}>Write the brief first. Approval works on a saved revision.</p>
      ) : null}

      {active ? (
        <div className="row gap-2 wrap" style={{ marginTop: 12 }}>
          <span className="t-xs c-3">
            In Matrix: {active.externalRef ?? ""}{active.externalUrl ? <> <a className="u" href={active.externalUrl} target="_blank" rel="noreferrer noopener">open</a></> : null}
            {active.confirmNote ? `. ${active.confirmNote}` : ""}
          </span>
          <button className="btn btn-g btn-sm" disabled={busy}
            onClick={() => run("pause", { packageId: active.id, paused: active.status !== "paused" })}>
            {active.status === "paused" ? "Record it running again" : "Record it paused in Matrix"}
          </button>
        </div>
      ) : null}

      {history.length ? (
        <div style={{ marginTop: 12 }}>
          <button className="t-2xs c-3 u" style={{ background: "none", border: 0, padding: 0, cursor: "pointer" }}
            onClick={() => setShowHistory(!showHistory)}>
            {showHistory ? "Hide" : "Show"} earlier approvals ({history.length})
          </button>
          {showHistory ? (
            <ul className="t-2xs c-4" style={{ marginTop: 6, display: "grid", gap: 3 }}>
              {history.map((h) => (
                <li key={h.id}>
                  Revision {h.revision}, approved {DAY(h.approvedAt)}: {h.status}{h.endedAt ? ` ${DAY(h.endedAt)}` : ""}
                  {h.externalRef ? `, "${h.externalRef}"` : ""}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function PackageLines({ title, lines }: { title: string; lines: SearchPackage["filters"] }) {
  if (!lines.length) return null;
  return (
    <div>
      <div className="t-xs w6">{title}</div>
      <ul className="t-xs c-2" style={{ marginTop: 3, display: "grid", gap: 3 }}>
        {lines.map((l) => (
          <li key={l.criterionId}>
            {l.text}
            {l.enforcement === "approximate" ? <span className="chip chip-warn t-2xs" style={{ marginLeft: 6 }}>approximate</span> : null}
            {l.caveat ? <div className="t-2xs c-4">{l.caveat}</div> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
