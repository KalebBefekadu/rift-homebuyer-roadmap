import Link from "next/link";
import { compareHomes, MAX_COMPARED, type CompareHome } from "@/lib/core/compare";
import type { BuyerInputs } from "@/lib/core/compute";
import type { SearchCriterion } from "@/lib/core/search";

const GROUP_LABEL = { money: "Money", facts: "The home", fit: "Your requirements" } as const;

/** Which homes to compare, from the address: the chosen ones, or the first few. */
export function chosen(all: CompareHome[], raw: string | undefined): CompareHome[] {
  const ids = (raw ?? "").split(",").filter(Boolean);
  const picked = ids.length ? all.filter((h) => ids.includes(h.id)) : all;
  return picked.slice(0, MAX_COMPARED);
}

/**
 * Homes side by side (SEARCH-05). Server-rendered and read-only; which homes
 * are compared is in the address, so a link can be kept or shared inside the
 * household. Used by the agent's journey and the buyer's journey page.
 */
export function CompareTable({ all, picked, criteria, plan, base }: {
  all: CompareHome[];
  picked: CompareHome[];
  criteria: SearchCriterion[];
  plan: { inputs: BuyerInputs; savingsKnown: boolean } | null;
  /** The page's own address, without ?h=. */
  base: string;
}) {
  const ids = picked.map((h) => h.id);
  const toggle = (id: string) => {
    const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id].slice(-MAX_COMPARED);
    return next.length ? `${base}?h=${next.join(",")}` : base;
  };
  const rows = compareHomes(picked, criteria, plan);
  const groups = (["money", "facts", "fit"] as const).filter((g) => rows.some((r) => r.group === g));

  return (
    <div className="col gap-3">
      <nav aria-label="Homes to compare" className="row gap-2 wrap">
        {all.map((h) => (
          <Link key={h.id} href={toggle(h.id)} scroll={false} className={`btn btn-sm ${ids.includes(h.id) ? "btn-p" : "btn-g"}`} aria-current={ids.includes(h.id) ? "true" : undefined}>
            {ids.includes(h.id) ? "✓ " : "+ "}{h.address}
          </Link>
        ))}
      </nav>
      {picked.length < 2 ? (
        <p className="t-sm c-3">Choose at least two homes to compare.</p>
      ) : (
        <div className="card" style={{ overflowX: "auto" }}>
          <table className="ops-table cmp-table">
            <colgroup><col style={{ width: 230 }} />{picked.map((h) => <col key={h.id} style={{ width: 190 }} />)}</colgroup>
            <thead>
              <tr><th scope="col"><span className="sr-only">Row</span></th>{picked.map((h) => <th key={h.id} scope="col">{h.address}</th>)}</tr>
            </thead>
            {groups.map((g) => (
              <tbody key={g}>
                <tr><th colSpan={picked.length + 1} scope="colgroup" className="cmp-group">{GROUP_LABEL[g]}</th></tr>
                {rows.filter((r) => r.group === g).map((r, i) => (
                  <tr key={`${g}-${r.label}-${i}`}>
                    <th scope="row">
                      {r.label}
                      {r.note ? <span className="t-xs c-4" style={{ display: "block", fontWeight: 400 }}>{r.note}</span> : null}
                    </th>
                    {r.cells.map((c, n) => (
                      <td key={n} className={c.fit === "misses" ? "c-neg" : c.fit === "meets" ? "c-pos" : c.unknown ? "c-4" : undefined}>{c.text}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      )}
      <p className="t-xs c-4">Only the facts typed for each home, as of the day they were typed. A missing fact is not known, never assumed.</p>
    </div>
  );
}
