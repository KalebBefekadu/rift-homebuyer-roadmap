import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { agentSession } from "@/lib/db/session";
import { memberForPreview } from "@/lib/db/portal";
import { buyerSearchOn } from "@/lib/core/journey";
import { isUuid } from "@/lib/core/ids";
import { ClientShell } from "../../../ClientShell";
import { JourneyView } from "../../../j/[id]/JourneyView";

export const metadata: Metadata = { title: "Preview as client", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Preview as client (manual review WS10.2): the agent sees a member's journey
 * page exactly as that member's scopes allow, read-only, from his own session.
 *
 * Deliberately not "sign in as the client". That was started on 5 October and
 * stopped: it would let the agent accept an offer or confirm a brief as the
 * client with no trace it was not them. This renders the same page through
 * the same projection with every control disabled, and nothing here creates,
 * borrows or changes a client session.
 */
export default async function Preview({ params, searchParams }: { params: Promise<{ journeyId: string; memberId: string }>; searchParams: Promise<{ tab?: string | string[] }> }) {
  if (!buyerSearchOn(process.env)) redirect("/operations");
  const s = await agentSession();
  if (s.state === "signed-out") redirect("/operations/sign-in");
  if (s.state === "unknown") {
    return <ClientShell agentName={null} preview><p className="t-sm c-3">We could not check your sign-in just now. Reload in a moment.</p></ClientShell>;
  }
  const { journeyId, memberId } = await params;
  if (!isUuid(journeyId) || !isUuid(memberId)) notFound();
  const m = await memberForPreview(s.agent.agentId, journeyId, memberId);
  if (!m.ok || "skipped" in m) {
    return <ClientShell agentName={null} preview><p className="t-sm c-3">This did not load. Try again in a minute.</p></ClientShell>;
  }
  if (!m.data) notFound();
  return <JourneyView member={m.data} preview={{ by: s.agent.name }} tab={(await searchParams).tab} />;
}
