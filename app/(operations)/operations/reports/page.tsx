import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { agentSession } from "@/lib/db/session";
import { PERIODS, periodFrom } from "@/lib/core/business-report";
import { PrintButton } from "@/components/rift/PrintButton";
import { Unavailable } from "../Unavailable";
import { PageHead, Tabs, Notice } from "../ui";
import { BusinessView } from "./BusinessView";
import { PilotView } from "./PilotView";
import { FunnelReports } from "./Funnel";

export const metadata: Metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

const VIEWS = [
  { id: "business", label: "The business" },
  { id: "pilot", label: "Buyer pilot" },
  { id: "questions", label: "Where people stop" },
] as const;
type View = (typeof VIEWS)[number]["id"];

/**
 * Reports, in three views so each opens only the reads it needs.
 *
 * It used to be one page that opened a dozen reads at once, and on a cold
 * start the later ones spent their whole deadline waiting for the event loop:
 * "Where people stop" said "did not load; unknown, not empty" while the
 * database answered in fifty milliseconds. Splitting the page cuts the burst
 * to what one view shows, the agent-side deadline (lib/core/timeout.ts)
 * stops a cold start counting against it, and a view that does fail says which
 * read it was.
 *
 * The first view is the one the agent opens this for: a truthful picture of
 * the business (lib/core/business-report.ts). The other two are the pilot's
 * evidence and the questions' drop-off, unchanged in what they count.
 */
export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ view?: string; days?: string }> }) {
  const session = await agentSession();
  if (session.state === "unknown") return <Unavailable reason={session.reason} />;
  if (session.state === "signed-out") redirect("/operations/sign-in");

  const sp = await searchParams;
  const view: View = VIEWS.find((v) => v.id === sp.view)?.id ?? "business";
  const days = periodFrom(sp.days);
  const now = new Date();

  const viewHref = (id: View) => (id === "business" ? "/operations/reports" : `/operations/reports?view=${id}`);
  const dayHref = (d: number) => (d === 90 ? "/operations/reports" : `/operations/reports?days=${d}`);

  return (
    <main className="shell-w">
      <PageHead
        title="Reports"
        lede={view === "business"
          ? "How many people arrived, where from, how far they got, and what the people in play are worth. Counted from what is recorded; every figure says its period and what it counts."
          : view === "pilot"
            ? "What the pilot shows so far, counted from what is recorded. Nothing here is compared with how long the same work took before Rift, because that was never measured."
            : "Where visitors stop answering, and who started without finishing."}
        actions={<div className="no-print"><PrintButton /></div>}
        meta={(
          <>
            <Tabs label="Which report" current={view} items={VIEWS.map((v) => ({ id: v.id, label: v.label, href: viewHref(v.id) }))} />
            {view === "business" ? (
              <Tabs label="Period" current={String(days)} items={PERIODS.map((p) => ({ id: String(p.days), label: p.label, href: dayHref(p.days) }))} />
            ) : null}
          </>
        )}
      />

      <Suspense fallback={<Notice tone="info" title="Counting">This takes a moment on a cold start.</Notice>}>
        {view === "business" ? <BusinessView days={days} agentId={session.agent.agentId} now={now} />
          : view === "pilot" ? <PilotView now={now} />
          : <FunnelReports />}
      </Suspense>
    </main>
  );
}
