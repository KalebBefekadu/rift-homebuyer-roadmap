import {
  forecast,
  weightFor,
  evidenceMix,
  commissionOn,
  outcomesFrom,
  BASIS_CHIP,
  type Finished,
} from "@/lib/core/pipeline";
import { money } from "@/lib/core/compute";
import type { Live } from "@/lib/db/clients";

/**
 * What is likely to close, and how much of that is evidence.
 *
 * This module existed in `lib/core/pipeline.ts`, fully written and tested, and
 * was rendered by nothing outside the prototype. The parity audit in
 * docs/benchmark.md scored it as shipping. It was not.
 *
 * Two rules it must keep, both of which the prototype version could break:
 *
 *   The history is HIS. `weightFor` no longer has a default argument, so there
 *   is no path by which the seeded fixture reaches this screen. An agent with
 *   no closed deals sees "Assumed" on every stage, which is the true statement.
 *
 *   A dollar figure needs a priced deal. `valueKnown` separates "worth nothing"
 *   from "nobody has said", because summed together they render identically.
 */
export function Forward({
  live,
  finished,
  commissionPct,
  commissionDecided,
  months = 4,
  now = new Date(),
}: {
  live: Live[];
  finished: Finished[];
  commissionPct: number;
  /** False when that percentage is still our default rather than his decision. */
  commissionDecided: boolean;
  months?: number;
  now?: Date;
}) {
  const history = outcomesFrom(finished);
  const rows = live.map((l) => ({ name: l.name, stage: l.stage, value: l.value }));
  const buckets = forecast(rows, now, months, history);

  const stages = [...new Set(rows.map((r) => r.stage))];
  const mix = evidenceMix(stages, history);
  const totalWeighted = buckets.reduce((a, b) => a + b.weightedValue, 0);
  const inWindow = buckets.reduce((a, b) => a + b.count, 0);

  /* Named separately because they are two different conversations. Somebody
     outside the window is not missing from the forecast by mistake — a lead in
     Exploring is 210 days from closing and genuinely does not belong in a
     four-month view. Somebody unpriced is missing from the MONEY only. */
  const unpriced = live.filter((l) => !l.valueKnown).length;
  const outside = live.length - inWindow;

  if (!live.length) {
    return (
      <div className="card p-5" style={{ marginBottom: 14 }}>
        <div className="t-sm w6">Nothing to forecast yet</div>
        <p className="t-xs c-4" style={{ marginTop: 6, lineHeight: 1.55, maxWidth: 520 }}>
          This fills in as people are given a stage. It is a weighted view — what the
          stages historically produce, not a list of everyone you hope will close.
        </p>
      </div>
    );
  }

  return (
    <div className="card" style={{ marginBottom: 14, overflow: "hidden" }}>
      <div className="between wrap gap-2" style={{ padding: "12px 16px", borderBottom: "1px solid var(--line-2)" }}>
        <span className="t-sm w6">Likely to close</span>
        <span className="t-xs c-4">
          Weighted by stage ·{" "}
          <span title={commissionDecided ? undefined : "Still the default. Set it in Settings."}>
            {commissionPct}% commission{commissionDecided ? "" : " (assumed)"}
          </span>{" "}
          ·{" "}
          {totalWeighted
            ? `${money(Math.round(commissionOn(totalWeighted, commissionPct)))} expected over ${months} months`
            : "no priced deals in the window"}
        </span>
      </div>

      <div className="row wrap" style={{ alignItems: "stretch" }}>
        {buckets.map((b, i) => (
          <div
            key={b.month}
            className="grow"
            style={{ padding: "14px 16px", borderLeft: i ? "1px solid var(--line-3)" : undefined, minWidth: 150 }}
          >
            <div className="t-2xs c-4 w6" style={{ letterSpacing: ".07em", textTransform: "uppercase" }}>
              {b.month}
            </div>
            <div className="row gap-2" style={{ alignItems: "baseline", marginTop: 5 }}>
              <span className="num" style={{ fontSize: 21 }}>{b.expected}</span>
              <span className="t-xs c-4">of {b.count}</span>
            </div>
            <div className="t-xs c-3" style={{ marginTop: 3 }}>
              {b.weightedValue ? money(Math.round(commissionOn(b.weightedValue, commissionPct))) : "—"}
            </div>
            <div className="t-2xs c-4 trunc" style={{ marginTop: 4 }}>
              {b.names.length ? b.names.join(", ") : "Nothing expected"}
            </div>
            {/* No chip on an empty month. A bucket with nothing in it has no
                basis to report, and "Assumed" over a blank column reads as a
                claim about people who are not there. */}
            {b.count ? (
              <span className={`chip ${BASIS_CHIP[b.basis].c}`} style={{ marginTop: 6 }}>
                {BASIS_CHIP[b.basis].l}
              </span>
            ) : null}
          </div>
        ))}
      </div>

      <div style={{ padding: "10px 16px", background: "var(--sunk)" }}>
        <p className="t-xs c-4" style={{ lineHeight: 1.55 }}>
          &ldquo;{buckets[0].expected} of {buckets[0].count}&rdquo; means the stages those
          relationships are in historically produce that many closings. It is deliberately
          lower than the headcount, and a forecast that matches the headcount is not a forecast.
        </p>

        <p className="t-xs c-4" style={{ marginTop: 6, lineHeight: 1.55 }}>
          {mix.observed === 0 && mix.blended === 0 ? (
            <>
              <span className="w6">Every stage here is still an assumption.</span> These odds are
              starting figures, not your record — a stage needs twelve of your own closed or lost
              outcomes before it stops borrowing ours. That is deliberate: forecasting from three
              closings is how a solo agent comes to believe a stage converts at 100%.
            </>
          ) : (
            <>
              These odds shrink toward your own closed history and are labelled with what is
              behind them —
              <span className="w6">
                {" "}{mix.observed} from your history, {mix.blended} part-observed,{" "}
                {mix.assumed} still assumed
              </span>
              . A stage needs twelve of your own outcomes before it stops borrowing ours.
            </>
          )}
        </p>

        {(unpriced > 0 || outside > 0) && (
          <p className="t-xs c-4" style={{ marginTop: 6, lineHeight: 1.55 }}>
            {outside > 0 && (
              <>
                {outside} {outside === 1 ? "person is" : "people are"} further out than{" "}
                {months} months and {outside === 1 ? "is" : "are"} not counted above.
              </>
            )}
            {outside > 0 && unpriced > 0 ? " " : ""}
            {unpriced > 0 && (
              <>
                {unpriced} {unpriced === 1 ? "has" : "have"} no price on record, so{" "}
                {unpriced === 1 ? "it counts" : "they count"} toward the number expected and
                not toward the money.
              </>
            )}
          </p>
        )}

        <div className="row wrap gap-2" style={{ marginTop: 8 }}>
          {stages.map((st) => {
            const w = weightFor(st, history);
            return (
              <span key={st} className={`chip ${BASIS_CHIP[w.basis].c}`} title={w.note}>
                {st} · {Math.round(w.weight * 100)}%
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
