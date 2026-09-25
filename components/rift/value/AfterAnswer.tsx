"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Ico } from "@/components/rift/icons";
import { track } from "@/lib/rift/track";
import { readAnswers, answeredKeys } from "@/lib/rift/answers";
import { rememberValue, readPlan, type PlanEntry } from "@/lib/rift/plan";
import { missingPhrase, nextValues, valueById } from "@/lib/core/values";
import type { Answers } from "@/lib/core/asks";
import { SavePlan } from "./SavePlan";
import { ForgetMe } from "@/components/rift/Forget";

/**
 * Everything after a value's answer (Blueprint v5 §5.1, §5.5, D14).
 *
 * Free, with no details asked: the next values, each saying how many more
 * questions it needs given what is already answered, and a share link.
 * Asks for details: keeping the plan, and asking Kaleb to look at it. The
 * answer above is never cut short to push anyone into the form.
 */
export function AfterAnswer({ tool, entry, answers }: {
  tool: string;
  /** What this value adds to the plan taking shape. */
  entry: Omit<PlanEntry, "at">;
  answers: Answers;
}) {
  const def = valueById(tool)!;
  const [known, setKnown] = useState(() => answeredKeys(answers));
  const [plan, setPlan] = useState<PlanEntry[]>([]);
  const [saving, setSaving] = useState<null | "save" | "review">(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    /* Only a person who answered here gets this added to their plan. A shared
       link opened by somebody else must not drop a stranger's figures into
       their device's plan: the same rule as the answers store. */
    const mine = readAnswers();
    const fromThisDevice = def.asks.every((k) => mine[k] === undefined || String(mine[k]) === String(answers[k]));
    setKnown(answeredKeys({ ...mine, ...answers }));
    setPlan(fromThisDevice ? rememberValue({ ...entry }) : readPlan());
    track({ name: "value_answer", side: def.side === "abroad" ? undefined : def.side, meta: { tool } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const next = nextValues(tool, known);

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) { await navigator.share({ url, title: def.question }); }
      else { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2400); }
      track({ name: "share_sent", side: def.side === "abroad" ? undefined : def.side, meta: { tool } });
    } catch { /* cancelled */ }
  };

  return (
    <>
      {next.length ? (
        <section className="sec" aria-labelledby="next-h">
          <h2 id="next-h" className="serif d3">You can also find out</h2>
          <div className="trio mt-4">
            {next.map(({ value: v, missing }) => (
              <Link key={v.id} href={v.href} className="card p-5 lift value-card">
                <div className="kicker c-brand">{v.name}</div>
                <div className="t-lg w6 serif" style={{ letterSpacing: "-0.015em" }}>{v.question}</div>
                <p className="t-sm c-3 grow" style={{ lineHeight: 1.55 }}>{v.gives}</p>
                <div className="between">
                  <span className="t-xs c-4">{missingPhrase(missing)}</span>
                  <span className="row gap-1 t-sm w6 c-brand">{v.cta}<Ico.arrowR size={14} /></span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="sec" aria-labelledby="keep-h">
        <div className="card p-6 between wrap gap-4" style={{ background: "var(--ink)", borderColor: "var(--ink)", color: "#fff" }}>
          <div style={{ maxWidth: 520 }}>
            <h2 id="keep-h" className="serif d3" style={{ color: "#fff" }}>Keep your plan</h2>
            <p style={{ marginTop: 10, color: "rgba(255,255,255,.72)", fontSize: 15, lineHeight: 1.6 }}>
              {plan.length > 1
                ? `Your ${plan.length} answers so far, saved together so you can reopen them on any device.`
                : "Save this answer and the ones you find next, so you can reopen them on any device."}
              {" "}Kaleb can also look over your numbers and tell you what he would do.
            </p>
            {plan.length > 1 ? (
              <ul className="row wrap gap-1" style={{ marginTop: 14 }}>
                {plan.map((p) => (
                  <li key={p.tool} style={{ fontSize: 12, padding: "4px 9px", borderRadius: 6, background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.16)" }}>
                    {p.label}: <strong>{p.figure}</strong>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <div className="col gap-2" style={{ minWidth: 240 }}>
            <button className="btn btn-lg" style={{ background: "#fff", color: "var(--ink)" }} onClick={() => setSaving("save")}>
              Save my plan <Ico.arrowR size={15} />
            </button>
            <button className="btn" style={{ background: "transparent", color: "#fff", border: "1px solid rgba(255,255,255,.26)" }} onClick={() => setSaving("review")}>
              Ask Kaleb to review my numbers
            </button>
            <button className="btn btn-sm" style={{ background: "transparent", color: "rgba(255,255,255,.72)" }} onClick={share}>
              <Ico.share size={13} />{copied ? "Link copied" : "Share this answer"}
            </button>
          </div>
        </div>
      </section>

      {/* "Delete all of it", at the bottom of every answer as /privacy says.
          It resets this device's answers too (LEAD-06). */}
      <section className="sec-sm" aria-label="Delete your answers">
        <ForgetMe side={def.side === "sell" ? "sell" : def.side === "buy" ? "buy" : undefined} />
      </section>

      {saving ? (
        <SavePlan
          side={def.side}
          mode={saving}
          plan={plan}
          onClose={() => setSaving(null)}
        />
      ) : null}
    </>
  );
}
