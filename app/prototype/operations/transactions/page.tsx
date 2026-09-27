import Link from "next/link";
import { TRANSACTIONS, type Workstream } from "@/lib/prototype/operations";

const MARK: Record<Workstream["state"], { sym: string; word: string; color: string }> = {
  done: { sym: "✓", word: "Done", color: "var(--pos, #1f7a4d)" },
  active: { sym: "●", word: "In progress", color: "var(--brand, #b5532e)" },
  waiting: { sym: "◷", word: "Waiting on someone", color: "var(--warn, #9a6b00)" },
  blocked: { sym: "✕", word: "Blocked", color: "var(--neg, #b3261e)" },
  "not-started": { sym: "○", word: "Not started", color: "var(--ink-4)" },
};

/**
 * Transactions, new (§8.7): every contract in one table, the ten
 * workstreams at a glance (a symbol and a word each, never colour alone),
 * anything blocked or unconfirmed, and straight into the journey's Contract
 * tab.
 */
export default function Transactions() {
  return (
    <>
      <h1 className="ops-h1">Transactions</h1>
      <table className="ops-table" style={{ marginTop: 12 }}>
        <thead><tr><th>Property</th><th>Client</th><th>Stage</th><th>Next deadline</th><th>Workstreams</th><th>Blocked or unconfirmed</th></tr></thead>
        <tbody>
          {TRANSACTIONS.map((t) => (
            <tr key={t.id}>
              <td><Link className="u" href={`/prototype/operations/journey/${t.id}?tab=contract`} style={{ fontWeight: 600 }}>{t.property}</Link></td>
              <td>{t.client}</td><td>{t.stage}</td>
              <td><span className="chip t-2xs chip-neg">{t.nextDeadline}</span></td>
              <td>
                <div className="row gap-1 wrap" style={{ maxWidth: 260 }}>
                  {t.work.map((w) => (
                    <span key={w.name} title={`${w.name}: ${MARK[w.state].word}`} aria-label={`${w.name}: ${MARK[w.state].word}`}
                      style={{ fontSize: 11.5, border: "1px solid var(--line-2)", borderRadius: 4, padding: "0 5px", color: MARK[w.state].color }}>
                      {MARK[w.state].sym} {w.name}
                    </span>
                  ))}
                </div>
              </td>
              <td style={{ color: "var(--ink-3)" }}>{t.blocked}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ fontSize: 12, color: "var(--ink-4)", marginTop: 10 }}>
        {Object.values(MARK).map((m) => `${m.sym} ${m.word}`).join(" · ")}
      </p>
    </>
  );
}
