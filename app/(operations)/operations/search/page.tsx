import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { agentSession } from "@/lib/db/session";
import { Unavailable } from "../Unavailable";
import { buyingJourneys } from "@/lib/db/journeys";
import { searchStatuses, type SearchRow } from "@/lib/db/search";
import { journeyStates, type JourneyState } from "@/lib/db/progress";
import { buyerSearchOn } from "@/lib/core/journey";
import { STATUS_LABEL, type SearchStatus } from "@/lib/core/search";
import { STAGE_LABEL } from "@/lib/core/progress";
import { searchListing, type SearchGroup } from "@/lib/core/search-list";
import { agoWords } from "@/lib/core/journey-focus";
import { georgiaDay, showDay } from "@/lib/core/day";
import { Ico } from "@/components/rift/icons";
import { PageHead, Notice, Empty, Tabs, Stats, Stat } from "../ui";
import s from "./search.module.css";

export const metadata: Metadata = { title: "Search" };
export const dynamic = "force-dynamic";

const SHOW = [
  { id: "needs", label: "Needs you" },
  { id: "running", label: "Running" },
  { id: "paused", label: "Paused" },
  { id: "all", label: "All" },
] as const;
type Show = (typeof SHOW)[number]["id"];

/* An icon and a word with every status, never colour alone (rule 10). */
const STATUS_ICON: Record<SearchStatus, { Icon: typeof Ico.alert; tone: "warn" | "pos" | "none" }> = {
  "manual-action-needed": { Icon: Ico.alert, tone: "warn" },
  "update-pending": { Icon: Ico.refresh, tone: "warn" },
  "awaiting-approval": { Icon: Ico.clock, tone: "warn" },
  unknown: { Icon: Ico.alert, tone: "warn" },
  draft: { Icon: Ico.doc, tone: "warn" },
  paused: { Icon: Ico.pause, tone: "none" },
  "active-confirmed": { Icon: Ico.checkCircle, tone: "pos" },
};

/**
 * The agent's working list of home searches: every buyer who is still
 * looking, what their search needs from him, and how long it has waited.
 *
 * Decision D10: buyer search is the work that repeats most. This page is the
 * answer to "whose search do I owe something to", which today lives in his
 * head and a Matrix sidebar. A status that could not be read is listed as
 * unknown, among what he owes, rather than dropped or shown as fine. A buyer
 * who is under contract, closed or cancelled is not searching and is not
 * listed: that work is on Transactions. The view is in the address, so back
 * returns to the same list.
 */
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const session = await agentSession();
  if (session.state === "unknown") return <Unavailable reason={session.reason} />;
  if (session.state === "signed-out") redirect("/operations/sign-in");

  const on = buyerSearchOn(process.env);
  const journeys = on ? await buyingJourneys() : null;
  const list = journeys && journeys.ok && "data" in journeys ? journeys.data : [];
  const ids = list.map((j) => j.id);
  const [statuses, states] = ids.length ? await Promise.all([searchStatuses(ids), journeyStates(ids)]) : [null, null];
  const byId: Map<string, SearchRow> | null = statuses && statuses.ok && "data" in statuses ? statuses.data : null;
  const stateById: Map<string, JourneyState> | null = states && states.ok && "data" in states ? states.data : null;
  const today = georgiaDay();

  /* A read that failed leaves a row's status unknown, and says so; it is never quietly "set up". */
  const rows = list.map((j) => {
    const row: SearchRow = byId?.get(j.id) ?? { journeyId: j.id, status: "unknown", latest: null, updatedAt: null };
    const state: JourneyState = stateById?.get(j.id) ?? { stage: "search", status: "active", statusReason: null };
    return { ...j, row, state, ...searchListing({ stage: state.stage, status: state.status, statusReason: state.statusReason, search: row.status }) };
  }).filter((r) => r.listed)
    .sort((a, b) => a.rank - b.rank || (a.row.updatedAt ?? "").localeCompare(b.row.updatedAt ?? ""));
  const notListed = list.length - rows.length;

  const count = (g: SearchGroup) => rows.filter((r) => r.group === g).length;
  const raw = (await searchParams).show;
  const show: Show = SHOW.some((x) => x.id === raw) ? (raw as Show) : "needs";
  const shown = rows.filter((r) => show === "all" || r.group === show);

  return (
    <main className="shell-w">
      <PageHead
        title="Search"
        lede={<>Every buyer who is still looking, and what their search needs from you. &ldquo;Set up&rdquo; means you recorded setting it up: Rift cannot see Matrix, so it never claims a search is running on its own.</>}
        actions={rows.length ? (
          <Tabs label="Which searches" current={show} items={SHOW.map((x) => ({
            id: x.id, label: x.label, count: x.id === "all" ? rows.length : count(x.id), href: x.id === "needs" ? "/operations/search" : `/operations/search?show=${x.id}`,
          }))} />
        ) : undefined}
      />

      {!on ? (
        <Notice tone="info" title="Journeys are switched off on this deployment">RIFT_BUYER_SEARCH is set to off. Nothing was deleted; switching it back on brings every search back.</Notice>
      ) : journeys && !journeys.ok ? (
        <Notice tone="neg" title="The buying journeys did not load">That is not an empty list; it is a list we could not fetch ({journeys.error}). Reload in a moment.</Notice>
      ) : journeys && "skipped" in journeys ? (
        <Notice tone="info" title="Nothing is recorded on this deployment">{journeys.reason}.</Notice>
      ) : list.length === 0 ? (
        <Empty title="No buying journeys yet" action={<Link className="btn btn-s btn-sm" href="/operations/clients">Open Relationships</Link>}>
          Open a buyer from Relationships and start a journey. Their readout comes with them, so you begin from what they already told the calculator.
        </Empty>
      ) : (
        <>
          {statuses && !statuses.ok ? (
            <Notice tone="warn" title="Search statuses did not load">Every row below says unknown, which is not the same as set up ({statuses.error}).</Notice>
          ) : null}
          {states && !states.ok ? (
            <Notice tone="warn" title="Where each journey stands did not load">Every journey below is treated as an active search, so a finished one may still be listed ({states.error}).</Notice>
          ) : null}

          <Stats>
            <Stat label="Need you" value={count("needs")} tone={count("needs") ? "warn" : undefined} hint={count("needs") ? "Approve, set up, or write a brief" : "Nothing owed"} href="/operations/search" />
            <Stat label="Running" value={count("running")} hint="Set up in Matrix, as you recorded" href="/operations/search?show=running" />
            <Stat label="Paused" value={count("paused")} hint="Journey or Matrix search paused" href="/operations/search?show=paused" />
          </Stats>

          {shown.length === 0 ? (
            <Empty title={show === "needs" ? "No search needs you" : "None here"}
              action={show !== "all" ? <Link className="btn btn-g btn-sm" href="/operations/search?show=all">Show all {rows.length}</Link> : undefined}>
              {show === "needs"
                ? "Every active search is set up or paused. One appears here when a brief is written, changes, or is approved and waiting to be set up in Matrix."
                : "A search appears here when its journey is active and has not yet reached a contract."}
            </Empty>
          ) : (
            <div className={s.list} style={{ marginTop: 16 }}>
              <div className={s.head} aria-hidden>
                <span>Buyer</span><span>Stage</span><span>What it needs</span><span>Matrix search</span><span />
              </div>
              <ul className={s.items}>
                {shown.map((r) => {
                  const { Icon, tone } = STATUS_ICON[r.row.status];
                  const ago = r.row.updatedAt ? agoWords(georgiaDay(new Date(r.row.updatedAt)), today) : null;
                  return (
                    <li key={r.id}>
                      <Link href={`/operations/journey/${r.id}?tab=search`} className={s.row}>
                        <span className={s.who}>
                          <span className={s.name}>{r.person}</span>
                          <span className={s.what}>{r.label}</span>
                        </span>
                        <span className={s.stage}>
                          <span className={s.label}>Stage</span>{STAGE_LABEL[r.state.stage]}
                          {r.state.status === "paused" ? <span className="c-warn"> · Paused</span> : null}
                        </span>
                        <span>
                          <span className={s.next}>{r.next}</span>
                          {r.row.latest ? (
                            <span className={s.age} style={{ display: "block" }}>
                              Brief revision {r.row.latest}, {ago ?? (r.row.updatedAt ? showDay(r.row.updatedAt, { month: "short", day: "numeric" }) : "")}
                            </span>
                          ) : <span className={s.age} style={{ display: "block" }}>No brief yet</span>}
                        </span>
                        <span><span className={s.status} data-tone={tone}><Icon size={12} /> {STATUS_LABEL[r.row.status]}</span></span>
                        <span className={s.go}>Open <Ico.chevR size={12} /></span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {notListed > 0 ? (
            <p className="t-xs c-4" style={{ marginTop: 12 }}>
              {notListed} buying journey{notListed === 1 ? " is" : "s are"} not listed: under contract, closed or cancelled. {notListed === 1 ? "It is" : "They are"} on <Link className="u" href="/operations/transactions">Transactions</Link> or in Relationships.
            </p>
          ) : null}
        </>
      )}
    </main>
  );
}
