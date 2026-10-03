import type { ReactNode } from "react";
import { planSummary, type SavedPlan } from "@/lib/core/saved-plan";
import { ASKS, ASK_SHORT, answerLabel } from "@/lib/core/asks";
import { money } from "@/lib/core/compute";
import { siteUrl } from "@/lib/core/site";
import { showDay } from "@/lib/core/day";
import { BAND_LABEL, type Band } from "@/lib/core/lead";
import { Section, Notice } from "../../ui";
import type { Background } from "@/lib/db/lead-background";
import css from "./record.module.css";

const DAY = (iso: string) => showDay(iso, { month: "short", day: "numeric", year: "numeric" });

/**
 * What this person wants and can afford, from the two places it is recorded
 * (Blueprint v5 §5.5, v3 §46.7): what they told the funnel, and what they
 * saved. Both are shown as what they said, on the day they said it.
 *
 * Nothing here is generated. The funnel facts are the answers as stored; the
 * saved figures are the strings their browser showed them, and each link
 * reopens the value with their answers, recomputed today (rule 1). A figure is
 * labelled with whose it is: "you said" needs that they said it (rule 11), so
 * readiness, which the funnel worked out from their answers, is not worded as
 * a quote.
 *
 * Each source degrades alone. A failed read says it failed; it is never drawn
 * as "added by hand, nothing to show", which would tell the agent there is
 * nothing to ask about.
 */
export function Wants({ side, source, score, band, saved, background }: {
  side: "buy" | "sell";
  source: string;
  score: number | null;
  band: string | null;
  /** Undefined when the saved plan could not be read; null when there is none. */
  saved: { plan: SavedPlan; savedAt: string } | null | undefined;
  /** Null when the funnel answers could not be read. */
  background: Background | null;
}) {
  const origin = siteUrl();
  const funnel = background?.funnel ?? null;

  const funnelFacts: [ReactNode, ReactNode][] = funnel ? [
    ["Timing, in their words", funnel.timing || "Not answered"],
    [side === "sell" ? "Estimated sale price" : "Target price", funnel.value > 0 ? <span className="num">{money(funnel.value)}</span> : "Not given"],
    ["Ready to move", funnel.monthsToReady === 0 ? "Ready now" : funnel.monthsToReady === null ? "Unknown" : `About ${funnel.monthsToReady} month${funnel.monthsToReady === 1 ? "" : "s"} of saving first`],
    ["Second decision-maker", funnel.coBuyer ? "They named one" : "None named"],
  ] : [];

  const answers = saved ? Object.values(ASKS).filter((a) => saved.plan.answers[a.key] !== undefined) : [];
  const answerFacts: [ReactNode, ReactNode][] = answers.map((a) => [
    ASK_SHORT[a.key],
    a.type === "money" ? <span className="num">{answerLabel(a.key, saved!.plan.answers[a.key])}</span> : answerLabel(a.key, saved!.plan.answers[a.key]),
  ]);

  const nothing = !funnel && !saved && background !== null && saved !== undefined;

  return (
    <Section
      title="What they want and can afford"
      hint="Their own answers, as they gave them. Figures are as they were shown on the day; Open today recomputes them from the same answers."
      id="wants"
    >
      {background === null ? (
        <Notice tone="warn" title="What they told the funnel did not load">
          That is not the same as there being nothing: reload before assuming this is somebody to start from scratch with.
        </Notice>
      ) : null}
      {saved === undefined ? (
        <Notice tone="warn" title="Their saved plan did not load">Reload before telling them anything about their figures.</Notice>
      ) : null}

      {nothing ? (
        <div className="card p-4">
          <p className="t-sm c-3" style={{ lineHeight: 1.6 }}>
            {source === "funnel"
              ? "They arrived without a recorded set of answers and have not saved a plan."
              : "Added by hand, so there are no funnel answers or saved plan. What you learn goes in a note, and a journey holds their search brief."}
          </p>
        </div>
      ) : null}

      {funnel || saved ? (
        <div className="card p-4">
          {funnel ? (
            <>
              <div className="t-sm w6" style={{ marginBottom: 10 }}>What they told the funnel</div>
              <dl className={css.facts}>
                {funnelFacts.map(([k, v], i) => <div key={i}><dt>{k}</dt><dd>{v}</dd></div>)}
              </dl>
            </>
          ) : null}

          {saved ? (
            <div style={{ marginTop: funnel ? 18 : 0 }}>
              <div className="t-sm w6">{saved.plan.mode === "review" ? "Asked you to review their plan" : "Saved a plan"} · {DAY(saved.savedAt)}</div>
              <p className="t-sm c-2" style={{ marginTop: 4 }}>{planSummary(saved.plan)}.</p>
              {answerFacts.length ? (
                <dl className={css.facts} style={{ marginTop: 12 }}>
                  {answerFacts.map(([k, v], i) => <div key={i}><dt>{k}</dt><dd>{v}</dd></div>)}
                </dl>
              ) : null}
              {saved.plan.values.length ? (
                <div className={css.figs}>
                  {saved.plan.values.map((v) => (
                    <div key={v.tool} className={css.fig}>
                      <span>{v.label}</span>
                      <span className="row gap-3">
                        <span className="num">{v.figure}</span>
                        {origin ? (
                          <a href={`${origin}${v.href}`} target="_blank" rel="noopener noreferrer" className="t-xs u">Open today</a>
                        ) : <span className="t-xs c-4">No site address set</span>}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {score !== null && band ? (
            <details className={css.why} style={{ marginTop: 16 }}>
              <summary>Why they scored {score}{BAND_LABEL[band as Band] ? `: ${BAND_LABEL[band as Band]} when they arrived` : ""}</summary>
              {background?.signals.length ? (
                <ul>
                  {background.signals.map((s) => (
                    <li key={s.label}><span><span className="w6">{s.label}</span> <span className="c-4">{s.note}</span></span><span className="num">+{s.points}</span></li>
                  ))}
                </ul>
              ) : <p className="t-xs c-4" style={{ marginTop: 8 }}>The reasons were not kept for this record.</p>}
            </details>
          ) : null}
        </div>
      ) : null}
    </Section>
  );
}
