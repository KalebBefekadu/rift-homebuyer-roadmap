"use client";

import { useMemo, useState } from "react";
import { Ico } from "@/components/rift/icons";
import { KIND_LABEL, FUNDING_TEXT, upTo, type ProgramRecord } from "@/lib/core/assistance";

const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const MONTH = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric" });


function incomeText(p: ProgramRecord) {
  const i = p.income;
  if (i.kind === "ami") return `Up to ${i.pct}% of area median`;
  if (i.kind === "flat") return `Up to ${money(i.max)}`;
  if (i.kind === "two-sizes") return `Up to ${money(i.upTo2)} (1 to 2 people)`;
  return "Not stated";
}

type Sort = "amount" | "name" | "checked";

/**
 * Georgia programs as a table, with a filter and a sort (Blueprint v5 §5.8,
 * Kaleb R2: "too much information... more like a table"). Free, with no
 * details asked (D14). Each row links to the program's own page.
 */
export function ProgramTable({ programs, counties }: { programs: ProgramRecord[]; counties: string[] }) {
  const [county, setCounty] = useState("all");
  const [repeat, setRepeat] = useState(false);
  const [sort, setSort] = useState<Sort>("amount");

  const rows = useMemo(() => {
    const list = programs.filter((p) =>
      (county === "all" || p.area.counties.length === 0 || p.area.counties.includes(county)) &&
      (!repeat || p.firstTime !== "required"));
    return [...list].sort((a, b) =>
      sort === "name" ? a.name.localeCompare(b.name)
      : sort === "checked" ? b.checkedOn.localeCompare(a.checkedOn)
      : upTo(b).n - upTo(a).n);
  }, [programs, county, repeat, sort]);

  return (
    <div>
      <div className="row wrap gap-3" style={{ alignItems: "flex-end" }}>
        <label className="field" style={{ minWidth: 200 }}>
          <span className="label">County</span>
          <select className="select" value={county} onChange={(e) => setCounty(e.target.value)}>
            <option value="all">All counties</option>
            {counties.map((c) => <option key={c} value={c}>{c} County</option>)}
          </select>
        </label>
        <label className="field" style={{ minWidth: 180 }}>
          <span className="label">Sort by</span>
          <select className="select" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="amount">Largest amount</option>
            <option value="name">Name</option>
            <option value="checked">Most recently checked</option>
          </select>
        </label>
        <label className="opt" data-on={repeat} style={{ height: 40, padding: "0 12px", alignItems: "center" }}>
          <input type="checkbox" checked={repeat} onChange={() => setRepeat(!repeat)} />
          <span className="t-sm">Open to repeat buyers</span>
        </label>
        <span className="t-sm c-4" style={{ marginLeft: "auto", paddingBottom: 10 }} aria-live="polite">{rows.length} program{rows.length === 1 ? "" : "s"}</span>
      </div>

      <div className="card scroll-x mt-3">
        <table className="tbl" style={{ minWidth: 860 }}>
          <thead>
            <tr>
              <th scope="col" style={{ paddingTop: 14 }}>Program</th>
              <th scope="col" style={{ paddingTop: 14 }}>Where</th>
              <th scope="col" style={{ paddingTop: 14 }}>Amount</th>
              <th scope="col" style={{ paddingTop: 14 }}>First-time only</th>
              <th scope="col" style={{ paddingTop: 14 }}>Income</th>
              <th scope="col" style={{ paddingTop: 14 }}>Checked</th>
              <th scope="col" style={{ paddingTop: 14 }}><span className="sr-only">Source</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.slug}>
                <td style={{ maxWidth: 280 }}>
                  <div className="w6">{p.name}</div>
                  <div className="t-xs c-4">{KIND_LABEL[p.kind]} · {FUNDING_TEXT[p.funding]}</div>
                </td>
                <td className="t-sm">{p.area.counties.length ? p.area.counties.join(", ") : "Statewide"}{p.area.within ? <div className="t-xs c-4">Part of the county only</div> : null}{p.onlyFor ? <div className="t-xs c-4">Certain jobs only</div> : null}</td>
                <td className="t-sm num" style={{ fontWeight: 550 }}>{upTo(p).label}</td>
                <td className="t-sm">{p.firstTime === "required" ? "Yes" : p.firstTime === "not-required" ? "No" : "Not stated"}</td>
                <td className="t-sm">{incomeText(p)}</td>
                <td className="t-sm c-3">{MONTH(p.checkedOn)}</td>
                <td><a href={p.sourceUrl} target="_blank" rel="noopener noreferrer" className="btn btn-g btn-sm" aria-label={`Official source for ${p.name}`}>Source<Ico.arrowUpR size={12} /></a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
