import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { agentSession } from "@/lib/db/session";
import { Unavailable } from "../../Unavailable";
import { redirect } from "next/navigation";
import { readLead } from "@/lib/db/clients";
import { readPlanForAgent } from "@/lib/db/plan";
import { referralTokenFor, referralLinks, momentsForLead } from "@/lib/db/referral";
import { representationOf } from "@/lib/db/clients";
import { standingOf } from "@/lib/core/representation";
import { Agreement } from "./Agreement";
import { decisionsFor } from "@/lib/db/decisions";
import { Decisions } from "./Decisions";
import { Referral } from "./Referral";
import { offersFor } from "@/lib/db/offers";
import { siteUrl } from "@/lib/core/site";
import { Actions } from "./Record";
import { Contact, Details } from "./Rail";
import { History } from "./History";
import { Wants } from "./Wants";
import { backgroundOf } from "@/lib/db/lead-background";
import { lastContacts } from "@/lib/db/clients";
import { ArchiveBox } from "./Record";
import { STALL_CHIP } from "@/lib/core/pipeline";
import { BAND_LABEL } from "@/lib/core/lead";
import { ago, bandIsLive, sourceLabel } from "@/lib/core/people";
import { Ico } from "@/components/rift/icons";
import { PageHead, Section, Notice } from "../../ui";
import css from "./record.module.css";
import { Plan } from "./Plan";
import { Offers } from "./Offers";
import { Take } from "./Take";
import { roomFor } from "@/lib/db/offer-room";
import { journeysFor } from "@/lib/db/journeys";
import { searchStatuses } from "@/lib/db/search";
import { STATUS_LABEL } from "@/lib/core/search";
import { buyerSearchOn } from "@/lib/core/journey";
import { Journeys, type JourneySummary } from "./Journeys";
import { savedPlanFor } from "@/lib/db/saved-plan";
import { isUuid } from "@/lib/core/ids";
import type { DbResult } from "@/lib/db/result";

export const metadata: Metadata = { title: "Record", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * One person.
 *
 * The screen the agent is actually on while the phone is ringing, so it is
 * ordered by what he needs in that moment: who they are and where they are,
 * what is owed next and a place to write down what just happened, then what
 * they want and can afford, the working panels, and last the history, newest
 * first because the last conversation is the one he is continuing. Reference
 * facts (how to reach them, consent, details) sit in a rail beside the main
 * column and fall below it on a phone.
 */
export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await agentSession();
  /* A blip is not an expired session. Redirecting on "unknown" shows the
     agent a sign-in form when his cookie is fine, which says something false
     about what just happened: see lib/db/session.ts. */
  if (session.state === "unknown") return <Unavailable reason={session.reason} />;
  if (session.state === "signed-out") redirect("/operations/sign-in");
  const agent = session.agent;

  const { id } = await params;
  /* A mistyped link is not found, not a database failure to report. */
  if (!isUuid(id)) notFound();
  const read = await readLead(id);

  if (!read.ok) {
    return (
      <main className="shell-w">
        <PageHead back={{ href: "/operations/clients", label: "Relationships" }} title="This record could not be loaded" />
        <Notice tone="neg" title="The database did not answer">
          Nothing has been lost: this is a read, and the record is still there. The error was: {read.error}
        </Notice>
      </main>
    );
  }
  if ("skipped" in read) {
    return (
      <main className="shell-w">
        <PageHead back={{ href: "/operations/clients", label: "Relationships" }} title="Not available yet" />
        <Notice tone="info" title="Nothing is recorded on this deployment">{read.reason}.</Notice>
      </main>
    );
  }
  if (!read.data) notFound();

  /* Read after the record, not beside it. The record is what the agent came
     for; the plan is a panel on it, and a slow second query must not be able
     to keep him from the phone number he is looking at the page to find. */
  const searchOn = buyerSearchOn(process.env);
  const [plan, offers, refToken, refLinks, rep, rooms, offerRoom, journeyRead, savedRead, lifeRead, backgroundRead, contactRead] = await Promise.all([
    readPlanForAgent(id),
    offersFor(id),
    referralTokenFor(id),
    referralLinks(id),
    representationOf(id),
    decisionsFor(id),
    read.data.lead.side === "sell" ? roomFor(id) : Promise.resolve(null),
    searchOn ? journeysFor(id) : Promise.resolve(null),
    savedPlanFor(id),
    momentsForLead(id),
    backgroundOf(id),
    lastContacts([id]),
  ]);
  /* Undefined when it could not be read, which the field says rather than showing an empty date. */
  const closedOn = lifeRead.ok && "data" in lifeRead ? (lifeRead.data?.life.closedOn ?? null) : undefined;
  /* Undefined when it could not be read: "no saved plan" and "could not ask"
     are different statements, and the panel says which. */
  const saved = savedRead.ok && "data" in savedRead ? savedRead.data : undefined;
  const background = backgroundRead.ok && "data" in backgroundRead ? backgroundRead.data : null;
  const lastContact = contactRead.ok && "data" in contactRead ? (contactRead.data.get(id) ?? null) : undefined;
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

  /* The panels below fall back to an empty list, and an empty list renders
     as "No steps yet", "Nothing recorded yet" and "Nothing here yet". Over a
     read that failed those are false, and the offers one invites recording
     every offer a second time. Each panel is told instead, in words. */
  const missing = (r: DbResult<unknown>, what: string) =>
    !r.ok ? `${what} did not load (${r.error}). That is not the same as there being none: reload before changing anything.`
      : "skipped" in r ? `${what} could not be read: ${r.reason}.`
        : null;
  const planUnavailable = missing(plan, "The steps");
  const offersUnavailable = missing(offers, "The offers");
  const decisionsUnavailable = missing(rooms, "The decisions");
  const agreementUnavailable = agreement ? null : missing(rep, "The representation agreement");

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

  const lead = read.data.lead;
  const first = (lead.name ?? "").trim().split(/\s+/)[0] || null;
  const agentFirst = agent.name.trim().split(/\s+/)[0] ?? "You";

  return (
    <main className="shell-w">
      <PageHead
        back={{ href: "/operations/clients", label: "Relationships" }}
        title={lead.name?.trim() || lead.email || "Unnamed"}
        meta={
          <>
            <span className="chip">{lead.side === "buy" ? "Buyer" : "Seller"}</span>
            <span className="chip chip-ink">{lead.stage ?? "Not picked up yet"}</span>
            {lead.stall && lead.stall.level !== "moving" ? (
              <span className={`chip ${STALL_CHIP[lead.stall.level].c}`}><Ico.alert size={11} />{STALL_CHIP[lead.stall.level].l}</span>
            ) : null}
            {bandIsLive(lead) ? <span className="chip chip-acc"><Ico.bolt size={11} />{BAND_LABEL[lead.band]}</span> : null}
            {lead.archivedAt ? <span className="chip"><Ico.pause size={11} />Archived</span> : null}
            <span className="t-xs c-4">
              {sourceLabel(lead.source)} {ago(lead.createdAt)}
              {" · "}
              {lastContact === undefined ? "last contact could not be read" : lastContact ? `last contact ${ago(lastContact)}` : "no contact logged"}
            </span>
          </>
        }
        actions={
          <>
            {lead.phone ? <a href={`tel:${lead.phone}`} className="btn btn-s btn-sm">Call {lead.phone}</a> : null}
            {lead.email ? <a href={`mailto:${lead.email}`} className="btn btn-s btn-sm"><Ico.mail size={13} />Email</a> : null}
          </>
        }
      />

      {lead.archivedAt ? (
        <Notice tone="info" title={`Archived ${ago(lead.archivedAt)}`} action={<ArchiveBox lead={lead} />}>
          {lead.archivedReason}
        </Notice>
      ) : null}

      <Actions lead={lead} />

      <div className={css.cols}>
        <div className={css.main}>
          <Wants side={lead.side} source={lead.source} score={lead.score} band={lead.band} saved={saved} background={background} />
          {/* Where another section about what they said slots in: the answers
              to the questions Kaleb wrote himself belong beside these. */}
          <Journeys
            leadId={id}
            side={lead.side}
            journeys={journeySummaries}
            unavailable={journeysUnavailable}
          />
          <Plan
            leadId={id}
            items={items}
            token={token}
            origin={siteUrl()}
            agentFirst={agentFirst}
            clientFirst={first}
            unavailable={planUnavailable}
          />
          {/* Sellers only. A buyer has no offers ON them, and a panel that
              renders empty on every buyer record is a panel he learns to skip. */}
          {lead.side === "sell" ? (
            <Offers
              leadId={id}
              offers={offerList}
              costs={sellerCosts}
              agentFirst={agentFirst}
              unavailable={offersUnavailable}
            />
          ) : null}
          {/* Not drawn over offers that did not load: with none to read it
              would call an approved take hidden because "the offers changed",
              which is false, and offer to draft from nothing. */}
          {lead.side === "sell" && !offersUnavailable ? (
            <Take leadId={id} offers={offerList} costs={sellerCosts} room={room} />
          ) : null}
          <Decisions
            leadId={id}
            decisions={decisions}
            agentFirst={agent.name.trim().split(/\s+/)[0] ?? "your agent"}
            unavailable={decisionsUnavailable}
          />
          {agreement ? (
            <Agreement
              leadId={id}
              side={lead.side}
              status={agreement.status}
              signedOn={agreement.signedOn}
              expiresOn={agreement.expiresOn}
              standing={standingOf(agreement)}
            />
          ) : agreementUnavailable ? (
            <Section id="representation" title="Representation agreement">
              <Notice tone="warn" title="The agreement did not load">{agreementUnavailable}</Notice>
            </Section>
          ) : null}
          <Referral
            leadId={id}
            closedOn={closedOn}
            token={referralToken}
            origin={siteUrl()}
            firstName={first}
            sent={links.sent}
            referrer={links.referrer}
          />
          <History notes={read.data.notes} unavailable={read.data.notesError ?? null} />
        </div>

        <aside className={css.rail} aria-label="Contact, consent and details">
          <Contact lead={lead} background={background} />
          <Details lead={lead} />
        </aside>
      </div>
    </main>
  );
}
