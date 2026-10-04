"use client";

import { useState, useTransition } from "react";
import { Ico } from "@/components/rift/icons";
import { ownerLabel, type Owner, type PlanItem } from "@/lib/core/plan";
import { showDay } from "@/lib/core/day";
import { Notice } from "../../ui";
import { useSellerOps } from "./useSellerOps";

/**
 * The steps on a client's plan: ordinary work, written to be read by the
 * client. On the person's record under their plan link, and on a sale's
 * Preparation tab, where `journeyId` sends the writes through the journey's
 * route (useSellerOps).
 */
export function Steps({ leadId, items, agentFirst, clientFirst, unavailable = null, journeyId }: {
  leadId: string;
  items: PlanItem[];
  agentFirst: string;
  clientFirst: string | null;
  /** Why the steps could not be read. `items` is then empty, which is not "no steps". */
  unavailable?: string | null;
  journeyId?: string;
}) {
  const ops = useSellerOps(leadId, journeyId, items.map((i) => `${i.id}:${i.doneAt}`).join(","));
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState<Owner>("client");
  const [ownerName, setOwnerName] = useState("");
  const [dueOn, setDueOn] = useState("");

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) { setError(r.error ?? "that did not work"); return; }
      setError(null);
      after?.();
    });

  return (
    <>
      {error ? <Notice tone="neg" title="That did not work">{error}</Notice> : null}
      <div className="col gap-1" style={{ marginTop: 18 }}>
        {unavailable ? (
          <Notice tone="warn" title="The steps did not load">{unavailable}</Notice>
        ) : items.length === 0 ? (
          <p className="t-xs c-4">No steps yet.</p>
        ) : items.map((item) => (
          <div key={item.id} className="between gap-2" style={{
            padding: "9px 0", borderBottom: "1px solid var(--line-3)", alignItems: "flex-start",
          }}>
            <div className="row gap-2" style={{ alignItems: "flex-start", minWidth: 0 }}>
              <button
                aria-label={item.doneAt ? "Mark not done" : "Mark done"}
                aria-pressed={Boolean(item.doneAt)}
                disabled={pending}
                onClick={() => run(() => ops.tickStep(item.id, !item.doneAt))}
                style={{
                  flex: "none", marginTop: 1, width: 18, height: 18, borderRadius: 5,
                  border: "1px solid var(--line)", display: "grid", placeItems: "center",
                  background: item.doneAt ? "var(--pos-wash)" : "var(--paper)",
                }}>
                {item.doneAt ? <Ico.check size={12} className="c-pos" /> : null}
              </button>
              <div style={{ minWidth: 0 }}>
                <div className="t-sm" style={{
                  lineHeight: 1.45,
                  textDecoration: item.doneAt ? "line-through" : undefined,
                  color: item.doneAt ? "var(--ink-4)" : undefined,
                }}>{item.title}</div>
                <div className="t-2xs c-4" style={{ marginTop: 2 }}>
                  {ownerLabel(item, { agent: agentFirst, client: clientFirst }, "agent")}{item.dueOn ? ` · ${showDay(item.dueOn, { month: "short", day: "numeric" })}` : " · no date"}
                </div>
              </div>
            </div>
            <button className="t-2xs c-4" disabled={pending} style={{ flex: "none" }}
              onClick={() => run(() => ops.dropStep(item.id))}>Remove</button>
          </div>
        ))}
      </div>

      <div className="col gap-2" style={{ marginTop: 14 }}>
        <input
          className="input" value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="What is the next step?" aria-label="What is the next step?"
          maxLength={160}
        />
        <div className="row gap-2 wrap">
          {/* Three owners and no default of "nobody". A plan where nothing is
              owed by anyone is the thing every plan dies of. */}
          {([["client", clientFirst || "Them"], ["agent", "You"], ["other", "Someone else"]] as const).map(([id, label]) => (
            <button key={id} onClick={() => setOwner(id)} aria-pressed={owner === id}
              className={`chip ${owner === id ? "chip-ink" : ""}`}
              style={{ cursor: "pointer", height: 26, padding: "0 10px" }}>{label}</button>
          ))}
          {owner === "other" ? (
            <input className="input" style={{ width: 150, height: 30 }} value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder="Who?" aria-label="Who is it waiting on?" maxLength={80} />
          ) : null}
          <input className="input" type="date" style={{ width: 150, height: 30 }}
            value={dueOn} onChange={(e) => setDueOn(e.target.value)} aria-label="Due date" />
          <button className="btn btn-s btn-sm" disabled={pending || title.trim().length < 3}
            onClick={() => run(
              () => ops.addStep(title.trim(), owner, owner === "other" ? ownerName.trim() : null, dueOn || null),
              () => { setTitle(""); setDueOn(""); setOwnerName(""); },
            )}>
            <Ico.plus size={13} />Add
          </button>
        </div>
        {/* No date is a real answer and says so. A date invented to look
            organised is worse than none, because they measure you against it. */}
        <p className="t-2xs c-4">A date is optional. Without one it sits under “After that” on their page.</p>
      </div>
    </>
  );
}
