"use client";

import { useState } from "react";
import Link from "next/link";
import { Ico } from "./icons";
import { useFunnel } from "@/lib/prototype/funnelStore";
import { resetFunnel, isCustomised } from "@/lib/prototype/funnelStore";
import { canRemove, move, newCustom, type Question, type FieldType } from "@/lib/prototype/funnel";
import { readEvents, funnelReport, diagnose, type FunnelReport } from "@/lib/prototype/telemetry";
import { useEffect } from "react";

const TYPE_LABEL: Record<FieldType, string> = {
  choice: "Multiple choice", slider: "Slider", select: "Dropdown", text: "Short text", boolean: "Yes / no",
};

export function FunnelEditor() {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const { funnel, save } = useFunnel(side);
  const [open, setOpen] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [log, setLog] = useState(false);

  /* Measurement sits beside the thing it indicts. Seeing "41% stop here" on the
     row you are about to rewrite is worth more than the same number on a
     dashboard nobody opens on the day they edit a question. */
  const [rep, setRep] = useState<FunnelReport | null>(null);
  useEffect(() => { setRep(funnelReport(readEvents(), side)); }, [side, dirty]);
  const stat = (id: string) => rep?.steps.find((x) => x.qid === id);

  const patch = (id: string, p: Partial<Question>, what?: string) => {
    save({ ...funnel, questions: funnel.questions.map((q) => (q.id === id ? { ...q, ...p } : q)) }, what ?? `Edited "${id}"`);
    setDirty(true);
  };
  const reorder = (id: string, d: -1 | 1) => { save({ ...funnel, questions: move(funnel.questions, id, d) }, `Moved "${id}" ${d < 0 ? "up" : "down"}`); setDirty(true); };
  const remove = (id: string) => { save({ ...funnel, questions: funnel.questions.filter((q) => q.id !== id) }, `Removed "${id}"`); setDirty(true); };
  const add = () => {
    const q = newCustom();
    save({ ...funnel, questions: [...funnel.questions, q] }, "Added a question");
    setOpen(q.id); setDirty(true);
  };

  const live = funnel.questions.filter((q) => q.enabled).length;

  return (
    <>
      <div className="between wrap gap-3" style={{ marginBottom: 16 }}>
        <div className="row gap-1">
          {(["buy", "sell"] as const).map((s) => (
            <button key={s} onClick={() => setSide(s)} className="btn btn-sm" style={{
              background: side === s ? "var(--ink)" : "var(--paper)",
              color: side === s ? "#fff" : "var(--ink-2)",
              border: `1px solid ${side === s ? "var(--ink)" : "var(--line)"}`,
            }}>{s === "buy" ? "Buyer funnel" : "Seller funnel"}</button>
          ))}
        </div>
        <div className="row gap-1">
          {isCustomised(side) ? (
            <button className="btn btn-g btn-sm" onClick={() => { resetFunnel(side); setDirty(false); }}>
              <Ico.refresh size={13} />Reset to default
            </button>
          ) : null}
          <Link href={`/prototype/${side}/start`} target="_blank" className="btn btn-s btn-sm">
            <Ico.arrowUpR size={13} />See it live
          </Link>
        </div>
      </div>

      {/* Versioning. A lead stores the version it answered, so edits never
          retroactively rewrite what somebody was actually asked. */}
      <div className="card" style={{ marginBottom: 16, overflow: "hidden" }}>
        <div className="between wrap gap-2" style={{ padding: "11px 14px" }}>
          <div className="row gap-2 wrap">
            <span className="chip chip-acc mono">v{funnel.version}</span>
            <span className="t-sm c-3">Last changed {funnel.updatedAt}</span>
          </div>
          <button className="btn btn-g btn-sm" onClick={() => setLog(!log)}>
            <Ico.layers size={13} />{log ? "Hide history" : `History (${funnel.changes?.length ?? 0})`}
          </button>
        </div>
        {log ? (
          <div style={{ borderTop: "1px solid var(--line-2)", background: "var(--sunk)", padding: "10px 14px" }}>
            {(funnel.changes ?? []).map((c, i) => (
              <div key={i} className="row gap-3" style={{ padding: "5px 0" }}>
                <span className="t-xs c-4 mono" style={{ minWidth: 78 }}>{c.at}</span>
                <span className="t-xs c-2">{c.what}</span>
                <span className="t-xs c-4 mono" style={{ marginLeft: "auto" }}>v{(funnel.version ?? 1) - i}</span>
              </div>
            ))}
            <p className="t-xs c-4" style={{ marginTop: 8, lineHeight: 1.55 }}>
              Anyone who answered an older version keeps the readout they were given. Their record
              shows which version they saw.
            </p>
          </div>
        ) : null}
      </div>

      {/* Measurement */}
      <div className="card p-4" style={{ marginBottom: 16 }}>
        <div className="between wrap gap-2">
          <div className="row gap-2">
            <Ico.chart size={15} className="c-3" />
            <span className="t-sm w6">Where people actually stop</span>
          </div>
          {rep?.thin ? <span className="chip chip-warn">Too little traffic to trust</span> : null}
        </div>
        <div className="row gap-4 wrap" style={{ marginTop: 12 }}>
          {[
            ["Starts", rep?.starts ?? 0],
            ["Reached the readout", rep?.readouts ?? 0],
            ["Left an email", rep?.emails ?? 0],
            ["Booked", rep?.bookings ?? 0],
          ].map(([l, v]) => (
            <div key={l as string} style={{ paddingRight: 20, borderRight: "1px solid var(--line-2)" }}>
              <div className="t-2xs c-4 w6" style={{ letterSpacing: ".07em", textTransform: "uppercase" }}>{l}</div>
              <div className="num" style={{ fontSize: 20, marginTop: 3 }}>{v as number}</div>
            </div>
          ))}
        </div>
        <p className="t-xs c-4" style={{ marginTop: 12, lineHeight: 1.6, maxWidth: 700 }}>
          {rep?.thin
            ? `Only ${rep?.starts ?? 0} starts recorded on this device. Nothing below is worth acting on until there are twenty — a drop-off computed from four people is noise wearing a percentage sign.`
            : rep?.worst
            ? `The question losing most people is "${rep.worst.qid}", at ${rep.worst.dropPct}%.`
            : "Numbers appear per question below as traffic arrives."}
        </p>
      </div>

      <div className="card p-4" style={{ marginBottom: 16, background: "var(--sunk)" }}>
        <div className="row gap-2">
          <Ico.shield size={15} className="c-3" />
          <span className="t-sm w6">Two kinds of question, and only one of them is safe to invent</span>
        </div>
        <p className="t-sm c-3" style={{ marginTop: 8, lineHeight: 1.6, maxWidth: 720 }}>
          <b>Bound</b> questions feed the calculations — cash to close, your gap, the assistance
          match. You can reword them, reorder them and rewrite the answer labels. You cannot delete
          a required one, because that would leave the maths guessing instead of stopping.
          <b> Your own</b> questions are captured onto the lead and shown to you here, and never
          touch a number, so nothing you add can make a figure wrong.
        </p>
        <div className="row gap-3 wrap" style={{ marginTop: 12 }}>
          <span className="chip"><Ico.bolt size={12} />{live} questions live</span>
          <span className="chip">{funnel.questions.filter((q) => q.kind === "custom").length} of your own</span>
          {dirty ? <span className="chip chip-pos"><Ico.check size={12} />Saved — live now</span> : null}
        </div>
      </div>

      <div className="col gap-2">
        {funnel.questions.map((q, i) => (
          <div key={q.id} className="card" style={{ overflow: "hidden", opacity: q.enabled ? 1 : 0.55 }}>
            <div className="row gap-3" style={{ padding: "12px 14px", alignItems: "flex-start" }}>
              <div className="col" style={{ gap: 2, flex: "none" }}>
                <button className="btn btn-ico btn-sm" disabled={i === 0} onClick={() => reorder(q.id, -1)} aria-label="Move up">
                  <Ico.chevD size={13} style={{ transform: "rotate(180deg)" }} />
                </button>
                <button className="btn btn-ico btn-sm" disabled={i === funnel.questions.length - 1} onClick={() => reorder(q.id, 1)} aria-label="Move down">
                  <Ico.chevD size={13} />
                </button>
              </div>

              <div className="grow" style={{ minWidth: 0 }}>
                <div className="row gap-2 wrap">
                  <span className="num t-xs c-4">{String(i + 1).padStart(2, "0")}</span>
                  <span className="t-md w55">{q.title || <span className="c-4">Untitled question</span>}</span>
                </div>
                <div className="row gap-1 wrap" style={{ marginTop: 6 }}>
                  <span className={`chip ${q.kind === "core" ? "chip-acc" : "chip-pos"}`}>
                    {q.kind === "core" ? `Bound → ${q.bound}` : "Your own"}
                  </span>
                  <span className="chip">{TYPE_LABEL[q.type]}</span>
                  {q.required ? <span className="chip">Required</span> : null}
                  {!q.enabled ? <span className="chip chip-warn">Hidden</span> : null}
                  {(() => {
                    const st = stat(q.id);
                    const d = st ? diagnose(st) : null;
                    if (!st || !st.reached) return null;
                    return (
                      <>
                        <span className="chip mono">{st.dropPct}% stop · {st.medianSec}s</span>
                        {d ? <span className={`chip ${d.tone}`} title={d.advice}>{d.label}</span> : null}
                      </>
                    );
                  })()}
                </div>
                {(() => {
                  const st = stat(q.id);
                  const d = st ? diagnose(st) : null;
                  return d && d.label !== "Healthy" ? (
                    <p className="t-xs c-3" style={{ marginTop: 6, lineHeight: 1.5 }}>{d.advice}</p>
                  ) : null;
                })()}
              </div>

              <div className="row gap-1" style={{ flex: "none" }}>
                <button className="btn btn-g btn-sm" disabled={q.required}
                  onClick={() => patch(q.id, { enabled: !q.enabled })}>
                  {q.enabled ? "Hide" : "Show"}
                </button>
                <button className="btn btn-s btn-sm" onClick={() => setOpen(open === q.id ? null : q.id)}>
                  {open === q.id ? "Done" : "Edit"}
                </button>
              </div>
            </div>

            {open === q.id ? (
              <div style={{ padding: "16px 14px", borderTop: "1px solid var(--line-2)", background: "var(--sunk)" }}>
                <div className="g2 gap-3">
                  <label className="field">
                    <span className="label">Question</span>
                    <input className="input" value={q.title} onChange={(e) => patch(q.id, { title: e.target.value })} />
                  </label>
                  <label className="field">
                    <span className="label">Section label</span>
                    <input className="input" value={q.topic} onChange={(e) => patch(q.id, { topic: e.target.value })} />
                  </label>
                </div>
                <label className="field" style={{ marginTop: 12 }}>
                  <span className="label">Why you&apos;re asking — shown under the question</span>
                  <textarea className="input ta" rows={2} value={q.description ?? ""}
                    onChange={(e) => patch(q.id, { description: e.target.value })}
                    placeholder="Optional. People answer honestly far more often when they know why." />
                </label>

                {q.kind === "custom" ? (
                  <div className="row gap-3 wrap" style={{ marginTop: 12 }}>
                    <label className="field" style={{ minWidth: 180 }}>
                      <span className="label">Answer type</span>
                      <select className="select" value={q.type}
                        onChange={(e) => patch(q.id, {
                          type: e.target.value as FieldType,
                          options: e.target.value === "choice" ? (q.options ?? [{ label: "", value: "opt-1" }]) : undefined,
                        })}>
                        {(["choice", "text", "boolean"] as FieldType[]).map((t) => (
                          <option key={t} value={t}>{TYPE_LABEL[t]}</option>
                        ))}
                      </select>
                    </label>
                    <label className="opt" style={{ alignSelf: "flex-end" }} data-on={q.required}>
                      <input type="checkbox" checked={q.required} onChange={() => patch(q.id, { required: !q.required })} />
                      <span className="t-sm">Must be answered</span>
                    </label>
                  </div>
                ) : null}

                {q.options ? (
                  <div style={{ marginTop: 14 }}>
                    <span className="label">Answers</span>
                    <div className="col gap-2" style={{ marginTop: 6 }}>
                      {q.options.map((o, oi) => (
                        <div key={oi} className="row gap-2">
                          <input className="input grow" value={o.label} placeholder={`Answer ${oi + 1}`}
                            onChange={(e) => patch(q.id, {
                              options: q.options!.map((x, xi) => xi === oi
                                ? { label: e.target.value, value: q.kind === "custom" ? e.target.value : x.value }
                                : x),
                            })} />
                          {q.kind === "core" ? (
                            <span className="chip mono" style={{ flex: "none" }} title="Locked — the calculations read this">
                              <Ico.lock size={11} />{o.value}
                            </span>
                          ) : (
                            <button className="btn btn-ico btn-sm" disabled={q.options!.length <= 2}
                              onClick={() => patch(q.id, { options: q.options!.filter((_, xi) => xi !== oi) })}>
                              <Ico.x size={13} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    {q.kind === "custom" ? (
                      <button className="btn btn-g btn-sm" style={{ marginTop: 8, paddingLeft: 0 }}
                        onClick={() => patch(q.id, { options: [...q.options!, { label: "", value: `opt-${q.options!.length + 1}` }] })}>
                        <Ico.plus size={13} />Add an answer
                      </button>
                    ) : (
                      <p className="t-xs c-4" style={{ marginTop: 8, lineHeight: 1.55 }}>
                        Reword these freely. The locked value beside each one is what the calculations
                        read, so it stays put — otherwise a rename would quietly change someone&apos;s numbers.
                      </p>
                    )}
                  </div>
                ) : null}

                <div className="between" style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--line-2)" }}>
                  <span className="t-xs c-4">
                    {q.kind === "core"
                      ? "Changes go live immediately on the public funnel."
                      : "Answers to this appear on the lead, never in a calculation."}
                  </span>
                  {canRemove(q) ? (
                    <button className="btn btn-g btn-sm c-neg" onClick={() => remove(q.id)}>
                      <Ico.x size={13} />Remove
                    </button>
                  ) : (
                    <span className="chip"><Ico.lock size={11} />Required by the maths</span>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <button className="btn btn-p" style={{ marginTop: 14 }} onClick={add}>
        <Ico.plus size={15} />Add a question of your own
      </button>
      <p className="t-xs c-4" style={{ marginTop: 10, lineHeight: 1.6, maxWidth: 620 }}>
        Every question you add is one more thing between a stranger and their answer. The funnels
        ship at {live} because that is roughly where completion starts falling — worth remembering
        before the eighth.
      </p>
    </>
  );
}
