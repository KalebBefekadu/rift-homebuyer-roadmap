import { funnelReport } from "@/lib/db/events";
import { abandoned } from "@/lib/db/recovery";
import { BUY_FUNNEL, SELL_FUNNEL } from "@/lib/core/funnel";
import { Notice, Empty, Section } from "../ui";
import { Tag, type TagTone } from "../_business/Tag";
import k from "../_business/kit.module.css";
import s from "./reports.module.css";
import { diagnose } from "./diagnose";

/**
 * A question's key as a person reads it. The events carry the key, never the
 * answer (rule 6), so the report names the question from the funnel's own
 * words where it can and says the key plainly where it cannot, rather than
 * printing "downPct".
 */
const KNOWN: Record<string, string> = {
  county: "Which county", credit: "Credit", downPct: "Down payment", household: "Household size", income: "Household income",
  price: "Home price", savings: "Savings", payoff: "Mortgage payoff", owned: "Owned before", timing: "Timing", who: "Who is asking",
  ownership: "Owned a home before", rate: "Interest rate",
};
function questionLabel(key: string): string {
  const fromFunnel = [...BUY_FUNNEL.questions, ...SELL_FUNNEL.questions].find((q) => q.id === key)?.title;
  return KNOWN[key] ?? fromFunnel ?? key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
}

const DIAG_TONE: Record<string, TagTone> = { "chip-neg": "neg", "chip-warn": "warn" };

/**
 * Where people stop, and who started without finishing. Moved from Today to
 * Reports (Blueprint v5 §8.8): both are about the funnel's shape over weeks,
 * not about what needs the agent this morning.
 */
export async function FunnelReports() {
  const [buy, sell, partial] = await Promise.all([funnelReport("buy"), funnelReport("sell"), abandoned()]);
  const rep = (r: typeof buy) => (r.ok && "data" in r ? r.data : null);
  const started = partial.ok && "data" in partial ? partial.data : null;
  const buyReport = rep(buy);

  return (
    <>
      <Section
        title="Where people stop"
        hint={`The last ${buyReport?.days ?? 90} days, counted in distinct sessions rather than page views: a person who backs up and re-reads a question is one person. Bounded in time on purpose, so a changed question can be seen to help or not.`}
      >
        <div className={s.cols}>
          <Side label="Buyers" report={buyReport} failed={!buy.ok} error={!buy.ok ? buy.error : null} />
          <Side label="Sellers" report={rep(sell)} failed={!sell.ok} error={!sell.ok ? sell.error : null} />
        </div>
      </Section>

      <Section
        title="Started, not finished"
        hint="Last 30 days. A normal state rather than a failure. Most of these people gave no way to reach them, which is correct: a resume link goes only to somebody who gave an address for that purpose."
      >
        {!partial.ok ? (
          <Notice tone="neg" title="This list did not load">That is not the same as it being empty.</Notice>
        ) : !started?.length ? (
          <Empty title="Nobody in the last 30 days">Someone appears here when they start and go quiet for two hours.</Empty>
        ) : (
          <div className={k.list}>
            {started.slice(0, 20).map((a) => (
              <div key={a.assessmentId} className={k.row}>
                <div className={k.rowMain}>
                  <div className={k.rowTitle}>
                    {a.email ?? "No contact details"}
                    <Tag>{a.side === "buy" ? "Buyer" : "Seller"}</Tag>
                    {a.county ? <Tag>{a.county}</Tag> : null}
                  </div>
                  <div className={k.rowSub}>{a.answered} question{a.answered === 1 ? "" : "s"} answered, quiet for {a.hoursSince < 48 ? `${a.hoursSince} hours` : `${Math.floor(a.hoursSince / 24)} days`}</div>
                </div>
                <div className={k.rowSide}>
                  {a.email ? <Tag tone="acc">Can be sent a resume link</Tag> : <Tag>Nothing to send</Tag>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </>
  );
}

interface FunnelStep { questionKey: string; reached: number; answered: number; medianSec: number; dropPct: number }

/**
 * One side of the drop-off report. Both sides are always shown, including
 * one with no traffic: a funnel absent from the page reads as "nothing is
 * wrong with it" rather than "nobody has been through it".
 */
function Side({ label, report, failed, error }: { label: string; report: { days: number; starts: number; steps: FunnelStep[] } | null; failed: boolean; error: string | null }) {
  return (
    <div>
      <div className={s.sub} style={{ marginTop: 0, marginBottom: 8 }}>{label}</div>
      {failed ? (
        <Notice tone="neg" title="Did not load">{error}. Unknown, not empty.</Notice>
      ) : !report || report.starts < 20 ? (
        <Empty title={report ? `${report.starts} ${report.starts === 1 ? "assessment" : "assessments"} started` : "No data yet"}>
          Nothing is reported below twenty, because a drop-off computed from four people is noise wearing a percentage sign.
        </Empty>
      ) : (
        <div className={k.list}>
          {report.steps.map((st) => {
            const d = diagnose(st);
            return (
              <div key={st.questionKey} className={s.step}>
                <div>
                  <div className={s.stepKey}>{questionLabel(st.questionKey)}</div>
                  <div className={s.stepMeta}>{st.reached} reached, {st.answered} answered, {st.medianSec}s median</div>
                  {d ? <p className={s.stepAdvice}>{d.advice}</p> : null}
                </div>
                <div className={s.stepSide}>
                  <span className={s.drop}>{st.dropPct}% stop</span>
                  {d ? <Tag tone={DIAG_TONE[d.tone] ?? "warn"}>{d.label}</Tag> : <Tag tone="pos">Healthy</Tag>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
