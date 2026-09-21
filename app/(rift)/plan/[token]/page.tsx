import type { Metadata } from "next";
import Link from "next/link";
import { readPlanByToken } from "@/lib/db/plan";
import { currentAgentPublic } from "@/lib/db/service";
import { groupPlan, summarise, headline, ownerLabel, daysUntil } from "@/lib/core/plan";
import { Ico, Mark } from "@/components/rift/icons";

export const metadata: Metadata = {
  title: "Your plan",
  /* Never indexed. It is somebody's plan behind an unguessable link, and a
     link unguessable to a person is trivially findable by a crawler that has
     been given it. Same rule as the shared readout. */
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const WHEN = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
  month: "short", day: "numeric", timeZone: "UTC",
});

/**
 * The client's own page.
 *
 * Everything else this product holds points one way: the agent can see the
 * person, the person sees one frozen readout and then nothing. From the moment
 * somebody becomes a client, the "client-experience platform" goes dark. This
 * is the first surface pointing the other way.
 *
 * What it shows is deliberately small: what has been agreed, who owes it, and
 * by when. Not a dashboard. A person checks this between other things, on a
 * phone, to answer one question — is anything waiting on me?
 *
 * No account, like everything else here. The token is the authorisation.
 *
 * The agent's notes are not on this page and cannot be: `readPlanByToken`
 * selects a fixed, narrow column list, so the score, the band, the contact
 * basis and the signals never reach the renderer at all.
 */
export default async function ClientPlan({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const read = await readPlanByToken(token);
  const plan = read.ok && "data" in read ? read.data : null;

  /* A broken query is not a revoked link.
     
     Telling somebody "this plan does not exist" when the database hiccupped
     says something false about their agent — and they have no way to tell the
     difference. Same distinction the shared readout makes, for the same
     reason. */
  /* `skipped` is not `null`, and the difference is the whole point of the
     union. With no database configured the read is skipped — and falling
     through to "this link is no longer open" would tell somebody their agent
     revoked their plan when in fact nothing was ever asked. */
  if (!read.ok || "skipped" in read) {
    return (
      <Shell>
        <h1 className="serif" style={{ fontSize: 28 }}>We cannot open this right now.</h1>
        <p className="lede" style={{ marginTop: 12, maxWidth: 520 }}>
          Something on our side is not answering. This does not mean your link has expired —
          try again in a few minutes, and if it keeps happening, tell your agent.
        </p>
      </Shell>
    );
  }

  if (!plan) {
    return (
      <Shell>
        <h1 className="serif" style={{ fontSize: 28 }}>This link is no longer open.</h1>
        <p className="lede" style={{ marginTop: 12, maxWidth: 520 }}>
          Plans can be closed, and links get copied further than anyone intended, so they do
          not last forever. Ask your agent for a new one — nothing has been lost.
        </p>
      </Shell>
    );
  }

  const agent = await currentAgentPublic();
  const agentFirst = (agent?.name ?? "your agent").trim().split(/\s+/)[0]!;

  const sections = groupPlan(plan.items);
  const s = summarise(plan.items);
  const side = plan.side === "buy" ? "buy" : "sell";

  return (
    <Shell tone={side}>
      <div className="t-2xs c-4 w6" style={{ letterSpacing: ".07em", textTransform: "uppercase" }}>
        {plan.firstName ? `${plan.firstName}’s plan` : "Your plan"}
      </div>

      <h1 className="serif" style={{
        fontSize: "clamp(24px,3.4vw,36px)", lineHeight: 1.15, letterSpacing: "-0.022em", marginTop: 8, maxWidth: 620,
      }}>
        {headline(s)}
      </h1>

      {plan.stage ? (
        <p className="t-sm c-3" style={{ marginTop: 12, maxWidth: 560, lineHeight: 1.6 }}>
          Where things stand: <strong>{plan.stage}</strong>
          {plan.stageSince ? ` since ${WHEN(plan.stageSince.slice(0, 10))}` : ""}.
          {" "}This page is kept up to date by {agentFirst}, and nothing on it is automatic.
        </p>
      ) : null}

      {/* The plan being empty is a real state and reads as one. A client who
          opens this the day after a first call should not see a broken page. */}
      {sections.length === 0 ? (
        <div className="card p-4" style={{ marginTop: 22 }}>
          <p className="t-sm c-3">
            Nothing is written here yet. {agentFirst} adds each step as you agree it, so this
            stays a record of what was actually decided rather than a checklist somebody
            generated.
          </p>
        </div>
      ) : (
        <div className="col gap-4" style={{ marginTop: 26 }}>
          {sections.map((sec) => (
            <section key={sec.bucket}>
              <div className="row gap-2" style={{ marginBottom: 10 }}>
                <span className="t-2xs c-4 w6" style={{ letterSpacing: ".07em", textTransform: "uppercase" }}>
                  {sec.label}
                </span>
                {sec.bucket === "overdue" ? <span className="chip chip-neg t-2xs">{sec.items.length}</span> : null}
              </div>

              <div className="card" style={{ overflow: "hidden" }}>
                {sec.items.map((item, i) => {
                  const who = ownerLabel(item, { agent: agentFirst, client: plan.firstName }, "client");
                  const mine = item.owner === "client";
                  const late = sec.bucket === "overdue";
                  return (
                    <div key={item.id} className="between gap-3" style={{
                      padding: "13px 16px", gap: 12, alignItems: "flex-start",
                      borderBottom: i === sec.items.length - 1 ? 0 : "1px solid var(--line-3)",
                      background: mine && !item.doneAt ? "var(--sunk)" : undefined,
                    }}>
                      <div className="row gap-2" style={{ alignItems: "flex-start", minWidth: 0 }}>
                        <span style={{ flex: "none", marginTop: 2 }}>
                          {item.doneAt
                            ? <Ico.check size={14} className="c-pos" />
                            : <Ico.clock size={14} className={late ? "c-neg" : "c-4"} />}
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <div className="t-sm w5" style={{
                            lineHeight: 1.5,
                            textDecoration: item.doneAt ? "line-through" : undefined,
                            color: item.doneAt ? "var(--ink-4)" : undefined,
                          }}>{item.title}</div>
                          <div className="t-xs c-4" style={{ marginTop: 3 }}>
                            {/* Who, always. A plan where nobody owes anything is
                                a list of hopes. */}
                            {item.doneAt ? `${who} · done` : who}
                            {item.dueOn && !item.doneAt
                              ? ` · ${WHEN(item.dueOn)}${late ? ` (${Math.abs(daysUntil(item.dueOn, new Date()))} days ago)` : ""}`
                              : ""}
                          </div>
                        </div>
                      </div>

                      {mine && !item.doneAt ? (
                        <span className="chip t-2xs" style={{ flex: "none" }}>You</span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <div className="card p-4" style={{ marginTop: 26 }}>
        <div className="t-sm w6">If something here is wrong</div>
        <p className="t-sm c-3" style={{ marginTop: 6, lineHeight: 1.6 }}>
          Tell {agentFirst}. This page has no way to reply, deliberately — a message typed into
          a page nobody is watching is worse than no message at all.
        </p>
        <Link href="/book" className="btn btn-s btn-sm" style={{ marginTop: 12 }}>
          <Ico.cal size={14} />Book fifteen minutes
        </Link>
      </div>

      <p className="t-xs c-4" style={{ marginTop: 22, lineHeight: 1.6, maxWidth: 560 }}>
        This link is private. Anyone who has it can read this page, so send it on only to
        people you want reading your plan — and ask {agentFirst} to close it if it ever goes
        further than you meant.
      </p>
    </Shell>
  );
}

function Shell({ children, tone = "buy" }: { children: React.ReactNode; tone?: "buy" | "sell" }) {
  return (
    <div className={tone}>
      <header style={{ borderBottom: "1px solid var(--line-2)" }}>
        <div className="shell-w between" style={{ height: 56 }}>
          <div className="row gap-2">
            <Mark size={19} />
            <span className="mark-name" style={{ fontSize: 18 }}>Rift</span>
            <span className="chip chip-brand hide-sm t-2xs">Your plan</span>
          </div>
          <Link href="/privacy" className="t-xs c-4">What we keep</Link>
        </div>
      </header>
      <main className="shell-w sec" style={{ maxWidth: 720, paddingTop: 30 }}>{children}</main>
    </div>
  );
}
