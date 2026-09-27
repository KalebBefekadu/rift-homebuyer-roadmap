"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { PEOPLE, type Person } from "@/lib/prototype/operations";

type Sort = "due" | "name" | "lastContact";
const KEY = "rift.ops.relationships.filters";

/**
 * Relationships, as proposed (§8.5): search, filters that persist, sort,
 * and a detail panel beside the list, so opening a person keeps the list and
 * its position. The full journey workspace is one click further.
 */
export function Table() {
  const params = useSearchParams();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [side, setSide] = useState<"all" | Person["side"]>("all");
  const [sort, setSort] = useState<Sort>("due");
  const open = params.get("open");

  /* Filters persist on this device, like a desk left as it was. */
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(KEY) ?? "{}");
      if (saved.side) setSide(saved.side);
      if (saved.sort) setSort(saved.sort);
    } catch { /* storage unavailable */ }
  }, []);
  useEffect(() => {
    try { window.localStorage.setItem(KEY, JSON.stringify({ side, sort })); } catch { /* ignore */ }
  }, [side, sort]);

  const rows = useMemo(() => {
    const order: Record<string, number> = { Now: 0, Today: 1, Tomorrow: 2, Friday: 3 };
    return PEOPLE.filter((p) => (side === "all" || p.side === side) && p.name.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => sort === "name" ? a.name.localeCompare(b.name) : sort === "lastContact" ? a.lastContact.localeCompare(b.lastContact) : (order[a.due] ?? 9) - (order[b.due] ?? 9));
  }, [q, side, sort]);
  const person = PEOPLE.find((p) => p.id === open) ?? null;
  const show = (id: string | null) => router.replace(id ? `?open=${id}` : "?", { scroll: false });

  return (
    <div style={{ display: "grid", gridTemplateColumns: person ? "minmax(0,1fr) 340px" : "1fr", gap: 12, marginTop: 12 }}>
      <div>
        <div className="row gap-2 wrap">
          <input className="input" style={{ maxWidth: 240, height: 32 }} placeholder="Search by name" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="select" style={{ height: 32, width: "auto" }} value={side} onChange={(e) => setSide(e.target.value as typeof side)} aria-label="Side">
            <option value="all">Buyers and sellers</option><option value="Buyer">Buyers</option><option value="Seller">Sellers</option>
          </select>
          <select className="select" style={{ height: 32, width: "auto" }} value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort">
            <option value="due">Next action due</option><option value="name">Name</option><option value="lastContact">Last contact</option>
          </select>
        </div>
        <table className="ops-table" style={{ marginTop: 10 }}>
          <thead><tr><th>Name</th><th>Side</th><th>Stage</th><th>Next action</th><th>Due</th><th>Last contact</th><th>Source</th></tr></thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="ops-row" onClick={() => show(p.id)} aria-selected={p.id === open} style={p.id === open ? { background: "var(--sunk)" } : undefined}>
                <td style={{ fontWeight: 600 }}>{p.name}</td><td>{p.side}</td><td>{p.stage}</td><td>{p.next}</td>
                <td><span className={`chip t-2xs ${p.due === "Now" || p.due === "Today" ? "chip-warn" : "chip-out"}`}>{p.due}</span></td>
                <td>{p.lastContact}</td><td style={{ color: "var(--ink-3)" }}>{p.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {person ? (
        <aside className="card" style={{ padding: 14, alignSelf: "start", position: "sticky", top: 14 }} aria-label={person.name}>
          <div className="between"><strong style={{ fontSize: 15 }}>{person.name}</strong><button className="btn btn-g btn-sm" onClick={() => show(null)} aria-label="Close">×</button></div>
          <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 2 }}>{person.side} · {person.stage} · {person.source}</div>
          <div style={{ marginTop: 12, fontSize: 12, fontWeight: 600, color: "var(--ink-3)" }}>WHAT THEY DID</div>
          <p style={{ marginTop: 3 }}>{person.summary}</p>
          <div style={{ marginTop: 12, fontSize: 12, fontWeight: 600, color: "var(--ink-3)" }}>NEXT</div>
          <p style={{ marginTop: 3 }}>{person.next} · due {person.due}</p>
          <div className="col gap-2" style={{ marginTop: 14 }}>
            {person.journey
              ? <Link href={`/prototype/operations/journey/${person.journey}`} className="btn btn-p btn-sm">Open the journey</Link>
              : <button className="btn btn-p btn-sm">Start a journey</button>}
            <button className="btn btn-g btn-sm">Log a call or note</button>
          </div>
        </aside>
      ) : null}
    </div>
  );
}
