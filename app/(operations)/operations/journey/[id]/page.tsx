import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { agentSession } from "@/lib/db/session";
import { Unavailable } from "../../Unavailable";
import { PageHead, Section, Notice, Empty } from "../../ui";
import { journeyFor, membersOf } from "@/lib/db/journeys";
import { searchState, searchStatuses, readoutStart, type Revision, type SearchState } from "@/lib/db/search";
import { homesOf } from "@/lib/db/shortlist";
import { toursOf } from "@/lib/db/tours";
import { readLead } from "@/lib/db/clients";
import { buyerSearchOn } from "@/lib/core/journey";
import { describe, diffBriefs, FIELDS, STATUS_LABEL as SEARCH_STATUS_LABEL, STRENGTH_LABEL } from "@/lib/core/search";
import { AgentBrief } from "./AgentBrief";
import { SearchSetup } from "./SearchSetup";
import { Household } from "./Household";
import { SummaryLinks } from "./SummaryLinks";
import { summaryLinksFor } from "@/lib/db/summary-links";
import { Homes } from "./Homes";
import { Showings } from "./Showings";
import { Progress } from "./Progress";
import { progressFor } from "@/lib/db/progress";
import { STAGE_LABEL, WORK_STATE_LABEL, STATUS_LABEL, isSettled, type WorkState } from "@/lib/core/progress";
import { bidsFor } from "@/lib/db/bids";
import { documentsFor } from "@/lib/db/documents";
import { Offers } from "./Offers";
import { Dates } from "./Dates";
import { deadlinesFor } from "@/lib/db/deadlines";
import { TAB_LABEL, tabFrom } from "./tabs";
import { moneyFor } from "@/lib/db/money";
import { LedgerView } from "@/components/rift/money/LedgerView";
import { MoneyFacts } from "./MoneyFacts";
import { Linked } from "./Linked";
import { SellerProperty } from "./SellerProperty";
import { SellerPricing } from "./SellerPricing";
import { SellerProceeds } from "./SellerProceeds";
import { SellerListing } from "./SellerListing";
import { Offers as SellerOffers } from "../../lead/[id]/Offers";
import { Take } from "../../lead/[id]/Take";
import { Steps } from "../../lead/[id]/Steps";
import { offersFor } from "@/lib/db/offers";
import { roomFor } from "@/lib/db/offer-room";
import { readPlanForAgent } from "@/lib/db/plan";
import { listingOf } from "@/lib/db/listing";
import { sellerMoneyFor } from "@/lib/db/seller";
import { scenarios } from "@/lib/core/pricing";
import { proceedsLine, viewFigures } from "@/lib/core/proceeds";
import { journeyHistory } from "@/lib/core/journey-history";
import { dependenciesFor } from "@/lib/db/dependencies";
import { journeysFor } from "@/lib/db/journeys";
import { lineFor, stateOf } from "@/lib/core/dependency";
import { checklist, listingLine, listingStatus } from "@/lib/core/listing";
import { agoWords, journeyAttention, stageFocus, tabCounts } from "@/lib/core/journey-focus";
import { inDays } from "@/lib/core/deadline";
import { georgiaDay, showDay, showTime } from "@/lib/core/day";
import { isUuid } from "@/lib/core/ids";
import { Ico } from "@/components/rift/icons";
import { JourneyHead } from "./Frame";
import { AttentionList, NeedsUpdate, Panel, Unread } from "./Bits";
import s from "./journey.module.css";

export const metadata: Metadata = { title: "Journey", robots: { index: false } };
export const dynamic = "force-dynamic";

const DAY = (iso: string) => showDay(iso, { month: "short", day: "numeric", year: "numeric" });
const WHEN = (iso: string) => showTime(iso, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const settled = <T,>(p: Promise<T> | null) => p ?? Promise.resolve(null);

/* A shape per state as well as a colour, so a workstream reads without colour (rule 10). */
const GLYPH: Record<WorkState, { g: string; c: string }> = {
  "not-started": { g: "○", c: "c-4" },
  "in-progress": { g: "◔", c: "c-2" },
  waiting: { g: "⏸", c: "c-warn" },
  blocked: { g: "✕", c: "c-neg" },
  reported: { g: "◑", c: "c-warn" },
  confirmed: { g: "✓", c: "c-pos" },
  "not-applicable": { g: "–", c: "c-4" },
};

/**
 * One buying (or selling) goal, as a workspace (Blueprint v5 §8.6): a fixed
 * head with who, the status, where in the path it is, the one next action
 * and the tabs for the rest. It replaced one long page of nine stacked
 * sections.
 *
 * Each tab reads what it shows, plus the small set every tab needs for the
 * head: what is blocking and what is next is the same on every tab, so the
 * reads behind it are too. A read that fails says so where it would have
 * rendered, rather than showing an empty section that means "none". Every
 * write keeps its rules: history-only records, request ids, server checks.
 */
export default async function JourneyPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const session = await agentSession();
  if (session.state === "unknown") return <Unavailable reason={session.reason} />;
  if (session.state === "signed-out") redirect("/operations/sign-in");
  const agent = session.agent;

  if (!buyerSearchOn(process.env)) {
    return (
      <main className="shell-w">
        <PageHead title="Journeys are switched off" lede="RIFT_BUYER_SEARCH is set to off on this deployment. Nothing has been deleted; switching it back on brings every journey back as it was." />
      </main>
    );
  }

  const { id } = await params;
  if (!isUuid(id)) notFound();
  const j = await journeyFor(id);
  if (!j.ok) {
    return (
      <main className="shell-w">
        <PageHead title="This journey could not be loaded" back={{ href: "/operations/search", label: "Search" }} />
        <Unread what="journey" error={j.error} />
      </main>
    );
  }
  if ("skipped" in j) return <Unavailable reason={j.reason} />;
  if (!j.data) notFound();
  const journey = j.data;
  const buying = journey.side === "buy";
  const tab = tabFrom((await searchParams).tab, buying);
  const needs = (...ts: string[]) => ts.includes(tab);
  const buyerNeeds = (...ts: string[]) => buying && needs(...ts);
  const today = georgiaDay();

  const agentFirst = agent.name.trim().split(/\s+/)[0] ?? agent.name;
  const person = journey.person.split(/\s+/)[0] ?? journey.person;
  /* The head reads search, showings, offers, dates and the sale's own records on
     every tab, because "what is blocking" must not depend on which tab is open. */
  const [members, lead, progress, search, start, homes, tours, bids, docs, deadlines, summaryRead, moneyRead, depsRead, siblings, sellerRead, listingRead, offersRead, roomRead, planRead, statusRead] = await Promise.all([
    membersOf(id),
    readLead(journey.leadId),
    progressFor(id),
    settled(buyerNeeds("search", "homes", "history") ? searchState(id) : null),
    settled(buyerNeeds("search") ? readoutStart(journey.leadId) : null),
    settled(needs("homes", "offers", "property") ? homesOf(id) : null),
    settled(buying ? toursOf(id) : null),
    settled(buying ? bidsFor(id, agentFirst) : null),
    settled(needs("offers", "contract") ? documentsFor(id) : null),
    deadlinesFor(id),
    tab === "household" ? summaryLinksFor(id) : Promise.resolve(null),
    settled(buyerNeeds("money") ? moneyFor(id) : null),
    dependenciesFor(id),
    settled(tab === "overview" ? journeysFor(journey.leadId) : null),
    settled(!buying && needs("pricing", "proceeds", "history") ? sellerMoneyFor(id) : null),
    settled(!buying ? listingOf(id, agent.agentId) : null),
    settled(!buying ? offersFor(journey.leadId) : null),
    settled(!buying ? roomFor(journey.leadId) : null),
    settled(!buying ? readPlanForAgent(journey.leadId) : null),
    settled(buying ? searchStatuses([id]) : null),
  ]);
  const listing = listingRead && listingRead.ok && "data" in listingRead ? listingRead.data : null;
  const seller = sellerRead && sellerRead.ok && "data" in sellerRead ? sellerRead.data : null;
  const figureViews = viewFigures(seller?.figures ?? []);
  const lastFigure = figureViews.at(-1) ?? null;
  const deps = depsRead.ok && "data" in depsRead ? depsRead.data : null;
  const openDeps = (deps ?? []).filter((d) => stateOf(d) === "open");
  const candidates = siblings && siblings.ok && "data" in siblings ? siblings.data.filter((x) => x.side !== journey.side).map((x) => ({ id: x.id, label: x.label })) : [];
  const moneyData = moneyRead && moneyRead.ok && "data" in moneyRead ? moneyRead.data : null;

  const memberList = members.ok && "data" in members ? members.data : null;
  const leadRow = lead.ok && "data" in lead ? lead.data?.lead ?? null : null;
  const prog = progress && progress.ok && "data" in progress ? progress.data : null;
  const s0 = search && search.ok && "data" in search ? search.data : null;
  const latest = s0?.revisions[0] ?? null;
  const previous = s0?.revisions[1] ?? null;
  const homeList = homes && homes.ok && "data" in homes ? homes.data : null;
  const liveHomes = (homeList ?? []).filter((h) => !h.withdrawnAt).map((h) => ({ id: h.id, address: h.address }));
  const tourData = tours && tours.ok && "data" in tours ? tours.data : null;
  const bidData = bids && bids.ok && "data" in bids ? bids.data : null;
  const docData = docs && docs.ok && "data" in docs ? docs.data : null;
  const dateData = deadlines && deadlines.ok && "data" in deadlines ? deadlines.data : null;
  const openDates = prog?.open && dateData ? dateData.deadlines.filter((d) => d.transactionId === prog.open!.id) : [];
  const offerData = offersRead && offersRead.ok && "data" in offersRead ? offersRead.data : null;
  const room = roomRead && roomRead.ok && "data" in roomRead ? roomRead.data : null;
  const planItems = planRead && planRead.ok && "data" in planRead ? planRead.data.items : null;

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
  const statusEvent = [...(prog?.events ?? [])].reverse().find((e) => e.kind === "status");
  const searchStatus = !buying ? null
    : statusRead && statusRead.ok && "data" in statusRead ? statusRead.data.get(id)?.status ?? "unknown"
      : statusRead ? "unknown" : null;

  const attention = prog ? journeyAttention({
    side: journey.side, stage: prog.progress.stage, status: prog.progress.status, statusReason: statusEvent?.to === "paused" ? statusEvent.reason : null,
    nobodyInvited,
    missedDates: missed.map((d) => ({ id: d.id, label: d.label, when: d.view.when })),
    uncheckedDates: unchecked.map((d) => ({ id: d.id, label: d.label })),
    blocked: blocked.map((w) => ({ label: w.label, note: w.note ?? null })),
    stageNudge: nudge,
    search: searchStatus,
    tours: (tourData?.stops ?? []).map((t) => ({ id: t.id, address: t.address, status: t.view.status, blocked: t.view.blocked, overdue: t.view.overdue })),
    bids: (bidData?.bids ?? []).map((b) => ({ id: b.id, address: b.address, status: b.view.status, nextStep: b.view.nextStep, final: b.view.final })),
    listing: listing ? {
      status: listingStatus(listing.events).status,
      checklistLeft: checklist(listing.events).filter((c) => !c.done).length,
      showingsToUpdate: listing.showings.filter((x) => x.state === "requested" || (x.state === "done" && !x.feedback)).length,
    } : null,
    sellerOffers: offerData ? { unreleased: offerData.offers.filter((o) => !o.releasedAt).length, chosen: Boolean(room?.chosenOfferId) } : null,
    prep: planItems ? planItems.filter((p) => !p.doneAt).map((p) => ({ id: p.id, title: p.title, dueOn: p.dueOn })) : null,
    leadNext: leadRow?.nextAction ? { text: leadRow.nextAction, due: leadRow.nextDue ?? null } : null,
    today,
  }) : [];
  const counts = tabCounts(attention);
  const status = prog?.progress.status ?? null;
  const closed = prog && (status === "completed" || status === "cancelled")
    ? `${STATUS_LABEL[status]} ${prog.progress.statusSince ? DAY(prog.progress.statusSince) : ""}${statusEvent?.reason ? `: ${statusEvent.reason}` : "."}`.replace(/\s+:/, ":")
    : null;
  const focus = prog ? stageFocus(journey.side, prog.progress.stage) : null;
  const href = (t: string) => (t === "overview" ? `/operations/journey/${id}` : `/operations/journey/${id}?tab=${t}`);

  const fitRevision = s0?.active ? s0.revisions.find((r) => r.id === s0.active!.revisionId) ?? latest : latest;
  const against = fitRevision
    ? s0?.active && fitRevision.id === s0.active.revisionId
      ? `the requirements in the Matrix search (revision ${fitRevision.revision})`
      : `the requirements in brief revision ${fitRevision.revision}, not yet set up in Matrix`
    : null;

  const householdLine = memberList
    ? memberList.filter((m) => m.state === "active" || m.state === "invited").map((m) => `${m.name ?? m.email}${m.state === "invited" ? " (invited)" : ""}`).join(", ") || null
    : null;

  return (
    <main className="shell-w">
      <JourneyHead
        id={id} tab={tab}
        journey={{ label: journey.label, leadId: journey.leadId, person: journey.person, side: journey.side, createdAt: DAY(journey.createdAt) }}
        household={householdLine} progress={prog?.progress ?? null} events={prog?.events ?? []} status={status}
        attention={attention} closed={closed} focus={focus} counts={counts}
        extra={openDeps.map((d) => (
          <Link key={d.id} href={`/operations/journey/${buying ? d.saleJourneyId : d.purchaseJourneyId}`} className="chip chip-warn chip-line">
            <Ico.clock size={11} /> <span>{lineFor(d, journey.side)}</span>
          </Link>
        ))}
      />

      <div className={s.body}>
        {tab === "overview" ? (
          <div className={s.cols}>
            <div>
              <Section title="What needs you" hint="Everything on this journey that is wrong, owed or waiting, most urgent first.">
                <Panel>
                  {!prog ? <Unread what="journey's stage and contract" />
                    : closed ? (
                      <div className={s.line}><Ico.checkCircle size={15} className="c-pos" /><span className="w6">Nothing is open: this journey is finished.</span></div>
                    ) : attention.length ? <AttentionList items={attention} id={id} tab={tab} />
                    : (
                      <div>
                        <div className={s.line}><Ico.checkCircle size={15} className="c-pos" /><span className="w6">Nothing is blocked or waiting on you.</span></div>
                        {focus ? <p className="t-sm c-3" style={{ marginTop: 6 }}>At {STAGE_LABEL[prog.progress.stage]}: {focus.text}{" "}
                          {focus.tab !== "overview" ? <Link className="u" href={href(focus.tab)}>Open {(TAB_LABEL[focus.tab as keyof typeof TAB_LABEL] ?? focus.tab).toLowerCase()}</Link> : null}</p> : null}
                      </div>
                    )}
                </Panel>
              </Section>

              <Section title="Recent activity" actions={<Link className="u t-sm" href={href("history")}>All history</Link>}>
                <Panel>
                  {!prog ? <Unread what="journey's history" /> : prog.events.length ? (
                    <ul className={s.rows}>{[...prog.events].reverse().slice(0, 6).map((e) => {
                      const ago = agoWords(georgiaDay(new Date(e.at)), today);
                      return (
                        <li key={e.seq}>
                          {e.kind === "stage" ? "Stage" : "Status"}: <span className="w6">{e.kind === "stage" ? STAGE_LABEL[e.to as keyof typeof STAGE_LABEL] ?? e.to : STATUS_LABEL[e.to as keyof typeof STATUS_LABEL] ?? e.to}</span>
                          <span className={s.sub}><span title={WHEN(e.at)}>{ago ?? DAY(e.at)}</span> · {e.by}{e.reason ? ` · ${e.reason}` : ""}</span>
                        </li>
                      );
                    })}</ul>
                  ) : <p className="t-sm c-4">Nothing recorded yet. The first stage change appears here.</p>}
                </Panel>
              </Section>
            </div>

            <div>
              <Section title="Key dates" hint={prog?.open ? "Checked dates only: the household sees a date once you have checked it." : undefined} actions={prog?.open ? <Link className="u t-sm" href={href("contract")}>All dates</Link> : undefined}>
                <Panel>
                  {!prog?.open ? <p className="t-sm c-4">No contract yet. Dates appear here once one is recorded on the Contract tab.</p>
                    : !dateData ? <Unread what="contract dates" />
                    : upcoming.length ? (
                      <ul className={s.rows}>{upcoming.map((d) => (
                        <li key={d.id}>{d.label}<span className={s.sub}>{d.view.when}{d.view.days !== null ? <> · <span className={s.rel}>{inDays(d.view.days)}</span></> : null}</span></li>
                      ))}</ul>
                    ) : <p className="t-sm c-4">No checked dates ahead.{unchecked.length ? ` ${unchecked.length} still to check against the contract.` : ""}</p>}
                </Panel>
              </Section>

              {prog?.open ? (
                <Section title="Workstreams" actions={<Link className="u t-sm" href={href("contract")}>Open the contract</Link>}>
                  <Panel>
                    {(() => {
                      const active = prog.open.work.filter((w) => !isSettled(w.state) && w.state !== "not-started");
                      const idle = prog.open.work.filter((w) => w.state === "not-started").length;
                      const done = prog.open.work.filter((w) => isSettled(w.state)).length;
                      return (
                        <>
                          {active.length ? (
                            <ul className={s.rows}>{active.map((w) => (
                              <li key={w.workstream}>
                                <span className={`${s.state} ${GLYPH[w.state].c}`}><span aria-hidden>{GLYPH[w.state].g}</span><span className="c-1 w6">{w.label}</span></span>
                                <span className={s.sub}>{WORK_STATE_LABEL[w.state]}{w.stale && w.state !== "blocked" ? " · no word for a week" : ""}</span>
                              </li>
                            ))}</ul>
                          ) : <p className="t-sm c-4">Nothing under way.</p>}
                          <p className="t-xs c-4" style={{ marginTop: 10 }}>{idle} not started, {done} confirmed or not needed.</p>
                        </>
                      );
                    })()}
                  </Panel>
                </Section>
              ) : null}

              {buying ? (
                <Section title="Search and showings">
                  <Panel>
                    <ul className={s.rows}>
                      <li><Link className="u" href={href("search")}>Matrix search</Link><span className={s.sub}>{searchStatus ? SEARCH_STATUS_LABEL[searchStatus] : "Not read"}</span></li>
                      <li><Link className="u" href={href("homes")}>Showings</Link><span className={s.sub}>{tourData ? `${tourData.stops.filter((t) => t.view.status !== "cancelled" && t.view.status !== "completed").length} open, ${tourData.stops.filter((t) => t.view.status === "completed").length} seen` : "Did not load"}</span></li>
                      <li><Link className="u" href={href("offers")}>Offers</Link><span className={s.sub}>{bidData ? `${bidData.bids.filter((b) => !b.view.final).length} in progress, ${bidData.bids.filter((b) => b.view.final).length} finished` : "Did not load"}</span></li>
                    </ul>
                  </Panel>
                </Section>
              ) : (
                <Section title="The sale">
                  <Panel>
                    <ul className={s.rows}>
                      <li><Link className="u" href={href("listing")}>Listing</Link><span className={s.sub}>{listing ? listingLine(listing.events, listing.showings) : "Not read"}</span></li>
                      <li><Link className="u" href={href("seller-offers")}>Offers</Link><span className={s.sub}>{offerData ? `${offerData.offers.length} recorded, ${offerData.offers.filter((o) => o.releasedAt).length} shown to the seller${room?.chosenAt ? ", one chosen" : ""}` : "Did not load"}</span></li>
                      <li><Link className="u" href={href("prep")}>Preparation</Link><span className={s.sub}>{planItems ? `${planItems.filter((p) => !p.doneAt).length} open, ${planItems.filter((p) => p.doneAt).length} done` : "Did not load"}</span></li>
                    </ul>
                  </Panel>
                </Section>
              )}

              <Section title={`Linked ${buying ? "sale" : "purchase"}`}>
                <Panel>
                  {deps === null ? (depsRead.ok ? <NeedsUpdate what="Linked journeys" migration="20260928020000" /> : <Unread what="linked journeys" />)
                    : <Linked journeyId={id} side={journey.side} deps={deps} candidates={candidates} agentName={agent.name} />}
                </Panel>
              </Section>
            </div>
          </div>
        ) : null}

        {tab === "search" ? (
          <>
            <Section title="Search brief" hint={latest
              ? `Revision ${latest.revision}, by ${latest.authorLabel}${latest.authorKind === "client" ? " (buyer)" : ""}, ${DAY(latest.createdAt)}.`
              : "What they need in a home, and what they would only like, each with who said it and when."}>
              <Panel>
                {search && !search.ok ? <Unread what="brief" error={search.error} /> : (
                  <AgentBrief journeyId={id} latest={latest ? { revision: latest.revision, ...latest.brief } : null}
                    start={start && start.ok && "data" in start ? start.data : null} person={journey.person} disagreement={s0?.disagreement ?? []} />
                )}
              </Panel>
            </Section>
            {latest && (previous || s0?.responses.length) ? <Changed latest={latest} previous={previous} s={s0!} anyActive={Boolean(memberList?.some((m) => m.state === "active"))} /> : null}
            <Section title="Matrix search" hint="Approve a revision, set it up in Matrix, record where it lives. Rift cannot see Matrix, so it only knows what you record.">
              <Panel>
                {s0 ? (
                  <SearchSetup journeyId={id} person={journey.person} status={s0.status}
                    latest={latest ? { id: latest.id, revision: latest.revision, brief: latest.brief } : null}
                    disagreement={s0.disagreement} active={s0.active} pending={s0.pending} history={s0.history} />
                ) : <Notice tone="neg" title="The Matrix search status did not load">It is unknown, not inactive.</Notice>}
              </Panel>
            </Section>
          </>
        ) : null}

        {tab === "homes" ? (
          <>
            <Section title="Homes" hint="Homes you or the buyer added, with everyone's reactions. No listing feed: a link and the facts you typed."
              actions={(homeList?.filter((h) => !h.withdrawnAt).length ?? 0) >= 2 ? <Link href={`/operations/journey/${id}/compare`} className="btn btn-s btn-sm">Compare side by side</Link> : undefined}>
              <Panel>
                {homeList ? (
                  <Homes journeyId={id} homes={homeList.map((h) => ({ ...h, historyCount: h.history.length }))} criteria={fitRevision?.brief.criteria ?? []} against={against} />
                ) : <Unread what="shortlist" />}
              </Panel>
            </Section>
            <Section title="Showings" hint="What you arranged in ShowingTime, step by step. A request is not an appointment until you record the confirmed time.">
              <Panel>
                {tourData ? (
                  <Showings journeyId={id} stops={tourData.stops} homes={liveHomes} coverage={tourData.coverage} leadId={journey.leadId} person={person} unavailable={tourData.unavailable} />
                ) : <Unread what="showings" />}
              </Panel>
            </Section>
          </>
        ) : null}

        {tab === "offers" ? (
          <Section title="Offers and documents" hint="The terms, each version, and what the household told you. The forms are prepared, signed and delivered in Remine; this records that they were.">
            <Panel>
              {bidData && docData ? (
                <Offers journeyId={id} bids={bidData.bids} docs={docData.documents} homes={liveHomes} deciders={bidData.deciders}
                  coverage={bidData.coverage} leadId={journey.leadId} person={person} unavailable={bidData.unavailable ?? docData.unavailable} />
              ) : <Unread what="offers" />}
            </Panel>
          </Section>
        ) : null}

        {tab === "contract" ? (
          <>
            <Section title="Where it stands" hint={`The stage the ${buying ? "buyer" : "seller"} sees, and under contract what is running at once. Each change is recorded with why and by whom.`}>
              <Panel>
                {prog ? (
                  <Progress journeyId={id} side={journey.side} progress={prog.progress} events={prog.events} open={prog.open} past={prog.contracts.filter((c) => c.outcome)}
                    homes={prog.homes} coverage={prog.coverage} leadId={journey.leadId} person={person} unavailable={prog.unavailable} nudge={nudge} />
                ) : <Unread what="stage and contract" />}
              </Panel>
            </Section>
            {prog?.open ? (
              <Section title="Contract dates" hint={`Each from the executed documents, with where it comes from. The ${buying ? "buyer" : "seller"} sees a date only once you have checked it against the document.`}>
                {dateData?.unavailable ? <Notice tone="warn" title="Contract dates are not available yet">{dateData.unavailable}</Notice>
                  : dateData ? <Panel><Dates journeyId={id} dates={openDates} docs={(docData?.documents ?? []).map((d) => ({ id: d.id, label: d.label }))} /></Panel>
                  : <Unread what="contract dates" />}
              </Section>
            ) : null}
          </>
        ) : null}

        {tab === "property" ? (
          <Section title="The property" hint="The home being sold, each fact from a named source on a stated day.">
            <Panel>
              {homeList ? (() => {
                const p = homeList.find((h) => !h.withdrawnAt) ?? null;
                return <SellerProperty journeyId={id} property={p ? { id: p.id, address: p.address, facts: p.facts, factsSource: p.factsSource, factsAsOf: p.factsAsOf } : null} />;
              })() : <Unread what="property" />}
            </Panel>
          </Section>
        ) : null}

        {/* Worked here, not on the person's record: the same controls, with
            writes through this page's route (lead/[id]/useSellerOps.ts). */}
        {tab === "seller-offers" ? (
          offerData ? (
            <>
              <SellerOffers leadId={journey.leadId} journeyId={id} offers={offerData.offers} costs={offerData.costs} agentFirst={agentFirst} />
              <Take leadId={journey.leadId} journeyId={id} offers={offerData.offers} costs={offerData.costs} room={room} />
            </>
          ) : <Section title="Offers"><Unread what="offers" /></Section>
        ) : null}

        {tab === "prep" ? (
          <Section title="Preparation" hint="The work before launch, each item with who does it and when: the same plan the seller sees on their page.">
            {planItems && planRead && planRead.ok && "data" in planRead
              ? <Panel><Steps leadId={journey.leadId} journeyId={id} items={planRead.data.items} agentFirst={agentFirst} clientFirst={person} /></Panel>
              : <Unread what="plan" />}
          </Section>
        ) : null}

        {tab === "listing" ? (
          <Section title="Listing and showings" hint="What is done for the launch, when it went live and where, each showing with the feedback actually given, and the weekly account. The seller sees the summary on their page, never access details.">
            {!listingRead || !listingRead.ok ? <Unread what="listing" />
              : !listing ? <NeedsUpdate what="The listing and its showings" migration="20260928050000" />
              : <Panel><SellerListing journeyId={id} events={listing.events} showings={listing.showings} reviews={listing.reviews} /></Panel>}
          </Section>
        ) : null}

        {tab === "pricing" || tab === "proceeds" ? (
          <Section title={tab === "pricing" ? "Pricing strategy" : "Proceeds"}
            hint={tab === "pricing"
              ? "Your approved opinion and the comparables you chose. The seller sees it with their net at each end of the range, and answers on their page."
              : "The seller's net from planning to official, each version from a named source. The seller sees these on their page."}>
            {!sellerRead || !sellerRead.ok ? <Unread what={tab === "pricing" ? "pricing" : "proceeds"} />
              : !seller ? <NeedsUpdate what="Pricing and proceeds" migration="20260928040000" />
              : (
                <Panel>
                  {tab === "pricing"
                    ? <SellerPricing journeyId={id} opinions={seller.opinions}
                        scenarios={seller.opinions.length && lastFigure ? scenarios(seller.opinions.at(-1)!, { owed: lastFigure.owed, commissionPct: lastFigure.commissionPct, credits: lastFigure.credits }) : null} />
                    : <SellerProceeds journeyId={id} views={figureViews} line={proceedsLine(figureViews)} />}
                </Panel>
              )}
          </Section>
        ) : null}

        {tab === "money" ? (
          <Section title="Money" hint={<>The buyer&apos;s ledger: {moneyData?.answersFrom ? `their answers from the plan they saved on ${DAY(moneyData.answersFrom)}` : "no saved plan, so Rift's starting figures"}, the amounts you record, and {moneyData ? `this week's rate (${moneyData.rate.label})` : "this week's rate"}. Household members with &ldquo;Price and fees&rdquo; see it too.</>}>
            {!moneyRead || !moneyRead.ok ? <Unread what="money record" error={moneyRead && !moneyRead.ok ? moneyRead.error : undefined} />
              : !moneyData ? <Notice tone="info" title="Nothing is recorded on this deployment">{"skipped" in moneyRead ? moneyRead.reason : "Not available."}</Notice>
              : (
                <div className={s.stack}>
                  <Panel><LedgerView l={moneyData.ledger} audience="agent" /></Panel>
                  {moneyData.recording
                    ? <Panel><MoneyFacts journeyId={id} facts={moneyData.facts} /></Panel>
                    : <NeedsUpdate what="Recording amounts" migration="20260928010000" />}
                </div>
              )}
          </Section>
        ) : null}

        {tab === "household" ? (
          <>
            <Section title="Household" hint={`Who can sign in to this journey, and what each person sees.`}>
              {memberList ? (
                <Household journeyId={id} side={journey.side} agentName={agent.name} journeyLabel={journey.label} members={memberList} defaultEmail={leadRow?.email ?? ""} defaultName={leadRow?.name ?? ""} />
              ) : <Unread what="household" />}
            </Section>
            <Section title="Summary links" hint="A read-only summary for someone outside the household. It never shows money, notes or documents.">
              <Panel>
                {summaryRead && summaryRead.ok ? <SummaryLinks journeyId={id} links={"data" in summaryRead ? summaryRead.data : null} /> : <Unread what="summary links" />}
              </Panel>
            </Section>
          </>
        ) : null}

        {tab === "history" ? (
          <Section title="History" hint={`Every change to the stage and status${buying ? ", and every revision of the brief" : ", every pricing and proceeds version, the listing and each weekly review"}, with who and why. Nothing here is ever edited.`}>
            {!prog ? <Unread what="stage history" /> : null}
            {!buying && (!sellerRead?.ok || !listingRead?.ok) ? <Notice tone="warn" title="Part of the sale's history did not load">What is shown is not all of it.</Notice> : null}
            {(() => {
              const history = journeyHistory({
                events: prog?.events ?? [], revisions: s0?.revisions ?? [],
                opinions: seller?.opinions, figures: seller?.figures, listing,
              });
              return history.length ? (
                <Panel>
                  <ol className={s.hist}>{history.map((h) => (
                    <li key={h.key}>
                      <span className={s.histWhen}>{WHEN(h.at)}</span>
                      <span>{h.text} <span className={s.histWho}>· {h.who}</span>{h.note ? <span className={s.sub}>{h.note}</span> : null}</span>
                    </li>
                  ))}</ol>
                </Panel>
              ) : <Empty title="Nothing recorded yet">Stage changes, brief revisions{buying ? "" : ", pricing versions and listing events"} appear here as they are recorded.</Empty>;
            })()}
          </Section>
        ) : null}
      </div>

      <p className={s.foot}>
        Nothing on this page sends anything to anybody. Invitation links are for you to send{buying ? ", and the Matrix search is set up by you" : ", and the listing goes live through your MLS"}. Rift records what you did, {agentFirst}, and when.
      </p>
    </main>
  );
}

/** What changed between the last two brief revisions, and who in the household agrees. */
function Changed({ latest, previous, s, anyActive }: { latest: Revision; previous: Revision | null; s: SearchState; anyActive: boolean }) {
  const diff = diffBriefs(previous?.brief ?? null, latest.brief);
  return (
    <Section title="What changed, and who agrees" hint={previous ? `Revision ${previous.revision} to ${latest.revision}${latest.note ? `: "${latest.note}"` : ""}` : undefined}>
      <Panel>
        {previous ? (
          diff.changes.length || diff.questionsAdded.length || diff.questionsResolved.length ? (
            <ul className="t-sm" style={{ display: "grid", gap: 6 }}>
              {diff.changes.map((c) => (
                <li key={(c.after ?? c.before)!.id}>
                  <span className="chip t-2xs" style={{ marginRight: 6 }}>{c.kind === "added" ? "Added" : c.kind === "removed" ? "Removed" : "Changed"}</span>
                  <span className="w6">{FIELDS[(c.after ?? c.before)!.field].label}</span>:{" "}
                  {c.kind === "changed"
                    ? <>{describe(c.before!)} ({STRENGTH_LABEL[c.before!.strength].toLowerCase()}) to {describe(c.after!)} ({STRENGTH_LABEL[c.after!.strength].toLowerCase()})</>
                    : describe((c.after ?? c.before)!)}
                  {c.after && c.kind !== "removed" ? <span className="t-2xs c-4"> · {c.after.statedBy}, {c.after.sourceRef}</span> : null}
                </li>
              ))}
              {diff.questionsAdded.map((q) => <li key={`qa${q}`}><span className="chip t-2xs" style={{ marginRight: 6 }}>New question</span>{q}</li>)}
              {diff.questionsResolved.map((q) => <li key={`qr${q}`}><span className="chip t-2xs" style={{ marginRight: 6 }}>Settled</span>{q}</li>)}
            </ul>
          ) : <p className="t-sm c-3">Saved again with no changes to the criteria.</p>
        ) : null}
        {s.responses.length ? (
          <div style={previous ? { marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--line-3)" } : undefined}>
            <div className="t-sm w6">Answers to revision {latest.revision}</div>
            <ul className="t-sm" style={{ marginTop: 6, display: "grid", gap: 6 }}>
              {s.responses.map((r) => (
                <li key={r.id}>
                  <span className="w6">{r.name}</span>{" "}
                  {r.response === "confirmed"
                    ? <span className="c-pos"><Ico.check size={12} /> confirmed it</span>
                    : <span className="c-warn"><Ico.alert size={12} /> asked for changes</span>}
                  {r.note ? <span className="c-3">: &ldquo;{r.note}&rdquo;</span> : null}
                  <span className="t-2xs c-4"> · {DAY(r.createdAt)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : anyActive ? <p className="t-sm c-4" style={previous ? { marginTop: 12 } : undefined}>Nobody in the household has answered revision {latest.revision} yet.</p> : null}
      </Panel>
    </Section>
  );
}
