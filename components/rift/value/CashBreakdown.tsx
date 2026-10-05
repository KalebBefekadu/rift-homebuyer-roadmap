"use client";

import { useId, useState } from "react";
import { money } from "@/lib/core/compute";
import { groupSmallCosts, type CashLine } from "@/lib/core/cash-group";
import { CashStack } from "./artifacts";

/**
 * The cash-to-close drawing with the small costs grouped (manual review
 * WS3.2). Prepaids, inspection and appraisal become one "Other costs" block
 * so the drawing stays readable; the button under it slides the three lines
 * open. A real button with aria-expanded, so a keyboard and a screen reader
 * can open it too, and the slide is a CSS transition that the global
 * reduced-motion rule in rift.css switches off. The total never changes:
 * grouping only adds the same numbers together.
 */
export function CashBreakdown({ lines, total, down }: { lines: CashLine[]; total: number; down: number }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const g = groupSmallCosts(lines);
  return (
    <div>
      <CashStack lines={g.lines} total={total} down={down} />
      {g.parts.length ? (
        <div style={{ marginTop: 6 }}>
          <button type="button" className="between t-sm" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}
            style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--line-2)", borderRadius: 8, background: "var(--paper)", cursor: "pointer" }}>
            <span className="c-2">{g.label}: what is in the {money(g.amount)}</span>
            <span aria-hidden style={{ display: "inline-block", transition: "transform .25s ease", transform: open ? "rotate(90deg)" : "none" }}>›</span>
          </button>
          <div id={id} style={{ display: "grid", gridTemplateRows: open ? "1fr" : "0fr", transition: "grid-template-rows .3s ease" }}>
            <ul style={{ overflow: "hidden", minHeight: 0, opacity: open ? 1 : 0, transform: open ? "none" : "translateX(-8px)", transition: "opacity .3s ease, transform .3s ease" }}
              aria-hidden={!open}>
              {g.parts.map((p) => (
                <li key={p.label} className="between t-sm" style={{ padding: "8px 10px", borderBottom: "1px solid var(--line-3)" }}>
                  <span className="c-3">{p.label}</span><span className="num">{money(p.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
