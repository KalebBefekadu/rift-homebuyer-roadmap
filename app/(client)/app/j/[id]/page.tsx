import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { clientSession, memberOf } from "@/lib/db/portal";
import { buyerSearchOn } from "@/lib/core/journey";
import { isUuid } from "@/lib/core/ids";
import { ClientShell } from "../../ClientShell";
import { JourneyView } from "./JourneyView";

export const metadata: Metadata = { title: "Your move", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * One journey, as the buyer sees it. The page itself is JourneyView, shared
 * with the agent's read-only preview (app/(client)/app/preview).
 *
 * Every read goes through `memberOf` first. A revoked member, or somebody
 * signed in with a different address, gets a 404 rather than a page: whether
 * a journey exists is itself not theirs to know.
 */
export default async function ClientJourney({ params }: { params: Promise<{ id: string }> }) {
  if (!buyerSearchOn(process.env)) redirect("/app");
  const session = await clientSession();
  if (session.state === "signed-out") redirect("/app/sign-in");
  if (session.state === "unknown") {
    return <ClientShell agentName={null}><p className="t-sm c-3">We could not check your sign-in just now. Reload in a moment.</p></ClientShell>;
  }
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const m = await memberOf(session.userId, id);
  if (!m.ok || "skipped" in m) {
    return <ClientShell agentName={null}><p className="t-sm c-3">This did not load. Nothing is lost. Try again in a minute.</p></ClientShell>;
  }
  if (!m.data) notFound();
  const member = m.data;
  return <JourneyView member={member} />;
}
