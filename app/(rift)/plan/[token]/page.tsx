import type { Metadata } from "next";
import Link from "next/link";
import { readPlanByToken } from "@/lib/db/plan";
import { currentAgentPublic, currentAgentId } from "@/lib/db/service";
import { releasedFor } from "@/lib/db/decisions";
import { DecisionRoom } from "@/components/rift/DecisionRoom";
import {
  groupPlan, summarise, headline, ownerLabel, daysUntil,
  nextForClient, notOnYou, whenPhrase, RECENT_DAYS,
} from "@/lib/core/plan";
import { rankOffers, headlineTrap, gapsIn, FINANCING_LABEL } from "@/lib/core/offers";
import { money } from "@/lib/core/compute";
import { Ico, Mark } from "@/components/rift/icons";
import { NOT_ACCEPTANCE } from "@/lib/core/offer-room";
import { Choose } from "./Choose";

export const metadata: Metadata = {
  title: "Your plan",
  /* Never indexed. It is somebody's plan behind an unguessable link, and a
     link unguessable to a person is trivially findable by a crawler that has
     been given it. Same rule as the shared readout. */
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const WHEN = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
  month: "short", day: "numeric", timeZone: "UTC",
});

/**
 * The client's own page.
 *
 * Everything else this product holds points one way: the agent can see the
 * person, the person sees one frozen readout and then nothing. From the moment
 * somebody becomes a client, the "client-experience platform" goes dark. This
 * is the first surface pointing the other way.
 *
 * What it shows is deliberately small: what has been agreed, who owes it, and
 * by when. Not a dashboard. A person checks this between other things, on a
 * phone, to answer one question: is anything waiting on me?
 *
 * No account, like everything else here. The token is the authorisation.
 *
 * The agent's notes are not on this page and cannot be: `readPlanByToken`
 * selects a fixed, narrow column list, so the score, the band, the contact
 * basis and the signals never reach the renderer at all.
 */
export default async function ClientPlan({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const read = await readPlanByToken(token);
  const plan = read.ok && "data" in read ? read.data : null;

  /* A broken query is not a revoked link.
     
     Telling somebody "this plan does not exist" when the database hiccupped
     says something false about their agent, and they have no way to tell the
     difference. Same distinction the shared readout makes, for the same
     reason. */
  /* `skipped` is not `null`, and the difference is the whole point of the
     union. With no database configured the read is skipped, and falling
     through to "this link is no longer open" would tell somebody their agent
     revoked their plan when in fact nothing was ever asked. */
  if (!read.ok || "skipped" in read) {
    return (
      <Shell>
        <h1 className="serif" style={{ fontSize: 28 }}>We cannot open this right now.</h1>
        <p className="lede" style={{ marginTop: 12, maxWidth: 520 }}>
          Something on our side is not answering. This does not mean your link has expired;
          try again in a few minutes, and if it keeps happening, tell your agent.
        </p>
      </Shell>
    );
  }

  if (!plan) {
    return (
      <Shell>
        <h1 className="serif" style={{ fontSize: 28 }}>This link is no longer open.</h1>
        <p className="lede" style={{ marginTop: 12, maxWidth: 520 }}>
          Plans can be closed, and links get copied further than anyone intended, so they do
          not last forever. Ask your agent for a new one. Nothing has been lost.
        </p>
      </Shell>
    );
  }

  const agent = await currentAgentPublic();
  const agentFirst = (agent?.name ?? "your agent").trim().split(/\s+/)[0]!;

  /* Decision rooms the agent has RELEASED.
  
     `releasedFor` puts `.not("released_at", "is", null)` in the query rather
     than filtering here, so a room he is half way through assembling is never
     fetched at all: the same shape as readPlanByToken's narrow column list,
     and for the same reason: a filter applied after the data arrives is one
     refactor away from not being applied. */
  const agentId = await currentAgentId();
  const roomsRead = agentId ? await releasedFor(plan.leadId, agentId) : null;
  const rooms = roomsRead?.ok && "data" in roomsRead ? roomsRead.data : [];

  const sections = groupPlan(plan.items);
  const s = summarise(plan.items);

  /* The other three of the five questions docs/vision.md promises every
     customer can answer immediately. This page answered "where am I" and
     "where do I ask"; these answer "what do I do next", "what is somebody
     else doing", and "what is approaching". All derived from the plan items
     that already exist: there is no appointments table and no documents
     table, and a heading that is permanently empty is worse than no heading. */
  const now = new Date();
  const next = nextForClient(plan.items, now);
  const finishedLately = notOnYou(plan.items, now).recentlyDone;

  /* Ranked here, on the server, like every other figure in this product. The
     browser receives numbers, never the arithmetic: this page is reachable by
     a link somebody forwarded, and a net computed in the browser from data in
     the page is a net anybody can edit. */
  const nets = plan.sellerCosts ? rankOffers(plan.offers, plan.sellerCosts) : [];
  const offerNets = new Map(nets.map((n) => [n.offerId, n]));
  const orderedOffers = plan.sellerCosts
    ? nets.map((n) => plan.offers.find((o) => o.id === n.offerId)!)
    : plan.offers;
  const trap = plan.sellerCosts ? headlineTrap(plan.offers, plan.sellerCosts) : null;
  const side = plan.side === "buy" ? "buy" : "sell";

  return (
    <Shell tone={side}>
      <div className="t-2xs c-4 w6" style={{ letterSpacing: ".07em", textTransform: "uppercase" }}>
        {plan.firstName ? `${plan.firstName}’s plan` : "Your plan"}
      </div>

      <h1 className="serif" style={{
        fontSize: "clamp(24px,3.4vw,36px)", lineHeight: 1.15, letterSpacing: "-0.022em", marginTop: 8, maxWidth: 620,
      }}>
        {headline(s)}
      </h1>

      {plan.stage ? (
        <p className="t-sm c-3" style={{ marginTop: 12, maxWidth: 560, lineHeight: 1.6 }}>
          Where things stand: <strong>{plan.stage}</strong>
          {plan.stageSince ? ` since ${WHEN(plan.stageSince.slice(0, 10))}` : ""}.
          {" "}This page is kept up to date by {agentFirst}, and nothing on it is automatic.
        </p>
      ) : null}

      {/* Question two: the one thing.

          One, not a list: the plan below already shows everything. Somebody
          opening this on a phone between other things is asking "is anything
          waiting on me", and five bullet points is a worse answer to that than
          one sentence. Absent entirely when nothing is owed by them, because a
          page that manufactures a task to fill the space is a page people
          learn to ignore. */}
      {next ? (
        <div className="card p-4" style={{
          marginTop: 22,
          borderColor: next.reason === "overdue" ? "var(--neg-line)" : "var(--accent-line)",
          background: next.reason === "overdue" ? "var(--neg-wash)" : "var(--accent-wash)",
        }}>
          <div className="row gap-2" style={{ alignItems: "center" }}>
            <Ico.arrowR size={14} className={next.reason === "overdue" ? "c-neg" : "c-acc"} />
            <span className="t-2xs w6" style={{ letterSpacing: ".07em", textTransform: "uppercase" }}>
              {next.reason === "overdue" ? "Past its date, and waiting on you" : "Your next step"}
            </span>
          </div>
          <div className="t-md w6" style={{ marginTop: 8, lineHeight: 1.5 }}>{next.item.title}</div>
          <div className="t-xs c-3" style={{ marginTop: 5 }}>
            {next.days === null
              ? "No date set. Worth asking about when you next speak."
              : `Due ${WHEN(next.item.dueOn!)} · ${whenPhrase(next.days)}`}
          </div>
        </div>
      ) : s.total > 0 ? (
        /* No heading here. `headline()` above has already said "Nothing is
           waiting on you right now": a card repeating it verbatim two lines
           later is how a page reads as generated. What is added is the part
           the headline does not say: where the work actually is. */
        <div className="card p-4" style={{ marginTop: 22 }}>
          <p className="t-sm c-3" style={{ lineHeight: 1.6 }}>
            Everything currently open is at {agentFirst}&rsquo;s end or somebody
            else&rsquo;s. You will see it here the moment that changes.
          </p>
        </div>
      ) : null}

      {/* Decision Rooms.
      
          docs/benchmark.md scores 4.3 at 0 in production: absent, not weak.
          High on the page and above the plan, because a decision waiting on
          somebody outranks a checklist: this is the thing that stalls, and the
          criterion asks for rooms "at the moments where clients actually
          stall". Undecided ones first for the same reason. */}
      {rooms.length ? (
        <section style={{ marginTop: 26 }}>
          <div className="t-2xs c-4 w6" style={{ letterSpacing: ".07em", textTransform: "uppercase" }}>
            {rooms.length === 1 ? "A decision" : "Decisions"}
          </div>
          <div className="col gap-3" style={{ marginTop: 10 }}>
            {[...rooms]
              .sort((a, b) => Number(Boolean(a.decidedAt)) - Number(Boolean(b.decidedAt)))
              .map((d) => (
                <DecisionRoom key={d.id} decision={d} agentFirst={agentFirst} today={now} />
              ))}
          </div>
        </section>
      ) : null}

      {/* Question three, the half the plan cannot answer.

          The Done bucket above holds everything ever completed, in no relation
          to now: something finished in March sits beside something finished on
          Tuesday, and neither tells the reader whether anything is currently
          happening. This does, and it ages out at three weeks so it cannot go
          on implying momentum that stopped months ago.

          It is the mechanism behind "inbound status questions under one per
          client per month" in docs/benchmark.md: somebody who can see three
          things finished lately stops needing to ask. */}
      {finishedLately.length > 0 ? (
        <section style={{ marginTop: 28 }}>
          <div className="t-2xs c-4 w6" style={{ letterSpacing: ".07em", textTransform: "uppercase" }}>
            Done for you in the last {Math.round(RECENT_DAYS / 7)} weeks
          </div>
          <div className="card p-4" style={{ marginTop: 10 }}>
            <div className="col gap-2">
              {finishedLately.map((it) => (
                <div key={it.id} className="row gap-2" style={{ alignItems: "flex-start" }}>
                  <Ico.check size={13} className="c-pos" style={{ flex: "none", marginTop: 4 }} />
                  <div className="t-sm c-2" style={{ lineHeight: 1.5 }}>
                    {it.title}
                    <span className="c-4">
                      {" · "}
                      {ownerLabel(it, { agent: agentFirst, client: plan.firstName }, "client")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* Question four is answered by the plan itself, not by a panel above it.

          A "Coming up" section listing the next five dated items was built here
          first and thrown away. The plan below is ALREADY grouped into "Past its
          date", "This week" and "The next two weeks", so the panel restated every
          one of them a second time, and the next-step card made the first of
          them a third. Three copies of "Gather two months of pay stubs" on one
          phone screen. The fix is not a better panel, it is a relative date on
          each row, so how soon a thing is reads at a glance with no second list
          to keep in step with the first.

          The same reasoning removed the open half of "what is happening at our
          end". Every open item already names its owner in the list; somebody
          scanning it reads "Kaleb · Sep 22" and has their answer. What the list
          could NOT say is what has been finished LATELY: the Done bucket holds
          everything ever completed, in no relation to now, so that half
          survives, below the plan, where reassurance belongs rather than
          competing with the thing they have to do. */}

      {/* The plan being empty is a real state and reads as one. A client who
          opens this the day after a first call should not see a broken page. */}
      {sections.length === 0 ? (
        <div className="card p-4" style={{ marginTop: 22 }}>
          <p className="t-sm c-3">
            Nothing is written here yet. {agentFirst} adds each step as you agree it, so this
            stays a record of what was actually decided rather than a checklist somebody
            generated.
          </p>
        </div>
      ) : (
        <div className="col gap-4" style={{ marginTop: 26 }}>
          {sections.map((sec) => (
            <section key={sec.bucket}>
              <div className="row gap-2" style={{ marginBottom: 10 }}>
                <span className="t-2xs c-4 w6" style={{ letterSpacing: ".07em", textTransform: "uppercase" }}>
                  {sec.label}
                </span>
                {sec.bucket === "overdue" ? <span className="chip chip-neg t-2xs">{sec.items.length}</span> : null}
              </div>

              <div className="card" style={{ overflow: "hidden" }}>
                {sec.items.map((item, i) => {
                  const who = ownerLabel(item, { agent: agentFirst, client: plan.firstName }, "client");
                  const mine = item.owner === "client";
                  const late = sec.bucket === "overdue";
                  return (
                    <div key={item.id} className="between gap-3" style={{
                      padding: "13px 16px", gap: 12, alignItems: "flex-start",
                      borderBottom: i === sec.items.length - 1 ? 0 : "1px solid var(--line-3)",
                      background: mine && !item.doneAt ? "var(--sunk)" : undefined,
                    }}>
                      <div className="row gap-2" style={{ alignItems: "flex-start", minWidth: 0 }}>
                        <span style={{ flex: "none", marginTop: 2 }}>
                          {item.doneAt
                            ? <Ico.check size={14} className="c-pos" />
                            : <Ico.clock size={14} className={late ? "c-neg" : "c-4"} />}
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <div className="t-sm w5" style={{
                            lineHeight: 1.5,
                            textDecoration: item.doneAt ? "line-through" : undefined,
                            color: item.doneAt ? "var(--ink-4)" : undefined,
                          }}>{item.title}</div>
                          <div className="t-xs c-4" style={{ marginTop: 3 }}>
                            {/* Who, always. A plan where nobody owes anything is
                                a list of hopes. */}
                            {item.doneAt ? `${who} · done` : who}
                            {/* The calendar date AND how soon that is.

                                "Sep 24" requires the reader to work out what
                                today is and subtract. A panel above the plan
                                that did the subtraction for them was tried and
                                removed (it restated the whole list) so the
                                answer belongs on the row it is about. */}
                            {item.dueOn && !item.doneAt
                              ? ` · ${WHEN(item.dueOn)} · ${whenPhrase(daysUntil(item.dueOn, now))}`
                              : ""}
                          </div>
                        </div>
                      </div>

                      {mine && !item.doneAt ? (
                        <span className="chip t-2xs" style={{ flex: "none" }}>You</span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* The offer room.
       
          Only what the agent has released, and only ever ranked by what
          reaches them. A seller comparing PDFs sees four headline numbers;
          the highest of them is often not the best one, and that sentence is
          the single most useful thing this product can say at this point in a
          transaction, so it is computed rather than left to be noticed. */}
      {plan.offers.length > 0 ? (
        <section style={{ marginTop: 32 }}>
          <div className="t-2xs c-4 w6" style={{ letterSpacing: ".07em", textTransform: "uppercase" }}>
            Offers on your home
          </div>
          <p className="t-sm c-3" style={{ marginTop: 8, maxWidth: 560, lineHeight: 1.6 }}>
            {plan.sellerCosts
              ? "Ordered by what would actually reach you after everything comes out, not by the number on the front page."
              : `These are the offers ${agentFirst} has shared with you. What each one leaves you depends on your payoff, which is not recorded here yet.`}
          </p>

          {trap ? (
            <div className="card p-4" style={{ marginTop: 14, borderColor: "var(--warn-line)", background: "var(--warn-wash)" }}>
              <div className="t-sm w6">The highest offer is not the best one.</div>
              <p className="t-sm c-2" style={{ marginTop: 6, lineHeight: 1.6 }}>
                {trap.highest.from} offered {money(trap.highest.price)}. {trap.bestNet.from} offered
                less and would leave you about {money(trap.difference)} more, once everything they
                ask back comes out. Worth a conversation before you answer either.
              </p>
            </div>
          ) : null}

          {/* The agent's take. Only ever what he approved, and only while it
              was approved for exactly these offers: readPlanByToken drops it
              otherwise, so a take written before an offer arrived never sits
              above a table it does not describe. */}
          {plan.take ? (
            <div className="card p-4" style={{ marginTop: 14 }}>
              <div className="row gap-2" style={{ alignItems: "center" }}>
                <Ico.users size={14} className="c-3" />
                <span className="t-sm w6">{agentFirst}&rsquo;s take</span>
                <span className="t-2xs c-4">· {whenPhrase(daysUntil(plan.take.approvedAt.slice(0, 10), now))}</span>
              </div>
              <p className="t-sm c-2" style={{ marginTop: 8, lineHeight: 1.65, whiteSpace: "pre-line" }}>
                {plan.take.text}
              </p>
            </div>
          ) : null}

          <div className="col gap-2" style={{ marginTop: 14 }}>
            {orderedOffers.map((o, i) => {
              const n = offerNets.get(o.id);
              return (
                <div key={o.id} className="card p-4" style={{
                  borderColor: i === 0 && plan.sellerCosts && orderedOffers.length > 1 ? "var(--pos-line)" : undefined,
                }}>
                  <div className="between gap-3 wrap" style={{ alignItems: "flex-start" }}>
                    <div style={{ minWidth: 0 }}>
                      <div className="row gap-2 wrap">
                        <span className="t-md w6">{o.from}</span>
                        <span className="chip t-2xs">{FINANCING_LABEL[o.financing]}</span>
                        {i === 0 && plan.sellerCosts && orderedOffers.length > 1
                          ? <span className="chip chip-pos t-2xs">Leaves you most</span> : null}
                        {plan.choice?.offerId === o.id
                          ? <span className="chip chip-brand t-2xs"><Ico.check size={10} />Your choice</span> : null}
                      </div>
                      <div className="t-xs c-4" style={{ marginTop: 4 }}>
                        {money(o.price)} offered
                        {o.concessions > 0 ? ` · asking ${money(o.concessions)} back` : ""}
                        {o.repairCredit > 0 ? ` · ${money(o.repairCredit)} repair credit` : ""}
                        {o.closeOn ? ` · closes ${WHEN(o.closeOn)}` : ""}
                      </div>
                      {o.contingencies.length ? (
                        <div className="t-xs c-4" style={{ marginTop: 3 }}>
                          Conditional on {o.contingencies.join(", ")}
                        </div>
                      ) : null}
                      {/* Shown to them, not only to the agent.

                          These are facts about the paperwork: "no preapproval
                          letter attached": and they are material to the person
                          actually deciding. Keeping them on the agent's screen
                          alone would be withholding something from the one
                          reader who is going to live with the answer, which is
                          the opposite of what the rest of this product does.
                          They are never judgements about a buyer; gapsIn is
                          tested for exactly that. */}
                      {gapsIn(o).length ? (
                        <div className="col gap-1" style={{ marginTop: 8 }}>
                          {gapsIn(o).map((g) => (
                            <div key={g} className="t-xs c-3 row gap-1" style={{ alignItems: "flex-start" }}>
                              {/* In a row: the icon renders as a block, and
                                  inline it sat on a line of its own above
                                  every note at phone width. */}
                              <Ico.info size={11} style={{ flex: "none", marginTop: 3 }} /><span>{g}</span>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {/* The agent's own words, shown only because he released
                          it. Nothing here is generated about a buyer. */}
                      {o.note ? (
                        <p className="t-sm c-3" style={{ marginTop: 8, lineHeight: 1.6 }}>{o.note}</p>
                      ) : null}
                    </div>

                    {n ? (
                      <div style={{ textAlign: "right", flex: "none" }}>
                        <div className="num t-lg">{money(n.net)}</div>
                        <div className="t-2xs c-4">would reach you</div>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          {/* The choice. Recorded once, with what they were shown; changing it
              is a conversation with the agent, who can reopen it. */}
          {plan.choice ? (
            <div className="card p-4" style={{ marginTop: 14, borderColor: "var(--pos-line)" }}>
              <div className="t-sm w6">
                You told {agentFirst} you want the offer from {plan.choice.seen.from}
                <span className="c-4 w5"> · {whenPhrase(daysUntil(plan.choice.at.slice(0, 10), now))}</span>
              </div>
              <p className="t-sm c-3" style={{ marginTop: 6, lineHeight: 1.6 }}>
                Recorded with what you saw: {money(plan.choice.seen.price)} offered
                {plan.choice.seen.net !== null ? `, about ${money(plan.choice.seen.net)} to you after costs` : ""}.
                {" "}{NOT_ACCEPTANCE} If you change your mind, tell {agentFirst} and it can be reopened.
              </p>
            </div>
          ) : (
            <Choose
              token={token}
              agentFirst={agentFirst}
              options={orderedOffers.map((o) => {
                const n = offerNets.get(o.id);
                return {
                  id: o.id,
                  label: o.from,
                  detail: `${money(o.price)} offered${n ? ` · about ${money(n.net)} to you` : ""}`,
                };
              })}
            />
          )}

          <p className="t-xs c-4" style={{ marginTop: 12, lineHeight: 1.6, maxWidth: 560 }}>
            These figures are estimates from the terms as written. Your payoff moves daily with
            interest and is only exact on a lender&rsquo;s statement, and a closing attorney&rsquo;s
            settlement statement is the authority on the rest. The figures are not a recommendation;
            price is one thing an offer is, and how likely it is to close is another
            {plan.take ? `; the only recommendation on this page is ${agentFirst}'s own` : ""}.
          </p>
        </section>
      ) : null}

      {/* Question five: where to ask.

          It was already here and it was already honest about the missing reply
          box. What it did not do was name the person, say how quickly they
          answer, or distinguish "this is wrong" from "I do not understand this"
         : three different reasons to make contact, and a block that covers
          only the first is one most people will not use. */}
      <div className="card p-4" style={{ marginTop: 26 }}>
        <div className="t-sm w6">If you need something</div>
        <p className="t-sm c-3" style={{ marginTop: 6, lineHeight: 1.6 }}>
          Anything on this page that is wrong, out of date, or that you would just
          rather have explained: that is {agentFirst}, and it is a normal thing to
          ask for. There is no reply box here on purpose: a message typed into a page
          nobody is watching is worse than no message at all.
        </p>
        {/* The booking link, and nothing else. `currentAgentPublic` returns
            the name and deliberately not the address: it is the read every
            public page uses, and widening it to hang a mailto here would put
            the agent's inbox on surfaces that never asked for it. */}
        <Link href="/book" className="btn btn-s btn-sm" style={{ marginTop: 12 }}>
          <Ico.cal size={14} />Book fifteen minutes
        </Link>
      </div>

      <p className="t-xs c-4" style={{ marginTop: 22, lineHeight: 1.6, maxWidth: 560 }}>
        This link is private. Anyone who has it can read this page, so send it on only to
        people you want reading your plan, and ask {agentFirst} to close it if it ever goes
        further than you meant.
      </p>
    </Shell>
  );
}

function Shell({ children, tone = "buy" }: { children: React.ReactNode; tone?: "buy" | "sell" }) {
  return (
    <div className={tone}>
      <header style={{ borderBottom: "1px solid var(--line-2)" }}>
        <div className="shell-w between" style={{ height: 56 }}>
          <div className="row gap-2">
            <Mark size={19} />
            <span className="mark-name" style={{ fontSize: 18 }}>Rift</span>
            <span className="chip chip-brand hide-sm t-2xs">Your plan</span>
          </div>
          <Link href="/privacy" className="t-xs c-4">What we keep</Link>
        </div>
      </header>
      <main className="shell-w sec" style={{ maxWidth: 720, paddingTop: 30 }}>{children}</main>
    </div>
  );
}
