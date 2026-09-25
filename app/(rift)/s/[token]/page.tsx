import type { Metadata } from "next";
import { Mark } from "@/components/rift/icons";
import { openSummary } from "@/lib/db/summary-links";

export const metadata: Metadata = { title: "A summary of a move", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const DAY = (iso: string) => new Date(iso).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "long", day: "numeric", year: "numeric" });

/**
 * A read-only summary somebody in a household chose to share (ACCESS-02).
 *
 * The token is the credential and it is in the path, so this page sends no
 * referrer, is never indexed and is never cached by anything shared
 * (next.config.ts). An unknown, stopped or expired link all say the link
 * does not open, without saying which of them it was to a stranger guessing:
 * stopped and expired are named, because the holder of a real link deserves
 * to know it was not a typo.
 */
export default async function SummaryPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const r = await openSummary(token);
  const s = r.ok && "data" in r ? r.data : null;

  return (
    <main className="shell-w sec" style={{ maxWidth: 680 }}>
      <div className="row gap-2" style={{ marginBottom: 20 }}>
        <Mark size={20} /><span className="mark-name" style={{ fontSize: 19 }}>Rift</span>
      </div>

      {!s ? (
        <p className="t-md c-3">This summary could not be read just now. Try again in a minute.</p>
      ) : s.state !== "live" ? (
        <>
          <h1 className="serif" style={{ fontSize: 28 }}>This link does not open</h1>
          <p className="t-md c-3 mt-3" style={{ lineHeight: 1.6 }}>
            {s.state === "expired" ? "It has expired. " : s.state === "revoked" ? "The person who shared it has stopped it. " : ""}
            Ask the person who sent it for a new one.
          </p>
        </>
      ) : (
        <>
          <p className="t-sm c-4">Shared by {s.sharedBy}, for {s.label}. Open until {DAY(s.expiresAt)}.</p>
          <h1 className="serif" style={{ fontSize: 30, letterSpacing: "-0.02em", marginTop: 8 }}>{s.journeyLabel}</h1>
          <p className="t-sm c-3" style={{ marginTop: 6, lineHeight: 1.6 }}>
            With {s.agentName}. This is a read-only view of the parts {s.sharedBy} chose, worded as they see it. Amounts of money are
            left out. Nothing here is a contract, an offer or a loan decision.
          </p>
          {s.sections.map((sec) => (
            <section key={sec.title} className="card p-4" style={{ marginTop: 14 }} aria-labelledby={`s-${sec.title}`}>
              <h2 id={`s-${sec.title}`} className="t-md w6">{sec.title}</h2>
              <ul className="t-sm" style={{ marginTop: 8, display: "grid", gap: 6, paddingLeft: 18, lineHeight: 1.55 }}>
                {sec.lines.map((l, i) => <li key={i}>{l}</li>)}
              </ul>
            </section>
          ))}
        </>
      )}
    </main>
  );
}
