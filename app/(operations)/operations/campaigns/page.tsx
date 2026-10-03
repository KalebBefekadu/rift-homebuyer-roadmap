import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { agentSession } from "@/lib/db/session";
import { campaigns, campaignResults } from "@/lib/db/campaigns";
import { GA_COUNTIES } from "@/lib/core/registry";
import { siteUrl } from "@/lib/core/site";
import { Unavailable } from "../Unavailable";
import { PageHead, Section, Notice, Empty } from "../ui";
import { Tag } from "../_business/Tag";
import k from "../_business/kit.module.css";
import { NewCampaign } from "./NewCampaign";

export const metadata: Metadata = { title: "Campaigns" };
export const dynamic = "force-dynamic";

const RESULT_DAYS = 90;

/**
 * Campaign landing pages (Blueprint v5 §5.10): recipes of approved blocks,
 * composed here, published at /c/<slug>, with every version kept. Each row
 * says whether the page is live and what it has brought in, so a campaign
 * that nobody visits is visible as one.
 */
export default async function CampaignsPage() {
  const session = await agentSession();
  if (session.state === "unknown") return <Unavailable reason={session.reason} />;
  if (session.state === "signed-out") redirect("/operations/sign-in");
  const read = await campaigns();
  const list = read.ok && "data" in read ? read.data : null;
  const results = list?.length ? await campaignResults(list.map((c) => c.slug), RESULT_DAYS) : null;
  const counts = results && results.ok && "data" in results ? results.data : null;
  const origin = siteUrl();

  return (
    <main className="shell-w">
      <PageHead
        title="Campaigns"
        lede="Landing pages built from approved blocks: a heading, the county's programs, a value, a paragraph, a button. No code, no custom styles, no figures typed in: the numbers are the site's own. Every saved version is kept, and one is live at a time."
      />

      {!read.ok ? (
        <Notice tone="neg" title="The campaigns did not load">That is not the same as there being none.</Notice>
      ) : list === null ? (
        <Notice tone="warn" title="Campaigns need a database update">{"skipped" in read ? read.reason : "Migration 20260928060000 has not been applied."}</Notice>
      ) : (
        <>
          <Section title={list.length ? "Your campaigns" : "Start a campaign"} hint={list.length ? `Results are the last ${RESULT_DAYS} days, first visits that carried the page's tag and the leads those visits became.` : "The first starts as the assistance page for a county, then you compose it."}>
            {list.length ? (
              <>
                {results && !counts ? <Notice tone="warn" title="Results did not load">{results.ok ? "" : results.error}. The visits and leads below are not shown rather than shown as zero.</Notice> : null}
                <div className={k.tableCard}>
                  <table className={`${k.table} ${k.stack}`}>
                    <thead><tr><th>Campaign</th><th>Address</th><th>Status</th><th className="num">Versions</th><th className="num">Visits</th><th className="num">Leads</th></tr></thead>
                    <tbody>
                      {list.map((c) => {
                        const r = counts?.get(c.slug);
                        return (
                          <tr key={c.id}>
                            <td data-label="Campaign"><Link className={k.strong} href={`/operations/campaigns/${c.id}`}>{c.name}</Link></td>
                            <td data-label="Address">
                              {c.live && origin ? <a className={k.link} href={`${origin}/c/${c.slug}`} target="_blank" rel="noreferrer">/c/{c.slug}</a> : <span className={k.muted}>/c/{c.slug}</span>}
                            </td>
                            <td data-label="Status">{c.live ? <Tag tone="pos">Live, version {c.live}</Tag> : <Tag>Not published</Tag>}</td>
                            <td data-label="Versions" className="num">{c.versions}</td>
                            <td data-label="Visits" className="num">{r ? r.visitors : <span className={k.muted}>Unknown</span>}</td>
                            <td data-label="Leads" className="num">{r ? r.leads : <span className={k.muted}>Unknown</span>}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <Empty title="No campaigns yet">Create one below. It stays private until you publish a version.</Empty>
            )}
          </Section>

          <Section title="New campaign" hint="Starts as the assistance recipe for one county; you add and reorder blocks next.">
            <NewCampaign counties={GA_COUNTIES} />
          </Section>
        </>
      )}
    </main>
  );
}
