import { money } from "@/lib/core/compute";
import { rankOffers, headlineTrap, gapsIn, FINANCING_LABEL } from "@/lib/core/offers";
import { NOT_ACCEPTANCE } from "@/lib/core/offer-room";
import { daysUntil, whenPhrase } from "@/lib/core/plan";
import { georgiaDay, showDay } from "@/lib/core/day";
import { Ico } from "@/components/rift/icons";
import type { SellerRoom } from "@/lib/db/plan";
import { OfferChoose } from "./OfferChoose";

const WHEN = (value: string) => showDay(value);
/* How long ago a moment was, counted in Georgia days. Slicing the stored
   timestamp gave London's day, so a choice made after eight in the evening
   read as made "tomorrow" until midnight. */
const AGO = (iso: string, now: Date) => whenPhrase(daysUntil(georgiaDay(new Date(iso)), now));

/**
 * The offers on a seller's home, as the seller reads them: on the old plan
 * link and in the portal (audit portals-2026-10, item 4). One component, so
 * the two pages cannot drift apart, the lesson DecisionRoom already records.
 *
 * Ranked on the server, like every other figure in this product: the browser
 * receives numbers, never the arithmetic. `post` is where the choice goes and
 * what proves it is theirs: the plan link's token, or the signed-in member's
 * journey.
 */
export function OfferRoomView({ room, agentFirst, post, now = new Date() }: {
  room: SellerRoom;
  agentFirst: string;
  post: { url: string; body: Record<string, string> };
  now?: Date;
}) {
  if (!room.offers.length) return null;
  const nets = room.sellerCosts ? rankOffers(room.offers, room.sellerCosts) : [];
  const offerNets = new Map(nets.map((n) => [n.offerId, n]));
  const orderedOffers = room.sellerCosts
    ? nets.map((n) => room.offers.find((o) => o.id === n.offerId)!)
    : room.offers;
  const trap = room.sellerCosts ? headlineTrap(room.offers, room.sellerCosts) : null;

  return (
        <section style={{ marginTop: 32 }}>
          <div className="t-2xs c-4 w6" style={{ letterSpacing: ".07em", textTransform: "uppercase" }}>
            Offers on your home
          </div>
          <p className="t-sm c-3" style={{ marginTop: 8, maxWidth: 560, lineHeight: 1.6 }}>
            {room.sellerCosts
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
          {room.take ? (
            <div className="card p-4" style={{ marginTop: 14 }}>
              <div className="row gap-2" style={{ alignItems: "center" }}>
                <Ico.users size={14} className="c-3" />
                <span className="t-sm w6">{agentFirst}&rsquo;s take</span>
                <span className="t-2xs c-4">· {AGO(room.take.approvedAt, now)}</span>
              </div>
              <p className="t-sm c-2" style={{ marginTop: 8, lineHeight: 1.65, whiteSpace: "pre-line" }}>
                {room.take.text}
              </p>
            </div>
          ) : null}

          <div className="col gap-2" style={{ marginTop: 14 }}>
            {orderedOffers.map((o, i) => {
              const n = offerNets.get(o.id);
              return (
                <div key={o.id} className="card p-4" style={{
                  borderColor: i === 0 && room.sellerCosts && orderedOffers.length > 1 ? "var(--pos-line)" : undefined,
                }}>
                  <div className="between gap-3 wrap" style={{ alignItems: "flex-start" }}>
                    <div style={{ minWidth: 0 }}>
                      <div className="row gap-2 wrap">
                        <span className="t-md w6">{o.from}</span>
                        <span className="chip t-2xs">{FINANCING_LABEL[o.financing]}</span>
                        {i === 0 && room.sellerCosts && orderedOffers.length > 1
                          ? <span className="chip chip-pos t-2xs">Leaves you most</span> : null}
                        {room.choice?.offerId === o.id
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
          {room.choice ? (
            <div className="card p-4" style={{ marginTop: 14, borderColor: "var(--pos-line)" }}>
              <div className="t-sm w6">
                You told {agentFirst} you want the offer from {room.choice.seen.from}
                <span className="c-4 w5"> · {AGO(room.choice.at, now)}</span>
              </div>
              <p className="t-sm c-3" style={{ marginTop: 6, lineHeight: 1.6 }}>
                Recorded with what you saw: {money(room.choice.seen.price)} offered
                {room.choice.seen.net !== null ? `, about ${money(room.choice.seen.net)} to you after costs` : ""}.
                {" "}{NOT_ACCEPTANCE} If you change your mind, tell {agentFirst} and it can be reopened.
              </p>
            </div>
          ) : (
            <OfferChoose
              post={post}
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
            {room.take ? `; the only recommendation on this page is ${agentFirst}'s own` : ""}.
          </p>
        </section>
  );
}
