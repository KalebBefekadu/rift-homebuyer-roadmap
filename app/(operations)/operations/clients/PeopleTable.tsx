import Link from "next/link";
import type { ManagedLead } from "@/lib/core/pipeline";
import { STALL_CHIP } from "@/lib/core/pipeline";
import { BAND_LABEL, BAND_TONE, type Band } from "@/lib/core/lead";
import { Ico } from "@/components/rift/icons";

const SORT_WORD = { arrived: "newest first", name: "by name", due: "what is owed soonest first" } as const;
const DUE = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const WHEN = (iso: string | null) => {
  if (!iso) return "";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.round(days / 30)} months ago`;
  return `${Math.round(days / 365)} years ago`;
};

/**
 * Everyone, as a table. The name is the link and covers its row (CSS), so
 * the whole row opens them beside the list without a script; the URL keeps
 * who is open, so back returns to the same list with the same person.
 */
export function PeopleTable({ people, openId, today, sort, hrefOf }: {
  people: ManagedLead[]; openId: string | null; today: string; sort: keyof typeof SORT_WORD; hrefOf: (id: string) => string;
}) {
  return (
  <div className="ops-table-wrap">
    <table className="ops-table ops-table-cards opsx-people">
      <caption className="sr-only">{people.length} people, {SORT_WORD[sort]}. Choose a name to see them beside the list.</caption>
      <thead>
        <tr>
          <th scope="col">Name</th>
          <th scope="col">Stage</th>
          <th scope="col">Next</th>
          <th scope="col" className="ops-opt">Came from</th>
          <th scope="col" className="ops-opt">Arrived</th>
        </tr>
      </thead>
      <tbody>
        {people.map((p) => {
          const overdue = Boolean(p.nextDue && p.nextDue < today);
          return (
            <tr key={p.id} aria-selected={p.id === openId}>
              <td>
                {/* The name is the link, and it covers the row (CSS), so
                    the whole row opens them without a script. */}
                <Link href={hrefOf(p.id)} scroll={false} className="ops-rowlink opsx-rowlink">
                  {p.name?.trim() || p.email || "Someone who left no name"}
                </Link>
                <div className="row gap-1 wrap" style={{ marginTop: 3 }}>
                  <span className="chip t-2xs">{p.side === "buy" ? "Buying" : "Selling"}</span>
                  {p.band ? (
                    <span className={`chip t-2xs ${BAND_TONE[p.band as Band] ?? ""}`}>{BAND_LABEL[p.band as Band] ?? p.band}</span>
                  ) : null}
                  {p.archivedAt ? <span className="chip t-2xs">Archived</span> : null}
                </div>
              </td>
              <td data-label="Stage">
                {p.stage ?? <span className="c-4">Not picked up</span>}
                {p.stall && p.stall.level !== "moving" ? (
                  <span className={`chip t-2xs ${STALL_CHIP[p.stall.level].c}`} style={{ marginLeft: 6 }}>{STALL_CHIP[p.stall.level].l}</span>
                ) : null}
              </td>
              <td data-label="Next" className={overdue ? "c-neg" : ""}>
                {p.nextAction ? (
                  <>
                    {overdue ? <span className="opsx-inl"><Ico.alert size={10} aria-hidden />Overdue ·&nbsp;</span> : null}
                    {p.nextAction}{p.nextDue ? <span className={overdue ? "" : "c-3"}>, {DUE(p.nextDue)}</span> : null}
                  </>
                ) : <span className="c-4">Nothing owed</span>}
              </td>
              <td className="ops-opt c-3" data-label="Came from">{p.source === "funnel" ? "Readout" : p.source}</td>
              <td className="ops-opt c-3" data-label="Arrived">{WHEN(p.createdAt)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
  );
}
