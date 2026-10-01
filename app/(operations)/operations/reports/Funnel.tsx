import { funnelReport } from "@/lib/db/events";
import { abandoned } from "@/lib/db/recovery";
import { valueById } from "@/lib/core/values";
import { diagnose } from "./diagnose";

/**
 * Where people stop, and who started without finishing. Moved from Today to
 * Reports (Blueprint v5 §8.8): both are about the funnel's shape over weeks,
 * not about what needs the agent this morning.
 */
export async function FunnelReports({ h2 }: { h2: React.CSSProperties }) {
  const [buy, sell, partial] = await Promise.all([funnelReport("buy"), funnelReport("sell"), abandoned()]);
  const rep = (r: typeof buy) => (r.ok && "data" in r ? r.data : null);
  const started = partial.ok && "data" in partial ? partial.data : null;
  const buyReport = rep(buy);

  return (
    <>
      <h2 className="serif" style={h2}>Where people stop</h2>
      <p className="t-sm c-3" style={{ marginTop: 6, maxWidth: 640, lineHeight: 1.6 }}>
        The last {buyReport?.days ?? 90} days, counted in distinct sessions rather than page views: a person who
        backs up and re-reads a question is one person. Bounded in time on purpose, so a changed question can be
        seen to help or not.
      </p>
      <Funnel label="Buyers" report={buyReport} failed={!buy.ok} />
      <Funnel label="Sellers" report={rep(sell)} failed={!sell.ok} />

      <h2 className="serif" style={h2}>Started, not finished</h2>
      <p className="t-sm c-3" style={{ marginTop: 6, maxWidth: 640, lineHeight: 1.6 }}>
        People who opened a value, or a retired assessment, and left without an answer or a saved plan. A normal state rather than a failure. Most of these people gave no way to reach them, which is correct: a
        resume link goes only to somebody who gave an address for that purpose.
      </p>
      {!partial.ok ? (
        <p className="t-sm c-neg" style={{ marginTop: 8 }}>This list did not load, which is not the same as it being empty.</p>
      ) : !started?.length ? (
        <p className="t-sm c-4" style={{ marginTop: 8 }}>Nobody in the last 30 days.</p>
      ) : (
        <div className="card" style={{ marginTop: 10, overflow: "hidden" }}>
          {started.slice(0, 20).map((a, i) => (
            <div key={`${a.sessionId}-${a.tool ?? a.assessmentId}`} className="between wrap gap-2" style={{ padding: "9px 12px", borderBottom: i === Math.min(started.length, 20) - 1 ? undefined : "1px solid var(--line-3)" }}>
              <div>
                <div className="row wrap gap-2">
                  <span className="t-sm w55">{a.email ?? "No contact details"}</span>
                  <span className="chip t-2xs">{a.side === "buy" ? "Buyer" : a.side === "sell" ? "Seller" : "Buyer abroad"}</span>
                  {a.tool ? <span className="chip t-2xs">{valueById(a.tool)?.name ?? a.tool}</span> : null}
                  {a.county ? <span className="chip t-2xs">{a.county}</span> : null}
                </div>
                <div className="t-xs c-4" style={{ marginTop: 3 }}>
                  {a.answered} question{a.answered === 1 ? "" : "s"} answered · quiet for {a.hoursSince}h
                </div>
              </div>
              {a.email ? <span className="chip chip-acc t-2xs">Can be sent a resume link</span> : <span className="chip t-2xs">Nothing to send</span>}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

interface FunnelStep { questionKey: string; reached: number; answered: number; medianSec: number; dropPct: number }

/**
 * One side of the drop-off report. Both sides are always shown, including
 * one with no traffic: a funnel absent from the page reads as "nothing is
 * wrong with it" rather than "nobody has been through it".
 */
function Funnel({ label, report, failed }: { label: string; report: { days: number; starts: number; steps: FunnelStep[] } | null; failed: boolean }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div className="t-sm w6 c-3">{label}</div>
      {failed ? (
        <p className="t-sm c-neg" style={{ marginTop: 6 }}>Did not load; unknown, not empty.</p>
      ) : !report || report.starts < 20 ? (
        <div className="card p-4" style={{ marginTop: 8, background: "var(--sunk)" }}>
          <p className="t-sm c-3" style={{ lineHeight: 1.6 }}>
            {report ? `${report.starts} assessment${report.starts === 1 ? "" : "s"} started.` : "No data yet."}{" "}
            Nothing is reported below twenty, because a drop-off computed from four people is noise wearing a percentage sign.
          </p>
        </div>
      ) : (
        <div className="card" style={{ marginTop: 8, overflow: "hidden" }}>
          {report.steps.map((s, i) => {
            const d = diagnose(s);
            return (
              <div key={s.questionKey} className="between wrap gap-2" style={{ padding: "9px 12px", borderBottom: i === report.steps.length - 1 ? undefined : "1px solid var(--line-3)" }}>
                <div>
                  <span className="t-sm w55">{s.questionKey}</span>
                  <div className="t-xs c-4" style={{ marginTop: 2 }}>{s.reached} reached · {s.answered} answered · {s.medianSec}s median</div>
                  {d ? <p className="t-xs c-3" style={{ marginTop: 4, maxWidth: 460, lineHeight: 1.5 }}>{d.advice}</p> : null}
                </div>
                <div className="row gap-2">
                  <span className="num t-sm">{s.dropPct}%</span>
                  {d ? <span className={`chip ${d.tone}`}>{d.label}</span> : <span className="chip chip-pos">Healthy</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
