import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { agentSession } from "@/lib/db/session";
import { campaignFor } from "@/lib/db/campaigns";
import { programsToday } from "@/lib/db/program-checks";
import { rulesOrDefaults } from "@/lib/db/settings";
import { siteUrl } from "@/lib/core/site";
import { Unavailable } from "../../Unavailable";
import { Composer } from "./Composer";

export const metadata: Metadata = { title: "Campaign" };
export const dynamic = "force-dynamic";

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await agentSession();
  if (session.state === "unknown") return <Unavailable reason={session.reason} />;
  if (session.state === "signed-out") redirect("/operations/sign-in");
  const { id } = await params;
  const read = await campaignFor(id);
  if (!read.ok) return <main className="shell-w sec"><p className="t-sm c-neg">This campaign did not load ({read.error}).</p></main>;
  if ("skipped" in read) return <Unavailable reason={read.reason} />;
  if (!read.data || !read.data.revisions.length) notFound();
  const c = read.data;
  const { rules } = await rulesOrDefaults(session.agent.agentId);
  const programs = (await programsToday(new Date(), rules.registryDays.value)).shown;

  return (
    <main className="shell-w sec">
      <Link href="/operations/campaigns" className="t-sm c-3">← Campaigns</Link>
      <h1 className="serif" style={{ marginTop: 6 }}>{c.name}</h1>
      <div style={{ marginTop: 12 }}>
        <Composer id={c.id} slug={c.slug} live={c.live} revisions={c.revisions} history={c.history} programs={programs} origin={siteUrl()} />
      </div>
    </main>
  );
}
