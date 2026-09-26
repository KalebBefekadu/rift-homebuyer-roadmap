"use client";

import { useState } from "react";
import { Ico } from "@/components/rift/icons";
import { Layer } from "@/components/rift/Layer";
import { STAGES } from "@/lib/core/progress";
import { assignableTo, stageName, stepsFor, type Assignable, type Step } from "@/lib/core/checklist";
import { useWrite } from "../journey/[id]/useWrite";

const WHO: Record<Assignable, string> = { you: "You", tc: "Coordinator", rift: "Rift" };
const DAY = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export interface Changed { stepId: string; doer: Assignable; by: string; at: string }

/**
 * Who does each step, for every journey (Blueprint v5 §8.6). One list per
 * side, a layer per stage (§4.8): the stage says how the work splits, and
 * opening it shows each step with who does it.
 *
 * A step that is not the agent's to hand out says why instead of offering a
 * choice: protected steps are his in every mode, and the client's and the
 * professionals' are theirs whoever records them. Rift is offered only for
 * the steps it was designed for, and one that does not run yet says so.
 */
export function Assignments({ changed, unavailable, hasCoordinator }: { changed: Changed[]; unavailable: string | null; hasCoordinator: boolean }) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const by = new Map(changed.map((c) => [c.stepId, c]));
  const { busy, error, write } = useWrite(changed.map((c) => `${c.stepId}:${c.doer}`).join("|"), "/api/operations/team");
  const who = (s: Step): Assignable | null => {
    const c = by.get(s.id)?.doer;
    if (c && assignableTo(s).includes(c)) return c;
    return s.doer === "you" || s.doer === "tc" || s.doer === "rift" ? s.doer : null;
  };
  const steps = stepsFor(side);
  const tcCount = [...stepsFor("buy"), ...stepsFor("sell")].filter((s) => who(s) === "tc").length;

  return (
    <div>
      <div className="row gap-2 wrap" role="group" aria-label="Which checklist">
        {(["buy", "sell"] as const).map((x) => (
          <button key={x} className={`chip ${side === x ? "chip-ink" : ""}`} aria-pressed={side === x} onClick={() => setSide(x)}
            style={{ cursor: "pointer", height: 28, padding: "0 12px" }}>
            {x === "buy" ? "Buying" : "Selling"}
          </button>
        ))}
      </div>
      {!hasCoordinator && tcCount ? (
        <p className="t-xs c-3 opsx-inl" style={{ marginTop: 10, lineHeight: 1.55 }}>
          <Ico.info size={11} aria-hidden />
          <span>{tcCount} steps across both checklists are the coordinator&apos;s, and nobody is on your team yet, so you record them. Add someone under Team.</span>
        </p>
      ) : null}
      {unavailable ? <p className="t-xs c-warn" style={{ marginTop: 10 }}>{unavailable}</p> : null}
      {error ? <p role="alert" className="t-xs c-neg" style={{ marginTop: 10 }}>{error}</p> : null}

      <div className="col gap-2" style={{ marginTop: 12 }}>
        {STAGES.map((stage) => {
          const list = steps.filter((s) => s.stage === stage);
          const counts = (["you", "tc", "rift"] as Assignable[]).map((d) => [d, list.filter((s) => who(s) === d).length] as const).filter(([, n]) => n);
          const others = list.filter((s) => who(s) === null).length;
          return (
            <Layer key={stage} title={stageName(side, stage)}
              meta={[...counts.map(([d, n]) => `${WHO[d]} ${n}`), others ? `Others ${others}` : ""].filter(Boolean).join(" · ")}>
              <ul className="col" style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {list.map((s) => {
                  const allowed = assignableTo(s);
                  const current = who(s);
                  const c = by.get(s.id);
                  return (
                    <li key={s.id} className="between gap-3 wrap" style={{ padding: "9px 0", borderTop: "1px solid var(--line-3)" }}>
                      <span className="col" style={{ gap: 2, minWidth: 0, flex: "1 1 260px" }}>
                        <span className="t-sm">{s.title}</span>
                        <span className="t-2xs c-4">
                          {s.ref}
                          {c && current !== s.doer ? ` · changed by ${c.by}, ${DAY(c.at)}` : ""}
                          {current === "rift" && !s.live ? " · Rift cannot do this yet, so it shows as yours until it can" : ""}
                        </span>
                      </span>
                      {allowed.length ? (
                        <select className="input" aria-label={`Who does: ${s.title}`} value={current ?? ""} disabled={busy || Boolean(unavailable)}
                          onChange={(e) => void write("assign", { stepId: s.id, doer: e.target.value })}
                          style={{ height: 30, padding: "0 8px", fontSize: 13, width: "auto" }}>
                          {allowed.map((d) => <option key={d} value={d}>{WHO[d]}{d === s.doer ? " (default)" : ""}</option>)}
                        </select>
                      ) : (
                        <span className="row gap-1 t-xs c-3" title={s.protected ? "Yours in every mode" : "Done by someone outside your team"}>
                          {s.protected ? <><Ico.lock size={11} aria-hidden /> Always you</> : s.doer === "client" ? "The client" : s.pro ?? "A professional"}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Layer>
          );
        })}
      </div>
    </div>
  );
}
