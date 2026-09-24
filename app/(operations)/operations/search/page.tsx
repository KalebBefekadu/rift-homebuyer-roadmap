import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { agentSession } from "@/lib/db/session";
import { Unavailable } from "../Unavailable";
import { StudioHeader } from "../StudioHeader";
import { buyingJourneys } from "@/lib/db/journeys";
import { searchStatuses, type SearchRow } from "@/lib/db/search";
import { buyerSearchOn } from "@/lib/core/journey";
import { STATUS_LABEL, type SearchStatus } from "@/lib/core/search";

export const metadata: Metadata = { title: "Search" };
export const dynamic = "force-dynamic";

/** What is his to do, first. A search that is running needs nothing today. */
const ORDER: SearchStatus[] = [
  "manual-action-needed", "update-pending", "awaiting-approval", "unknown", "draft", "paused", "active-confirmed",
];

const WHAT_NEXT: Record<SearchStatus, string> = {
  "manual-action-needed": "Set it up in Matrix, then record it",
  "update-pending": "The brief changed. Review it and update Matrix",
  "awaiting-approval": "Review the brief and approve it as a search",
  unknown: "Could not be read. Open it to check",
  draft: "Write the brief",
  paused: "Paused in Matrix",
  "active-confirmed": "Nothing to do",
};

const DAY = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/**
 * Every buyer's search, in the order they need him.
 *
 * Decision D10: buyer search is the work that repeats most. This page is the
 * answer to "whose search do I owe something to", which today lives in his
 * head and a Matrix sidebar. A status that could not be read is listed as
 * unknown, near the top, rather than dropped or shown as fine.
 */
export default async function SearchPage() {
  const session = await agentSession();
  if (session.state === "unknown") return <Unavailable reason={session.reason} />;
  if (session.state === "signed-out") redirect("/operations/sign-in");
  const agent = session.agent;

  const on = buyerSearchOn(process.env);
  const journeys = on ? await buyingJourneys() : null;
  const list = journeys && journeys.ok && "data" in journeys ? journeys.data : [];
  const statuses = list.length ? await searchStatuses(list.map((j) => j.id)) : null;
  const byId: Map<string, SearchRow> | null = statuses && statuses.ok && "data" in statuses ? statuses.data : null;

  const rows = list.map((j) => ({
    ...j,
    row: byId?.get(j.id) ?? { journeyId: j.id, status: "unknown" as SearchStatus, latest: null, updatedAt: null },
  })).sort((a, b) => ORDER.indexOf(a.row.status) - ORDER.indexOf(b.row.status));

  const owed = rows.filter((r) => !["active-confirmed", "paused"].includes(r.row.status)).length;

  return (
    <>
      <StudioHeader agentName={agent.name} current="search" />
      <main className="shell-w sec" style={{ paddingTop: 28, maxWidth: 860 }}>
        <h1 className="serif" style={{ fontSize: "clamp(24px,3vw,34px)", letterSpacing: "-0.02em" }}>Search</h1>
        <p className="t-sm c-3" style={{ marginTop: 8, maxWidth: 620, lineHeight: 1.6 }}>
          Each buyer&apos;s brief and the Matrix search it became. &ldquo;Set up&rdquo; means you recorded setting it up:
          Rift cannot see Matrix, so it never claims a search is running on its own.
        </p>

        {!on ? (
          <p className="t-sm c-3" style={{ marginTop: 20 }}>Journeys are switched off on this deployment (RIFT_BUYER_SEARCH=off).</p>
        ) : journeys && !journeys.ok ? (
          <p className="t-sm c-neg" style={{ marginTop: 20 }}>
            The buying journeys did not load ({journeys.error}). This is not an empty list; it is a list we could not fetch.
          </p>
        ) : journeys && "skipped" in journeys ? (
          <p className="t-sm c-3" style={{ marginTop: 20 }}>{journeys.reason}</p>
        ) : rows.length === 0 ? (
          <div className="card p-4" style={{ marginTop: 20 }}>
            <div className="t-sm w6">No buying journeys yet.</div>
            <p className="t-xs c-3" style={{ marginTop: 6, lineHeight: 1.6 }}>
              Open a buyer from <Link className="u" href="/operations/clients">Relationships</Link> and start a journey. Their
              readout comes with them, so you begin from what they already told the calculator.
            </p>
          </div>
        ) : (
          <>
            {statuses && !statuses.ok ? (
              <p className="t-xs c-neg" style={{ marginTop: 16 }}>
                Search statuses did not load ({statuses.error}), so every row below says unknown.
              </p>
            ) : null}
            <p className="t-xs c-4" style={{ marginTop: 16 }}>
              {owed ? `${owed} of ${rows.length} need something from you.` : `All ${rows.length} are set up. Nothing owed.`}
            </p>
            <ul style={{ marginTop: 8, display: "grid", gap: 8 }}>
              {rows.map((r) => (
                <li key={r.id}>
                  <Link href={`/operations/journey/${r.id}`} className="card p-3 between gap-2 wrap" style={{ display: "flex" }}>
                    <span style={{ minWidth: 0 }}>
                      <span className="t-sm w6">{r.person}</span>
                      <span className="t-xs c-4"> · {r.label}</span>
                      <span className="t-2xs c-3" style={{ display: "block", marginTop: 3 }}>
                        {WHAT_NEXT[r.row.status]}
                        {r.row.latest ? ` · brief revision ${r.row.latest}` : ""}
                        {r.row.updatedAt ? `, ${DAY(r.row.updatedAt)}` : ""}
                      </span>
                    </span>
                    <span className={`chip t-2xs ${r.row.status === "active-confirmed" ? "chip-pos" : ["manual-action-needed", "update-pending", "unknown"].includes(r.row.status) ? "chip-warn" : ""}`}>
                      {STATUS_LABEL[r.row.status]}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </>
  );
}
