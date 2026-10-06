import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { clientSession, householdOf, myJourneys, myNotices } from "@/lib/db/portal";
import { NoticesToggle } from "./NoticesToggle";
import { buyerSearchOn, ROLE_LABEL } from "@/lib/core/journey";
import { ClientShell } from "../ClientShell";
import { Help } from "../Help";
import { PasswordForm } from "./PasswordForm";

export const metadata: Metadata = { title: "Your account", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * The client's own account (manual review WS11.7): which address they sign in
 * with, a password to set or change, and who else is on their move.
 *
 * Changing the email is not offered. The invitation, and so the access, is
 * tied to the address the agent invited; a self-service change would either
 * strand the membership or let a login move access to an address nobody
 * checked. The agent re-invites the new address instead.
 */
export default async function Account({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (!buyerSearchOn(process.env)) redirect("/app");
  const session = await clientSession();
  if (session.state === "signed-out") redirect("/app/sign-in?next=/app/account");
  if (session.state === "unknown") redirect("/app");
  const q = await searchParams;

  const mine = await myJourneys(session.userId);
  const list = mine.ok && "data" in mine ? mine.data : [];
  const households = await Promise.all(list.map(async (m) => {
    const [h, notices] = await Promise.all([householdOf(m), myNotices(m)]);
    return { m, people: h.ok && "data" in h ? h.data : [], notices };
  }));

  return (
    <ClientShell agentName={list[0]?.agentName ?? null}>
      <h1 className="serif" style={{ fontSize: 28, letterSpacing: "-0.02em" }}>Your account</h1>

      <section className="card p-4" style={{ marginTop: 16 }} aria-labelledby="signin-h">
        <h2 id="signin-h" className="t-md w6">Signing in</h2>
        <p className="t-sm c-3" style={{ marginTop: 6, lineHeight: 1.6 }}>
          You sign in as <span className="w6 c-2">{session.email}</span>. To use a different address, ask your agent to
          invite it; access belongs to the address that was invited.
        </p>
        <PasswordForm reset={q.reset === "1"} email={session.email} />
      </section>

      {households.map(({ m, people, notices }) => (
        <section key={m.journeyId} className="card p-4" style={{ marginTop: 14 }} aria-labelledby={`h-${m.journeyId}`}>
          <h2 id={`h-${m.journeyId}`} className="t-md w6">Who is on &ldquo;{m.journeyLabel}&rdquo;</h2>
          <ul style={{ marginTop: 8, display: "grid", gap: 6 }}>
            <li className="t-sm c-2">{m.agentName} <span className="c-4">· your agent</span></li>
            {people.map((p, i) => (
              <li key={i} className="t-sm c-2">
                {p.name}{p.you ? " (you)" : ""} <span className="c-4">· {ROLE_LABEL[p.role]}{p.joined ? "" : ", invited"}</span>
              </li>
            ))}
          </ul>
          <p className="t-xs c-4" style={{ marginTop: 8, lineHeight: 1.5 }}>To add or remove someone, ask your agent.</p>
          {notices !== null ? <NoticesToggle journeyId={m.journeyId} on={notices} agentFirst={m.agentName.trim().split(/\s+/)[0] ?? m.agentName} /> : null}
        </section>
      ))}

      {list[0] ? <Help agentName={list[0].agentName} agentEmail={list[0].agentEmail} /> : null}
    </ClientShell>
  );
}
