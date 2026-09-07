import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentAgent } from "@/lib/db/session";
import { AddLead } from "./AddLead";

export const metadata: Metadata = { title: "Add someone", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AddPage() {
  const agent = await currentAgent();
  if (!agent) redirect("/studio/sign-in");
  return <AddLead />;
}
