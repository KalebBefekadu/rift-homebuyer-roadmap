"use client";

import { useState } from "react";
import { Ico } from "@/components/rift/icons";
import { money } from "@/lib/prototype/compute";

type R = "cobuyer" | "gifter" | "lender" | "friend";

const RECIPIENTS: { id: R; who: string; sub: string; sees: string[]; hidden: string[] }[] = [
  { id: "cobuyer", who: "Devon", sub: "Co-buyer", sees: ["Everything you see", "His own view once he joins"], hidden: [] },
  { id: "gifter", who: "Mum", sub: "Gifting funds", sees: ["Cash needed at closing", "The exact remaining gap", "What a gift letter requires"], hidden: ["Your income", "Your credit", "Your debts", "Your savings balance"] },
  { id: "lender", who: "Brookhaven Lending", sub: "Lender", sees: ["Your situation summary", "The question sheet", "Which programs to confirm"], hidden: ["Personal notes", "Anything you didn't include"] },
  { id: "friend", who: "A friend", sub: "Same position", sees: ["The package as an example", "A link to run their own"], hidden: ["Your figures", "Your contact details"] },
];

export default function Share() {
  const [r, setR] = useState<R>("gifter");
  const [sent, setSent] = useState<R[]>([]);
  const a = RECIPIENTS.find((x) => x.id === r)!;

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <h1 className="serif d3">Share your plan</h1>
        <p className="t-sm c-4" style={{ marginTop: 3 }}>Each person sees only what they need to help you.</p>
      </div>

      <div className="split-w">
        <div className="card" style={{ overflow: "hidden" }}>
          <div className="row railscroll" style={{ borderBottom: "1px solid var(--line-2)", gap: 2, padding: "0 8px" }}>
            {RECIPIENTS.map((x) => (
              <button key={x.id} onClick={() => setR(x.id)} style={{
                height: 42, padding: "0 11px", fontSize: 13, whiteSpace: "nowrap",
                fontWeight: r === x.id ? 600 : 500, color: r === x.id ? "var(--ink)" : "var(--ink-3)",
                borderBottom: `2px solid ${r === x.id ? "var(--ink)" : "transparent"}`, marginBottom: -1,
              }}>{x.who}</button>
            ))}
          </div>

          <div style={{ padding: 20 }}>
            <div className="between" style={{ marginBottom: 16 }}>
              <div><div className="t-lg w6">{a.who}</div><div className="t-xs c-4">{a.sub}</div></div>
              {sent.includes(r) ? <span className="chip chip-pos"><Ico.check size={10} />Sent</span> : null}
            </div>

            {r === "gifter" ? (
              <div className="tint p-4" style={{ marginBottom: 16 }}>
                <div className="kicker" style={{ marginBottom: 8 }}>What Mum will see</div>
                <div className="serif" style={{ fontSize: 25, letterSpacing: "-0.02em" }}>
                  Maya needs {money(20_400)} at closing.
                </div>
                <table className="tbl" style={{ marginTop: 12 }}><tbody>
                  <tr><td style={{ padding: "6px 0" }} className="c-3">Cash required at the table</td><td className="num-c num" style={{ padding: "6px 0" }}>{money(31_190)}</td></tr>
                  <tr><td style={{ padding: "6px 0" }} className="c-3">Covered by savings and assistance</td><td className="num-c num c-pos" style={{ padding: "6px 0" }}>{money(10_790)}</td></tr>
                  <tr><td style={{ padding: "6px 0" }} className="w55">Remaining gap</td><td className="num-c num w6" style={{ padding: "6px 0" }}>{money(20_400)}</td></tr>
                </tbody></table>
                <p className="t-xs c-3" style={{ marginTop: 10, lineHeight: 1.55 }}>
                  A gift toward this needs a signed letter the lender accepts, and traceable funds.
                </p>
              </div>
            ) : null}

            <div className="g2 gap-4">
              <div>
                <div className="kicker" style={{ marginBottom: 9 }}>They see</div>
                <div className="col gap-2">
                  {a.sees.map((s) => (
                    <div key={s} className="row-t gap-2">
                      <Ico.check size={14} className="c-pos" style={{ marginTop: 2, flex: "none" }} />
                      <span className="t-sm c-2">{s}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="kicker" style={{ marginBottom: 9 }}>They never see</div>
                {a.hidden.length === 0 ? (
                  <span className="t-sm c-4">Nothing withheld — a co-buyer sees it all.</span>
                ) : (
                  <div className="col gap-2">
                    {a.hidden.map((s) => (
                      <div key={s} className="row-t gap-2">
                        <Ico.lock size={13} className="c-4" style={{ marginTop: 3, flex: "none" }} />
                        <span className="t-sm c-4">{s}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="row gap-2" style={{ marginTop: 20 }}>
              <input className="input" defaultValue={r === "gifter" ? "mum@example.com" : r === "lender" ? "loans@brookhaven.example" : ""} placeholder="Email address" />
              <button className="btn btn-p" onClick={() => setSent((s) => [...s, r])} disabled={sent.includes(r)}>
                <Ico.send size={14} />{sent.includes(r) ? "Sent" : "Send"}
              </button>
            </div>
          </div>
        </div>

        <div className="col gap-3">
          <div className="card p-4">
            <div className="t-sm w6" style={{ marginBottom: 10 }}>Or copy a link</div>
            <div className="tint p-2 row gap-2">
              <span className="t-xs mono c-3 grow trunc">rift.co/p/maya-e/3f8a</span>
              <button className="btn btn-g btn-sm">Copy</button>
            </div>
            <p className="t-xs c-4" style={{ marginTop: 9, lineHeight: 1.55 }}>
              Read-only. No account needed to open it. You can revoke it any time.
            </p>
          </div>
          <div className="card p-4">
            <div className="t-sm w6" style={{ marginBottom: 10 }}>Shared so far</div>
            {sent.length === 0
              ? <p className="t-sm c-4">Nothing shared yet.</p>
              : sent.map((s) => {
                  const x = RECIPIENTS.find((y) => y.id === s)!;
                  return (
                    <div key={s} className="between" style={{ padding: "7px 0", borderTop: "1px solid var(--line-3)" }}>
                      <div><div className="t-sm w55">{x.who}</div><div className="t-xs c-4">{x.sub}</div></div>
                      <span className="t-xs c-4">just now</span>
                    </div>
                  );
                })}
          </div>
        </div>
      </div>
    </>
  );
}
