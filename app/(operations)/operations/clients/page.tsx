import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { agentSession } from "@/lib/db/session";
import { Unavailable } from "../Unavailable";
import { roster, liveRelationships, finishedRelationships, lastContacts } from "@/lib/db/clients";
import { Panel } from "./Panel";
import { rulesOrDefaults } from "@/lib/db/settings";
import { STALL_CHIP } from "@/lib/core/pipeline";
import { Forward } from "./Forward";
import { BAND_LABEL } from "@/lib/core/lead";
import { Ico } from "@/components/rift/icons";
import { Search } from "./Search";
import { isUuid } from "@/lib/core/ids";
import {
  STAGE_FILTERS, NEXT_FILTERS, CONTACT_FILTERS, SORTS, pick,
  ago, dueView, bandIsLive, sourceLabel, narrowPeople, sortPeople, isTerminal,
  type Narrowing,
} from "@/lib/core/people";
import { PageHead, Section, Notice, Empty } from "../ui";
import css from "./clients.module.css";

export const metadata: Metadata = { title: "Relationships" };
export const dynamic = "force-dynamic";

/* How many people are read at once. Narrowing by stage, next step and last
   contact happens on this set, so it must be the whole book, not a page of it;
   past it the page says so rather than quietly narrowing the newest. */
const BOOK = 500;

/**
 * Everybody, findable.
 *
 * Today's screen is the right default and the wrong tool for one job: somebody
 * rings up and says their name. It ranks by what the answers imply is urgent,
 * shows only who has been given a stage, and caps at what fits, so a lead who
 * came through the funnel this morning and has not been picked up is not on it.
 *
 * This is deliberately the unranked view. No scoring order, no urgency, no
 * opinion about who matters. A list, newest first unless asked otherwise, with
 * a box to search it and filters for the questions that get asked of it: who
 * is overdue, who has gone quiet, who is at which stage.
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
  const status = pick(["all", "working", "new", "archived"] as const, one("filter"), "all");
  const side = pick(["all", "buy", "sell"] as const, one("side"), "all");
  const narrowing: Narrowing = {
    stage: pick(STAGE_FILTERS, one("stage"), "any"),
    next: pick(NEXT_FILTERS, one("next"), "any"),
    contact: pick(CONTACT_FILTERS, one("contact"), "any"),
  };
  const sort = pick(SORTS, one("sort"), "arrived");

  /* One round. None of these depends on another, and the forward view must not
     make the list of people wait: if the forecast query is the slow one, the
     thing the agent actually came here for is still the roster. */
  const [list, rules, live, finished] = await Promise.all([
    roster({ q: one("q"), filter: status, side, limit: BOOK }),
    rulesOrDefaults(agent.agentId),
    liveRelationships(),
    finishedRelationships(),
  ]);

  const everyone = list.ok && "data" in list ? list.data.people : [];
  /* The person open beside the list, kept in the address with the search. */
  const open = isUuid(one("open") ?? "") ? one("open")! : null;
  const withOpen = (id: string | null) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (k !== "open" && typeof v === "string" && v) next.set(k, v);
    if (id) next.set("open", id);
    return `/operations/clients${next.size ? `?${next}` : ""}`;
  };
  const contactRead = await lastContacts(everyone.map((p) => p.id));
  const contacted = contactRead.ok && "data" in contactRead ? contactRead.data : null;
  const more = list.ok && "data" in list ? list.data.more : false;
  const searching = Boolean(one("q")?.trim());

  const people = sortPeople(narrowPeople(everyone, contacted, narrowing), contacted, sort);
  /* What the two quick chips count: people still being worked. A closed client
     with no recent call is finished, not neglected. Each count keeps the other
     filters already set, so "3 overdue" beside a stage filter is what pressing
     it will show, not a number for the whole book. */
  const working = everyone.filter((p) => !isTerminal(p.stage) && !p.archivedAt);
  const overdue = narrowPeople(working, contacted, { ...narrowing, next: "overdue" }).length;
  const quiet = narrowPeople(working, contacted, { ...narrowing, contact: "quiet" }).length;
  const filtered = narrowing.stage !== "any" || narrowing.next !== "any" || narrowing.contact !== "any" || status !== "all" || side !== "all" || searching;

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
    <main className="shell-w">
      <PageHead
        title="Relationships"
        lede="Everyone, newest first by default. Today ranks them by what needs doing; this is for when you already know whose name you are looking for, or want to see who has gone quiet."
        actions={<Link href="/operations/add" className="btn btn-p btn-sm"><Ico.plus size={14} />Add someone</Link>}
      />

      <Suspense fallback={<div className="t-sm c-4">Loading…</div>}>
        <Search shown={people.length} total={everyone.length} more={more} overdue={overdue} quiet={quiet} quietKnown={contacted !== null} />
      </Suspense>

      {contacted === null && everyone.length ? (
        <Notice tone="warn" title="Last contact could not be read">
          The last-contact column and its filter are off until it loads. The people listed are not affected.
        </Notice>
      ) : null}

      {/* A read that failed is not an empty list, and must never render as
          one. "You have nobody" and "we could not ask" are the same picture
          and completely different facts. */}
      {!list.ok ? (
        <Notice tone="warn" title="The list could not be read">
          {list.error}. This is not an empty list, it is a list we could not fetch. Reload in a moment.
        </Notice>
      ) : "skipped" in list ? (
        <Notice tone="info" title="Nothing is recorded on this deployment">{list.reason}.</Notice>
      ) : everyone.length === 0 ? (
        <Empty
          title={searching ? "Nobody matches that" : status === "archived" ? "Nobody is archived" : "Nobody here yet"}
          action={!searching && status !== "archived" ? <Link href="/operations/add" className="btn btn-p btn-sm">Add someone</Link> : searching ? <Link href="/operations/clients" className="btn btn-s btn-sm">Clear the search</Link> : undefined}
        >
          {searching
            ? "Try part of a name, an email or a phone number."
            : status === "archived"
              ? "People you archive from their record are kept here, and can be restored."
              : "People arrive here when they finish a readout and leave their details, or you can add somebody yourself."}
        </Empty>
      ) : people.length === 0 ? (
        <Empty title="Nobody matches these filters" action={<Link href="/operations/clients" className="btn btn-s btn-sm">Clear filters</Link>}>
          {everyone.length} {everyone.length === 1 ? "person is" : "people are"} on record before the stage, next-step and contact filters.
        </Empty>
      ) : (
        <div className={`${css.split} ${open ? css.open : ""}`}>
          <div className="card" style={{ minWidth: 0, overflow: "hidden" }}>
            <table className={css.tbl}>
              <thead>
                <tr><th>Person</th><th>Stage</th><th>Next step</th><th>Last contact</th><th>Arrived</th></tr>
              </thead>
              <tbody>
                {people.map((p) => {
                  const due = p.nextAction && p.nextDue ? dueView(p.nextDue) : null;
                  const last = contacted?.get(p.id);
                  return (
                    <tr key={p.id} aria-selected={open === p.id}>
                      <td className={css.first}>
                        {/* Opens beside the list, keeping the search and the
                            scroll; the full record is one click further. */}
                        <Link href={withOpen(p.id)} scroll={false} className={css.name}>{p.name?.trim() || p.email || "Someone who left no name"}</Link>
                        <div className={css.sub}>{p.side === "buy" ? "Buying" : "Selling"} · {sourceLabel(p.source)}</div>
                        {bandIsLive(p) || p.archivedAt ? (
                          <div className={css.chips}>
                            {bandIsLive(p) ? <span className="chip chip-acc"><Ico.bolt size={11} />{BAND_LABEL[p.band]}</span> : null}
                            {p.archivedAt ? <span className="chip"><Ico.pause size={11} />Archived</span> : null}
                          </div>
                        ) : null}
                      </td>
                      <td data-label="Stage" className={css.nowrap}>
                        {p.stage ?? <span className="c-4">Not picked up</span>}
                        {p.stall && p.stall.level !== "moving" ? (
                          <div className={css.chips}><span className={`chip ${STALL_CHIP[p.stall.level].c}`}><Ico.alert size={11} />{STALL_CHIP[p.stall.level].l}</span></div>
                        ) : null}
                      </td>
                      <td data-label="Next step" className={css.next}>
                        {p.nextAction ? (
                          <>
                            {p.nextAction}
                            {due ? <div className={`${css.due} ${css[due.state]}`}>{due.state === "overdue" ? <Ico.alert size={12} /> : <Ico.cal size={12} />}{due.label}</div> : null}
                          </>
                        ) : <span className="c-4">None set</span>}
                      </td>
                      <td data-label="Last contact" className={css.nowrap}>
                        {last ? ago(last) : <span className="c-4">{contacted ? "None logged" : "Unknown"}</span>}
                      </td>
                      <td data-label="Arrived" className={css.nowrap}>{ago(p.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {open ? <Panel id={open} closeHref={withOpen(null)} /> : null}
        </div>
      )}

      {/* Only when the roster is unfiltered. A forecast sitting above the
          results of a name search is answering a question nobody asked, and
          it would look like a forecast OF the search. */}
      {liveOk && !filtered ? (
        <div className={css.after}><Section title="Likely to close" hint="Weighted by stage, from everyone being worked. It sits under the list because the list is what this page is for.">
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
        </Section></div>
      ) : null}
    </main>
  );
}
