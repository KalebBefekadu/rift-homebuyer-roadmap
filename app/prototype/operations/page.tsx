import Link from "next/link";
import { ITEMS, ACTIVITY, NEW_LEADS, GROUP_LABEL, GROUP_QUESTION, type Group } from "@/lib/prototype/operations";
import { ItemRow } from "./ItemRow";

const ORDER: Group[] = ["attention", "approval", "today", "waiting", "upcoming"];

/**
 * Today, as proposed (Blueprint v5 §8.4). The seven questions in §8.2 are
 * answered here without scrolling at 1280px: five groups in two columns,
 * new leads first with the 15-minute target (D07a), and a strip of what
 * changed and what Rift did on its own.
 */
export default function OpsToday() {
  return (
    <>
      <div className="between wrap gap-2">
        <h1 className="ops-h1">Today</h1>
        <span style={{ fontSize: 12.5, color: "var(--ink-4)" }}>Saturday 27 September · Georgia time</span>
      </div>

      <section className="card" style={{ padding: "8px 12px", marginTop: 10 }} aria-label="New leads">
        <div className="between"><strong>New leads</strong><span style={{ fontSize: 12, color: "var(--ink-4)" }}>Target: a first reply within 15 minutes</span></div>
        <ul>
          {NEW_LEADS.map((l) => (
            <li key={l.id} className="between gap-2 wrap" style={{ padding: "4px 0", borderTop: "1px solid var(--line-3)" }}>
              <span><Link className="u" href={`/prototype/operations/relationships?open=${l.id}`} style={{ fontWeight: 600 }}>{l.name}</Link> <span style={{ color: "var(--ink-3)" }}>{l.summary}</span></span>
              <span className={`chip t-2xs ${l.minutes !== null && l.minutes < 15 ? "chip-warn" : "chip-out"}`}>{l.minutes !== null ? `${l.minutes} min, reply now` : `Arrived ${l.arrived}`}</span>
            </li>
          ))}
        </ul>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 10, marginTop: 10 }}>
        {ORDER.map((g) => {
          const items = ITEMS.filter((i) => i.group === g);
          return (
            <section key={g} className="card" style={{ padding: "8px 12px" }} aria-labelledby={`g-${g}`}>
              <h2 id={`g-${g}`} style={{ fontSize: 13.5, fontWeight: 650 }} title={GROUP_QUESTION[g]}>
                {GROUP_LABEL[g]} <span style={{ color: "var(--ink-4)", fontWeight: 500 }}>{items.length}</span>
              </h2>
              <ul>{items.map((i) => <ItemRow key={i.id} item={i} />)}</ul>
              {!items.length ? <p style={{ color: "var(--ink-4)", padding: "6px 0" }}>Nothing.</p> : null}
            </section>
          );
        })}
        <section className="card" style={{ padding: "8px 12px" }} aria-labelledby="g-activity">
          <h2 id="g-activity" style={{ fontSize: 13.5, fontWeight: 650 }} title="Which leads or clients changed? What did Rift do on its own?">Recent activity</h2>
          <ul>
            {ACTIVITY.map((a) => (
              <li key={a.text} style={{ padding: "5px 0", borderBottom: "1px solid var(--line-3)", fontSize: 12.5 }}>
                <span style={{ color: "var(--ink-4)" }}>{a.at}</span> <Link className="u" href={a.href}>{a.text}</Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
