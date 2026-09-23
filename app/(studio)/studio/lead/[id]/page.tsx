import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { agentSession } from "@/lib/db/session";
import { Unavailable } from "../../Unavailable";
import { redirect } from "next/navigation";
import { readLead } from "@/lib/db/clients";
import { readPlanForAgent } from "@/lib/db/plan";
import { referralTokenFor, referralLinks } from "@/lib/db/referral";
import { representationOf } from "@/lib/db/clients";
import { standingOf } from "@/lib/core/representation";
import { Agreement } from "./Agreement";
import { decisionsFor } from "@/lib/db/decisions";
import { Decisions } from "./Decisions";
import { Referral } from "./Referral";
import { offersFor } from "@/lib/db/offers";
import { siteUrl } from "@/lib/core/site";
import { Record as ClientRecord } from "./Record";
import { Plan } from "./Plan";
import { Offers } from "./Offers";
import { Take } from "./Take";
import { roomFor } from "@/lib/db/offer-room";
import { journeysFor } from "@/lib/db/journeys";
import { searchStatuses } from "@/lib/db/search";
import { STATUS_LABEL } from "@/lib/core/search";
import { buyerSearchOn } from "@/lib/core/journey";
import { Journeys, type JourneySummary } from "./Journeys";

export const metadata: Metadata = { title: "Record", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * One person.
 *
 * The screen the agent is actually on while the phone is ringing, so it is
 * ordered by what he needs in that moment: who they are and how to reach them,
 * where they are and how long they have been there, then everything that has
 * ever been said: newest first, because the last conversation is the one he
 * is continuing.
 */
export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await agentSession();
  /* A blip is not an expired session. Redirecting on "unknown" shows the
     agent a sign-in form when his cookie is fine, which says something false
     about what just happened: see lib/db/session.ts. */
  if (session.state === "unknown") return <Unavailable reason={session.reason} />;
  if (session.state === "signed-out") redirect("/studio/sign-in");
  const agent = session.agent;

  const { id } = await params;
  const read = await readLead(id);

  if (!read.ok) {
    return (
      <main className="shell-w" style={{ paddingTop: 60 }}>
        <h1 className="serif" style={{ fontSize: 26 }}>This record could not be loaded.</h1>
        <p className="t-sm c-3" style={{ marginTop: 10, lineHeight: 1.6, maxWidth: 560 }}>
          The database did not answer. Nothing has been lost. This is a read, and the record is
          still there. It has been reported, and the error was: {read.error}
        </p>
        <Link href="/studio" className="btn btn-p" style={{ marginTop: 18 }}>Back to Operations</Link>
      </main>
    );
  }
  if ("skipped" in read) {
    return (
      <main className="shell-w" style={{ paddingTop: 60 }}>
        <h1 className="serif" style={{ fontSize: 26 }}>Not available yet.</h1>
        <p className="t-sm c-3" style={{ marginTop: 10 }}>{read.reason}</p>
        <Link href="/studio" className="btn btn-p" style={{ marginTop: 18 }}>Back to Operations</Link>
      </main>
    );
  }
  if (!read.data) notFound();

  /* Read after the record, not beside it. The record is what the agent came
     for; the plan is a panel on it, and a slow second query must not be able
     to keep him from the phone number he is looking at the page to find. */
  const searchOn = buyerSearchOn(process.env);
  const [plan, offers, refToken, refLinks, rep, rooms, offerRoom, journeyRead] = await Promise.all([
    readPlanForAgent(id),
    offersFor(id),
    referralTokenFor(id),
    referralLinks(id),
    representationOf(id),
    decisionsFor(id),
    read.data.lead.side === "sell" ? roomFor(id) : Promise.resolve(null),
    searchOn ? journeysFor(id) : Promise.resolve(null),
  ]);
  const items = plan.ok && "data" in plan ? plan.data.items : [];
  const token = plan.ok && "data" in plan ? plan.data.token : null;
  const offerList = offers.ok && "data" in offers ? offers.data.offers : [];
  const sellerCosts = offers.ok && "data" in offers ? offers.data.costs : null;
  const referralToken = refToken.ok && "data" in refToken ? refToken.data : null;
  const links = refLinks.ok && "data" in refLinks
    ? refLinks.data
    : { referrer: null, sent: [] };
  /* A read that failed is not "no agreement". Rendering "Nothing yet" over a
     timed-out query would tell the agent he has a compliance problem he does
     not have, and he has no way to tell the two apart from the screen. */
  const agreement = rep.ok && "data" in rep ? rep.data : null;
  const decisions = rooms.ok && "data" in rooms ? rooms.data : [];
  /* Null when the read failed, so the panel can say so rather than render
     "no choice yet" over a seller who may well have chosen. */
  const room = offerRoom && offerRoom.ok && "data" in offerRoom ? offerRoom.data : null;

  /* Journeys, with each buying journey's search status. A failed read says
     so in the panel rather than rendering "none yet" over journeys that exist. */
  const journeyList = journeyRead && journeyRead.ok && "data" in journeyRead ? journeyRead.data : [];
  const statuses = journeyList.some((j) => j.side === "buy")
    ? await searchStatuses(journeyList.filter((j) => j.side === "buy").map((j) => j.id))
    : null;
  const statusMap = statuses && statuses.ok && "data" in statuses ? statuses.data : null;
  const journeySummaries: JourneySummary[] = journeyList.map((j) => ({
    id: j.id, side: j.side, label: j.label, createdAt: j.createdAt,
    statusLabel: j.side === "buy" && statusMap?.get(j.id) ? `Search: ${STATUS_LABEL[statusMap.get(j.id)!.status]}` : null,
  }));
  const journeysUnavailable = !searchOn
    ? "Journeys are switched off on this deployment."
    : journeyRead && !journeyRead.ok
      ? `Journeys did not load (${journeyRead.error}). That is not the same as having none.`
      : journeyRead && "skipped" in journeyRead ? journeyRead.reason : null;

  return (
    <>
      <ClientRecord lead={read.data.lead} notes={read.data.notes} />
      <div className="shell-w" style={{ paddingBottom: 40 }}>
        <Journeys
          leadId={id}
          side={read.data.lead.side}
          journeys={journeySummaries}
          unavailable={journeysUnavailable}
        />
        <Plan
          leadId={id}
          items={items}
          token={token}
          origin={siteUrl()}
          agentFirst={agent.name.trim().split(/\s+/)[0] ?? "You"}
          clientFirst={(read.data.lead.name ?? "").trim().split(/\s+/)[0] || null}
        />
        {/* Sellers only. A buyer has no offers ON them, and a panel that
            renders empty on every buyer record is a panel he learns to skip. */}
        {read.data.lead.side === "sell" ? (
          <Offers
            leadId={id}
            offers={offerList}
            costs={sellerCosts}
            agentFirst={agent.name.trim().split(/\s+/)[0] ?? "You"}
          />
        ) : null}
        {read.data.lead.side === "sell" ? (
          <Take leadId={id} offers={offerList} costs={sellerCosts} room={room} />
        ) : null}
        <Decisions
          leadId={id}
          decisions={decisions}
          agentFirst={agent.name.trim().split(/\s+/)[0] ?? "your agent"}
        />
        {agreement ? (
          <Agreement
            leadId={id}
            side={read.data.lead.side}
            status={agreement.status}
            signedOn={agreement.signedOn}
            expiresOn={agreement.expiresOn}
            standing={standingOf(agreement)}
          />
        ) : null}
        <Referral
          token={referralToken}
          origin={siteUrl()}
          firstName={(read.data.lead.name ?? "").trim().split(/\s+/)[0] || null}
          sent={links.sent}
          referrer={links.referrer}
        />
      </div>
    </>
  );
}
