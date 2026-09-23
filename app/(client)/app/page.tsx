import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { clientSession, myJourneys } from "@/lib/db/client";
import { buyerSearchOn, SIDE_LABEL } from "@/lib/core/journey";
import { ClientShell } from "./ClientShell";

export const metadata: Metadata = { title: "Your move", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Where a signed-in buyer lands. One journey goes straight to it; several are
 * listed. A login with no membership is told so plainly: signing in proves an
 * address, it does not grant anything (REQ-ACCESS-01).
 */
export default async function ClientHome() {
  if (!buyerSearchOn(process.env)) {
    return <ClientShell agentName={null}><p className="t-sm c-3">This is switched off at the moment. Your agent can still help directly.</p></ClientShell>;
  }
  const session = await clientSession();
  if (session.state === "signed-out") redirect("/app/sign-in");
  if (session.state === "unknown") {
    return (
      <ClientShell agentName={null}>
        <h1 className="serif" style={{ fontSize: 26 }}>We could not check your sign-in.</h1>
        <p className="t-sm c-3" style={{ marginTop: 8, lineHeight: 1.6 }}>
          Something on our side is slow to answer. You are probably still signed in; reload in a moment.
        </p>
      </ClientShell>
    );
  }

  const mine = await myJourneys(session.userId);
  if (!mine.ok || "skipped" in mine) {
    return (
      <ClientShell agentName={null}>
        <h1 className="serif" style={{ fontSize: 26 }}>Your move did not load.</h1>
        <p className="t-sm c-3" style={{ marginTop: 8, lineHeight: 1.6 }}>Nothing is lost. Try again in a minute.</p>
      </ClientShell>
    );
  }
  const list = mine.data;
  if (list.length === 1) redirect(`/app/j/${list[0]!.journeyId}`);

  return (
    <ClientShell agentName={list[0]?.agentName ?? null}>
      <h1 className="serif" style={{ fontSize: 28, letterSpacing: "-0.02em" }}>Your move</h1>
      {list.length === 0 ? (
        <p className="t-sm c-3" style={{ marginTop: 10, lineHeight: 1.6 }}>
          You are signed in as {session.email}, but nothing has been shared with this address. If your agent sent you an
          invitation link, open it. It only works for the address it was sent to.
        </p>
      ) : (
        <ul style={{ marginTop: 16, display: "grid", gap: 8 }}>
          {list.map((m) => (
            <li key={m.journeyId}>
              <Link href={`/app/j/${m.journeyId}`} className="card p-4 between gap-2" style={{ display: "flex" }}>
                <span><span className="t-md w6">{m.journeyLabel}</span><span className="t-xs c-4"> · with {m.agentName}</span></span>
                <span className="chip t-2xs">{SIDE_LABEL[m.side]}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </ClientShell>
  );
}
