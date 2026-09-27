import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { agentSession } from "@/lib/db/session";
import { Unavailable } from "../../Unavailable";
import { journeyFor, membersOf } from "@/lib/db/journeys";
import { searchState, readoutStart, type Revision, type SearchState } from "@/lib/db/search";
import { homesOf } from "@/lib/db/shortlist";
import { toursOf } from "@/lib/db/tours";
import { readLead } from "@/lib/db/clients";
import { buyerSearchOn, SIDE_LABEL } from "@/lib/core/journey";
import { describe, diffBriefs, FIELDS, STRENGTH_LABEL } from "@/lib/core/search";
import { AgentBrief } from "./AgentBrief";
import { SearchSetup } from "./SearchSetup";
import { Household } from "./Household";
import { SummaryLinks } from "./SummaryLinks";
import { summaryLinksFor } from "@/lib/db/summary-links";
import { Homes } from "./Homes";
import { Showings } from "./Showings";
import { Progress } from "./Progress";
import { progressFor } from "@/lib/db/progress";
import { STAGE_LABEL, STATUS_LABEL, isSettled } from "@/lib/core/progress";
import { bidsFor } from "@/lib/db/bids";
import { documentsFor } from "@/lib/db/documents";
import { Offers } from "./Offers";
import { Dates } from "./Dates";
import { deadlinesFor } from "@/lib/db/deadlines";
import { TAB_LABEL, tabFrom, tabsFor, type Tab } from "./tabs";

export const metadata: Metadata = { title: "Journey", robots: { index: false } };
export const dynamic = "force-dynamic";

const DAY = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const WHEN = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
const settled = <T,>(p: Promise<T> | null) => p ?? Promise.resolve(null);

/**
 * One buying (or selling) goal, as a workspace (Blueprint v5 §8.6): a fixed
 * header with who, the stage, the status, the next action and the household,
 * and tabs for the rest. It replaced one long page of nine stacked sections.
 *
 * Each tab reads only what it shows. A read that fails says so where it
 * would have rendered, rather than showing an empty section that means
 * "none". Every write keeps its rules: history-only records, request ids,
 * server checks.
 */
export default async function JourneyPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const session = await agentSession();
  if (session.state === "unknown") return <Unavailable reason={session.reason} />;
  if (session.state === "signed-out") redirect("/operations/sign-in");
  const agent = session.agent;

  if (!buyerSearchOn(process.env)) {
    return (
      <main className="shell-w sec">
        <h1 className="serif">Journeys are switched off.</h1>
        <p className="t-sm c-3" style={{ marginTop: 10, maxWidth: 560, lineHeight: 1.6 }}>
          RIFT_BUYER_SEARCH is set to off on this deployment. Nothing has been deleted; switching it back on brings
          every journey back as it was.
        </p>
      </main>
    );
  }

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const j = await journeyFor(id);
  if (!j.ok) {
    return (
      <main className="shell-w sec">
        <h1 className="serif">This journey could not be loaded.</h1>
        <p className="t-sm c-3" style={{ marginTop: 10 }}>The database did not answer ({j.error}). Nothing has been lost.</p>
      </main>
    );
  }
  if ("skipped" in j) return <Unavailable reason={j.reason} />;
  if (!j.data) notFound();
  const journey = j.data;
  const buying = journey.side === "buy";
  const tab = tabFrom((await searchParams).tab, buying);
  const needs = (...ts: Tab[]) => buying && ts.includes(tab);

  const agentFirst = agent.name.trim().split(/\s+/)[0] ?? agent.name;
  const person = journey.person.split(/\s+/)[0] ?? journey.person;
  const [members, lead, progress, search, start, homes, tours, bids, docs, deadlines, summaryRead] = await Promise.all([
    membersOf(id),
    readLead(journey.leadId),
    buying ? progressFor(id) : Promise.resolve(null),
    settled(needs("search", "homes", "history") ? searchState(id) : null),
    settled(needs("search") ? readoutStart(journey.leadId) : null),
    settled(needs("homes", "offers") ? homesOf(id) : null),
    settled(needs("homes") ? toursOf(id) : null),
    settled(needs("overview", "offers", "contract") ? bidsFor(id, agentFirst) : null),
    settled(needs("offers", "contract") ? documentsFor(id) : null),
    settled(needs("overview", "contract") ? deadlinesFor(id) : null),
    tab === "household" ? summaryLinksFor(id) : Promise.resolve(null),
  ]);

  const memberList = members.ok && "data" in members ? members.data : null;
  const leadRow = lead.ok && "data" in lead ? lead.data?.lead ?? null : null;
  const prog = progress && progress.ok && "data" in progress ? progress.data : null;
  const s = search && search.ok && "data" in search ? search.data : null;
  const latest = s?.revisions[0] ?? null;
  const previous = s?.revisions[1] ?? null;
  const homeList = homes && homes.ok && "data" in homes ? homes.data : null;
  const liveHomes = (homeList ?? []).filter((h) => !h.withdrawnAt).map((h) => ({ id: h.id, address: h.address }));
  const tourData = tours && tours.ok && "data" in tours ? tours.data : null;
  const bidData = bids && bids.ok && "data" in bids ? bids.data : null;
  const docData = docs && docs.ok && "data" in docs ? docs.data : null;
  const dateData = deadlines && deadlines.ok && "data" in deadlines ? deadlines.data : null;
  const openDates = prog?.open && dateData ? dateData.deadlines.filter((d) => d.transactionId === prog.open!.id) : [];

  /* The stage never moves by itself (REQ-STATE-05); the page only says when
     the offers suggest it is behind. */
  const accepted = bidData?.bids.find((b) => b.view.status === "accepted");
  const liveBid = bidData?.bids.find((b) => !b.view.final);
  const nudge = prog && !prog.open
    ? accepted
      ? `The offer on ${accepted.address} was accepted. Once the contract is executed, record it on the Contract tab: that is what moves the journey to Under contract.`
      : liveBid && ["prepare", "search", "tour"].includes(prog.progress.stage)
        ? `An offer on ${liveBid.address} is in progress, but the stage says ${STAGE_LABEL[prog.progress.stage]}. Change it to Offer if that is where things are.`
        : null
    : null;

  const nobodyInvited = memberList !== null && !memberList.some((m) => m.state === "active" || m.state === "invited");
  const blocked = prog?.open?.work.filter((w) => w.state === "blocked") ?? [];
  const missed = openDates.filter((d) => d.view.state === "active" && d.view.missed);
  const unchecked = openDates.filter((d) => d.view.state === "active" && !d.view.verified);
  const upcoming = openDates.filter((d) => d.view.state === "active" && d.view.verified && !d.view.missed && (d.view.days ?? -1) >= 0).slice(0, 4);

  /* The one next action in the header: the most urgent thing first. */
  const next = nobodyInvited ? { text: "Invite the household: nobody can sign in yet", tab: "household" as Tab }
    : missed[0] ? { text: `${missed[0].label} passed: record what happened`, tab: "contract" as Tab }
    : blocked[0] ? { text: `${blocked[0].label} is blocked${blocked[0].note ? `: ${blocked[0].note}` : ""}`, tab: "contract" as Tab }
    : nudge ? { text: nudge, tab: "contract" as Tab }
    : unchecked[0] ? { text: `Check ${unchecked[0].label} against the contract`, tab: "contract" as Tab }
    : leadRow?.nextAction ? { text: `${leadRow.nextAction}${leadRow.nextDue ? ` (${leadRow.nextDue})` : ""}`, tab: null }
    : null;

  const fitRevision = s?.active ? s.revisions.find((r) => r.id === s.active!.revisionId) ?? latest : latest;
  const against = fitRevision
    ? s?.active && fitRevision.id === s.active.revisionId
      ? `the requirements in the Matrix search (revision ${fitRevision.revision})`
      : `the requirements in brief revision ${fitRevision.revision}, not yet set up in Matrix`
    : null;
  const href = (t: Tab) => (t === "overview" ? `/operations/journey/${id}` : `/operations/journey/${id}?tab=${t}`);

  return (
    <main className="shell-w sec">
      <header className="card" style={{ padding: "10px 14px" }}>
        <div className="between wrap gap-2">
          <div style={{ minWidth: 0 }}>
            <div className="row gap-2 wrap">
              <span className="chip t-2xs">{SIDE_LABEL[journey.side]}</span>
              <h1 className="serif trunc">{journey.label}</h1>
            </div>
            <p className="t-xs c-4" style={{ marginTop: 2 }}>
              <Link className="u" href={`/operations/lead/${journey.leadId}`}>{journey.person}</Link> · started {DAY(journey.createdAt)}
              {memberList ? ` · household: ${memberList.filter((m) => m.state === "active" || m.state === "invited").map((m) => `${m.name ?? m.email}${m.state === "invited" ? " (invited)" : ""}`).join(", ") || "nobody yet"}` : ""}
            </p>
          </div>
          {prog ? (
            <div className="row gap-2 wrap">
              <span className="chip">{STAGE_LABEL[prog.progress.stage]}</span>
              <span className={`chip ${prog.progress.status === "active" ? "chip-pos" : "chip-warn"}`}>{STATUS_LABEL[prog.progress.status]}</span>
            </div>
          ) : buying ? <span className="chip chip-warn">Stage unknown: did not load</span> : null}
        </div>
        {next ? (
          <p className="t-sm" style={{ marginTop: 8 }}>
            <span className="w6">Next:</span> {next.tab ? <Link className="u" href={href(next.tab)}>{next.text}</Link> : next.text}
          </p>
        ) : null}
        <nav className="row gap-1 wrap" aria-label="Journey" style={{ marginTop: 10 }}>
          {tabsFor(buying).map((t) => (
            <Link key={t} href={href(t)} className={`btn btn-sm ${t === tab ? "btn-p" : "btn-g"}`} aria-current={t === tab ? "page" : undefined}>{TAB_LABEL[t]}</Link>
          ))}
        </nav>
      </header>

      <div style={{ marginTop: 14 }}>
        {tab === "overview" ? (
          <div className="desk-grid" style={{ marginTop: 0 }}>
            <section className="card desk-card" aria-labelledby="ov-next">
              <h2 id="ov-next">Next actions and blockers</h2>
              <ul>
                {nobodyInvited ? <li className="desk-row"><Link className="u" href={href("household")}>Invite the buyer</Link><div className="desk-meta">Nobody can sign in to this journey yet. Make an invitation link and send it yourself.</div></li> : null}
                {missed.map((d) => <li key={d.id} className="desk-row"><span className="chip chip-neg t-2xs">Passed</span> <Link className="u" href={href("contract")}>{d.label}</Link><div className="desk-meta">{d.view.when}. Record what actually happened.</div></li>)}
                {blocked.map((w) => <li key={w.workstream} className="desk-row"><span className="chip chip-neg t-2xs">Blocked</span> <Link className="u" href={href("contract")}>{w.label}</Link>{w.note ? <div className="desk-meta">{w.note}</div> : null}</li>)}
                {nudge ? <li className="desk-row">{nudge}</li> : null}
                {unchecked.map((d) => <li key={d.id} className="desk-row"><span className="chip chip-warn t-2xs">Check</span> <Link className="u" href={href("contract")}>{d.label}</Link><div className="desk-meta">Not checked against the document, so the buyer does not see it.</div></li>)}
                {leadRow?.nextAction ? <li className="desk-row">{leadRow.nextAction}<div className="desk-meta">Your next action{leadRow.nextDue ? `, due ${leadRow.nextDue}` : ""}</div></li> : null}
              </ul>
              {!nobodyInvited && !missed.length && !blocked.length && !nudge && !unchecked.length && !leadRow?.nextAction ? <p className="t-sm c-4">Nothing is waiting on you here.</p> : null}
            </section>
            <section className="card desk-card" aria-labelledby="ov-dates">
              <h2 id="ov-dates">Key dates</h2>
              {!buying ? <p className="t-sm c-4">Dates are tracked on buying journeys.</p>
                : !prog?.open ? <p className="t-sm c-4">No contract yet.</p>
                : !dateData ? <p className="t-sm c-neg">The dates did not load; unknown, not none.</p>
                : upcoming.length ? <ul>{upcoming.map((d) => <li key={d.id} className="desk-row">{d.label}<div className="desk-meta">{d.view.when}</div></li>)}</ul>
                : <p className="t-sm c-4">No checked dates ahead.</p>}
            </section>
            <section className="card desk-card" aria-labelledby="ov-recent">
              <h2 id="ov-recent">Recent activity</h2>
              {prog?.events.length ? (
                <ul>{[...prog.events].reverse().slice(0, 6).map((e) => (
                  <li key={e.seq} className="desk-row t-xs"><span className="c-4">{WHEN(e.at)}</span> {e.kind === "stage" ? "Stage" : "Status"}: {e.kind === "stage" ? STAGE_LABEL[e.to as keyof typeof STAGE_LABEL] ?? e.to : STATUS_LABEL[e.to as keyof typeof STATUS_LABEL] ?? e.to} · {e.by}<div className="desk-meta">{e.reason}</div></li>
                ))}</ul>
              ) : <p className="t-sm c-4">Nothing recorded yet.</p>}
              <p className="t-xs" style={{ marginTop: 6 }}><Link className="u" href={href("history")}>All history</Link></p>
            </section>
            {prog?.open ? (
              <section className="card desk-card" aria-labelledby="ov-work">
                <h2 id="ov-work">Workstreams</h2>
                <ul>{prog.open.work.filter((w) => !isSettled(w.state)).map((w) => (
                  <li key={w.workstream} className="desk-row t-xs"><span className="w6">{w.label}</span> · {w.state.replace("-", " ")}{w.stale ? " · no word for a week" : ""}</li>
                ))}</ul>
                <p className="t-xs" style={{ marginTop: 6 }}><Link className="u" href={href("contract")}>Open the contract</Link></p>
              </section>
            ) : null}
            {!buying ? (
              <section className="card desk-card">
                <h2>Selling</h2>
                <p className="t-sm c-3" style={{ lineHeight: 1.6 }}>
                  The seller journey (pricing, launch, offers, net) follows the buyer pilot. Offers and the offer room for this
                  person are on <Link className="u" href={`/operations/lead/${journey.leadId}`}>their record</Link>.
                </p>
              </section>
            ) : null}
          </div>
        ) : null}

        {tab === "search" ? (
          <>
            <section className="card p-4" aria-labelledby="brief-h">
              <h2 id="brief-h" className="t-md w6">Search brief</h2>
              <div className="t-xs c-4" style={{ marginTop: 2 }}>
                {latest
                  ? `Revision ${latest.revision}, by ${latest.authorLabel}${latest.authorKind === "client" ? " (buyer)" : ""}, ${DAY(latest.createdAt)}.`
                  : "What they need in a home, and what they would only like, each with who said it and when."}
              </div>
              {search && !search.ok ? (
                <p className="t-xs c-neg" style={{ marginTop: 10 }}>The brief did not load ({search.error}). That is not the same as having none.</p>
              ) : (
                <div style={{ marginTop: 12 }}>
                  <AgentBrief journeyId={id} latest={latest ? { revision: latest.revision, ...latest.brief } : null}
                    start={start && start.ok && "data" in start ? start.data : null} person={journey.person} disagreement={s?.disagreement ?? []} />
                </div>
              )}
            </section>
            {latest && (previous || s?.responses.length) ? <Changed latest={latest} previous={previous} s={s!} anyActive={Boolean(memberList?.some((m) => m.state === "active"))} /> : null}
            <section className="card p-4" style={{ marginTop: 14 }} aria-labelledby="matrix-h">
              <h2 id="matrix-h" className="t-md w6">Matrix search</h2>
              <div className="t-xs c-4" style={{ marginTop: 2, marginBottom: 10 }}>Approve a revision, set it up in Matrix, record where it lives.</div>
              {s ? (
                <SearchSetup journeyId={id} person={journey.person} status={s.status}
                  latest={latest ? { id: latest.id, revision: latest.revision, brief: latest.brief } : null}
                  disagreement={s.disagreement} active={s.active} pending={s.pending} history={s.history} />
              ) : <p className="t-xs c-neg">The Matrix search status did not load. It is unknown, not inactive.</p>}
            </section>
          </>
        ) : null}

        {tab === "homes" ? (
          <>
            <section className="card p-4" aria-labelledby="homes-h">
              <h2 id="homes-h" className="t-md w6">Homes</h2>
              <div className="t-xs c-4" style={{ marginTop: 2, marginBottom: 8 }}>Homes you or the buyer added, with everyone&apos;s reactions. No listing feed: a link and the facts you typed.</div>
              {homeList ? (
                <Homes journeyId={id} homes={homeList.map((h) => ({ ...h, historyCount: h.history.length }))} criteria={fitRevision?.brief.criteria ?? []} against={against} />
              ) : <p className="t-xs c-neg">The shortlist did not load. That is not the same as an empty list.</p>}
            </section>
            <section className="card p-4" style={{ marginTop: 14 }} aria-labelledby="showings-h">
              <h2 id="showings-h" className="t-md w6">Showings</h2>
              <div className="t-xs c-4" style={{ marginTop: 2, marginBottom: 8 }}>What you arranged in ShowingTime, step by step. A request is not an appointment until you record the confirmed time.</div>
              {tourData ? (
                <Showings journeyId={id} stops={tourData.stops} homes={liveHomes} coverage={tourData.coverage} leadId={journey.leadId} person={person} unavailable={tourData.unavailable} />
              ) : <p className="t-xs c-neg">The showings did not load. That is not the same as there being none.</p>}
            </section>
          </>
        ) : null}

        {tab === "offers" ? (
          <section className="card p-4" aria-labelledby="offers-h">
            <h2 id="offers-h" className="t-md w6">Offers and documents</h2>
            <div className="t-xs c-4" style={{ marginTop: 2, marginBottom: 8 }}>The terms, each version, and what the household told you. The forms are prepared, signed and delivered in Remine; this records that they were.</div>
            {bidData && docData ? (
              <Offers journeyId={id} bids={bidData.bids} docs={docData.documents} homes={liveHomes} deciders={bidData.deciders}
                coverage={bidData.coverage} leadId={journey.leadId} person={person} unavailable={bidData.unavailable ?? docData.unavailable} />
            ) : <p className="t-xs c-neg">The offers did not load. That is not the same as there being none.</p>}
          </section>
        ) : null}

        {tab === "contract" ? (
          <section className="card p-4" aria-labelledby="progress-h">
            <h2 id="progress-h" className="t-md w6">Where it stands</h2>
            <div className="t-xs c-4" style={{ marginTop: 2, marginBottom: 10 }}>The stage the buyer sees, and under contract what is running at once. Each change is recorded with why and by whom.</div>
            {prog ? (
              <Progress journeyId={id} progress={prog.progress} events={prog.events} open={prog.open} past={prog.contracts.filter((c) => c.outcome)}
                homes={prog.homes} coverage={prog.coverage} leadId={journey.leadId} person={person} unavailable={prog.unavailable} nudge={nudge} />
            ) : <p className="t-xs c-neg">Where this journey stands did not load. That is not the same as it being at Prepare.</p>}
            {prog?.open ? (
              dateData?.unavailable ? <p className="t-xs c-warn" style={{ marginTop: 12 }}>{dateData.unavailable}</p>
              : dateData ? <Dates journeyId={id} dates={openDates} docs={(docData?.documents ?? []).map((d) => ({ id: d.id, label: d.label }))} />
              : <p className="t-xs c-neg" style={{ marginTop: 12 }}>The contract dates did not load. That is not the same as there being none.</p>
            ) : null}
          </section>
        ) : null}

        {tab === "household" ? (
          <section className="card p-4" aria-labelledby="household-h">
            <h2 id="household-h" className="t-md w6">Household</h2>
            <div className="t-xs c-4" style={{ marginTop: 2, marginBottom: 10 }}>Who can sign in to this journey, and what each person sees.</div>
            {memberList ? (
              <Household journeyId={id} members={memberList} defaultEmail={leadRow?.email ?? ""} defaultName={leadRow?.name ?? ""} />
            ) : <p className="t-xs c-neg">The household did not load. That is not the same as nobody being invited.</p>}
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--line-3)" }}>
              <div className="t-sm w6">Summary links</div>
              {summaryRead && summaryRead.ok ? <SummaryLinks journeyId={id} links={"data" in summaryRead ? summaryRead.data : null} /> : <p className="t-xs c-neg">The summary links did not load.</p>}
            </div>
          </section>
        ) : null}

        {tab === "history" ? (
          <section className="card p-4" aria-labelledby="history-h">
            <h2 id="history-h" className="t-md w6">History</h2>
            <div className="t-xs c-4" style={{ marginTop: 2, marginBottom: 8 }}>Every change to the stage and status, and every revision of the brief, with who and why. Nothing here is ever edited.</div>
            <ul>
              {[
                ...(prog?.events ?? []).map((e) => ({ at: e.at, key: `e${e.seq}`, text: `${e.kind === "stage" ? "Stage" : "Status"} ${e.from ? `${e.from} to ` : ""}${e.to}`, who: e.by, note: [e.reason, e.evidence].filter(Boolean).join(" · ") })),
                ...(s?.revisions ?? []).map((r) => ({ at: r.createdAt, key: `r${r.id}`, text: `Brief revision ${r.revision}`, who: r.authorLabel, note: r.note ?? "" })),
              ].sort((a, b) => b.at.localeCompare(a.at)).map((h) => (
                <li key={h.key} className="desk-row t-sm"><span className="c-4 t-xs">{WHEN(h.at)}</span> {h.text} · {h.who}{h.note ? <div className="desk-meta">{h.note}</div> : null}</li>
              ))}
            </ul>
            {!prog?.events.length && !s?.revisions.length ? <p className="t-sm c-4">Nothing recorded yet.</p> : null}
            {buying && !prog ? <p className="t-xs c-neg">The stage history did not load.</p> : null}
          </section>
        ) : null}
      </div>

      <p className="t-2xs c-4" style={{ marginTop: 20, lineHeight: 1.6, maxWidth: 640 }}>
        Nothing on this page sends anything to anybody. Invitation links are for you to send, and the Matrix search is
        set up by you. Rift records what you did, {agentFirst}, and when.
      </p>
    </main>
  );
}

/** What changed between the last two brief revisions, and who in the household agrees. */
function Changed({ latest, previous, s, anyActive }: { latest: Revision; previous: Revision | null; s: SearchState; anyActive: boolean }) {
  const diff = diffBriefs(previous?.brief ?? null, latest.brief);
  return (
    <section className="card p-4" style={{ marginTop: 14 }} aria-labelledby="changed-h">
      <h2 id="changed-h" className="t-md w6">What changed, and who agrees</h2>
      {previous ? (
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
      {s.responses.length ? (
        <div style={{ marginTop: 12 }}>
          <div className="t-xs w6">Answers to revision {latest.revision}</div>
          <ul className="t-sm" style={{ marginTop: 4, display: "grid", gap: 3 }}>
            {s.responses.map((r) => (
              <li key={r.id}>
                <span className="w6">{r.name}</span> {r.response === "confirmed" ? "confirmed it" : "asked for changes"}
                {r.note ? <span className="c-3">: &ldquo;{r.note}&rdquo;</span> : null}
                <span className="t-2xs c-4"> · {DAY(r.createdAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : anyActive ? <p className="t-xs c-4" style={{ marginTop: 10 }}>Nobody in the household has answered revision {latest.revision} yet.</p> : null}
    </section>
  );
}
