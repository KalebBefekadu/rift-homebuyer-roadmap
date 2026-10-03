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
import { PageHead, Notice, Empty } from "../../../ui";
import { isUuid } from "@/lib/core/ids";

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
  if (!isUuid(id)) notFound();
  const j = await journeyFor(id);
  const back = { href: `/operations/journey/${id}?tab=homes`, label: "Homes and showings" };
  if (!j.ok) {
    return (
      <main className="shell-w">
        <PageHead title="Compare homes" back={back} />
        <Notice tone="neg" title="This journey did not load">That is not the same as there being no homes ({j.error}). Reload in a moment.</Notice>
      </main>
    );
  }
  if ("skipped" in j) return <Unavailable reason={j.reason} />;
  if (!j.data || j.data.side !== "buy") notFound();

  const [homes, search, moneyRead] = await Promise.all([homesOf(id), searchState(id), moneyFor(id)]);
  const all = homes.ok && "data" in homes ? homes.data.filter((h) => !h.withdrawnAt).map((h) => ({ id: h.id, address: h.address, facts: h.facts })) : null;
  const s = search.ok && "data" in search ? search.data : null;
  const revision = s?.active ? s.revisions.find((r) => r.id === s.active!.revisionId) ?? s.revisions[0] : s?.revisions[0];
  const money = moneyRead.ok && "data" in moneyRead ? moneyRead.data : null;
  const base = `/operations/journey/${id}/compare`;

  /* What the comparison is measured against, said in one place, in words. */
  const against = revision
    ? `Against brief revision ${revision.revision}${s?.active && revision.id === s.active.revisionId ? ", the one running in Matrix" : ", not yet set up in Matrix"}.`
    : "No requirements are written down yet, so the homes are compared on facts and money only.";
  const basis = money
    ? (money.answersFrom ? "Money is worked on the plan they saved." : "Money is worked on Rift's starting figures: they have not saved a plan.")
    : "The money did not load; the facts still compare.";

  return (
    <main className="shell-w">
      <PageHead
        back={back}
        title="Compare homes"
        lede={<>{j.data.label} for {j.data.person}. {against} {basis}</>}
        actions={<Link href={`/operations/journey/${id}?tab=homes`} className="btn btn-g btn-sm">Add or remove homes</Link>}
      />
      {all === null ? (
        <Notice tone="neg" title="The homes did not load">That is not the same as an empty list. Reload in a moment.</Notice>
      ) : all.length < 2 ? (
        <Empty title="Two homes are needed to compare" action={<Link href={`/operations/journey/${id}?tab=homes`} className="btn btn-s btn-sm">Add a home</Link>}>
          {all.length === 1 ? "There is one home on the list." : "There are no homes on the list."} Add another on the Homes and showings tab and it appears here.
        </Empty>
      ) : (
        <CompareTable all={all} picked={chosen(all, (await searchParams).h)} criteria={revision?.brief.criteria ?? []} plan={money?.plan ?? null} base={base} />
      )}
    </main>
  );
}
