import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { agentSession } from "@/lib/db/session";
import { Unavailable } from "../Unavailable";
import { roster, liveRelationships, finishedRelationships } from "@/lib/db/clients";
import { rulesOrDefaults } from "@/lib/db/settings";
import { STALL_CHIP } from "@/lib/core/pipeline";
import { Forward } from "./Forward";
import { BAND_LABEL, BAND_TONE, type Band } from "@/lib/core/lead";
import { Ico } from "@/components/rift/icons";
import { StudioHeader } from "../StudioHeader";
import { Search } from "./Search";

export const metadata: Metadata = { title: "People" };
export const dynamic = "force-dynamic";

const WHEN = (iso: string | null) => {
  if (!iso) return "";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.round(days / 30)} months ago`;
  return `${Math.round(days / 365)} years ago`;
};

/**
 * Everybody, findable.
 *
 * Today's screen is the right default and the wrong tool for one job: somebody
 * rings up and says their name. It ranks by what the answers imply is urgent,
 * shows only who has been given a stage, and caps at what fits, so a lead who
 * came through the funnel this morning and has not been picked up is not on it.
 *
 * This is deliberately the unranked view. No scoring order, no urgency, no
 * opinion about who matters. A list, newest first, with a box to search it.
 */
export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await agentSession();
  /* Three answers, not two. A blip is not an expired session: redirecting on
     "unknown" shows a sign-in form to somebody whose cookie is perfectly
     fine, which says something false about what just happened.

     Genuinely signed out, it redirects rather than explaining: matching
     settings, questions, add and the client record. /operations itself is the
     front door and keeps its explanation for somebody who arrived by
     accident, but an inner page reached without a session is somebody whose
     link expired, and the useful thing is to put them where they can sign in.
     Two behaviours for one situation in one surface is how a product teaches
     people not to trust what it says. */
  if (session.state === "unknown") return <Unavailable reason={session.reason} />;
  if (session.state === "signed-out") redirect("/operations/sign-in");
  const agent = session.agent;

  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) as string | undefined;

  /* One round. None of these depends on another, and the forward view must not
     make the list of people wait: if the forecast query is the slow one, the
     thing the agent actually came here for is still the roster. */
  const [list, rules, live, finished] = await Promise.all([
    roster({
      q: one("q"),
      filter: (["all", "working", "new", "archived"] as const).find((f) => f === one("filter")) ?? "all",
      side: (["all", "buy", "sell"] as const).find((s) => s === one("side")) ?? "all",
    }),
    rulesOrDefaults(agent.agentId),
    liveRelationships(),
    finishedRelationships(),
  ]);

  const people = list.ok && "data" in list ? list.data.people : [];
  const more = list.ok && "data" in list ? list.data.more : false;
  const searching = Boolean(one("q")?.trim());

  /* A failed or skipped read is not an empty book of business.

     `finished` falling back to [] is safe and correct: it means every stage
     reports "assumed", which is exactly what the screen should say when it
     cannot read the history. `live` falling back to [] is NOT safe in the same
     way: it renders "Nothing to forecast yet" to an agent with eleven live
     relationships. So the panel is shown only when the live read actually
     answered, and its absence is silence rather than a false statement. */
  const liveOk = live.ok && "data" in live;
  const forwardRows = liveOk ? live.data : [];
  const historyRows = finished.ok && "data" in finished ? finished.data : [];

  return (
    <>
      <StudioHeader agentName={agent.name} undecided={rules.undecided.length} current="clients" />

      <main className="shell-w sec" style={{ paddingTop: 28 }}>
        <h1 className="serif" style={{ fontSize: "clamp(24px,3vw,34px)", letterSpacing: "-0.02em" }}>People</h1>
        <p className="t-sm c-3" style={{ marginTop: 8, maxWidth: 560, lineHeight: 1.6 }}>
          Everyone, in the order they arrived. Today ranks them by what needs doing;
          this is for when you already know whose name you are looking for.
        </p>

        {/* Only when the roster is unfiltered. A forecast sitting above the
            results of a name search is answering a question nobody asked, and
            it would look like a forecast OF the search. */}
        {liveOk && !searching && (one("filter") ?? "all") === "all" && (one("side") ?? "all") === "all" ? (
          <div style={{ marginTop: 20 }}>
            <Forward
              live={forwardRows}
              finished={historyRows}
              commissionPct={rules.rules.commissionPct.value}
              /* Whether that percentage is his decision or our default. A
                 forecast quoting a commission nobody chose is the house bug:
                 a dial connected to nothing, and the money line here is the
                 most quotable number on the screen. */
              commissionDecided={!rules.undecided.includes("commissionPct")}
            />
          </div>
        ) : null}

        <div style={{ marginTop: 20, maxWidth: 560 }}>
          <Suspense fallback={<div className="t-sm c-4">Loading…</div>}>
            <Search total={people.length} more={more} />
          </Suspense>
        </div>

        {/* A read that failed is not an empty list, and must never render as
            one. "You have nobody" and "we could not ask" are the same picture
            and completely different facts. */}
        {!list.ok ? (
          <div className="card p-4" style={{ marginTop: 20, borderColor: "var(--warn-line)" }}>
            <div className="row gap-2"><Ico.alert size={15} className="c-warn" />
              <span className="t-sm w6">The list could not be read.</span>
            </div>
            <p className="t-sm c-3" style={{ marginTop: 8 }}>
              {list.error}. This is not an empty list, it is a list we could not fetch.
            </p>
          </div>
        ) : "skipped" in list ? (
          <div className="card p-4" style={{ marginTop: 20 }}>
            <p className="t-sm c-3">{list.reason}.</p>
          </div>
        ) : people.length === 0 ? (
          <div className="card p-4" style={{ marginTop: 20 }}>
            <p className="t-sm c-3">
              {searching
                ? "Nobody matches that. Try part of a name, or an email."
                : "Nobody yet. People arrive here when they finish a readout and leave their details, or you can add somebody yourself."}
            </p>
            {!searching ? (
              <Link href="/operations/add" className="btn btn-p btn-sm" style={{ marginTop: 12 }}>Add someone</Link>
            ) : null}
          </div>
        ) : (
          <div className="card" style={{ marginTop: 20, overflow: "hidden" }}>
            {people.map((p, i) => (
              <Link
                key={p.id}
                href={`/operations/lead/${p.id}`}
                className="between gap-3"
                style={{
                  padding: "13px 16px", gap: 12,
                  borderBottom: i === people.length - 1 ? 0 : "1px solid var(--line-3)",
                }}
              >
                <div className="col" style={{ gap: 3, minWidth: 0 }}>
                  <div className="row gap-2 wrap">
                    {/* The name, or an honest stand-in. A row reading only a dash is
                        somebody who left an email and no name, and pretending
                        otherwise makes him look for a record that is not
                        missing. */}
                    <span className="t-md w6">{p.name?.trim() || p.email || "Someone who left no name"}</span>
                    <span className="chip t-2xs">{p.side === "buy" ? "Buying" : "Selling"}</span>
                    {p.band ? (
                      <span className={`chip t-2xs ${BAND_TONE[p.band as Band] ?? ""}`}>
                        {BAND_LABEL[p.band as Band] ?? p.band}
                      </span>
                    ) : null}
                    {p.archivedAt ? <span className="chip t-2xs">Archived</span> : null}
                  </div>

                  <div className="t-xs c-4" style={{
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {[p.name?.trim() ? p.email : null, p.phone, `arrived ${WHEN(p.createdAt)}`]
                      .filter(Boolean).join(" · ")}
                  </div>

                  {p.nextAction ? (
                    <div className="t-xs c-3" style={{ marginTop: 2 }}>
                      <Ico.clock size={11} style={{ marginRight: 5 }} />
                      {p.nextAction}{p.nextDue ? `, ${p.nextDue}` : ""}
                    </div>
                  ) : null}
                </div>

                <div className="row gap-2" style={{ flex: "none" }}>
                  {p.stage ? (
                    <span className="t-xs c-3 hide-sm">{p.stage}</span>
                  ) : (
                    <span className="t-xs c-4 hide-sm">Not picked up</span>
                  )}
                  {p.stall ? (
                    <span className={`chip t-2xs ${STALL_CHIP[p.stall.level].c}`}>
                      {STALL_CHIP[p.stall.level].l}
                    </span>
                  ) : null}
                  <Ico.chevR size={14} className="c-4" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
