import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { agentSession } from "@/lib/db/session";
import { offerBoard } from "@/lib/db/offer-board";
import { countItems, WAITING_LABEL, type OfferItem } from "@/lib/core/offer-board";
import { inDays } from "@/lib/core/deadline";
import { daysUntil, georgiaDay, showDay } from "@/lib/core/day";
import { Unavailable } from "../Unavailable";
import { PageHead, Notice, Empty, Stats, Stat, Tabs, Section } from "../ui";
import { Tag } from "../_business/Tag";
import { say } from "../_business/say";
import { InboundCards, UploadCards } from "./Inbound";
import k from "../_business/kit.module.css";
import s from "./offers.module.css";

export const metadata: Metadata = { title: "Offers" };
export const dynamic = "force-dynamic";

const VIEWS = [
  { id: "all", label: "All" },
  { id: "buying", label: "Buying" },
  { id: "selling", label: "Selling" },
  { id: "inbound", label: "Came in by form" },
] as const;
type View = (typeof VIEWS)[number]["id"];

/**
 * Every live offer, on both sides, and what each is waiting on.
 *
 * This page was "Offers in": only the offers that arrived through the public
 * form. The offers a buyer's household was being asked to answer, and the
 * offers a seller had not yet been shown, were not on the page called Offers.
 * The question here is the agent's, not the sender's: what needs answering,
 * by whom, and by when.
 *
 * The inbound form is also the reason the feature is allowed to exist. /offer
 * tells a stranger their offer has been delivered, on a document with a
 * deadline attached to it, and an offer sitting in a table nobody opens would
 * make the whole thing worse than not having it. So an offer nobody has
 * answered is "needs a reply" here, and counted at the top.
 *
 * Each inbound offer is read the same way the submitter's own page read it,
 * from the same function. If Kaleb sees a different number from the one the
 * sender was shown, one of them is being lied to.
 */
export default async function OffersPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const session = await agentSession();
  if (session.state === "unknown") return <Unavailable reason={session.reason} />;
  if (session.state === "signed-out") redirect("/operations/sign-in");

  const wanted = (await searchParams).show;
  const view: View = VIEWS.find((v) => v.id === wanted)?.id ?? "all";
  const now = new Date();
  const first = session.agent.name.trim().split(/\s+/)[0] ?? session.agent.name;
  const q = await offerBoard(first);

  const board = q.ok && "data" in q ? q.data : null;
  const counts = board ? countItems(board.items, now) : null;
  const shown = board ? board.items.filter((i) => view === "all" || i.side === view) : [];
  const href = (id: View) => (id === "all" ? "/operations/offers" : `/operations/offers?show=${id}`);

  return (
    <main className="shell-w">
      <PageHead
        title="Offers"
        lede="Every live offer, buying and selling, what each is waiting on, and by when. A row opens the place it is worked."
        actions={<Link href="/offer" className="btn btn-g btn-sm">The public offer form</Link>}
      />

      {!q.ok ? (
        <Notice tone="neg" title="The offers did not load">
          {say(q.error)} That is not the same as there being none: somebody may be waiting on a reply.
        </Notice>
      ) : !board ? (
        <Notice tone="info" title="Nothing to read from">{"reason" in q ? q.reason : "No database is configured"}.</Notice>
      ) : (
        <>
          {board.problems.map((p) => (
            <Notice key={p.part} tone="neg" title={`${p.part} did not load`}>
              {say(p.error)} What is listed below leaves them out, so it is not the whole picture.
            </Notice>
          ))}

          <Stats>
            <Stat label="Waiting on you" value={counts!.waitingOnYou} tone={counts!.waitingOnYou ? "warn" : undefined} hint="Offers you have to move" />
            <Stat label="Waiting on others" value={counts!.waitingOnOthers} hint="Clients, sellers, the other side" />
            <Stat label="Due within 3 days" value={counts!.dueSoon} tone={counts!.dueSoon ? "warn" : undefined} hint="Including any already past" />
            <Stat label="Live offers" value={counts!.all} hint={`${counts!.buying} buying, ${counts!.selling} selling, ${counts!.inbound} by form`} />
          </Stats>

          <Section
            title={view === "inbound" ? "Offers that came in through the form" : "Live offers"}
            hint={view === "inbound"
              ? "Submitted at /offer by people with no account. Each one is also a relationship: somebody writing offers in Georgia is somebody worth knowing whether or not this one lands."
              : "What needs you first, then the soonest date."}
            actions={<Tabs label="Which offers" current={view} items={VIEWS.map((v) => ({ id: v.id, label: v.label, href: href(v.id), count: v.id === "all" ? counts!.all : counts![v.id] }))} />}
          >
            {view === "inbound" ? (
              board.inbound.length || board.uploads.length ? <>{board.uploads.length ? <UploadCards uploads={board.uploads} now={now} /> : null}{board.inbound.length ? <InboundCards offers={board.inbound} now={now} answeredOf={new Map(board.items.filter((i) => i.side === "inbound").map((i) => [i.key.slice(3), i.stands.word === "Replied"]))} /> : null}</> : (
                <Empty title="Nothing has come in through the form yet">
                  The page works with no account and no login, so the way this fills up is somebody sending the link to an agent who is writing an offer today.
                </Empty>
              )
            ) : shown.length ? (
              <Table items={shown} now={now} />
            ) : (
              <Empty title={view === "all" ? "No live offers" : `No live ${view} offers`}>
                A buyer&apos;s offer appears here once terms are drafted on the Offers tab of a journey; a seller&apos;s once an offer is recorded
                for them; and anything sent through the public form appears as it arrives.
              </Empty>
            )}
          </Section>
        </>
      )}
    </main>
  );
}

function When({ by, now }: { by: NonNullable<OfferItem["by"]>; now: Date }) {
  const d = daysUntil(by.day, now);
  return (
    <>
      <div className={`${s.byWhen} ${d < 0 ? s.late : d <= 3 ? s.soon : ""}`}>{d < 0 ? "Passed " : ""}{inDays(d)}</div>
      <div className={s.byHint}>{showDay(by.day, { weekday: "short", month: "short", day: "numeric" })}{by.basis ? `, ${by.basis}` : ""}</div>
    </>
  );
}

function Table({ items, now }: { items: OfferItem[]; now: Date }) {
  return (
    <div className={k.tableCard}>
      <table className={`${k.table} ${k.stack}`}>
        <thead>
          <tr><th>Offer</th><th>Terms</th><th>Where it stands</th><th>What needs answering</th><th>By when</th><th>Waiting on</th></tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.key}>
              <td data-label="Offer">
                {i.personHref ? <Link href={i.personHref} className={s.who}>{i.person}</Link> : <span className={k.strong}>{i.person}</span>}
                <div className={s.address}>
                  <Link href={i.href} className={k.link}>{i.address}</Link>
                </div>
                {i.onListing ? <div className={s.listing}>On <Link href={i.onListing.href} className={k.link}>{i.onListing.person}&apos;s listing</Link></div> : null}
              </td>
              <td data-label="Terms">{i.terms}</td>
              <td data-label="Stands"><Tag tone={i.stands.tone}>{i.stands.word}</Tag></td>
              <td data-label="Needs" className={s.needs}>{i.needs}</td>
              <td data-label="By when" className={s.by}>
                {i.by ? <When by={i.by} now={now} /> : (
                  <span className={k.muted}>{i.since ? `Since ${inDays(daysUntil(georgiaDay(new Date(i.since)), now))}` : "No date set"}</span>
                )}
              </td>
              <td data-label="Waiting on">
                <Tag tone={i.waitingOn === "you" ? "acc" : "none"}>{WAITING_LABEL[i.waitingOn]}</Tag>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
