import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { agentSession } from "@/lib/db/session";
import { Unavailable } from "../Unavailable";
import { PageHead } from "../ui";
import { AddLead } from "./AddLead";

export const metadata: Metadata = { title: "Add someone", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AddPage() {
  const session = await agentSession();
  /* A blip is not an expired session. Redirecting on "unknown" shows the
     agent a sign-in form when his cookie is fine, which says something false
     about what just happened: see lib/db/session.ts. */
  if (session.state === "unknown") return <Unavailable reason={session.reason} />;
  if (session.state === "signed-out") redirect("/operations/sign-in");
  /* The session is the gate; nothing on this page needs the agent's name. */
  return (
    <main className="shell-w ops-narrow">
      <PageHead
        back={{ href: "/operations/clients", label: "Relationships" }}
        title="Add someone"
        lede="For people you are already working with. They will not be scored: a score explains a set of funnel answers, and inventing one for somebody who never answered anything would put a made-up number beside a real person."
      />
      <AddLead />
    </main>
  );
}
