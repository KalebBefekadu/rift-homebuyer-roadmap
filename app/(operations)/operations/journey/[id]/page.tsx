import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { agentSession } from "@/lib/db/session";
import { Unavailable } from "../../Unavailable";
import { OpsNav } from "../../OpsNav";
import { journeyFor, membersOf } from "@/lib/db/journeys";
import { searchState, readoutStart } from "@/lib/db/search";
import { homesOf } from "@/lib/db/shortlist";
import { toursOf } from "@/lib/db/tours";
import { readLead } from "@/lib/db/clients";
import { buyerSearchOn, SIDE_LABEL } from "@/lib/core/journey";
import { describe, diffBriefs, FIELDS, STRENGTH_LABEL } from "@/lib/core/search";
import { AgentBrief } from "./AgentBrief";
import { SearchSetup } from "./SearchSetup";
import { Household } from "./Household";
import { Homes } from "./Homes";
import { Showings } from "./Showings";
import { Progress } from "./Progress";
import { progressFor } from "@/lib/db/progress";
import { STAGE_LABEL } from "@/lib/core/progress";
import { bidsFor } from "@/lib/db/bids";
import { documentsFor } from "@/lib/db/documents";
import { Offers } from "./Offers";
import { Dates } from "./Dates";
import { deadlinesFor } from "@/lib/db/deadlines";

export const metadata: Metadata = { title: "Journey", robots: { index: false } };
export const dynamic = "force-dynamic";

const DAY = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/**
 * One buying (or selling) goal: the brief, the Matrix search it becomes, the
 * household, and the homes.
 *
 * Ordered by the first useful delivery in blueprint v4 §6: the brief with its
 * sources, what changed and who agrees, the approval and setup record, then
 * the people and the shortlist. Each section reads independently, and a read
 * that fails says so where it would have rendered, rather than showing an
 * empty section that means "none".
 */
export default async function JourneyPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await agentSession();
  if (session.state === "unknown") return <Unavailable reason={session.reason} />;
  if (session.state === "signed-out") redirect("/operations/sign-in");
  const agent = session.agent;

  if (!buyerSearchOn(process.env)) {
    return (
      <main className="shell-w" style={{ paddingTop: 60 }}>
        <h1 className="serif" style={{ fontSize: 26 }}>Journeys are switched off.</h1>
        <p className="t-sm c-3" style={{ marginTop: 10, maxWidth: 560, lineHeight: 1.6 }}>
          RIFT_BUYER_SEARCH is set to off on this deployment. Nothing has been deleted; switching it back on brings
          every journey back as it was.
        </p>
        <Link href="/operations" className="btn btn-p" style={{ marginTop: 18 }}>Back to Operations</Link>
      </main>
    );
  }

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const j = await journeyFor(id);
  if (!j.ok) {
    return (
      <main className="shell-w" style={{ paddingTop: 60 }}>
        <h1 className="serif" style={{ fontSize: 26 }}>This journey could not be loaded.</h1>
        <p className="t-sm c-3" style={{ marginTop: 10 }}>The database did not answer ({j.error}). Nothing has been lost.</p>
      </main>
    );
  }
  if ("skipped" in j) return <Unavailable reason={j.reason} />;
  if (!j.data) notFound();
  const journey = j.data;
  const buying = journey.side === "buy";

  const agentFirst = agent.name.trim().split(/\s+/)[0] ?? agent.name;
  const [search, members, homes, lead, start, tours, progress, bids, docs, deadlines] = await Promise.all([
    buying ? searchState(id) : Promise.resolve(null),
    membersOf(id),
    homesOf(id),
    readLead(journey.leadId),
    buying ? readoutStart(journey.leadId) : Promise.resolve(null),
    buying ? toursOf(id) : Promise.resolve(null),
    buying ? progressFor(id) : Promise.resolve(null),
    buying ? bidsFor(id, agentFirst) : Promise.resolve(null),
    buying ? documentsFor(id) : Promise.resolve(null),
    buying ? deadlinesFor(id) : Promise.resolve(null),
  ]);

  const s = search && search.ok && "data" in search ? search.data : null;
  const latest = s?.revisions[0] ?? null;
  const previous = s?.revisions[1] ?? null;
  const diff = latest ? diffBriefs(previous?.brief ?? null, latest.brief) : null;
  const memberList = members.ok && "data" in members ? members.data : null;
  const homeList = homes.ok && "data" in homes ? homes.data : null;
  const leadRow = lead.ok && "data" in lead ? lead.data?.lead ?? null : null;
  const startPoint = start && start.ok && "data" in start ? start.data : null;
  const tourData = tours && tours.ok && "data" in tours ? tours.data : null;
  const prog = progress && progress.ok && "data" in progress ? progress.data : null;
  const bidData = bids && bids.ok && "data" in bids ? bids.data : null;
  const docData = docs && docs.ok && "data" in docs ? docs.data : null;
  const dateData = deadlines && deadlines.ok && "data" in deadlines ? deadlines.data : null;
  /* The stage never moves by itself (REQ-STATE-05); the page only says when
     the offers suggest it is behind. */
  const accepted = bidData?.bids.find((b) => b.view.status === "accepted");
  const liveBid = bidData?.bids.find((b) => !b.view.final);
  const nudge = prog && !prog.open
    ? accepted
      ? `The offer on ${accepted.address} was accepted. Once the contract is executed, record it below: that is what moves the journey to Under contract.`
      : liveBid && ["prepare", "search", "tour"].includes(prog.progress.stage)
        ? `An offer on ${liveBid.address} is in progress, but the stage says ${STAGE_LABEL[prog.progress.stage]}. Change it to Offer if that is where things are.`
        : null
    : null;

  /* Homes are compared with the search as it runs in Matrix when there is
     one, otherwise with the latest brief: and the card says which. */
  const fitRevision = s?.active
    ? s.revisions.find((r) => r.id === s.active!.revisionId) ?? latest
    : latest;
  const against = fitRevision
    ? s?.active && fitRevision.id === s.active.revisionId
      ? `the requirements in the Matrix search (revision ${fitRevision.revision})`
      : `the requirements in brief revision ${fitRevision.revision}, not yet set up in Matrix`
    : null;

  const firstName = agent.name.trim().split(/\s+/)[0] ?? agent.name;

  return (
    <>
      <OpsNav agentName={agent.name} />
      <main className="shell-w" style={{ paddingTop: 22, paddingBottom: 60 }}>
        <Link href={`/operations/lead/${journey.leadId}`} className="t-sm c-3">← {journey.person}</Link>
        <div className="row gap-2 wrap" style={{ marginTop: 10 }}>
          <span className="chip t-2xs">{SIDE_LABEL[journey.side]}</span>
          <h1 className="serif" style={{ fontSize: 28, letterSpacing: "-0.02em" }}>{journey.label}</h1>
        </div>
        <p className="t-xs c-4" style={{ marginTop: 4 }}>
          {journey.person} · started {DAY(journey.createdAt)}
        </p>

        {/* Blueprint v5 §7.3: the buyer cannot sign in until someone is
            invited, and the sign-in page cannot say so without revealing who
            is a client. So the first step is said here, where it can be. */}
        {memberList && !memberList.some((m) => m.state === "active" || m.state === "invited") ? (
          <div className="card p-4 between wrap gap-3" style={{ marginTop: 18, borderColor: "var(--warn-line)", background: "var(--warn-wash)" }} role="note">
            <div style={{ maxWidth: 560 }}>
              <div className="t-md w6">First step: invite the buyer</div>
              <p className="t-sm c-2" style={{ marginTop: 4, lineHeight: 1.55 }}>
                Nobody can sign in to this journey yet. Make an invitation link under Household and send it
                yourself; the buyer opens it once, and after that signs in with their email.
              </p>
            </div>
            <a href="#household-h" className="btn btn-p">Invite the household</a>
          </div>
        ) : null}

        {buying ? (
          <section className="card p-4" style={{ marginTop: 18 }} aria-labelledby="progress-h">
            <h2 id="progress-h" className="t-md w6">Where it stands</h2>
            <div className="t-xs c-4" style={{ marginTop: 2, marginBottom: 10 }}>
              The stage the buyer sees, and under contract what is running at once. Each change is recorded with why and by whom.
            </div>
            {prog ? (
              <Progress
                journeyId={id}
                progress={prog.progress}
                events={prog.events}
                open={prog.open}
                past={prog.contracts.filter((c) => c.outcome)}
                homes={prog.homes}
                coverage={prog.coverage}
                leadId={journey.leadId}
                person={journey.person.split(/\s+/)[0] ?? journey.person}
                unavailable={prog.unavailable}
                nudge={nudge}
              />
            ) : (
              <p className="t-xs c-neg">Where this journey stands did not load. That is not the same as it being at Prepare.</p>
            )}
            {prog?.open ? (
              dateData?.unavailable ? <p className="t-xs c-warn" style={{ marginTop: 12 }}>{dateData.unavailable}</p>
              : dateData ? (
                <Dates journeyId={id} dates={dateData.deadlines.filter((d) => d.transactionId === prog.open!.id)}
                  docs={(docData?.documents ?? []).map((d) => ({ id: d.id, label: d.label }))} />
              ) : <p className="t-xs c-neg" style={{ marginTop: 12 }}>The contract dates did not load. That is not the same as there being none.</p>
            ) : null}
          </section>
        ) : null}

        {buying ? (
          <>
            <section className="card p-4" style={{ marginTop: 18 }} aria-labelledby="brief-h">
              <div className="between gap-2 wrap">
                <div>
                  <h2 id="brief-h" className="t-md w6">Search brief</h2>
                  <div className="t-xs c-4" style={{ marginTop: 2 }}>
                    {latest
                      ? `Revision ${latest.revision}, by ${latest.authorLabel}${latest.authorKind === "client" ? " (buyer)" : ""}, ${DAY(latest.createdAt)}.`
                      : "What they need in a home, and what they would only like, each with who said it and when."}
                  </div>
                </div>
              </div>
              {search && !search.ok ? (
                <p className="t-xs c-neg" style={{ marginTop: 10 }}>The brief did not load ({search.error}). That is not the same as having none.</p>
              ) : (
                <div style={{ marginTop: 12 }}>
                  <AgentBrief
                    journeyId={id}
                    latest={latest ? { revision: latest.revision, ...latest.brief } : null}
                    start={startPoint}
                    person={journey.person}
                    disagreement={s?.disagreement ?? []}
                  />
                </div>
              )}
            </section>

            {latest && (previous || s?.responses.length) ? (
              <section className="card p-4" style={{ marginTop: 18 }} aria-labelledby="changed-h">
                <h2 id="changed-h" className="t-md w6">What changed, and who agrees</h2>
                {previous && diff ? (
                  <div style={{ marginTop: 8 }}>
                    <div className="t-xs c-4">Revision {previous.revision} to {latest.revision}{latest.note ? `: "${latest.note}"` : ""}</div>
                    {diff.changes.length || diff.questionsAdded.length || diff.questionsResolved.length ? (
                      <ul className="t-sm" style={{ marginTop: 6, display: "grid", gap: 4 }}>
                        {diff.changes.map((c) => (
                          <li key={(c.after ?? c.before)!.id}>
                            {c.kind === "added" ? "Added" : c.kind === "removed" ? "Removed" : "Changed"}{" "}
                            <span className="w6">{FIELDS[(c.after ?? c.before)!.field].label}</span>:{" "}
                            {c.kind === "changed"
                              ? <>{describe(c.before!)} ({STRENGTH_LABEL[c.before!.strength].toLowerCase()}) to {describe(c.after!)} ({STRENGTH_LABEL[c.after!.strength].toLowerCase()})</>
                              : describe((c.after ?? c.before)!)}
                            {c.after && c.kind !== "removed" ? <span className="t-2xs c-4"> · {c.after.statedBy}, {c.after.sourceRef}</span> : null}
                          </li>
                        ))}
                        {diff.questionsAdded.map((q) => <li key={`qa${q}`}>New question: {q}</li>)}
                        {diff.questionsResolved.map((q) => <li key={`qr${q}`}>Settled: {q}</li>)}
                      </ul>
                    ) : <p className="t-xs c-3" style={{ marginTop: 6 }}>Saved again with no changes to the criteria.</p>}
                  </div>
                ) : null}
                {s?.responses.length ? (
                  <div style={{ marginTop: 12 }}>
                    <div className="t-xs w6">Answers to revision {latest.revision}</div>
                    <ul className="t-sm" style={{ marginTop: 4, display: "grid", gap: 3 }}>
                      {s.responses.map((r) => (
                        <li key={r.id}>
                          <span className="w6">{r.name}</span>{" "}
                          {r.response === "confirmed" ? "confirmed it" : "asked for changes"}
                          {r.note ? <span className="c-3">: &ldquo;{r.note}&rdquo;</span> : null}
                          <span className="t-2xs c-4"> · {DAY(r.createdAt)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : latest && memberList?.some((m) => m.state === "active") ? (
                  <p className="t-xs c-4" style={{ marginTop: 10 }}>Nobody in the household has answered revision {latest.revision} yet.</p>
                ) : null}
              </section>
            ) : null}

            <section className="card p-4" style={{ marginTop: 18 }} aria-labelledby="matrix-h">
              <h2 id="matrix-h" className="t-md w6">Matrix search</h2>
              <div className="t-xs c-4" style={{ marginTop: 2, marginBottom: 10 }}>
                Approve a revision, set it up in Matrix, record where it lives.
              </div>
              {s ? (
                <SearchSetup
                  journeyId={id}
                  person={journey.person}
                  status={s.status}
                  latest={latest ? { id: latest.id, revision: latest.revision, brief: latest.brief } : null}
                  disagreement={s.disagreement}
                  active={s.active}
                  pending={s.pending}
                  history={s.history}
                />
              ) : (
                <p className="t-xs c-neg">The Matrix search status did not load. It is unknown, not inactive.</p>
              )}
            </section>
          </>
        ) : (
          <section className="card p-4" style={{ marginTop: 18 }}>
            <h2 className="t-md w6">Selling</h2>
            <p className="t-xs c-3" style={{ marginTop: 6, lineHeight: 1.6 }}>
              The seller workflow (pricing, launch, offers, net) comes after the buyer release. Offers and the offer
              room for this person are on <Link className="u" href={`/operations/lead/${journey.leadId}`}>their record</Link>.
            </p>
          </section>
        )}

        <section className="card p-4" style={{ marginTop: 18 }} aria-labelledby="household-h">
          <h2 id="household-h" className="t-md w6">Household</h2>
          <div className="t-xs c-4" style={{ marginTop: 2, marginBottom: 10 }}>
            Who can sign in to this journey, and what each person sees.
          </div>
          {memberList ? (
            <Household
              journeyId={id}
              members={memberList}
              defaultEmail={leadRow?.email ?? ""}
              defaultName={leadRow?.name ?? ""}
            />
          ) : (
            <p className="t-xs c-neg">The household did not load. That is not the same as nobody being invited.</p>
          )}
        </section>

        {buying ? (
          <section className="card p-4" style={{ marginTop: 18 }} aria-labelledby="homes-h">
            <h2 id="homes-h" className="t-md w6">Homes</h2>
            <div className="t-xs c-4" style={{ marginTop: 2, marginBottom: 8 }}>
              Homes you or the buyer added, with everyone&apos;s reactions. No listing feed: a link and the facts you typed.
            </div>
            {homeList ? (
              <Homes
                journeyId={id}
                homes={homeList.map((h) => ({ ...h, historyCount: h.history.length }))}
                criteria={fitRevision?.brief.criteria ?? []}
                against={against}
              />
            ) : (
              <p className="t-xs c-neg">The shortlist did not load. That is not the same as an empty list.</p>
            )}
          </section>
        ) : null}

        {buying ? (
          <section className="card p-4" style={{ marginTop: 18 }} aria-labelledby="showings-h">
            <h2 id="showings-h" className="t-md w6">Showings</h2>
            <div className="t-xs c-4" style={{ marginTop: 2, marginBottom: 8 }}>
              What you arranged in ShowingTime, step by step. A request is not an appointment until you record the confirmed time.
            </div>
            {tourData ? (
              <Showings
                journeyId={id}
                stops={tourData.stops}
                homes={(homeList ?? []).filter((h) => !h.withdrawnAt).map((h) => ({ id: h.id, address: h.address }))}
                coverage={tourData.coverage}
                leadId={journey.leadId}
                person={journey.person.split(/\s+/)[0] ?? journey.person}
                unavailable={tourData.unavailable}
              />
            ) : (
              <p className="t-xs c-neg">The showings did not load. That is not the same as there being none.</p>
            )}
          </section>
        ) : null}

        {buying ? (
          <section className="card p-4" style={{ marginTop: 18 }} aria-labelledby="offers-h">
            <h2 id="offers-h" className="t-md w6">Offers</h2>
            <div className="t-xs c-4" style={{ marginTop: 2, marginBottom: 8 }}>
              The terms, each version, and what the household told you. The forms are prepared, signed and delivered in Remine; this records that they were.
            </div>
            {bidData && docData ? (
              <Offers
                journeyId={id}
                bids={bidData.bids}
                docs={docData.documents}
                homes={(homeList ?? []).filter((h) => !h.withdrawnAt).map((h) => ({ id: h.id, address: h.address }))}
                deciders={bidData.deciders}
                coverage={bidData.coverage}
                leadId={journey.leadId}
                person={journey.person.split(/\s+/)[0] ?? journey.person}
                unavailable={bidData.unavailable ?? docData.unavailable}
              />
            ) : (
              <p className="t-xs c-neg">The offers did not load. That is not the same as there being none.</p>
            )}
          </section>
        ) : null}

        <p className="t-2xs c-4" style={{ marginTop: 24, lineHeight: 1.6, maxWidth: 640 }}>
          Nothing on this page sends anything to anybody. Invitation links are for you to send, and the Matrix search is
          set up by you. {firstName === "You" ? "" : `Rift records what you did, ${firstName}, and when.`}
        </p>
      </main>
    </>
  );
}
