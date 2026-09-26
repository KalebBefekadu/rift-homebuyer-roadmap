import type { Metadata } from "next";
import Link from "next/link";
import { teamSession } from "@/lib/db/team";
import { agentSession } from "@/lib/db/session";
import { coordinatorWork } from "@/lib/db/checklist";
import { STAGE_LABEL, marketDay } from "@/lib/core/progress";
import { isOpen } from "@/lib/core/checklist";
import { Ico, Mark } from "@/components/rift/icons";
import { signOutCoordinator } from "../actions";
import { TeamSignIn } from "./TeamSignIn";
import { Tasks } from "./Tasks";

export const metadata: Metadata = { title: "Your steps", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * The coordinator's page (Blueprint v5 §8.7): the steps their agent has
 * given the coordinator, on every active journey, in the stage each is in.
 * Record one: who did it, and the day. Nothing else of the agent's book is
 * here: no readouts, finances, notes or documents.
 *
 * Also where a coordinator signs in: the link the agent sends them is this
 * page, and signed out it asks for their address.
 */
export default async function TasksPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const s = await teamSession();

  if (s.state === "unknown") {
    return (
      <Shell>
        <h1 className="serif">Your steps could not be loaded</h1>
        <p className="t-sm c-3" style={{ marginTop: 10 }}>{s.reason}. Nothing has changed. Try again in a minute.</p>
      </Shell>
    );
  }
  if (s.state === "signed-out") {
    /* The agent, arriving here from Settings, is told what this page is
       rather than asked to sign in as somebody else. */
    const agent = s.reason === "no session" ? null : await agentSession();
    if (agent?.state === "signed-in") {
      return (
        <Shell>
          <h1 className="serif">This is your coordinator&apos;s page</h1>
          <p className="t-sm c-3" style={{ marginTop: 10, lineHeight: 1.6, maxWidth: 520 }}>
            A coordinator you add in Settings signs in here and sees only the steps you give the coordinator.
            You record everything from the journey pages.
          </p>
          <Link href="/operations/settings?section=team" className="btn btn-p btn-sm" style={{ marginTop: 16 }}>Team, in Settings</Link>
        </Shell>
      );
    }
    return (
      <Shell>
        <TeamSignIn error={sp.error ?? null} notMember={s.reason !== "no session" ? s.reason : null} />
      </Shell>
    );
  }

  const m = s.member;
  const work = await coordinatorWork(m.agentId);
  const journeys = work.ok && "data" in work ? work.data : null;
  const open = (journeys ?? []).reduce((n, j) => n + j.steps.filter((v) => isOpen(v.state)).length, 0);

  return (
    <Shell name={m.name}>
      <h1 className="serif">Your steps</h1>
      <p className="t-sm c-3" style={{ marginTop: 8, lineHeight: 1.6, maxWidth: 560 }}>
        The coordinator&apos;s steps on every active journey, in the stage it is in. Record each one when it is done:
        who did it and the day.
      </p>
      {!work.ok ? (
        <p className="t-sm c-warn" style={{ marginTop: 18 }}>These could not be read ({work.error}). That is not the same as having none.</p>
      ) : "skipped" in work ? (
        <p className="t-sm c-3" style={{ marginTop: 18 }}>{work.reason}.</p>
      ) : journeys === null ? (
        <p className="t-sm c-3" style={{ marginTop: 18 }}>The checklist needs a database update that has not been applied yet.</p>
      ) : !journeys.length ? (
        <p className="t-sm c-3" style={{ marginTop: 18 }}>Nothing for the coordinator in any journey&apos;s current stage.</p>
      ) : (
        <>
          <p className="t-sm w6" style={{ marginTop: 18 }}>{open ? `${open} open, across ${journeys.length} ${journeys.length === 1 ? "journey" : "journeys"}.` : "Everything here is recorded."}</p>
          <div className="col gap-3" style={{ marginTop: 12 }}>
            {journeys.map((j) => (
              <section key={j.journeyId} className="card p-4" aria-labelledby={`j-${j.journeyId}`}>
                <div className="between wrap gap-2">
                  <h2 id={`j-${j.journeyId}`} className="t-md w6" style={{ margin: 0 }}>{j.person}</h2>
                  <span className="chip t-2xs">{j.side === "buy" ? "Buying" : "Selling"} · {STAGE_LABEL[j.stage]}</span>
                </div>
                <p className="t-xs c-3" style={{ marginTop: 2 }}>{j.label}</p>
                <Tasks journeyId={j.journeyId} steps={j.steps} today={marketDay()} me={m.name.split(" ")[0]} />
              </section>
            ))}
          </div>
        </>
      )}
    </Shell>
  );
}

function Shell({ children, name }: { children: React.ReactNode; name?: string }) {
  return (
    <main className="shell-w sec" style={{ maxWidth: 760, paddingTop: 24 }}>
      <div className="between gap-2" style={{ marginBottom: 22 }}>
        <span className="row gap-2">
          <Mark size={18} />
          <span className="mark-name" style={{ fontSize: 17 }}>Rift</span>
          <span className="chip chip-out t-2xs">Coordinator</span>
        </span>
        {name ? (
          <form action={signOutCoordinator} className="row gap-2 t-xs c-3">
            <Ico.users size={12} aria-hidden />{name}
            <button className="opsx-signout" type="submit">Sign out</button>
          </form>
        ) : null}
      </div>
      {children}
    </main>
  );
}
