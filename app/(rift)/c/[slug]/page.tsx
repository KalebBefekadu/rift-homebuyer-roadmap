import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { publicCampaign } from "@/lib/db/campaigns";
import { programsToday } from "@/lib/db/program-checks";
import { rulesOrDefaults } from "@/lib/db/settings";
import { currentAgentId } from "@/lib/db/service";
import { SiteHeader } from "@/components/rift/site/SiteHeader";
import { SiteFooter } from "@/components/rift/site/SiteFooter";
import { CampaignBlocks } from "@/components/rift/campaign/CampaignBlocks";
import { KeepVersion } from "./KeepVersion";

export const dynamic = "force-dynamic";
/* Landing pages for a campaign's own traffic; the site's pages are what search should find. */
export async function generateMetadata({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ v?: string }> }): Promise<Metadata> {
  const [{ slug }, { v }] = await Promise.all([params, searchParams]);
  const read = await publicCampaign(slug, v);
  const first = read.ok && "data" in read ? read.data?.recipe.blocks[0] : undefined;
  return {
    title: first?.type === "heading" ? first.title : "Rift",
    description: first?.type === "heading" ? first.lede : undefined,
    robots: { index: false, follow: true },
  };
}

/**
 * A published campaign at /c/<slug> (Blueprint v5 §5.10). The revision in
 * the address when the visitor started, or the live one. Nothing when it is
 * not published or the database cannot be reached: a campaign page never
 * renders a half-page.
 */
export default async function CampaignPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ v?: string }> }) {
  const [{ slug }, { v }] = await Promise.all([params, searchParams]);
  const read = await publicCampaign(slug, v);
  const page = read.ok && "data" in read ? read.data : null;
  if (!page) notFound();

  const { rules } = await rulesOrDefaults(await currentAgentId());
  const programs = page.recipe.blocks.some((b) => b.type === "programs")
    ? (await programsToday(new Date(), rules.registryDays.value)).shown
    : [];
  /* The values it links to say which campaign, and which version, sent them. */
  const suffix = `?utm_source=rift&utm_medium=campaign&utm_campaign=${encodeURIComponent(`${page.slug}-v${page.version}`)}`;

  return (
    <div className="buy">
      <SiteHeader side="buy" />
      <main className="shell-w">
        <section className="sec-sm">
          <CampaignBlocks recipe={page.recipe} programs={programs} hrefSuffix={suffix} />
        </section>
      </main>
      <SiteFooter />
      <KeepVersion version={page.version} />
    </div>
  );
}
