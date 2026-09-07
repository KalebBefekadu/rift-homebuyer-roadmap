"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  FUNDING_LABEL, GA_COUNTIES, TYPE_LABEL, matchPrograms, type AssistanceProgram,
} from "@/lib/prototype/registry";
import { money } from "@/lib/prototype/compute";
import { Ico } from "@/components/rift/icons";


function Program({ p }: { p: AssistanceProgram }) {
  const [open, setOpen] = useState(false);
  const chip =
    p.funding === "open" ? "chip-pos" : p.funding === "waitlist" ? "chip-warn" : "chip";

  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <button onClick={() => setOpen(!open)} style={{ width: "100%", textAlign: "left", padding: "16px 18px" }}>
        <div className="between gap-3" style={{ alignItems: "flex-start" }}>
          <div className="grow">
            <div className="t-lg w6">{p.name}</div>
            <div className="t-xs c-4" style={{ marginTop: 2 }}>{p.administrator}</div>
            <div className="row gap-1 wrap" style={{ marginTop: 10 }}>
              <span className={`chip ${chip}`}>
                {p.funding === "open" ? <Ico.check size={11} /> : p.funding === "waitlist" ? <Ico.clock size={11} /> : <Ico.pause size={11} />}
                {FUNDING_LABEL[p.funding]}
              </span>
              <span className="chip">{TYPE_LABEL[p.type]}</span>
            </div>
          </div>
          <div style={{ textAlign: "right", flex: "none" }}>
            <div className="num" style={{ fontSize: 19 }}>
              {money(p.min)}<span className="c-4">–</span>{money(p.max)}
            </div>
            <div className="t-2xs c-4" style={{ marginTop: 2 }}>estimated range</div>
            <div className="row gap-1" style={{ justifyContent: "flex-end", marginTop: 10, color: "var(--ink-4)" }}>
              <span className="t-xs">{open ? "Less" : "Requirements"}</span>
              <Ico.chevD size={13} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .16s" }} />
            </div>
          </div>
        </div>
      </button>

      {open ? (
        <div style={{ borderTop: "1px solid var(--line-2)", padding: "16px 18px", background: "var(--canvas)" }}>
          <div className="g2 gap-4">
            <div>
              <div className="kicker" style={{ marginBottom: 8 }}>Limits</div>
              <p className="t-sm c-2" style={{ marginBottom: 8 }}>{p.incomeLimitNote}</p>
              <p className="t-sm c-2">{p.priceCapNote}</p>
            </div>
            <div>
              <div className="kicker" style={{ marginBottom: 8 }}>Conditions</div>
              <ul className="col gap-2">
                {p.conditions.map((c) => (
                  <li key={c} className="row-t gap-2">
                    <span className="dot" style={{ background: "var(--ink-5)", marginTop: 7 }} />
                    <span className="t-sm c-2">{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="row gap-2" style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--line-2)" }}>
            <Ico.shield size={13} className="c-4" />
            <span className="t-xs c-4">Verified {p.verifiedOn} by {p.verifiedBy} · {p.source}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function Assistance() {
  const [county, setCounty] = useState("DeKalb");
  const [first, setFirst] = useState(true);
  const r = useMemo(() => matchPrograms({ county, firstTimeBuyer: first }), [county, first]);
  const open = r.matched.filter((p) => p.funding === "open");

  return (
    <section className="shell-w">
      <div style={{ paddingTop: "clamp(40px,6vw,76px)", maxWidth: 760 }}>
        <div className="kicker">Assistance check</div>
        <h1 className="serif d2" style={{ marginTop: 12 }}>
          Is there money available to you?
        </h1>
        <p className="lede" style={{ marginTop: 16, maxWidth: 540 }}>
          Two questions. Every program below has been verified by hand — anything we
          can&apos;t currently stand behind isn&apos;t shown at all.
        </p>
      </div>

      <div className="card" style={{ marginTop: 34, padding: "clamp(20px,2.6vw,28px)" }}>
        <div className="g2 gap-4" style={{ alignItems: "end" }}>
          <label className="field">
            <span className="label">Which county are you looking in?</span>
            <select className="select input-lg" value={county} onChange={(e) => setCounty(e.target.value)}>
              {GA_COUNTIES.map((c) => <option key={c}>{c} County</option>)}
            </select>
          </label>
          <div className="field">
            <span className="label">Have you owned a home in the last three years?</span>
            <div className="row gap-2">
              {([["No", true], ["Yes", false]] as const).map(([l, v]) => (
                <button key={l} onClick={() => setFirst(v)}
                  className="btn btn-lg grow"
                  style={{
                    background: first === v ? "var(--ink)" : "var(--paper)",
                    color: first === v ? "#fff" : "var(--ink-2)",
                    border: `1px solid ${first === v ? "var(--ink)" : "var(--line)"}`,
                  }}>{l}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* result */}
      <div style={{ marginTop: 24 }}>
        {r.matched.length === 0 ? (
          <div className="card p-6 center">
            <Ico.info size={22} className="c-4" />
            <p className="t-lg w55" style={{ marginTop: 12 }}>Nothing matches those answers today.</p>
            <p className="t-sm c-3" style={{ marginTop: 6, maxWidth: 420, margin: "6px auto 0" }}>
              That doesn&apos;t mean nothing exists — it means nothing we can currently
              verify. Kaleb reviews this list continuously.
            </p>
          </div>
        ) : (
          <>
            <div className="card" style={{
              padding: "clamp(24px,3vw,36px)", background: "var(--ink)", borderColor: "var(--ink)", color: "#fff",
            }}>
              <div className="between wrap gap-4">
                <div>
                  <div className="kicker" style={{ color: "rgba(255,255,255,.5)" }}>
                    You may qualify for · {county} County
                  </div>
                  <div className="serif" style={{ fontSize: "clamp(38px,6vw,68px)", lineHeight: 1.02, marginTop: 10, letterSpacing: "-0.025em" }}>
                    {money(r.usableMin)}<span style={{ color: "rgba(255,255,255,.4)" }}>–</span>{money(r.usableMax)}
                  </div>
                  <p style={{ marginTop: 14, color: "rgba(255,255,255,.65)", fontSize: 14.5, maxWidth: 440, lineHeight: 1.55 }}>
                    Across {r.matched.length} programs. {open.length > 0
                      ? `${money(r.openMin)}–${money(r.openMax)} of it has funding open right now.`
                      : "None of it has funding open right now."}
                  </p>
                </div>
                <Link href="/prototype/buy/start" className="btn btn-lg" style={{ background: "#fff", color: "var(--ink)" }}>
                  See what this does to my numbers <Ico.arrowR size={16} />
                </Link>
              </div>
              <div style={{ marginTop: 22, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,.13)" }} className="row gap-2">
                <Ico.info size={13} style={{ color: "rgba(255,255,255,.4)" }} />
                <span style={{ fontSize: 12, color: "rgba(255,255,255,.45)", lineHeight: 1.5 }}>
                  Estimated ranges, not approvals. Income limits, purchase-price caps and
                  funding availability decide what you can actually use — your lender and the
                  program confirm it.
                </span>
              </div>
            </div>

            <div className="col gap-2" style={{ marginTop: 16 }}>
              {r.matched.map((p) => <Program key={p.id} p={p} />)}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
