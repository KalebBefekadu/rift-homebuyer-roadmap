import Link from "next/link";
import { Ico } from "@/components/rift/icons";
import { money } from "@/lib/core/compute";
import { FINANCING_LABEL, netOf, type Offer, type SellerCosts } from "@/lib/core/offers";
import { ownerLabel, type PlanItem } from "@/lib/core/plan";
import type { OfferRoom } from "@/lib/core/offer-room";
import { dueWords } from "@/lib/core/journey-focus";
import { georgiaDay, showDay } from "@/lib/core/day";
import { Empty, Notice } from "../../ui";
import { Panel } from "./Bits";
import s from "./journey.module.css";

const DAY = (d: string) => showDay(d, { month: "short", day: "numeric" });

/**
 * A sale's offers (S10, S11) and preparation (S05), read on the journey.
 *
 * Both are worked on the person's record, where the offer room and the plan
 * already live: their writes go through server actions, and a server action
 * applying a new tree on the journey page can hang (journey/ops.ts). So the
 * journey shows them as they stand, with every offer kept and none ranked by
 * anything but what reaches the seller, and the page's action is the link to
 * where they change.
 */
export function SellerOffersView({ leadId, offers, costs, room }: { leadId: string; offers: Offer[]; costs: SellerCosts | null; room: OfferRoom | null }) {
  const unreleased = offers.filter((o) => !o.releasedAt).length;
  return (
    <div className={s.stack}>
      {room?.chosenAt ? (
        <Notice tone="info" title={`They chose an offer on ${DAY(room.chosenAt)}`}
          action={<Link href={`/operations/lead/${leadId}`} className="btn btn-g btn-sm">Open their record</Link>}>
          {room.clientNote ? <>&ldquo;{room.clientNote}&rdquo; </> : null}A choice is not an acceptance; the paperwork is next, and the contract is recorded on the Contract tab once it is executed.
        </Notice>
      ) : unreleased > 0 ? (
        <Notice tone="warn" title={`${unreleased} offer${unreleased === 1 ? "" : "s"} not yet shown to the seller`}
          action={<Link href={`/operations/lead/${leadId}`} className="btn btn-g btn-sm">Release on their record</Link>}>
          The seller can only choose among offers you have released.
        </Notice>
      ) : null}
      {!offers.length ? (
        <Empty title="No offers recorded yet" action={<Link href={`/operations/lead/${leadId}`} className="btn btn-s btn-sm">Record an offer</Link>}>
          Every offer received is recorded on their record, and none is ever discarded. It appears here once recorded.
        </Empty>
      ) : (
        <div className="card" style={{ overflowX: "auto" }}>
          <table className="ops-table">
            <thead><tr>
              <th>From</th><th className={s.num}>Price</th><th className={s.num}>Asked back</th><th>Financing</th><th>Closes</th>
              <th className={s.num}>Reaches the seller</th><th>Shown to them</th>
            </tr></thead>
            <tbody>{offers.map((o) => {
              const n = costs ? netOf(o, costs) : null;
              return (
                <tr key={o.id}>
                  <td className="w6">{o.from}{room?.chosenOfferId === o.id ? <span className="chip chip-pos t-2xs" style={{ marginLeft: 6 }}><Ico.check size={10} /> Their choice</span> : null}</td>
                  <td className={s.num}>{money(o.price)}</td>
                  <td className={s.num}>{money(o.concessions + o.repairCredit)}</td>
                  <td>{FINANCING_LABEL[o.financing]}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{o.closeOn ? DAY(o.closeOn) : <span className="c-4">Not stated</span>}</td>
                  <td className={s.num}>{n ? money(n.net) : <span className="c-4" style={{ whiteSpace: "normal" }}>Record the payoff and commission first</span>}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{o.releasedAt ? <>Released {DAY(o.releasedAt)}</> : <span className="c-warn">Not yet</span>}</td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function SellerPrepView({ leadId, items, agentFirst, clientFirst }: { leadId: string; items: PlanItem[]; agentFirst: string; clientFirst: string | null }) {
  const open = items.filter((i) => !i.doneAt);
  const done = items.filter((i) => i.doneAt);
  const today = georgiaDay();
  return (
    <div className={s.stack}>
      <p className="t-sm c-3" style={{ maxWidth: 680 }}>Spending is theirs to approve; nothing here buys anything or promises a return on it.</p>
      {!items.length ? (
        <Empty title="No preparation written down yet" action={<Link href={`/operations/lead/${leadId}`} className="btn btn-s btn-sm">Add steps on their record</Link>}>
          Add what has to happen before launch, with who does it and by when. The seller sees the same list on their page.
        </Empty>
      ) : (
        <Panel>
          <ul className={s.rows}>
            {open.map((i) => {
              const d = i.dueOn ? dueWords(i.dueOn, today) : null;
              return (
                <li key={i.id}>
                  <span aria-hidden>○</span> <span className="w6">{i.title}</span>
                  <span className={s.sub}>
                    {ownerLabel(i, { agent: agentFirst, client: clientFirst }, "agent")}
                    {i.dueOn ? <> · by {DAY(i.dueOn)} <span className={d && d.days < 0 ? "c-neg" : s.rel}>({d?.text})</span></> : " · no date yet"}
                  </span>
                </li>
              );
            })}
            {done.map((i) => (
              <li key={i.id} className="c-3">
                <span className="c-pos" aria-hidden>✓</span> {i.title}
                <span className={s.sub}>Done {DAY(i.doneAt!)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
