import Link from "next/link";
import { readLead } from "@/lib/db/clients";
import { journeysFor } from "@/lib/db/journeys";
import { SIDE_LABEL } from "@/lib/core/journey";
import { BAND_LABEL, type Band } from "@/lib/core/lead";
import { showDay } from "@/lib/core/day";

const DAY = (iso: string) => showDay(iso, { month: "short", day: "numeric", year: "numeric" });

/**
 * One person beside the list (Blueprint v5 §8.5), so the agent keeps his
 * place: who they are, what is owed next, their journeys and the latest
 * notes. The full record is one click further.
 */
export async function Panel({ id, closeHref }: { id: string; closeHref: string }) {
  const [lead, journeys] = await Promise.all([readLead(id), journeysFor(id)]);
  if (!lead.ok) return <aside className="card p-4 ops-panel" aria-label="Person"><p className="t-sm c-neg">This record did not load ({lead.error}).</p></aside>;
  const rec = "data" in lead ? lead.data : null;
  if (!rec) return <aside className="card p-4 ops-panel" aria-label="Person"><p className="t-sm c-3">Not found. It may have been deleted.</p><Link className="u t-sm" href={closeHref}>Close</Link></aside>;
  const p = rec.lead;
  const js = journeys.ok && "data" in journeys ? journeys.data : null;
  const name = p.name?.trim() || p.email || "Someone who left no name";

  return (
    <aside className="card p-4 ops-panel" aria-labelledby="panel-name">
      <div className="between gap-2">
        <h2 id="panel-name" className="t-md w6 trunc">{name}</h2>
        <Link href={closeHref} className="btn btn-g btn-sm" aria-label="Close the panel">Close</Link>
      </div>
      <div className="row gap-2 wrap" style={{ marginTop: 6 }}>
        <span className="chip t-2xs">{p.side === "buy" ? "Buying" : "Selling"}</span>
        <span className="chip t-2xs">{p.stage ?? "Not picked up"}</span>
        {p.band ? <span className="chip t-2xs">{BAND_LABEL[p.band as Band] ?? p.band}</span> : null}
        {p.archivedAt ? <span className="chip t-2xs">Archived</span> : null}
      </div>
      <dl className="t-sm" style={{ marginTop: 10, display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 12px" }}>
        {p.email ? <><dt className="c-4">Email</dt><dd className="trunc">{p.email}</dd></> : null}
        {p.phone ? <><dt className="c-4">Phone</dt><dd>{p.phone}</dd></> : null}
        <dt className="c-4">Arrived</dt><dd>{DAY(p.createdAt)} · {p.source}</dd>
        <dt className="c-4">Next</dt><dd>{p.nextAction ? `${p.nextAction}${p.nextDue ? `, ${p.nextDue}` : ""}` : <span className="c-4">Nothing set</span>}</dd>
      </dl>

      <h3 className="t-sm w6" style={{ marginTop: 14 }}>Journeys</h3>
      {js === null ? <p className="t-xs c-neg">Did not load.</p>
        : js.length ? <ul className="t-sm" style={{ marginTop: 4 }}>{js.map((j) => <li key={j.id}><Link className="u" href={`/operations/journey/${j.id}`}>{j.label}</Link> <span className="c-4 t-xs">{SIDE_LABEL[j.side]}</span></li>)}</ul>
        : <p className="t-xs c-4">None yet. Start one from the full record.</p>}

      <h3 className="t-sm w6" style={{ marginTop: 14 }}>Latest notes</h3>
      {rec.notes.length ? (
        <ul style={{ marginTop: 4 }}>
          {[...rec.notes].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 5).map((n) => (
            <li key={n.id} className="desk-row t-xs"><span className="c-4">{DAY(n.at)} · {n.kind}</span><div className="c-2" style={{ marginTop: 2 }}>{n.body}</div></li>
          ))}
        </ul>
      ) : <p className="t-xs c-4">Nothing logged.</p>}

      <Link href={`/operations/lead/${p.id}`} className="btn btn-p btn-sm" style={{ marginTop: 14 }}>Open the full record</Link>
    </aside>
  );
}
