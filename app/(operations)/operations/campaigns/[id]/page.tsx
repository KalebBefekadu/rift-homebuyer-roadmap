import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { agentSession } from "@/lib/db/session";
import { campaignFor, campaignResults } from "@/lib/db/campaigns";
import { programsToday } from "@/lib/db/program-checks";
import { rulesOrDefaults } from "@/lib/db/settings";
import { siteUrl } from "@/lib/core/site";
import { aiConfigured } from "@/lib/db/ai";
import { Unavailable } from "../../Unavailable";
import { PageHead, Section, Notice, Stats, Stat } from "../../ui";
import { Tag } from "../../_business/Tag";
import { say } from "../../_business/say";
import { Composer } from "./Composer";
import { isUuid } from "@/lib/core/ids";

export const metadata: Metadata = { title: "Campaign" };
export const dynamic = "force-dynamic";

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await agentSession();
  if (session.state === "unknown") return <Unavailable reason={session.reason} />;
  if (session.state === "signed-out") redirect("/operations/sign-in");
  const { id } = await params;
  /* A mistyped link is not found, not a database failure to report. */
  if (!isUuid(id)) notFound();
  const read = await campaignFor(id);
  if (!read.ok) {
    return (
      <main className="shell-w">
        <PageHead title="Campaign" back={{ href: "/operations/campaigns", label: "Campaigns" }} />
        <Notice tone="neg" title="This campaign did not load">{say(read.error)} That is not the same as it not existing.</Notice>
      </main>
    );
  }
  if ("skipped" in read) return <Unavailable reason={read.reason} />;
  if (!read.data || !read.data.revisions.length) notFound();
  const c = read.data;
  const { rules } = await rulesOrDefaults(session.agent.agentId);
  const [programs, results] = await Promise.all([
    programsToday(new Date(), rules.registryDays.value).then((p) => p.shown),
    campaignResults([c.slug], 90),
  ]);
  const r = results.ok && "data" in results ? results.data.get(c.slug) : null;

  return (
    <main className="shell-w">
      <PageHead
        title={c.name}
        back={{ href: "/operations/campaigns", label: "Campaigns" }}
        meta={(
          <>
            {c.live ? <Tag tone="pos">Live, version {c.live}</Tag> : <Tag>Not published</Tag>}
            <span className="t-sm c-3">/c/{c.slug}</span>
          </>
        )}
      />
      <Stats>
        <Stat label="Visits, last 90 days" value={r ? r.visitors : "Unknown"} hint="First visits that carried this page's tag" />
        <Stat label="Leads, last 90 days" value={r ? r.leads : "Unknown"} hint="Those visits that left a way to reach them" />
        <Stat label="Versions" value={c.versions} hint={c.live ? `Version ${c.live} is live` : "None live"} />
      </Stats>
      <Section title="Edit and publish" hint="Saving makes a new version; publishing points the page at one.">
        <Composer id={c.id} slug={c.slug} live={c.live} revisions={c.revisions} history={c.history} programs={programs} origin={siteUrl()} aiReady={aiConfigured()} />
      </Section>
    </main>
  );
}
