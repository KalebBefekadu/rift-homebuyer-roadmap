"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import {
  BID_FINANCING, BID_FINANCING_LABEL, BID_STATUS_LABEL, EMPTY_TERMS, INSTRUCTION_LABEL, NEXT, termText, termsEffects,
  type BidResponse, type BidStep, type BidView, type Instruction, type StepKind, type Terms,
} from "@/lib/core/bid";
import { FAMILIES, FAMILY_LABEL, type Family } from "@/lib/core/document";
import { zonedToUtc } from "@/lib/core/tour";
import { useWrite } from "./useWrite";
import { send } from "../send";

export interface OfferView {
  id: string;
  address: string;
  homeWithdrawn: boolean;
  steps: BidStep[];
  responses: BidResponse[];
  view: BidView;
}

export interface DocView { id: string; family: Family; label: string; filename: string; bytes: number; by: string; at: string }

const newRequest = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
        (Number(c) ^ (Math.random() * 16) >> (Number(c) / 4)).toString(16));

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const DAY = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const WHEN = (iso: string) => new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
}).format(new Date(iso));
const SIZE = (b: number) => (b > 1_048_576 ? `${(b / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const CHIP: Partial<Record<BidView["status"], string>> = {
  instructed: "chip-pos", disagreement: "chip-neg", stopped: "chip-neg", changes: "chip-warn", awaiting: "chip-warn",
  countered: "chip-warn", submitted: "chip-warn", accepted: "chip-pos",
};
const TERM_ROWS: (keyof Terms)[] = [
  "price", "earnestMoney", "financing", "downPct", "concessions", "dueDiligenceDays",
  "financingContingency", "appraisalContingency", "closingDate",
];

/**
 * Offers and documents, from the agent's side (journey contracts B08 to B10).
 *
 * Nothing here signs or sends anything. The agent records what happened in
 * Remine and with the listing side, step by step, and asks the household how
 * to proceed on an exact version of the terms. A go ahead lets the agent
 * prepare the forms; it is not a signature, and accepted is not a contract.
 */
export function Offers({ journeyId, bids, docs, homes, deciders, coverage, leadId, person, unavailable }: {
  journeyId: string;
  bids: OfferView[];
  docs: DocView[];
  homes: { id: string; address: string }[];
  deciders: { memberId: string; name: string }[];
  coverage: { covered: boolean; note: string };
  leadId: string;
  person: string;
  unavailable?: string;
}) {
  const stamp = bids.map((b) => `${b.id}:${b.steps.length}:${b.responses.length}`).join("|") + `#${docs.length}`;
  const { busy, error, write } = useWrite(stamp);
  const [req, setReq] = useState(newRequest);
  const [starting, setStarting] = useState(false);
  const [homeId, setHomeId] = useState("");
  const [showDone, setShowDone] = useState(false);

  if (unavailable) return <p className="t-xs c-warn">{unavailable}</p>;

  const run = async (op: string, body: Record<string, unknown>) => {
    const r = await write(op, { journeyId, requestId: req, ...body });
    if (r.ok) setReq(newRequest());
    return r.ok;
  };
  /* Accepted stays in view: it is exactly when the agent still owes the
     contract record under Where it stands. */
  const open = bids.filter((b) => !b.view.final || b.view.status === "accepted");
  const done = bids.filter((b) => !open.includes(b));

  return (
    <div>
      {!coverage.covered ? (
        <div className="card p-3" style={{ background: "var(--sunk)" }}>
          <p className="t-xs c-warn" style={{ lineHeight: 1.6 }}>
            No offer can go ahead until {person}&apos;s buyer agreement is signed and in force. {coverage.note}{" "}
            <Link className="u" href={`/operations/lead/${leadId}`}>Update it on their record</Link>.
          </p>
        </div>
      ) : null}
      {error ? <p role="alert" className="t-xs c-neg" style={{ marginTop: 8, lineHeight: 1.5 }}>{error}</p> : null}

      <Documents journeyId={journeyId} docs={docs} />

      <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
        {open.length === 0 ? <p className="t-xs c-4">No offers in progress.</p> : null}
        {open.map((b) => <Offer key={b.id} b={b} journeyId={journeyId} docs={docs} deciders={deciders} busy={busy} run={run} />)}
      </div>

      <div style={{ marginTop: 10 }}>
        {starting ? (
          <div className="card p-3" style={{ background: "var(--sunk)" }}>
            <label className="field"><span className="label">Home</span>
              <select className="input" value={homeId} onChange={(e) => setHomeId(e.target.value)}>
                <option value="">Choose a home on the list</option>
                {homes.map((h) => <option key={h.id} value={h.id}>{h.address}</option>)}
              </select></label>
            <TermsForm start={EMPTY_TERMS} docs={docs} busy={busy} submitLabel="Save as version 1"
              disabled={!homeId}
              onSubmit={async (t, documentIds) => {
                const ok = await run("bid-start", { homeId, terms: t, documentIds });
                if (ok) { setStarting(false); setHomeId(""); }
              }}
              onCancel={() => setStarting(false)} />
            <p className="t-2xs c-4" style={{ marginTop: 8, lineHeight: 1.5 }}>
              This is the strategy, not the offer. The household is asked about it next; the forms are prepared in Remine only after they say go ahead.
            </p>
          </div>
        ) : homes.length ? (
          <button className="btn btn-s btn-sm" onClick={() => setStarting(true)}>Start an offer</button>
        ) : (
          <p className="t-2xs c-4">Add the home to the list first.</p>
        )}
      </div>

      {done.length ? (
        <div style={{ marginTop: 12 }}>
          <button className="btn btn-g btn-sm" onClick={() => setShowDone((v) => !v)}>{showDone ? "Hide" : "Show"} finished offers ({done.length})</button>
          {showDone ? (
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              {done.map((b) => <Offer key={b.id} b={b} journeyId={journeyId} docs={docs} deciders={deciders} busy={busy} run={run} />)}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Documents({ journeyId, docs }: { journeyId: string; docs: DocView[] }) {
  const [adding, setAdding] = useState(false);
  const [family, setFamily] = useState<Family>("offer");
  const [label, setLabel] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [show, setShow] = useState(false);

  const upload = async () => {
    if (!file) return;
    setResult(null);
    setBusy("Getting an upload link…");
    const slot = await send("doc-slot", { journeyId });
    if (!slot.ok) { setBusy(null); setResult({ ok: false, text: slot.error ?? "That did not work" }); return; }
    setBusy("Uploading…");
    try {
      const form = new FormData();
      form.append("cacheControl", "3600");
      form.append("", file);
      const put = await fetch(String(slot.url), { method: "PUT", body: form, headers: { "x-upsert": "false" } });
      if (!put.ok) throw new Error(String(put.status));
    } catch {
      setBusy(null);
      setResult({ ok: false, text: "The upload did not go through. Nothing was kept. Try again." });
      return;
    }
    setBusy("Checking the file…");
    const done = await send("doc-finish", { journeyId, path: slot.path, filename: file.name, type: file.type, family, label });
    setBusy(null);
    if (!done.ok) { setResult({ ok: false, text: done.error ?? "That did not work" }); return; }
    setResult({ ok: true, text: `Kept: ${label}.` });
    setAdding(false); setLabel(""); setFile(null);
    window.location.reload();
  };

  return (
    <div className="card p-3">
      <div className="between gap-2 wrap">
        <div className="t-sm w6">Documents ({docs.length})</div>
        <div className="row gap-2">
          {docs.length ? <button className="btn btn-g btn-sm" onClick={() => setShow((v) => !v)}>{show ? "Hide" : "Show"}</button> : null}
          <button className="btn btn-s btn-sm" onClick={() => setAdding((v) => !v)}>Add a document</button>
        </div>
      </div>
      <p className="t-2xs c-4" style={{ marginTop: 4, lineHeight: 1.5 }}>
        PDF, JPEG or PNG up to 20 MB. Each file is checked before it is kept: it must be what it says it is, and a PDF with scripts,
        launch actions, embedded files or a password is refused. That is a check, not a virus scan. Nobody reads the words inside.
      </p>
      {result ? <p role={result.ok ? "status" : "alert"} className={`t-xs ${result.ok ? "c-pos" : "c-neg"}`} style={{ marginTop: 6, lineHeight: 1.5 }}>{result.text}</p> : null}
      {adding ? (
        <div style={{ marginTop: 8 }}>
          <div className="row gap-2 wrap">
            <label className="field" style={{ flex: "1 1 150px" }}><span className="label">Kind</span>
              <select className="input" value={family} onChange={(e) => setFamily(e.target.value as Family)}>
                {FAMILIES.map((f) => <option key={f} value={f}>{FAMILY_LABEL[f]}</option>)}
              </select></label>
            <label className="field" style={{ flex: "3 1 220px" }}><span className="label">Name</span>
              <input className="input" value={label} maxLength={160} placeholder="Seller's counter, Sep 24" onChange={(e) => setLabel(e.target.value)} /></label>
          </div>
          <label className="field" style={{ marginTop: 8 }}><span className="label">File</span>
            <input className="input" type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
          <div className="row gap-2" style={{ marginTop: 8 }}>
            <button className="btn btn-p btn-sm" disabled={!!busy || !file || label.trim().length < 2} onClick={upload}>{busy ?? "Upload and check"}</button>
            <button className="btn btn-g btn-sm" onClick={() => setAdding(false)}>Back</button>
          </div>
        </div>
      ) : null}
      {show ? (
        <ul style={{ marginTop: 8, display: "grid", gap: 4 }}>
          {docs.map((d) => (
            <li key={d.id} className="t-xs between gap-2 wrap">
              <span><span className="w6">{d.label}</span> <span className="c-4">· {FAMILY_LABEL[d.family]} · {d.filename}, {SIZE(d.bytes)} · {DAY(d.at)}</span></span>
              <a className="u" href={`/api/operations/document?journeyId=${journeyId}&id=${d.id}`} target="_blank" rel="noreferrer">Open</a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

const EVIDENCE_PLACEHOLDER: Partial<Record<StepKind, string>> = {
  prepared: "Drafted on the GAR forms in Remine (optional)",
  signed: "Signed by both buyers in Remine, 3:40 PM",
  submitted: "Emailed to the listing agent at 4:05 PM",
  accepted: "Seller signed acceptance, received 6:10 PM",
  rejected: "Listing agent said they took another offer",
  expired: "No answer by the deadline, 9 PM Sep 26",
  withdrawn: "Buyers decided against it after the inspection",
};
const STEP_BUTTON: Partial<Record<StepKind, string>> = {
  prepared: "Prepared in Remine", signed: "It was signed", submitted: "It was delivered",
  accepted: "They accepted", rejected: "They rejected it", expired: "It expired", withdrawn: "Withdraw",
};

function Offer({ b, journeyId, docs, deciders, busy, run }: {
  b: OfferView;
  journeyId: string;
  docs: DocView[];
  deciders: { memberId: string; name: string }[];
  busy: boolean;
  run: (op: string, body: Record<string, unknown>) => Promise<boolean>;
}) {
  const [form, setForm] = useState<null | "terms" | "counter" | "answer" | StepKind>(null);
  const [note, setNote] = useState("");
  const [who, setWho] = useState("");
  const [instruction, setInstruction] = useState<Instruction>("proceed");
  const [how, setHow] = useState("");
  const [history, setHistory] = useState(false);
  const v = b.view;
  const seq = b.steps.length ? b.steps[b.steps.length - 1]!.seq : 0;
  const allowed = NEXT[v.status];
  const step = (kind: StepKind, extra: Record<string, unknown> = {}) =>
    run("bid-step", { bidId: b.id, kind, expectedSeq: seq, note, ...extra }).then((ok) => { if (ok) { setForm(null); setNote(""); } });
  const fx = v.terms ? termsEffects(v.terms) : null;
  const docName = new Map(docs.map((d) => [d.id, d.label]));
  const currentDocs = b.steps.filter((s) => s.kind === "terms" && s.version === v.version).flatMap((s) => s.documentIds);

  return (
    <div className="card p-3">
      <div className="between gap-2 wrap">
        <div className="row gap-2 wrap">
          <span className="t-sm w6">{b.address}</span>
          <span className={`chip t-2xs ${CHIP[v.status] ?? ""}`}>{BID_STATUS_LABEL[v.status]}</span>
        </div>
        <span className="t-2xs c-4">Version {v.version}{v.origin === "theirs" ? ", their counter" : ""}</span>
      </div>

      {v.terms ? (
        <dl className="t-xs" style={{ marginTop: 8, display: "grid", gridTemplateColumns: "max-content 1fr", gap: "2px 12px" }}>
          {TERM_ROWS.map((f) => (<Fragment key={f}><dt className="c-4">{LABEL[f]}</dt><dd>{termText(f, v.terms!)}</dd></Fragment>))}
          {v.terms.respondBy ? (<><dt className="c-4">Respond by</dt><dd>{WHEN(v.terms.respondBy)} ({v.terms.respondBySource})</dd></>) : null}
          {v.terms.other ? (<><dt className="c-4">Other</dt><dd>{v.terms.other}</dd></>) : null}
        </dl>
      ) : null}
      {fx ? (
        <p className="t-xs c-3" style={{ marginTop: 6, lineHeight: 1.5 }}>
          Loan {usd(fx.loanAmount)} · down payment {usd(fx.downPayment)} · {usd(fx.cashAtContract)} earnest money at contract ·
          about {usd(fx.cashAtClosingBeforeCosts)} more at closing before closing costs (not estimated here).
        </p>
      ) : null}
      {v.changes.length ? (
        <p className="t-2xs" style={{ marginTop: 4 }}>Changed from version {v.version - 1}: {v.changes.map((c) => `${c.label} ${c.before} to ${c.after}`).join("; ")}.</p>
      ) : null}
      {currentDocs.length ? (
        <p className="t-2xs c-3" style={{ marginTop: 4 }}>
          Documents: {currentDocs.map((id, i) => (
            <span key={id}>{i ? ", " : ""}<a className="u" href={`/api/operations/document?journeyId=${journeyId}&id=${id}`} target="_blank" rel="noreferrer">{docName.get(id) ?? "a document"}</a></span>
          ))}
        </p>
      ) : null}

      {v.asked ? (
        <div className="t-xs" style={{ marginTop: 8 }}>
          <div className="w6">The household on version {v.version}</div>
          <ul style={{ marginTop: 2, display: "grid", gap: 2 }}>
            {v.asked.required.map((m) => {
              const a = v.asked!.resolution.answers.find((x) => x.memberId === m.memberId);
              return (
                <li key={m.memberId}>
                  {m.name}: {a ? <>{INSTRUCTION_LABEL[a.instruction]}{a.note ? `. "${a.note}"` : ""}{a.toldAgent ? <span className="c-4"> (told you: {a.toldAgent})</span> : null}</> : <span className="c-4">no answer yet</span>}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      <p className={`t-xs ${v.status === "disagreement" || v.status === "stopped" ? "c-warn" : "c-4"}`} style={{ marginTop: 6, lineHeight: 1.55 }}>{v.nextStep}</p>

      {form === "terms" || form === "counter" ? (
        <div className="card p-3" style={{ marginTop: 8, background: "var(--sunk)" }}>
          <div className="t-xs w6">{form === "counter" ? "Their counter, as version" : "New terms, as version"} {v.version + 1}</div>
          <TermsForm start={v.terms ?? EMPTY_TERMS} docs={docs} busy={busy} submitLabel={`Save version ${v.version + 1}`}
            onSubmit={(t, documentIds) => step("terms", { terms: t, origin: form === "counter" ? "theirs" : "ours", documentIds, note: null })}
            onCancel={() => setForm(null)} />
        </div>
      ) : form === "answer" && v.asked ? (
        <div className="card p-3" style={{ marginTop: 8, background: "var(--sunk)" }}>
          <div className="row gap-2 wrap">
            <label className="field" style={{ flex: "1 1 140px" }}><span className="label">Whose answer</span>
              <select className="input" value={who} onChange={(e) => setWho(e.target.value)}>
                <option value="">Choose</option>
                {v.asked.required.map((m) => <option key={m.memberId} value={m.memberId}>{m.name}</option>)}
              </select></label>
            <label className="field" style={{ flex: "2 1 200px" }}><span className="label">They said</span>
              <select className="input" value={instruction} onChange={(e) => setInstruction(e.target.value as Instruction)}>
                {(Object.keys(INSTRUCTION_LABEL) as Instruction[]).map((i) => <option key={i} value={i}>{INSTRUCTION_LABEL[i]}</option>)}
              </select></label>
          </div>
          <label className="field" style={{ marginTop: 8 }}><span className="label">How they told you</span>
            <input className="input" value={how} maxLength={200} placeholder="On the phone, 2:15 PM" onChange={(e) => setHow(e.target.value)} /></label>
          <label className="field" style={{ marginTop: 8 }}><span className="label">{instruction === "proceed" ? "Note (optional)" : "What should change, or why not"}</span>
            <input className="input" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} /></label>
          <div className="row gap-2" style={{ marginTop: 8 }}>
            <button className="btn btn-p btn-sm" disabled={busy || !who || how.trim().length < 3}
              onClick={() => run("bid-answer", { bidId: b.id, memberId: who, version: v.version, instruction, note, how })
                .then((ok) => { if (ok) { setForm(null); setNote(""); setHow(""); setWho(""); } })}>
              {busy ? "Recording…" : "Record their answer"}
            </button>
            <button className="btn btn-g btn-sm" onClick={() => setForm(null)}>Back</button>
          </div>
        </div>
      ) : form ? (
        <div className="row gap-2 wrap" style={{ marginTop: 8 }}>
          <input className="input" style={{ flex: "1 1 240px" }} value={note} maxLength={500} placeholder={EVIDENCE_PLACEHOLDER[form as StepKind] ?? ""}
            aria-label="What shows it" onChange={(e) => setNote(e.target.value)} />
          <button className="btn btn-p btn-sm" disabled={busy || (form !== "prepared" && !note.trim())} onClick={() => step(form as StepKind)}>
            {busy ? "Recording…" : "Record it"}
          </button>
          <button className="btn btn-g btn-sm" onClick={() => setForm(null)}>Back</button>
        </div>
      ) : !v.final ? (
        <div className="row gap-2 wrap" style={{ marginTop: 8 }}>
          {allowed.includes("ask") ? (
            <button className="btn btn-p btn-sm" disabled={busy || !deciders.length}
              onClick={() => run("bid-step", { bidId: b.id, kind: "ask", expectedSeq: seq })}>
              Ask {deciders.map((d) => d.name.split(/\s+/)[0]).join(" and ") || "the household"} how to proceed
            </button>
          ) : null}
          {v.asked && ["awaiting", "instructed", "disagreement", "changes", "stopped"].includes(v.status) ? (
            <button className="btn btn-g btn-sm" onClick={() => setForm("answer")}>Record an answer they gave you</button>
          ) : null}
          {(["prepared", "signed", "submitted", "accepted", "rejected", "expired"] as StepKind[]).filter((k) => allowed.includes(k)).map((k) => (
            <button key={k} className="btn btn-s btn-sm" disabled={busy} onClick={() => { setNote(""); setForm(k); }}>{STEP_BUTTON[k]}</button>
          ))}
          {allowed.includes("terms") && v.status === "submitted" ? <button className="btn btn-s btn-sm" onClick={() => setForm("counter")}>Record their counter</button> : null}
          {allowed.includes("terms") ? <button className="btn btn-g btn-sm" onClick={() => setForm("terms")}>{v.status === "countered" ? "Counter back" : "Change the terms"}</button> : null}
          {allowed.includes("withdrawn") ? <button className="btn btn-g btn-sm" onClick={() => { setNote(""); setForm("withdrawn"); }}>Withdraw</button> : null}
          {!deciders.length && allowed.includes("ask") ? <span className="t-2xs c-4">Add the buyer under Household to ask them.</span> : null}
        </div>
      ) : null}

      <button className="btn btn-g btn-sm" style={{ marginTop: 6 }} onClick={() => setHistory((x) => !x)}>{history ? "Hide history" : `History (${b.steps.length + b.responses.length})`}</button>
      {history ? (
        <ul className="t-2xs c-3" style={{ marginTop: 4, display: "grid", gap: 3 }}>
          {[...b.steps.map((s) => ({ at: s.at, text: `${s.kind === "terms" ? `Version ${s.version} (${s.origin === "theirs" ? "their counter" : "ours"})` : s.kind === "ask" ? `Asked ${s.required.map((r) => r.name).join(" and ")} about version ${s.version}` : BID_STATUS_LABEL[s.kind as BidView["status"]]}${s.note ? `: ${s.note}` : ""} · ${s.by}` })),
            ...b.responses.map((r) => ({ at: r.at, text: `${r.name} on version ${r.version}: ${INSTRUCTION_LABEL[r.instruction]}${r.note ? `. "${r.note}"` : ""}${r.toldAgent ? ` (told the agent: ${r.toldAgent})` : ""}` }))]
            .sort((x, y) => y.at.localeCompare(x.at))
            .map((e, i) => <li key={i}>{DAY(e.at)} · {e.text}</li>)}
        </ul>
      ) : null}
    </div>
  );
}

const LABEL: Record<keyof Terms, string> = {
  price: "Price", earnestMoney: "Earnest money", financing: "Paying by", downPct: "Down payment", concessions: "Seller concessions",
  dueDiligenceDays: "Due diligence", financingContingency: "Financing contingency", appraisalContingency: "Appraisal contingency",
  closingDate: "Closing date", respondBy: "Respond by", respondBySource: "Deadline source", other: "Other",
};

/** The terms, entered by hand from the conversation or the counter in front of the agent (REQ-DOC-02: manual entry first). */
function TermsForm({ start, docs, busy, submitLabel, onSubmit, onCancel, disabled }: {
  start: Terms;
  docs: DocView[];
  busy: boolean;
  submitLabel: string;
  onSubmit: (t: Terms, documentIds: string[]) => void | Promise<void>;
  onCancel: () => void;
  disabled?: boolean;
}) {
  const [t, setT] = useState<Terms>(start);
  const [respondDay, setRespondDay] = useState("");
  const [respondTime, setRespondTime] = useState("");
  const [attached, setAttached] = useState<string[]>([]);
  const [local, setLocal] = useState<string | null>(null);
  const set = <K extends keyof Terms>(k: K, val: Terms[K]) => setT((x) => ({ ...x, [k]: val }));
  const num = (s: string) => (s.trim() === "" ? NaN : Number(s.replace(/[$,\s]/g, "")));
  const cash = t.financing === "cash";

  const submit = () => {
    let respondBy: string | null = t.respondBy;
    if (respondDay || respondTime) {
      respondBy = zonedToUtc(respondDay, respondTime);
      if (!respondBy) { setLocal("Give the response deadline's date and time"); return; }
    }
    setLocal(null);
    void onSubmit({ ...t, respondBy, downPct: cash ? null : t.downPct, financingContingency: cash ? false : t.financingContingency }, attached);
  };

  return (
    <div style={{ marginTop: 8 }}>
      <div className="row gap-2 wrap">
        <Money label="Price" value={t.price} onChange={(n) => set("price", n)} parse={num} />
        <Money label="Earnest money" value={t.earnestMoney} onChange={(n) => set("earnestMoney", n)} parse={num} />
        <label className="field" style={{ flex: "1 1 150px" }}><span className="label">Paying by</span>
          <select className="input" value={t.financing} onChange={(e) => set("financing", e.target.value as Terms["financing"])}>
            {BID_FINANCING.map((f) => <option key={f} value={f}>{BID_FINANCING_LABEL[f]}</option>)}
          </select></label>
        {!cash ? (
          <label className="field" style={{ flex: "0 1 110px" }}><span className="label">Down, %</span>
            <input className="input" inputMode="decimal" value={Number.isNaN(t.downPct ?? NaN) ? "" : String(t.downPct ?? "")}
              onChange={(e) => set("downPct", num(e.target.value))} /></label>
        ) : null}
      </div>
      <div className="row gap-2 wrap" style={{ marginTop: 8 }}>
        <Money label="Seller concessions" value={t.concessions} onChange={(n) => set("concessions", n)} parse={(x) => (x.trim() === "" ? 0 : num(x))} />
        <label className="field" style={{ flex: "0 1 150px" }}><span className="label">Due diligence, days</span>
          <input className="input" inputMode="numeric" value={t.dueDiligenceDays === null ? "" : String(t.dueDiligenceDays)} placeholder="None"
            onChange={(e) => set("dueDiligenceDays", e.target.value.trim() === "" ? null : num(e.target.value))} /></label>
        <label className="field" style={{ flex: "0 1 160px" }}><span className="label">Closing date</span>
          <input className="input" type="date" value={t.closingDate ?? ""} onChange={(e) => set("closingDate", e.target.value || null)} /></label>
      </div>
      <div className="row gap-3 wrap t-xs" style={{ marginTop: 8 }}>
        <label className="row gap-1"><input type="checkbox" disabled={cash} checked={!cash && t.financingContingency} onChange={(e) => set("financingContingency", e.target.checked)} /> Financing contingency</label>
        <label className="row gap-1"><input type="checkbox" checked={t.appraisalContingency} onChange={(e) => set("appraisalContingency", e.target.checked)} /> Appraisal contingency</label>
      </div>
      <div className="row gap-2 wrap" style={{ marginTop: 8 }}>
        <label className="field" style={{ flex: "0 1 160px" }}><span className="label">Respond by (date)</span>
          <input className="input" type="date" value={respondDay} onChange={(e) => setRespondDay(e.target.value)} /></label>
        <label className="field" style={{ flex: "0 1 140px" }}><span className="label">Time (Georgia)</span>
          <input className="input" type="time" value={respondTime} onChange={(e) => setRespondTime(e.target.value)} /></label>
        <label className="field" style={{ flex: "2 1 200px" }}><span className="label">Where the deadline comes from</span>
          <input className="input" value={t.respondBySource ?? ""} maxLength={200} placeholder="Offer, paragraph 12"
            onChange={(e) => set("respondBySource", e.target.value || null)} /></label>
      </div>
      <label className="field" style={{ marginTop: 8 }}><span className="label">Other terms (optional)</span>
        <input className="input" value={t.other ?? ""} maxLength={1000} placeholder="Seller to leave the refrigerator; possession at closing"
          onChange={(e) => set("other", e.target.value || null)} /></label>
      {docs.length ? (
        <fieldset style={{ marginTop: 8, border: 0, padding: 0 }}>
          <legend className="label">Attach documents (the household can open these once asked)</legend>
          <div className="row gap-3 wrap t-xs">
            {docs.map((d) => (
              <label key={d.id} className="row gap-1">
                <input type="checkbox" checked={attached.includes(d.id)} onChange={(e) => setAttached((a) => e.target.checked ? [...a, d.id] : a.filter((x) => x !== d.id))} />
                {d.label}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      {local ? <p role="alert" className="t-xs c-neg" style={{ marginTop: 6 }}>{local}</p> : null}
      <div className="row gap-2" style={{ marginTop: 10 }}>
        <button className="btn btn-p btn-sm" disabled={busy || disabled} onClick={submit}>{busy ? "Saving…" : submitLabel}</button>
        <button className="btn btn-g btn-sm" onClick={onCancel}>Back</button>
      </div>
    </div>
  );
}

function Money({ label, value, onChange, parse }: { label: string; value: number; onChange: (n: number) => void; parse: (s: string) => number }) {
  const [text, setText] = useState(value ? String(value) : "");
  return (
    <label className="field" style={{ flex: "1 1 130px" }}><span className="label">{label}</span>
      <input className="input" inputMode="numeric" value={text} placeholder="$"
        onChange={(e) => { setText(e.target.value); onChange(parse(e.target.value)); }} /></label>
  );
}
