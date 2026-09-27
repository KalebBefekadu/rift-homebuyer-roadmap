import Link from "next/link";
import { notFound } from "next/navigation";
import { JOURNEY, ITEMS, TRANSACTIONS } from "@/lib/prototype/operations";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "search", label: "Search" },
  { id: "homes", label: "Homes and showings" },
  { id: "offers", label: "Offers and documents" },
  { id: "contract", label: "Contract" },
  { id: "history", label: "History" },
] as const;

/**
 * The journey workspace, as proposed (§8.6): a fixed header (name, stage,
 * status, next action, household) and tabs, instead of today's nine stacked
 * sections. The tabs hold what the long page holds today; the mock-up fills
 * Overview and Contract and says what the others would carry.
 */
export default async function Workspace({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const { tab = "overview" } = await searchParams;
  const j = JOURNEY[id];
  if (!j) notFound();
  const items = ITEMS.filter((i) => i.about.href.endsWith(`/journey/${id}`));
  const t = TRANSACTIONS.find((x) => x.id === id);

  return (
    <>
      <header className="card" style={{ padding: 14, position: "sticky", top: 0, zIndex: 5 }}>
        <div className="between wrap gap-2">
          <h1 className="ops-h1">{j.name}</h1>
          <span className="chip">{j.stage}</span>
        </div>
        <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 4 }}>{j.status} · Household: {j.household}</div>
        <div style={{ marginTop: 6 }}><strong>Next:</strong> {j.next}</div>
        <nav className="row gap-1 wrap" style={{ marginTop: 10 }} aria-label="Workspace">
          {TABS.map((x) => (
            <Link key={x.id} href={`?tab=${x.id}`} className="ops-link" aria-current={tab === x.id ? "page" : undefined} style={{ height: 28 }}>{x.label}</Link>
          ))}
        </nav>
      </header>

      <div style={{ marginTop: 12 }}>
        {tab === "overview" ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
            <section className="card" style={{ padding: 12 }}>
              <strong>Next actions and blockers</strong>
              <ul style={{ marginTop: 6 }}>{items.map((i) => <li key={i.id} style={{ padding: "5px 0", borderTop: "1px solid var(--line-3)" }}>{i.title} <span style={{ color: "var(--ink-4)" }}>· {i.due}</span></li>)}</ul>
            </section>
            <section className="card" style={{ padding: 12 }}>
              <strong>Key dates and recent activity</strong>
              <ul style={{ marginTop: 6 }}>{j.overview.map((o) => <li key={o} style={{ padding: "5px 0", borderTop: "1px solid var(--line-3)" }}>{o}</li>)}</ul>
            </section>
          </div>
        ) : tab === "contract" && t ? (
          <section className="card" style={{ padding: 12 }}>
            <strong>{t.property}</strong>
            <table className="ops-table" style={{ marginTop: 8 }}>
              <thead><tr><th>Workstream</th><th>Where it stands</th></tr></thead>
              <tbody>{t.work.map((w) => <tr key={w.name}><td>{w.name}</td><td>{w.state.replace("-", " ")}</td></tr>)}</tbody>
            </table>
          </section>
        ) : (
          <section className="card" style={{ padding: 12, color: "var(--ink-3)" }}>
            {tab === "search" ? "The search brief, what changed and who agrees, and the Matrix search record: today's sections, moved here unchanged."
              : tab === "homes" ? "Homes, reactions and showings: today's sections, moved here unchanged."
              : tab === "offers" ? "Offers, the household's instructions and documents: today's sections, moved here unchanged."
              : tab === "history" ? "Every recorded change on this journey, newest first, from the history tables that already exist."
              : "No contract yet on this journey."}
          </section>
        )}
      </div>
    </>
  );
}
