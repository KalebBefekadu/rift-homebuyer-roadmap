"use client";

import { useState } from "react";
import Link from "next/link";
import type { OpsItem } from "@/lib/prototype/operations";

const TONE: Record<OpsItem["tone"], { chip: string; word: string }> = {
  neg: { chip: "chip-neg", word: "Urgent" },
  warn: { chip: "chip-warn", word: "Soon" },
  pos: { chip: "chip-pos", word: "Set" },
  none: { chip: "chip-out", word: "Open" },
};

/**
 * One item on Today (§8.4): why it is here, who owns it, what it is about,
 * its evidence, when it is due and the next action. Snooze keeps an owner
 * and a time to come back and never moves a contract date; delegate waits
 * for the other person to accept; pin has a reason and an end (OPS-02).
 * In the mock-up these only change what is on screen.
 */
export function ItemRow({ item }: { item: OpsItem }) {
  const [state, setState] = useState<null | "snoozed" | "delegated" | "pinned">(null);
  const isDate = item.why.startsWith("Contract date");
  const t = TONE[item.tone];
  return (
    <li style={{ padding: "6px 0", borderBottom: "1px solid var(--line-3)", opacity: state === "snoozed" ? 0.5 : 1 }} title={`Evidence: ${item.evidence}`}>
      <div className="row gap-2" style={{ alignItems: "baseline" }}>
        <span className={`chip t-2xs ${t.chip}`} style={{ flex: "none" }}>{t.word}</span>
        <span style={{ fontWeight: 600, minWidth: 0 }}>{item.title}</span>
      </div>
      <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>
        <Link className="u" href={item.about.href}>{item.about.label}</Link> · {item.owner} · {item.due}
      </div>
      <div className="between gap-2" style={{ fontSize: 12, marginTop: 2 }}>
        <span><span style={{ fontWeight: 600 }}>Next:</span> {item.next}</span>
        <span className="row gap-2" style={{ flex: "none", color: "var(--ink-3)" }}>
          {state ? <span className="chip t-2xs">{state === "snoozed" ? "Snoozed to 9:00" : state === "delegated" ? "Awaiting accept" : "Pinned to Fri"}</span> : <>
            <button className="u" disabled={isDate} title={isDate ? "A contract date is never snoozed" : "Snooze, with a time to come back"} onClick={() => setState("snoozed")} style={isDate ? { opacity: 0.4 } : undefined}>Snooze</button>
            <button className="u" onClick={() => setState("delegated")}>Delegate</button>
            <button className="u" onClick={() => setState("pinned")}>Pin</button>
          </>}
        </span>
      </div>
    </li>
  );
}
