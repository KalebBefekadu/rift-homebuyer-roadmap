import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { clientBrief, clientHomes, clientSession, memberOf } from "@/lib/db/client";
import { clientMoney } from "@/lib/db/money";
import { buyerSearchOn } from "@/lib/core/journey";
import { CompareTable, chosen } from "@/components/rift/money/CompareTable";
import { ClientShell } from "../../../ClientShell";

export const metadata: Metadata = { title: "Compare homes", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Homes side by side for the household (SEARCH-05). Only for someone who
 * can see the homes; the money rows only for someone with price and fees.
 * Every read goes through `memberOf`, as on the journey page.
 */
export default async function ClientCompare({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ h?: string }> }) {
  if (!buyerSearchOn(process.env)) redirect("/app");
  const session = await clientSession();
  if (session.state === "signed-out") redirect("/app/sign-in");
  if (session.state === "unknown") {
    return <ClientShell agentName={null}><p className="t-sm c-3">We could not check your sign-in just now. Reload in a moment.</p></ClientShell>;
  }
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const m = await memberOf(session.userId, id);
  if (!m.ok || "skipped" in m) {
    return <ClientShell agentName={null}><p className="t-sm c-3">This did not load. Nothing is lost. Try again in a minute.</p></ClientShell>;
  }
  if (!m.data || m.data.side !== "buy" || !m.data.scopes.includes("homes")) notFound();
  const member = m.data;

  const [homes, brief, money] = await Promise.all([
    clientHomes(member),
    member.scopes.includes("search") ? clientBrief(member) : Promise.resolve(null),
    clientMoney(member),
  ]);
  const all = homes.ok && "data" in homes ? homes.data.filter((h) => !h.withdrawnAt).map((h) => ({ id: h.id, address: h.address, facts: h.facts })) : null;
  const criteria = brief && brief.ok && "data" in brief ? brief.data.revision?.brief.criteria ?? [] : [];
  const plan = money.ok && "data" in money && money.data ? money.data.plan : null;

  return (
    <ClientShell agentName={member.agentName}>
      <Link href={`/app/j/${id}#homes`} className="t-sm c-3">← {member.journeyLabel}</Link>
      <h1 className="serif" style={{ fontSize: 28, letterSpacing: "-0.02em", marginTop: 8 }}>Compare homes</h1>
      <p className="t-sm c-3" style={{ marginTop: 6, marginBottom: 14, lineHeight: 1.6 }}>
        The same facts for each home, and where one is not known it says so.
        {plan ? " The money is worked out on your own plan as a scenario; a lender's estimate is the authority." : ""}
      </p>
      {all === null ? <p className="t-sm c-3">The homes did not load. That is not the same as an empty list; reload in a moment.</p>
        : all.length < 2 ? <p className="t-sm c-3">There need to be at least two homes on your list to compare.</p>
        : <CompareTable all={all} picked={chosen(all, (await searchParams).h)} criteria={criteria} plan={plan} base={`/app/j/${id}/compare`} />}
    </ClientShell>
  );
}
