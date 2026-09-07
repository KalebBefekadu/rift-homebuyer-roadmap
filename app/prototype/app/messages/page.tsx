"use client";

import { useState } from "react";
import { Ico } from "@/components/rift/icons";

type Msg = { from: "you" | "kaleb" | "rift"; t: string; when: string };

const THREAD: Msg[] = [
  { from: "rift", t: "A DeKalb assistance program reopened its funding. Your estimated range moved from $22,500–$27,500 to $30,000–$37,500, so your gap drops by about $7,500.", when: "6 Sep, 8:04" },
  { from: "you", t: "Wait, is that real? That seems like a lot.", when: "6 Sep, 8:31" },
  { from: "kaleb", t: "It's real, but it's an estimate until Brookhaven confirms your income against the program limits. That's exactly the call I want to have this week.", when: "6 Sep, 8:36" },
  { from: "kaleb", t: "I've sent them both programs. If they come back clean you're looking at 11 months instead of 29.", when: "6 Sep, 8:37" },
  { from: "you", t: "Devon wants to read the agency agreement before we sign anything — is that okay?", when: "6 Sep, 9:02" },
  { from: "kaleb", t: "Completely fair, and I'd expect it. I'll send it today so you both have it in front of you before we talk.", when: "6 Sep, 9:11" },
];

export default function Messages() {
  const [msgs, setMsgs] = useState(THREAD);
  const [v, setV] = useState("");
  const send = () => { if (!v.trim()) return; setMsgs([...msgs, { from: "you", t: v, when: "now" }]); setV(""); };

  return (
    <>
      <div className="between" style={{ marginBottom: 20 }}>
        <div className="row gap-3">
          <div className="av av-lg" style={{ background: "var(--accent)" }}>K</div>
          <div>
            <h1 className="t-xl w6">Kaleb Befekadu</h1>
            <p className="t-xs c-4">Usually replies within 15 minutes</p>
          </div>
        </div>
        <button className="btn btn-s btn-sm"><Ico.cal size={14} />Book a call</button>
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
        <div className="col gap-3" style={{ padding: 18, maxHeight: "56vh", overflowY: "auto" }}>
          {msgs.map((m, i) => (
            <div key={i} className={m.from === "you" ? "row" : "row-t"} style={{ justifyContent: m.from === "you" ? "flex-end" : "flex-start", gap: 10 }}>
              {m.from !== "you" ? (
                <div className="av av-sm" style={{ background: m.from === "rift" ? "var(--pos)" : "var(--accent)", marginTop: 2 }}>
                  {m.from === "rift" ? "R" : "K"}
                </div>
              ) : null}
              <div style={{ maxWidth: "72%" }}>
                {m.from === "rift" ? <div className="t-2xs c-4 w6" style={{ marginBottom: 3 }}>Rift · automatic update</div> : null}
                <div style={{
                  padding: "10px 13px", borderRadius: 12, fontSize: 14, lineHeight: 1.55,
                  background: m.from === "you" ? "var(--ink)" : m.from === "rift" ? "var(--pos-wash)" : "var(--sunk)",
                  color: m.from === "you" ? "#fff" : "var(--ink)",
                  border: m.from === "rift" ? "1px solid var(--pos-line)" : "none",
                }}>{m.t}</div>
                <div className="t-2xs c-4" style={{ marginTop: 3, textAlign: m.from === "you" ? "right" : "left" }}>{m.when}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="row gap-2" style={{ padding: 12, borderTop: "1px solid var(--line-2)" }}>
          <input className="input" placeholder="Message Kaleb" value={v}
            onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
          <button className="btn btn-p" onClick={send} disabled={!v.trim()}><Ico.send size={15} /></button>
        </div>
      </div>
    </>
  );
}
