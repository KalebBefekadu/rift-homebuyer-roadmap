import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { clientBids, clientBrief, clientHomes, clientProgress, clientSession, clientTours, memberOf } from "@/lib/db/client";
import { WORK_STATE_LABEL, isSettled, stageStrip, workLine, workSummary } from "@/lib/core/progress";
import { todayFor } from "@/lib/core/today";
import { OFFER_LABEL, buyerLabel } from "@/lib/core/tour";
import { buyerSearchOn, canRespond, ROLE_LABEL } from "@/lib/core/journey";
import { describe, diffBriefs, FIELDS, STRENGTH_LABEL, type SearchStatus } from "@/lib/core/search";
import { ClientShell } from "../../ClientShell";
import { ClientBrief } from "./ClientBrief";
import { ClientHomes } from "./ClientHomes";
import { Today, type BuyerWork } from "./Today";
import { ClientOffers } from "./ClientOffers";

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

  const [brief, homes, tours, prog, offers] = await Promise.all([
    member.scopes.includes("search") && member.side === "buy" ? clientBrief(member) : Promise.resolve(null),
    member.scopes.includes("homes") && member.side === "buy" ? clientHomes(member) : Promise.resolve(null),
    member.scopes.includes("homes") && member.side === "buy" ? clientTours(member) : Promise.resolve(null),
    member.side === "buy" ? clientProgress(member) : Promise.resolve(null),
    member.side === "buy" && member.scopes.includes("money") ? clientBids(member) : Promise.resolve(null),
  ]);
  /* Worded here, on the server, so nothing but the buyer's line leaves it:
     not the agent's notes, not the ShowingTime reference, not why a showing
     is on hold. A read that failed shows no showings rather than wrong ones;
     the homes still load. */
  const showings = (tours && tours.ok && "data" in tours ? tours.data.stops : []).map((s) => ({
    stopId: s.id,
    homeId: s.homeId,
    open: s.view.status !== "cancelled" && s.view.status !== "completed",
    completed: s.view.status === "completed",
    label: buyerLabel(s.view, agentFirst),
    answeredByMe: s.feedback.some((f) => f.memberId === member.memberId),
    myAnswer: (() => {
      const f = s.feedback.filter((x) => x.memberId === member.memberId).at(-1);
      return f ? OFFER_LABEL[f.offer] : null;
    })(),
  }));
  const b = brief && brief.ok && "data" in brief ? brief.data : null;
  const diff = b?.revision && b.previous ? diffBriefs(b.previous.brief, b.revision.brief) : null;
  const h = homes && homes.ok && "data" in homes ? homes.data : null;
  const respond = canRespond(member.role);

  /* Today (W07). The order is lib/core/today.ts; every line is worded here
     so the workstreams' raw notes and sources leave only as sentences. */
  const p = prog && prog.ok && "data" in prog ? prog.data : null;
  const o = offers && offers.ok && "data" in offers ? offers.data : null;
  /* Only what the component shows: which documents were ever shared is the server's to check. */
  const buyerBids = (o?.bids ?? []).map((x) => {
    const rest: Omit<typeof x, "sharedDocumentIds"> & { sharedDocumentIds?: string[] } = { ...x };
    delete rest.sharedDocumentIds;
    return rest;
  });
  const address = new Map((h ?? []).map((x) => [x.id, x.address]));
  const today = p && !p.unavailable
    ? todayFor({
      agentFirst,
      progress: p.progress,
      work: p.open?.work ?? p.closed?.work ?? [],
      closing: p.closed?.closing ?? null,
      plan: p.plan,
      briefToConfirm: respond && !!b?.revision && !b.myResponse,
      showingsToAnswer: respond ? showings.filter((x) => x.completed && !x.answeredByMe).map((x) => address.get(x.homeId) ?? "A home you saw") : [],
      contractDates: p.dates,
      offersToAnswer: respond ? buyerBids.filter((x) => x.asked?.open && x.asked.mineNeeded && !x.asked.myAnswer && !x.newerDraft).map((x) => x.address) : [],
    })
    : null;
  /* Under contract, the contract's workstreams; once it closed, the home and
     what is still worked after closing (possession). */
  const shown = p?.open ?? p?.closed ?? null;
  const contract = shown ? {
    id: shown.id,
    address: shown.address,
    title: p?.open ? `Under contract: ${shown.address}` : `Your home: ${shown.address}`,
    summary: p?.open
      ? `${workSummary(shown.work)} These run at the same time; one finishing says nothing about the others.`
      : "The closing is done. Possession and keys are recorded separately, because they can come later.",
    work: shown.work.map((w): BuyerWork => ({
      workstream: w.workstream, label: w.label, state: w.state, stateLabel: WORK_STATE_LABEL[w.state],
      line: workLine(w, agentFirst), seq: w.seq,
      canReport: w.owner === "client" && !isSettled(w.state) && w.state !== "reported",
    })),
  } : null;

  return (
    <ClientShell agentName={member.agentName} journey={{ id: member.journeyId, active: "today", side: member.side }}
      reach={{ email: member.agentEmail, phone: member.agentPhone }}>
      <Link href="/app" className="t-sm c-3">← Your move</Link>
      <h1 className="serif" style={{ fontSize: 28, letterSpacing: "-0.02em", marginTop: 8 }}>{member.journeyLabel}</h1>
      <p className="t-xs c-4" style={{ marginTop: 4 }}>
        With {member.agentName} · you are signed in as {member.name} ({ROLE_LABEL[member.role].toLowerCase()})
        {" · "}<Link className="u" href={`/app/j/${member.journeyId}/records`}>Your records</Link>
      </p>

      {member.side !== "buy" ? (
        <p className="t-sm c-3" style={{ marginTop: 16, lineHeight: 1.6 }}>
          {agentFirst} will share more here as your sale moves forward.
        </p>
      ) : null}

      {member.side === "buy" ? (
        <section id="today" className="card p-4" style={{ marginTop: 18 }} aria-labelledby="today-h">
          <h2 id="today-h" className="t-md w6">Today</h2>
          {!p ? (
            <p className="t-sm c-3" style={{ marginTop: 8, lineHeight: 1.6 }}>
              What is due did not load. That is not the same as nothing being due; reload in a moment, or ask {agentFirst}.
            </p>
          ) : p.unavailable || !today ? (
            <p className="t-sm c-3" style={{ marginTop: 8 }}>This part is being set up. Ask {agentFirst} what comes next.</p>
          ) : p.detail ? (
            <Today
              journeyId={member.journeyId}
              where={today.where}
              strip={stageStrip(p.progress, p.visited)}
              items={today.items}
              nothingOwed={today.nothingOwed}
              contract={contract}
              canRespond={respond}
              agentFirst={agentFirst}
            />
          ) : (
            <Today
              journeyId={member.journeyId}
              where={`${today.where} Your access shows where the move is, not the details of it.`}
              strip={stageStrip(p.progress, p.visited)}
              items={[]}
              nothingOwed={null}
              contract={null}
              canRespond={false}
              agentFirst={agentFirst}
            />
          )}
        </section>
      ) : null}

      {member.side === "buy" && offers && (!o || o.unavailable || buyerBids.length) ? (
        <section id="offers" className="card p-4" style={{ marginTop: 18 }} aria-labelledby="offers-h">
          <h2 id="offers-h" className="t-md w6">Offers</h2>
          {!o ? (
            <p className="t-sm c-3" style={{ marginTop: 8 }}>Your offers did not load. That is not the same as there being none; reload in a moment.</p>
          ) : o.unavailable ? (
            <p className="t-sm c-3" style={{ marginTop: 8 }}>This part is being set up. Ask {agentFirst} about any offer.</p>
          ) : (
            <ClientOffers journeyId={member.journeyId} bids={buyerBids} canRespond={respond} agentFirst={agentFirst} />
          )}
        </section>
      ) : null}

      {member.side === "buy" && member.scopes.includes("search") ? (
        <section id="priorities" className="card p-4" style={{ marginTop: 18 }} aria-labelledby="pri-h">
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
        <section id="homes" className="card p-4" style={{ marginTop: 18 }} aria-labelledby="homes-h">
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
              showings={showings}
              agentFirst={agentFirst}
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
