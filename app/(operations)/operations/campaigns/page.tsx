import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { agentSession } from "@/lib/db/session";
import { campaigns } from "@/lib/db/campaigns";
import { GA_COUNTIES } from "@/lib/core/registry";
import { Unavailable } from "../Unavailable";
import { NewCampaign } from "./NewCampaign";

export const metadata: Metadata = { title: "Campaigns" };
export const dynamic = "force-dynamic";

/**
 * Campaign landing pages (Blueprint v5 §5.10): recipes of approved blocks,
 * composed here, published at /c/<slug>, with every version kept.
 */
export default async function CampaignsPage() {
  const session = await agentSession();
  if (session.state === "unknown") return <Unavailable reason={session.reason} />;
  if (session.state === "signed-out") redirect("/operations/sign-in");
  const read = await campaigns();
  const list = read.ok && "data" in read ? read.data : null;

  return (
    <main className="shell-w sec">
      <h1 className="serif">Campaigns</h1>
      <p className="t-sm c-3" style={{ marginTop: 4, maxWidth: 660 }}>
        Landing pages built from approved blocks: a heading, the county&apos;s programs, a value, a paragraph, a button. No code, no
        custom styles, no figures typed in: the numbers are the site&apos;s own. Every saved version is kept, and one is live at a time.
      </p>
      {!read.ok ? <p className="card p-4 t-sm c-neg" style={{ marginTop: 12 }}>The campaigns did not load. That is not the same as there being none.</p>
        : list === null ? <p className="card p-4 t-sm c-warn" style={{ marginTop: 12 }}>{"skipped" in read ? read.reason : "Campaigns need database update 20260928060000."}</p>
        : (
          <>
            <div style={{ marginTop: 12 }}><NewCampaign counties={GA_COUNTIES} /></div>
            {list.length ? (
              <div className="card" style={{ marginTop: 12, overflowX: "auto" }}>
                <table className="ops-table">
                  <thead><tr><th>Campaign</th><th>Address</th><th>Live</th><th>Versions</th></tr></thead>
                  <tbody>{list.map((c) => (
                    <tr key={c.id}>
                      <td><Link className="w6" href={`/operations/campaigns/${c.id}`}>{c.name}</Link></td>
                      <td className="t-xs">/c/{c.slug}</td>
                      <td>{c.live ? <span className="chip chip-pos t-2xs">✓ Version {c.live}</span> : <span className="chip t-2xs">Not published</span>}</td>
                      <td>{c.versions}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            ) : <p className="t-sm c-4" style={{ marginTop: 12 }}>None yet. The first starts as the assistance page for a county.</p>}
          </>
        )}
    </main>
  );
}
