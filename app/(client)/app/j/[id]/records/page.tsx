import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { clientRecords, clientSession, memberOf } from "@/lib/db/client";
import { buyerSearchOn } from "@/lib/core/journey";
import { FAMILY_LABEL, type Family } from "@/lib/core/document";
import { ClientShell } from "../../../ClientShell";
import { PrintButton } from "@/components/rift/PrintButton";

export const metadata: Metadata = { title: "Your records", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * The household's records on one page (blueprint v4 W11; B20, AT36): what
 * they asked for, the homes, showings and offers, where the move stands and
 * the checked contract dates, worded exactly as their own pages word them.
 * Printing it, or saving it as a PDF, is how they keep a copy that does not
 * depend on Rift. Gated like the journey page: a revoked member or another
 * address gets a 404.
 */
export default async function ClientRecords({ params }: { params: Promise<{ id: string }> }) {
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
  const r = await clientRecords(member);
  const records = r.ok && "data" in r ? r.data : null;
  const asOf = new Date().toLocaleString("en-US", { timeZone: "America/New_York", month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

  return (
    <ClientShell agentName={member.agentName} journey={{ id, active: "records", side: member.side }}
      reach={{ email: member.agentEmail, phone: member.agentPhone }}>
      <Link href={`/app/j/${id}`} className="t-sm c-3 no-print">← {member.journeyLabel}</Link>
      <h1 className="serif" style={{ fontSize: 28, letterSpacing: "-0.02em", marginTop: 8 }}>Your records</h1>
      <p className="t-sm c-3" style={{ marginTop: 6, lineHeight: 1.6 }}>
        {member.journeyLabel}, with {member.agentName}. As of {asOf} (Georgia time). Everything here is what your own pages show;
        print it or save it as a PDF to keep your own copy.
      </p>
      <div className="no-print" style={{ marginTop: 12 }}><PrintButton /></div>

      {!records ? (
        <p className="t-sm c-3" style={{ marginTop: 18 }}>Your records could not be read just now. Nothing is lost. Try again in a minute.</p>
      ) : (
        <>
          {records.sections.map((s) => (
            <section key={s.title} className="card p-4" style={{ marginTop: 14 }} aria-labelledby={`rec-${s.title}`}>
              <h2 id={`rec-${s.title}`} className="t-md w6">{s.title}</h2>
              <ul className="t-sm" style={{ marginTop: 8, display: "grid", gap: 6, paddingLeft: 18, lineHeight: 1.55 }}>
                {s.lines.map((l, i) => <li key={i}>{l}</li>)}
              </ul>
            </section>
          ))}
          {records.documents.length ? (
            <section className="card p-4" style={{ marginTop: 14 }} aria-labelledby="rec-docs">
              <h2 id="rec-docs" className="t-md w6">Documents shared with you</h2>
              <ul className="t-sm" style={{ marginTop: 8, display: "grid", gap: 6, paddingLeft: 18 }}>
                {records.documents.map((d) => (
                  <li key={d.id}>
                    <a className="u" href={`/api/app/document?journeyId=${id}&id=${d.id}`} target="_blank" rel="noreferrer">{d.label}</a>{" "}
                    <span className="c-4">({FAMILY_LABEL[d.family as Family] ?? "Document"})</span>
                  </li>
                ))}
              </ul>
              <p className="t-xs c-4" style={{ marginTop: 8 }}>Each link opens the file for one minute. Download the ones you want to keep.</p>
            </section>
          ) : null}
        </>
      )}
    </ClientShell>
  );
}
