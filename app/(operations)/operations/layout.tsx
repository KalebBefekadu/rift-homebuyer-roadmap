import { agentSession } from "@/lib/db/session";
import { rulesOrDefaults } from "@/lib/db/settings";
import { OpsFrame } from "./OpsFrame";

/**
 * The sidebar is for the agent. Signed out, or when the session could not be
 * checked, a page renders on its own: the sign-in form, or the page's own
 * "could not check" notice, never a menu of places he cannot open.
 *
 * Both reads are cached for the request, so the page asking again costs
 * nothing (lib/db/session.ts, lib/db/settings.ts).
 */
export default async function OperationsLayout({ children }: { children: React.ReactNode }) {
  const session = await agentSession();
  if (session.state !== "signed-in") return <>{children}</>;
  const rules = await rulesOrDefaults(session.agent.agentId);
  return <OpsFrame agentName={session.agent.name} undecided={rules.undecided.length}>{children}</OpsFrame>;
}
