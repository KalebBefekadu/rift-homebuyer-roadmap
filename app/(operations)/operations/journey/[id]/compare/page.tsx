import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { agentSession } from "@/lib/db/session";
import { journeyFor } from "@/lib/db/journeys";
import { homesOf } from "@/lib/db/shortlist";
import { searchState } from "@/lib/db/search";
import { moneyFor } from "@/lib/db/money";
import { CompareTable, chosen } from "@/components/rift/money/CompareTable";
import { Unavailable } from "../../../Unavailable";

export const metadata: Metadata = { title: "Compare homes", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Homes side by side for the agent (SEARCH-05), on the buyer's own terms:
 * the requirements in the Matrix search when there is one, the latest brief
 * otherwise, and the plan they saved. The same table the buyer sees.
 */
export default async function ComparePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ h?: string }> }) {
  const session = await agentSession();
  if (session.state === "unknown") return <Unavailable reason={session.reason} />;
  if (session.state === "signed-out") redirect("/operations/sign-in");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const j = await journeyFor(id);
  if (!j.ok) return <main className="shell-w sec"><p className="t-sm c-neg">This journey did not load ({j.error}).</p></main>;
  if ("skipped" in j) return <Unavailable reason={j.reason} />;
  if (!j.data || j.data.side !== "buy") notFound();

  const [homes, search, moneyRead] = await Promise.all([homesOf(id), searchState(id), moneyFor(id)]);
  const all = homes.ok && "data" in homes ? homes.data.filter((h) => !h.withdrawnAt).map((h) => ({ id: h.id, address: h.address, facts: h.facts })) : null;
  const s = search.ok && "data" in search ? search.data : null;
  const revision = s?.active ? s.revisions.find((r) => r.id === s.active!.revisionId) ?? s.revisions[0] : s?.revisions[0];
  const money = moneyRead.ok && "data" in moneyRead ? moneyRead.data : null;
  const base = `/operations/journey/${id}/compare`;

  return (
    <main className="shell-w sec">
      <Link href={`/operations/journey/${id}?tab=homes`} className="t-sm c-3">← {j.data.label}</Link>
      <h1 className="serif" style={{ marginTop: 6 }}>Compare homes</h1>
      <p className="t-sm c-3" style={{ marginTop: 4, marginBottom: 12 }}>
        {revision ? `Against brief revision ${revision.revision}${s?.active && revision.id === s.active.revisionId ? ", the one running in Matrix" : ""}.` : "No requirements written down yet."}{" "}
        {money ? (money.answersFrom ? "Money on the plan they saved." : "Money on Rift's starting figures: they have not saved a plan.") : "The money did not load; the facts still compare."}
      </p>
      {all === null ? <p className="t-sm c-neg">The homes did not load. That is not the same as an empty list.</p>
        : all.length < 2 ? <p className="t-sm c-3">Add at least two homes to compare them.</p>
        : <CompareTable all={all} picked={chosen(all, (await searchParams).h)} criteria={revision?.brief.criteria ?? []} plan={money?.plan ?? null} base={base} />}
    </main>
  );
}
