import type { Metadata } from "next";
import { openSummary } from "@/lib/db/summary-links";
import { stageStrip, WORK_STATE_LABEL } from "@/lib/core/progress";
import { SCOPE_LABEL } from "@/lib/core/summary-link";
import { Mark } from "@/components/rift/icons";

export const metadata: Metadata = { title: "A summary of a move", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const DAY = (iso: string) => new Date(iso).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "long", day: "numeric", year: "numeric" });

/**
 * A read-only summary, opened by a link the agent made for someone outside
 * the household (Blueprint v5 §7.2, ACCESS-02, D03). Only the link's scopes
 * are read and shown; there is nothing here to answer, change or download,
 * and nothing tracked. Headers: no referrer, no caching (next.config.ts).
 */
export default async function SummaryPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const r = await openSummary(token);
  const s = r.ok && "data" in r ? r.data : null;

  const shell = (children: React.ReactNode) => (
    <main className="shell-w sec" style={{ maxWidth: 640 }}>
      <div className="row gap-2" style={{ marginBottom: 20 }}><Mark size={19} /><span className="mark-name" style={{ fontSize: 18 }}>Rift</span></div>
      {children}
    </main>
  );

  if (!r.ok) return shell(<p className="t-md c-2">This summary cannot be opened right now. The link is fine; try again in a few minutes.</p>);
  if (!s) return shell(<p className="t-md c-2">This link does not open anything. It may have been copied incompletely.</p>);
  if (s.state !== "live") return shell(<p className="t-md c-2">This summary link has {s.state === "expired" ? "expired" : "been turned off"}. Ask the person who shared it for a new one.</p>);

  return shell(
    <>
      <div className="kicker c-brand">Shared with {s.label}</div>
      <h1 className="serif d3 mt-2">{s.journeyLabel || "A move in progress"}</h1>
      <p className="t-sm c-3 mt-2">A read-only summary: {s.scopes.map((x) => SCOPE_LABEL[x].toLowerCase()).join(" and ")}. It works until {DAY(s.expiresAt)}.</p>

      {s.progress ? (
        <section className="card p-4 mt-4" aria-labelledby="stand-h">
          <h2 id="stand-h" className="t-md w6">Where it stands</h2>
          <ol className="row wrap gap-1 mt-2" aria-label="Stages">
            {stageStrip(s.progress, s.visited).map((x) => (
              <li key={x.stage} className={`chip t-2xs ${x.state === "now" ? "chip-brand" : x.state === "done" ? "chip-pos" : "chip-out"}`}>
                {x.state === "done" ? "✓ " : x.state === "now" ? "● " : ""}{x.label}
              </li>
            ))}
          </ol>
          {s.contract ? (
            <div className="mt-3">
              <div className="t-sm w6">{s.contract.closed ? `Closed: ${s.contract.address}` : `Under contract: ${s.contract.address}`}</div>
              <ul className="mt-2" style={{ display: "grid", gap: 4 }}>
                {s.contract.work.map((w) => (
                  <li key={w.workstream} className="between gap-2 t-sm"><span>{w.label}</span><span className="c-3">{WORK_STATE_LABEL[w.state]}</span></li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      {s.scopes.includes("dates") ? (
        <section className="card p-4 mt-3" aria-labelledby="dates-h">
          <h2 id="dates-h" className="t-md w6">Contract dates</h2>
          {s.dates.length ? (
            <ul className="mt-2" style={{ display: "grid", gap: 4 }}>
              {s.dates.map((d) => <li key={d.label + d.when} className="between gap-2 t-sm"><span>{d.label}</span><span className={d.missed ? "c-neg" : "c-3"}>{d.when}{d.missed ? " · passed" : ""}</span></li>)}
            </ul>
          ) : <p className="t-sm c-3 mt-1">No checked contract dates to show.</p>}
        </section>
      ) : null}

      <p className="t-2xs c-4 mt-4" style={{ lineHeight: 1.6 }}>Nothing here is a contract, an offer or a loan decision. Money, notes and documents are never shared this way.</p>
    </>,
  );
}
