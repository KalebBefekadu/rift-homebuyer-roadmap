import Link from "next/link";
import { dealsSummary, type DealRow } from "@/lib/core/transactions";
import { WORK_STATE_LABEL, type WorkState } from "@/lib/core/progress";
import { Ico } from "@/components/rift/icons";

/* Rule 10: every state has an icon and a word; the word is in the title and
   for screen readers, and in the key under the table. */
const ICON: Record<WorkState, keyof typeof Ico> = {
  "not-started": "minus", "in-progress": "clock", waiting: "pause", blocked: "alert",
  reported: "info", confirmed: "checkCircle", "not-applicable": "x",
};
const TONE: Record<WorkState, string> = {
  "not-started": "c-4", "in-progress": "c-2", waiting: "c-warn", blocked: "c-neg",
  reported: "c-warn", confirmed: "c-pos", "not-applicable": "c-4",
};
const IN = (days: number | null) =>
  days === null ? "" : days === 0 ? "today" : days === 1 ? "tomorrow" : days > 0 ? `in ${days} days` : days === -1 ? "yesterday" : `${-days} days ago`;

/** The deals, one row each, and the key to the workstream icons. */
export function DealsTable({ deals }: { deals: DealRow[] }) {
  return (
    <>
      <p className="t-sm w6" style={{ marginTop: 18 }}>{dealsSummary(deals)}</p>
      <div className="ops-table-wrap" style={{ marginTop: 10 }}>
        <table className="ops-table ops-table-cards opsx-people opsx-deals">
          <caption className="sr-only">{deals.length} open contracts. Each row opens its journey.</caption>
          <thead>
            <tr>
              <th scope="col">Home</th>
              <th scope="col">Closing</th>
              <th scope="col">Next date</th>
              <th scope="col">Workstreams</th>
              <th scope="col">Needs a look</th>
            </tr>
          </thead>
          <tbody>
            {deals.map((d) => (
              <tr key={`${d.journeyId}:${d.contractedAt}`}>
                <td>
                  <Link href={`/operations/journey/${d.journeyId}`} className="ops-rowlink opsx-rowlink">{d.address}</Link>
                  <span className="ops-sub">{d.person} · {d.financing === "cash" ? "Cash" : "Financed"}</span>
                </td>
                <td data-label="Closing">
                  {d.closing ? (
                    <>
                      <span className={d.closing.days !== null && d.closing.days <= 7 ? "w6" : ""}>{d.closing.when}</span>
                      <span className="ops-sub">{IN(d.closing.days)}{d.closing.verified ? "" : ", not checked"}</span>
                    </>
                  ) : <span className="c-4">Not recorded</span>}
                </td>
                <td data-label="Next date" className={d.next?.missed ? "c-neg" : ""}>
                  {d.next ? (
                    <>
                      <span className="opsx-inl">{d.next.missed ? <Ico.alert size={10} aria-hidden /> : null}{d.next.label}</span>
                      <span className="ops-sub">{d.next.when}, {IN(d.next.days)}</span>
                    </>
                  ) : <span className="c-4">None recorded</span>}
                </td>
                <td data-label="Workstreams">
                  <span className="opsx-strip" aria-hidden>
                    {d.work.map((w) => {
                      const I = Ico[ICON[w.state]];
                      return <span key={w.workstream} className={TONE[w.state]} title={`${w.label}: ${WORK_STATE_LABEL[w.state]}`}><I size={13} /></span>;
                    })}
                  </span>
                  <span className="sr-only">{d.work.map((w) => `${w.label}: ${WORK_STATE_LABEL[w.state]}`).join("; ")}</span>
                  <span className="ops-sub">{d.confirmed} of {d.applicable} confirmed</span>
                </td>
                <td data-label="Needs a look">
                  {d.flags.length ? (
                    <span className="ops-flags">
                      {d.flags.slice(0, 3).map((f) => (
                        <span key={f.text} className={`opsx-inl ${f.tone === "neg" ? "c-neg" : "c-warn"}`}>
                          <Ico.alert size={10} aria-hidden />{f.text}
                        </span>
                      ))}
                      {d.flags.length > 3 ? <span className="c-3">and {d.flags.length - 3} more on the journey</span> : null}
                    </span>
                  ) : <span className="c-3">Nothing flagged</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="row gap-3 wrap t-xs" style={{ marginTop: 10 }}>
        {(["confirmed", "in-progress", "waiting", "reported", "blocked", "not-started", "not-applicable"] as WorkState[]).map((s) => {
          const I = Ico[ICON[s]];
          return <span key={s} className={`row gap-1 ${TONE[s]}`}><I size={11} aria-hidden /> {WORK_STATE_LABEL[s]}</span>;
        })}
      </p>
      <p className="t-xs c-4" style={{ marginTop: 6 }}>
        &quot;Nothing flagged&quot; means nobody has reported a problem and no date has passed, not that there is none.
      </p>
    </>
  );
}
