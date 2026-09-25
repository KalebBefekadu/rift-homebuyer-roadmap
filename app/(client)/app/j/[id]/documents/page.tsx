import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { clientDocuments, clientSession, memberOf } from "@/lib/db/client";
import { buyerSearchOn } from "@/lib/core/journey";
import { FAMILY_LABEL } from "@/lib/core/document";
import { Ico } from "@/components/rift/icons";
import { ClientShell } from "../../../ClientShell";

export const metadata: Metadata = { title: "Your documents", robots: { index: false } };
export const dynamic = "force-dynamic";

const DAY = (iso: string) => new Date(iso).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric" });

/**
 * Every document shared with this member, in one place (Blueprint v5 §7.2),
 * newest first. What they may open is one rule, `clientDocuments`: shared
 * with them by the agent, or attached to an offer they were asked about.
 * Gated like the journey page: another address or a revoked member gets a
 * 404, because whether this journey exists is not theirs to know.
 */
export default async function ClientDocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  if (!buyerSearchOn(process.env)) redirect("/app");
  const session = await clientSession();
  if (session.state === "signed-out") redirect("/app/sign-in");
  if (session.state === "unknown") {
    return <ClientShell agentName={null}><p className="t-sm c-3">We could not check your sign-in just now. Reload in a moment.</p></ClientShell>;
  }
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const m = await memberOf(session.userId, id);
  if (!m.ok || "skipped" in m) {
    return <ClientShell agentName={null}><p className="t-sm c-3">This did not load. Nothing is lost. Try again in a minute.</p></ClientShell>;
  }
  if (!m.data) notFound();
  const member = m.data;
  const agentFirst = member.agentName.trim().split(/\s+/)[0] ?? member.agentName;
  const r = await clientDocuments(member);
  const docs = r.ok && "data" in r ? [...r.data.documents].sort((a, b) => b.at.localeCompare(a.at)) : null;

  return (
    <ClientShell agentName={member.agentName} journey={{ id, active: "documents", side: member.side }}
      reach={{ email: member.agentEmail, phone: member.agentPhone }}>
      <Link href={`/app/j/${id}`} className="t-sm c-3">← {member.journeyLabel}</Link>
      <h1 className="serif" style={{ fontSize: 28, letterSpacing: "-0.02em", marginTop: 8 }}>Documents</h1>
      <p className="t-sm c-3" style={{ marginTop: 6, lineHeight: 1.6 }}>
        Everything {agentFirst} has shared with you, newest first. Each opens for one minute; download the ones you want to keep.
      </p>

      {!docs ? (
        <p className="t-sm c-3" style={{ marginTop: 18 }}>
          Your documents could not be read just now. That is not the same as there being none; reload in a moment.
        </p>
      ) : !docs.length ? (
        <p className="t-sm c-3" style={{ marginTop: 18, lineHeight: 1.6 }}>
          Nothing has been shared with you yet. When {agentFirst} shares a disclosure, an inspection report or an offer, it appears here.
        </p>
      ) : (
        <ul className="card" style={{ marginTop: 16, overflow: "hidden" }}>
          {docs.map((d, k) => (
            <li key={d.id} className="between gap-3 wrap" style={{ padding: "13px 16px", borderBottom: k < docs.length - 1 ? "1px solid var(--line-3)" : undefined }}>
              <span className="row gap-2" style={{ minWidth: 0, alignItems: "flex-start" }}>
                <Ico.doc size={16} className="c-3" style={{ flex: "none", marginTop: 2 }} />
                <span>
                  <span className="t-md w55" style={{ display: "block" }}>{d.label}</span>
                  <span className="t-xs c-4">{FAMILY_LABEL[d.family]} · {DAY(d.at)}{d.why === "offer" ? " · from an offer you were asked about" : ""}</span>
                </span>
              </span>
              <a className="btn btn-s btn-sm" style={{ minHeight: 44 }} href={`/api/app/document?journeyId=${id}&id=${d.id}`} target="_blank" rel="noreferrer">Open</a>
            </li>
          ))}
        </ul>
      )}
    </ClientShell>
  );
}
