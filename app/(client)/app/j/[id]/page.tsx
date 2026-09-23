import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { clientBrief, clientHomes, clientSession, memberOf } from "@/lib/db/client";
import { buyerSearchOn, canRespond, ROLE_LABEL } from "@/lib/core/journey";
import { describe, diffBriefs, FIELDS, STRENGTH_LABEL, type SearchStatus } from "@/lib/core/search";
import { ClientShell } from "../../ClientShell";
import { ClientBrief } from "./ClientBrief";
import { ClientHomes } from "./ClientHomes";

export const metadata: Metadata = { title: "Your move", robots: { index: false } };
export const dynamic = "force-dynamic";

const DAY = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric" });

/** What the search status means to the buyer, in words that never overclaim. */
const FOR_BUYER: Record<SearchStatus, (agent: string, since: string | null) => string> = {
  draft: (a) => `${a} has not written your search priorities down yet.`,
  "awaiting-approval": (a) => `${a} is reviewing these before setting up your search.`,
  "manual-action-needed": (a) => `${a} approved these and is setting up your search in the MLS.`,
  "active-confirmed": (a, since) => `${a} set up your search with these on ${since ? DAY(since) : "a recent date"}. New listings that match come from the MLS system, not from Rift.`,
  "update-pending": (a) => `These changed since your search was set up. ${a} will review the change and update it; until then the search runs as it was.`,
  paused: (a) => `${a} has paused your search for now.`,
  unknown: () => "We could not read your search's status just now. That is not the same as it being off.",
};

/**
 * One journey, as the buyer sees it: their priorities, what changed, their
 * answer, and the homes.
 *
 * Every read goes through `memberOf` first. A revoked member, or somebody
 * signed in with a different address, gets a 404 rather than a page: whether
 * a journey exists is itself not theirs to know.
 */
export default async function ClientJourney({ params }: { params: Promise<{ id: string }> }) {
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

  const [brief, homes] = await Promise.all([
    member.scopes.includes("search") && member.side === "buy" ? clientBrief(member) : Promise.resolve(null),
    member.scopes.includes("homes") && member.side === "buy" ? clientHomes(member) : Promise.resolve(null),
  ]);
  const b = brief && brief.ok && "data" in brief ? brief.data : null;
  const diff = b?.revision && b.previous ? diffBriefs(b.previous.brief, b.revision.brief) : null;
  const h = homes && homes.ok && "data" in homes ? homes.data : null;
  const respond = canRespond(member.role);

  return (
    <ClientShell agentName={member.agentName}>
      <Link href="/app" className="t-sm c-3">← Your move</Link>
      <h1 className="serif" style={{ fontSize: 28, letterSpacing: "-0.02em", marginTop: 8 }}>{member.journeyLabel}</h1>
      <p className="t-xs c-4" style={{ marginTop: 4 }}>
        With {member.agentName} · you are signed in as {member.name} ({ROLE_LABEL[member.role].toLowerCase()})
      </p>

      {member.side !== "buy" ? (
        <p className="t-sm c-3" style={{ marginTop: 16, lineHeight: 1.6 }}>
          {agentFirst} will share more here as your sale moves forward.
        </p>
      ) : null}

      {member.side === "buy" && member.scopes.includes("search") ? (
        <section className="card p-4" style={{ marginTop: 18 }} aria-labelledby="pri-h">
          <h2 id="pri-h" className="t-md w6">Your search priorities</h2>
          {!b ? (
            <p className="t-sm c-3" style={{ marginTop: 8 }}>Your priorities did not load. Nothing is lost; reload in a moment.</p>
          ) : !b.revision ? (
            <p className="t-sm c-3" style={{ marginTop: 8, lineHeight: 1.6 }}>{FOR_BUYER.draft(agentFirst, null)} You will see them here, and can correct anything, once {agentFirst} has.</p>
          ) : (
            <>
              <p className="t-xs c-3" style={{ marginTop: 4, lineHeight: 1.6 }}>{FOR_BUYER[b.status](agentFirst, b.activeSince)}</p>

              {diff && (diff.changes.length || diff.questionsAdded.length) ? (
                <div className="card p-3" style={{ marginTop: 12, background: "var(--sunk)" }}>
                  <div className="t-xs w6">What changed since the last version</div>
                  <ul className="t-sm" style={{ marginTop: 4, display: "grid", gap: 3 }}>
                    {diff.changes.map((c) => (
                      <li key={(c.after ?? c.before)!.id}>
                        {FIELDS[(c.after ?? c.before)!.field].label}:{" "}
                        {c.kind === "added" ? `added, ${describe(c.after!)}` : c.kind === "removed" ? `removed (was ${describe(c.before!)})` : describe(c.before!) === describe(c.after!)
                          ? `${describe(c.after!)}, now ${c.after!.strength === "hard" ? "a must have" : c.after!.strength === "preference" ? "a nice to have" : "not decided"}`
                          : `${describe(c.before!)} to ${describe(c.after!)}`}
                      </li>
                    ))}
                    {diff.questionsAdded.map((q) => <li key={q}>New question: {q}</li>)}
                  </ul>
                </div>
              ) : null}

              <ul style={{ marginTop: 12, display: "grid", gap: 6 }}>
                {b.revision.brief.criteria.map((c) => (
                  <li key={c.id} className="between gap-2 wrap t-sm">
                    <span><span className="w6">{FIELDS[c.field].label}:</span> {describe(c)}</span>
                    <span className={`chip t-2xs ${c.strength === "hard" ? "chip-pos" : c.strength === "undecided" ? "chip-warn" : ""}`}>
                      {c.strength === "hard" ? "Must have" : c.strength === "preference" ? "Nice to have" : STRENGTH_LABEL.undecided}
                    </span>
                  </li>
                ))}
              </ul>
              {b.hidden ? (
                <p className="t-2xs c-4" style={{ marginTop: 6 }}>
                  {b.hidden} item{b.hidden === 1 ? " about price is" : "s about price are"} not shared with you.
                </p>
              ) : null}
              {b.revision.brief.questions.length ? (
                <div style={{ marginTop: 10 }}>
                  <div className="t-xs w6">Still to decide</div>
                  <ul className="t-sm c-2" style={{ marginTop: 3, display: "grid", gap: 2 }}>
                    {b.revision.brief.questions.map((q) => <li key={q}>{q}</li>)}
                  </ul>
                </div>
              ) : null}

              <ClientBrief
                journeyId={member.journeyId}
                revision={{ id: b.revision.id, revision: b.revision.revision, criteria: b.revision.brief.criteria, questions: b.revision.brief.questions }}
                myResponse={b.myResponse}
                canRespond={respond}
                person={member.name}
                hiddenMoney={b.hidden > 0}
                agentFirst={agentFirst}
              />
            </>
          )}
        </section>
      ) : null}

      {member.side === "buy" && member.scopes.includes("homes") ? (
        <section className="card p-4" style={{ marginTop: 18 }} aria-labelledby="homes-h">
          <h2 id="homes-h" className="t-md w6">Homes</h2>
          <p className="t-xs c-4" style={{ marginTop: 2 }}>
            Homes you or {agentFirst} added. Reacting tells {agentFirst} what you think; it does not change your search.
          </p>
          {h ? (
            <ClientHomes
              journeyId={member.journeyId}
              homes={h.map((x) => ({ ...x, historyCount: x.history.length }))}
              criteria={b?.revision?.brief.criteria ?? []}
              me={member.memberId}
              canRespond={respond}
            />
          ) : (
            <p className="t-sm c-3" style={{ marginTop: 8 }}>The homes did not load. That is not the same as an empty list; reload in a moment.</p>
          )}
        </section>
      ) : null}

      <p className="t-2xs c-4" style={{ marginTop: 24, lineHeight: 1.6 }}>
        Only people {agentFirst} invited can see this page, and only the parts shared with them. Nothing here is a
        contract, an offer, or a loan decision.
      </p>
    </ClientShell>
  );
}
