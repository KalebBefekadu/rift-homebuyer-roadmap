import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { agentSession } from "@/lib/db/session";
import { Unavailable } from "../Unavailable";
import { AddLead } from "./AddLead";
import { OpsNav } from "../OpsNav";

export const metadata: Metadata = { title: "Add someone", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AddPage() {
  const session = await agentSession();
  /* A blip is not an expired session. Redirecting on "unknown" shows the
     agent a sign-in form when his cookie is fine, which says something false
     about what just happened: see lib/db/session.ts. */
  if (session.state === "unknown") return <Unavailable reason={session.reason} />;
  if (session.state === "signed-out") redirect("/operations/sign-in");
  return <><OpsNav agentName={session.agent.name} /><AddLead /></>;
}
