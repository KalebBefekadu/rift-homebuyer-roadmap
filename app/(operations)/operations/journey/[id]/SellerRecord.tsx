import Link from "next/link";
import { money } from "@/lib/core/compute";
import { FINANCING_LABEL, netOf, type Offer, type SellerCosts } from "@/lib/core/offers";
import { ownerLabel, type PlanItem } from "@/lib/core/plan";
import type { OfferRoom } from "@/lib/core/offer-room";
import { showDay } from "@/lib/core/day";

const DAY = (d: string) => showDay(d);

/**
 * A sale's offers (S10, S11) and preparation (S05), read on the journey.
 *
 * Both are worked on the person's record, where the offer room and the plan
 * already live: their writes go through server actions, and a server action
 * applying a new tree on the journey page can hang (journey/ops.ts). So the
 * journey shows them as they stand, with every offer kept and none ranked by
 * anything but what reaches the seller, and links to where they change.
 */
export function SellerOffersView({ leadId, offers, costs, room }: { leadId: string; offers: Offer[]; costs: SellerCosts | null; room: OfferRoom | null }) {
  return (
    <div className="col gap-3">
      {!offers.length ? <p className="t-sm c-3">No offers recorded. Every offer received is recorded on the record, and none is ever discarded.</p> : (
        <div className="card" style={{ overflowX: "auto" }}>
          <table className="ops-table">
            <thead><tr><th>From</th><th>Price</th><th>Asked back</th><th>Financing</th><th>Close</th><th>Reaches the seller</th><th>Shown to them</th></tr></thead>
            <tbody>{offers.map((o) => {
              const n = costs ? netOf(o, costs) : null;
              return (
                <tr key={o.id}>
                  <td className="w6">{o.from}{room?.chosenOfferId === o.id ? <span className="chip chip-pos t-2xs" style={{ marginLeft: 6 }}>✓ Their choice</span> : null}</td>
                  <td>{money(o.price)}</td>
                  <td>{money(o.concessions + o.repairCredit)}</td>
                  <td>{FINANCING_LABEL[o.financing]}</td>
                  <td>{o.closeOn ? DAY(o.closeOn) : <span className="c-4">Not stated</span>}</td>
                  <td>{n ? money(n.net) : <span className="c-4">Record the payoff and commission first</span>}</td>
                  <td>{o.releasedAt ? `Released ${DAY(o.releasedAt)}` : <span className="c-4">Not yet</span>}</td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      )}
      {room?.chosenAt ? <p className="t-sm">They chose an offer on {DAY(room.chosenAt)}{room.clientNote ? `: "${room.clientNote}"` : ""}. A choice is not an acceptance; the paperwork is next.</p> : null}
      <Link href={`/operations/lead/${leadId}`} className="btn btn-g btn-sm" style={{ alignSelf: "flex-start" }}>Record, release and review offers on their record</Link>
    </div>
  );
}

export function SellerPrepView({ leadId, items, agentFirst, clientFirst }: { leadId: string; items: PlanItem[]; agentFirst: string; clientFirst: string | null }) {
  const open = items.filter((i) => !i.doneAt);
  const done = items.filter((i) => i.doneAt);
  return (
    <div className="col gap-3">
      <p className="t-sm c-3">
        The work before launch, each item with who does it and when: the same plan the seller sees on their page.
        Spending is theirs to approve; nothing here buys anything or promises a return on it.
      </p>
      {!items.length ? <p className="t-sm c-4">No preparation written down yet.</p> : (
        <ul>
          {open.map((i) => (
            <li key={i.id} className="desk-row t-sm">○ {i.title}<span className="t-xs c-4"> · {ownerLabel(i, { agent: agentFirst, client: clientFirst }, "agent")}{i.dueOn ? ` · by ${DAY(i.dueOn)}` : ""}</span></li>
          ))}
          {done.map((i) => (
            <li key={i.id} className="desk-row t-sm c-3">✓ {i.title}<span className="t-xs c-4"> · done {DAY(i.doneAt!)}</span></li>
          ))}
        </ul>
      )}
      <Link href={`/operations/lead/${leadId}`} className="btn btn-g btn-sm" style={{ alignSelf: "flex-start" }}>Add or tick off steps on their record</Link>
    </div>
  );
}
