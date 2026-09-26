import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { agentSession } from "@/lib/db/session";
import { rulesOrDefaults } from "@/lib/db/settings";
import { openDeals } from "@/lib/db/transactions";
import { DealsTable } from "./DealsTable";
import { Ico } from "@/components/rift/icons";
import { Unavailable } from "../Unavailable";
import { OpsNav } from "../OpsNav";

export const metadata: Metadata = { title: "Transactions" };
export const dynamic = "force-dynamic";

/**
 * Every deal under contract, one row each (Blueprint v5 §8.4).
 *
 * The journey page is where a deal is worked; this is where the agent sees
 * them all and picks one. Simple first (§4.8): per deal, the closing, the
 * next date, how many workstreams are confirmed and what needs a look. The
 * ten workstreams are a strip of icons, each with its word; the detail is
 * one press away, on the journey.
 */
export default async function TransactionsPage() {
  const session = await agentSession();
  if (session.state === "unknown") return <Unavailable reason={session.reason} />;
  if (session.state === "signed-out") redirect("/operations/sign-in");
  const agent = session.agent;

  const [q, rules] = await Promise.all([openDeals(), rulesOrDefaults(agent.agentId)]);
  const deals = q.ok && "data" in q ? q.data : null;

  return (
    <>
      <OpsNav agentName={agent.name} undecided={rules.undecided.length} />
      <main className="shell-w sec" style={{ paddingTop: 28 }}>
        <h1 className="serif">Transactions</h1>
        <p className="t-sm c-3" style={{ marginTop: 8, maxWidth: 600, lineHeight: 1.6 }}>
          Every contract still open, trouble first, then by closing. A row opens that deal&apos;s journey,
          where it is worked.
        </p>

        {!q.ok ? (
          <div className="card p-4" style={{ marginTop: 20, borderColor: "var(--warn-line)" }}>
            <div className="row gap-2"><Ico.alert size={15} className="c-warn" aria-hidden /><span className="t-sm w6">The contracts could not be read.</span></div>
            <p className="t-sm c-3" style={{ marginTop: 8 }}>{q.error}. This is not &quot;nothing under contract&quot;, it is a list we could not fetch.</p>
          </div>
        ) : "skipped" in q ? (
          <div className="card p-4" style={{ marginTop: 20 }}><p className="t-sm c-3">{q.reason}.</p></div>
        ) : deals === null ? (
          <div className="card p-4" style={{ marginTop: 20 }}>
            <p className="t-sm c-3">Contracts need a database update that has not been applied yet (in output/pending-migrations.sql).</p>
          </div>
        ) : deals.length === 0 ? (
          <div className="card p-4" style={{ marginTop: 20 }}>
            <p className="t-sm c-3">Nothing under contract. A contract is recorded on a buyer&apos;s journey, under Where it stands, and shows here until it closes or ends.</p>
          </div>
        ) : (
          <>
            <DealsTable deals={deals} />
          </>
        )}
      </main>
    </>
  );
}
