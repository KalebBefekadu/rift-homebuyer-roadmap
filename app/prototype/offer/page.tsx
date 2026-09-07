"use client";

import { useState } from "react";
import Link from "next/link";
import { Ico } from "@/components/rift/icons";
import { OFFERS } from "@/lib/prototype/fixtures";

const O = OFFERS[1];
const GROUPS = ["Price", "Financing", "Deposits", "Dates", "Contingencies", "Concessions", "Documents", "Special Terms"];
const CONF = { high: "chip-pos", medium: "chip-warn", low: "chip-neg" };
const STEPS = ["Property", "Upload", "Check the terms", "Attachments", "You", "Done"];

export default function Offer() {
  const [s, setS] = useState(0);
  const [confirmed, setConfirmed] = useState(true);
  const [rep, setRep] = useState<"agent" | "self">("agent");

  return (
    <section style={{ maxWidth: 760, margin: "0 auto", padding: "0 clamp(18px,4vw,36px)" }}>
      <div style={{ paddingTop: "clamp(36px,5vw,64px)", marginBottom: 26 }}>
        <div className="kicker">Rift Offer</div>
        <h1 className="serif d2" style={{ marginTop: 12 }}>Submit an offer on any Georgia address.</h1>
        <p className="lede" style={{ marginTop: 14 }}>
          No account. Upload the signed PDF and check what we read back to you.
        </p>
      </div>

      <div className="row railscroll" style={{ gap: 4, marginBottom: 20 }}>
        {STEPS.map((x, i) => (
          <button key={x} onClick={() => setS(i)} className="row gap-2" style={{
            height: 30, padding: "0 10px", borderRadius: 7, fontSize: 12.5, whiteSpace: "nowrap",
            fontWeight: s === i ? 600 : 500,
            background: s === i ? "var(--ink)" : i < s ? "var(--pos-wash)" : "var(--sunk)",
            color: s === i ? "#fff" : i < s ? "var(--pos)" : "var(--ink-4)",
          }}>
            {i < s ? <Ico.check size={12} /> : <span className="num t-2xs">{i + 1}</span>}{x}
          </button>
        ))}
      </div>

      {s === 0 ? (
        <div className="card p-5">
          <label className="field" style={{ marginBottom: 16 }}>
            <span className="label">Property address</span>
            <input className="input input-lg" defaultValue={O.property} />
          </label>
          <div className="g2 gap-2" style={{ marginBottom: 16 }}>
            {([["Rift-managed listing", true], ["Any other address", false]] as const).map(([l, v]) => (
              <label key={l} className="opt" data-on={confirmed === v}>
                <input type="radio" checked={confirmed === v} onChange={() => setConfirmed(v)} />
                <span className="t-md w5">{l}</span>
              </label>
            ))}
          </div>
          {confirmed ? (
            <div className="card p-3" style={{ background: "var(--pos-wash)", borderColor: "var(--pos-line)" }}>
              <div className="row-t gap-2">
                <Ico.checkCircle size={15} className="c-pos" style={{ marginTop: 1 }} />
                <span className="t-sm c-2">
                  Kaleb represents the seller here. Your offer goes straight to him and he
                  decides whether to present it.
                </span>
              </div>
            </div>
          ) : (
            <div className="card p-3" style={{ background: "var(--warn-wash)", borderColor: "var(--warn-line)" }}>
              <div className="row-t gap-2">
                <Ico.info size={15} className="c-warn" style={{ marginTop: 1 }} />
                <span className="t-sm c-2">
                  We don&apos;t represent the seller of this property. Your submission is
                  recorded with a reference number but may not reach anyone. We will never
                  contact the owner or occupant because of it.
                </span>
              </div>
            </div>
          )}
          <button className="btn btn-p btn-lg" style={{ marginTop: 18, width: "100%" }} onClick={() => setS(1)}>Continue</button>
        </div>
      ) : null}

      {s === 1 ? (
        <div className="card p-5">
          <div style={{ border: "1.5px dashed var(--line)", borderRadius: 12, padding: 34, textAlign: "center" }}>
            <Ico.doc size={22} className="c-3" />
            <div className="t-md w55" style={{ marginTop: 10 }}>Purchase and Sale Agreement — signed.pdf</div>
            <div className="t-xs c-4" style={{ marginTop: 3 }}>7 pages · 2.4 MB</div>
          </div>
          <p className="t-sm c-3" style={{ marginTop: 14, lineHeight: 1.6 }}>
            The document comes first. You shouldn&apos;t have to retype what you already have.
          </p>
          <button className="btn btn-p btn-lg" style={{ marginTop: 16, width: "100%" }} onClick={() => setS(2)}>
            Read the terms for me
          </button>
        </div>
      ) : null}

      {s === 2 ? (
        <div className="card" style={{ overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line-2)" }}>
            <div className="t-md w6">Check these before you send</div>
            <div className="t-xs c-4" style={{ marginTop: 2 }}>Anything marked low needs your eyes. We&apos;d rather ask than guess.</div>
          </div>
          {GROUPS.map((g) => {
            const f = O.fields.filter((x) => x.group === g);
            if (!f.length) return null;
            return (
              <div key={g}>
                <div className="kicker" style={{ padding: "12px 18px 5px", background: "var(--canvas)", borderTop: "1px solid var(--line-3)" }}>{g}</div>
                {f.map((x) => (
                  <div key={x.label} style={{ padding: "10px 18px", borderTop: "1px solid var(--line-3)" }}>
                    <div className="between" style={{ marginBottom: 5 }}>
                      <span className="t-sm c-3">{x.label}</span>
                      <span className={`chip ${CONF[x.confidence]}`}>{x.confidence}{x.page > 0 ? ` · p${x.page}` : ""}</span>
                    </div>
                    <input className="input" defaultValue={x.value} />
                  </div>
                ))}
              </div>
            );
          })}
          <div style={{ padding: 18 }}>
            <button className="btn btn-p btn-lg" style={{ width: "100%" }} onClick={() => setS(3)}>These look right</button>
          </div>
        </div>
      ) : null}

      {s === 3 ? (
        <div className="card p-5">
          <div className="t-md w6" style={{ marginBottom: 4 }}>Anything else attached?</div>
          <p className="t-sm c-4" style={{ marginBottom: 16 }}>Optional — an incomplete offer is still accepted, just flagged.</p>
          <div className="col gap-2">
            {["Preapproval letter", "Proof of funds", "Additional addenda"].map((d) => (
              <label key={d} className="opt">
                <input type="checkbox" />
                <span className="t-md w5">{d}</span>
              </label>
            ))}
          </div>
          <button className="btn btn-p btn-lg" style={{ marginTop: 18, width: "100%" }} onClick={() => setS(4)}>Continue</button>
        </div>
      ) : null}

      {s === 4 ? (
        <div className="card p-5">
          <div className="g2 gap-3" style={{ marginBottom: 16 }}>
            <label className="field"><span className="label">Your name</span><input className="input" defaultValue="Marcus Deel" /></label>
            <label className="field"><span className="label">Email</span><input className="input" defaultValue="m.deel@example.com" /></label>
            <label className="field"><span className="label">Phone</span><input className="input" defaultValue="(404) 555-0148" /></label>
          </div>
          <div className="col gap-2" style={{ marginBottom: 16 }}>
            {([["agent", "I'm a licensed agent representing the buyer"], ["self", "I'm the buyer, and I'm not represented"]] as const).map(([k, l]) => (
              <label key={k} className="opt" data-on={rep === k}>
                <input type="radio" checked={rep === k} onChange={() => setRep(k)} />
                <span className="t-md w5">{l}</span>
              </label>
            ))}
          </div>
          {rep === "self" ? (
            <div className="card p-4" style={{ background: "var(--warn-wash)", borderColor: "var(--warn-line)" }}>
              <div className="row-t gap-2">
                <Ico.alert size={15} className="c-warn" style={{ marginTop: 1, flex: "none" }} />
                <div>
                  <div className="t-sm w6 c-warn" style={{ marginBottom: 4 }}>Please read this</div>
                  <p className="t-sm c-2" style={{ lineHeight: 1.6 }}>
                    Kaleb represents the seller of this property, not you. He can&apos;t advise
                    you, and Rift won&apos;t tell you whether your offer is strong. Your
                    submission goes straight to him — no automated reply. He&apos;ll contact you
                    to discuss your options, which include finding your own representation.
                  </p>
                </div>
              </div>
            </div>
          ) : null}
          <button className="btn btn-a btn-lg" style={{ marginTop: 18, width: "100%" }} onClick={() => setS(5)}>Submit offer</button>
        </div>
      ) : null}

      {s === 5 ? (
        <div className="card p-6 center">
          <Ico.checkCircle size={26} className="c-pos" />
          <h2 className="serif d3" style={{ marginTop: 14 }}>Your offer has been received.</h2>
          <div className="tint p-4" style={{ marginTop: 20 }}>
            <div className="kicker">Your reference</div>
            <div className="num" style={{ fontSize: 28, marginTop: 5 }}>{O.ref}</div>
            <p className="t-sm c-3" style={{ marginTop: 8 }}>
              Keep this. Your private link lets you revise or withdraw without an account.
            </p>
          </div>
          <div style={{ textAlign: "left", marginTop: 22 }}>
            <div className="t-sm w6" style={{ marginBottom: 10 }}>What happens now</div>
            <div className="col gap-2">
              {[
                "Kaleb sees your offer first. The seller has not seen it.",
                "He decides to present it, hold it, or decline to present it.",
                "Whatever he decides, you're told it was received — and it's never discarded.",
                "Your original documents are preserved exactly as submitted.",
              ].map((t) => (
                <div key={t} className="row-t gap-2">
                  <Ico.check size={14} className="c-pos" style={{ marginTop: 3, flex: "none" }} />
                  <span className="t-sm c-2">{t}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="row gap-2" style={{ marginTop: 22, justifyContent: "center" }}>
            <Link href="/prototype/studio/offers" className="btn btn-s">See how Kaleb reviews it</Link>
            <button className="btn btn-g" onClick={() => setS(0)}>Submit another</button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
