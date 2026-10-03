import { agentSession } from "@/lib/db/session";
import { setupTodoCount } from "@/lib/db/setup";
import { OpsFrame } from "./OpsFrame";

/**
 * The sidebar is for the agent. Signed out, or when the session could not be
 * checked, a page renders on its own: the sign-in form, or the page's own
 * "could not check" notice, never a menu of places he cannot open.
 *
 * The Settings badge is the setup list's "To do" count: the undecided rules,
 * the missing profile details and the unset integrations. Its two reads are
 * cached for the request and run side by side, so the page asking again costs
 * nothing; it never calls out to a provider (lib/db/setup.ts).
 */
export default async function OperationsLayout({ children }: { children: React.ReactNode }) {
  const session = await agentSession();
  if (session.state !== "signed-in") return <>{children}</>;
  const toSetUp = await setupTodoCount(session.agent.agentId);
  return <OpsFrame agentName={session.agent.name} toSetUp={toSetUp}>{children}</OpsFrame>;
}
