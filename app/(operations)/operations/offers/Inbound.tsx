import Link from "next/link";
import { money } from "@/lib/core/compute";
import { read, type Submission } from "@/lib/core/offer-intake";
import { financingLabel } from "@/lib/core/offers";
import { termChips } from "@/lib/core/offer-board";
import { inDays } from "@/lib/core/deadline";
import { daysUntil, georgiaDay } from "@/lib/core/day";
import type { InboundOffer } from "@/lib/db/offer-intake";
import type { Candidates } from "@/lib/core/offer-extract";
import k from "../_business/kit.module.css";
import s from "./offers.module.css";

/** What the PDF reader found, in the words a person reads rather than the field names it stores. */
const FIELD_LABEL: Record<keyof Candidates, string> = {
  address: "Address", price: "Price", earnest: "Earnest money", concessions: "Concessions", financing: "Financing",
  financingOther: "Financing detail", closeOn: "Closing date", dueDiligenceDays: "Due diligence days", contingencies: "Contingencies",
} as Record<keyof Candidates, string>;

const MONEY_FIELDS = new Set(["price", "earnest", "concessions"]);
/** A stored value as it reads: dollars as dollars, the loan as its name. */
const said = (field: string, v: string) =>
  v === "" ? "blank" : MONEY_FIELDS.has(field) && Number.isFinite(Number(v)) ? money(Number(v)) : field === "financing" ? financingLabel(v) : v;

/**
 * An offer that came in through the form, in full: the terms as the sender
 * stated them, the same read the sender was shown (one piece of arithmetic,
 * or one of the two people looking is being told something the other is not),
 * the paperwork that is missing, and where the PDF disagrees with the boxes.
 */
export function InboundCards({ offers, now }: { offers: InboundOffer[]; now: Date }) {
  return (
    <div className={s.cards}>
      {offers.map((o) => {
        const r = read({
          address: o.address ?? "", price: o.price, concessions: o.concessions,
          repairCredit: o.repairCredit, earnest: o.earnest,
          financing: o.financing as Submission["financing"], financingOther: o.financingOther,
          closeOn: o.closeOn, dueDiligenceDays: o.dueDiligenceDays, documentToken: null,
          contingencies: o.contingencies,
          preapproval: o.preapproval, proofOfFunds: o.proofOfFunds,
          from: o.from, email: o.email ?? "", phone: o.phone ?? "", firm: o.firm,
          note: o.note, representing: (o.representing as "self" | "buyer") ?? "buyer",
        });
        const arrived = inDays(daysUntil(georgiaDay(new Date(o.at)), now));

        return (
          <article key={o.id} id={`offer-${o.id}`} className={s.card}>
            <div className={s.cardHead}>
              <div>
                <div className={s.cardTitle}>{o.address ?? "No address given"}</div>
                <div className={s.cardSub}>
                  {o.from}{o.firm ? `, ${o.firm}` : ""} · {o.representing === "self" ? "buying for themselves" : o.representing === "buyer" ? "an agent, for their buyer" : "not said who they represent"} · arrived {arrived}
                </div>
              </div>
              <div className={s.price}>
                <div className={s.priceNum}>{money(o.price)}</div>
                <div className={s.priceHint}>offered</div>
              </div>
            </div>

            {r.askedBack > 0 ? (
              <div className={s.well}>
                <div className={s.wellRow}>
                  <span>Worth the same to a seller as a clean offer at</span>
                  <span className={s.wellNum}>{money(r.equivalentCleanPrice)}</span>
                </div>
                <p className={s.wellHint}>{money(r.askedBack)} asked back. Assumes a {r.commissionPct}% commission.</p>
              </div>
            ) : null}

            <div className={k.chips}>
              {termChips(o, now).map((c) => <span key={c} className="chip">{c}</span>)}
            </div>

            {o.pdfUrl || o.read ? <PdfRead o={o} /> : null}

            {r.gaps.length ? (
              <ul className={s.gaps}>{r.gaps.map((g) => <li key={g}>{g}</li>)}</ul>
            ) : null}

            {o.note ? <p className={s.note}>&ldquo;{o.note}&rdquo;</p> : null}

            <div className={s.contact}>
              {o.email ? <a href={`mailto:${o.email}`} className={k.link}>{o.email}</a> : null}
              {o.phone ? <span>{o.phone}</span> : null}
              {o.submitterLeadId ? (
                <Link href={`/operations/lead/${o.submitterLeadId}`} className={k.link}>Their record</Link>
              ) : (
                <span className={k.muted}>Not matched to a relationship: they gave no way to link them to one.</span>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

/**
 * The PDF the sender uploaded, and where what they sent differs from what the
 * automatic read found in it (Blueprint v5 §5.9, §8.8). The sender checked
 * the boxes; this is Kaleb's check that the PDF and the terms agree.
 */
function PdfRead({ o }: { o: InboundOffer }) {
  const sent: Partial<Record<keyof NonNullable<InboundOffer["read"]>, string>> = {
    address: o.address ?? "", price: String(o.price), earnest: String(o.earnest), concessions: String(o.concessions),
    financing: o.financing, financingOther: o.financingOther ?? "", closeOn: o.closeOn ?? "",
    dueDiligenceDays: o.dueDiligenceDays === null ? "" : String(o.dueDiligenceDays), contingencies: o.contingencies.join(", "),
  };
  const differs = Object.entries(o.read ?? {}).filter(([key, c]) => c && String(sent[key as keyof typeof sent] ?? "") !== c.value);
  return (
    <div className={s.well}>
      <div className={s.wellRow}>
        <span className={k.strong}>Sent with a PDF</span>
        {o.pdfUrl ? <a href={o.pdfUrl} target="_blank" rel="noopener noreferrer" className="btn btn-g btn-sm">Open the PDF</a> : <span className={k.muted}>The PDF link did not load</span>}
      </div>
      {o.read ? (
        differs.length ? (
          <ul className={s.diff}>
            {differs.map(([key, c]) => (
              <li key={key}>
                {FIELD_LABEL[key as keyof Candidates] ?? key}: sent {said(key, sent[key as keyof typeof sent] ?? "")}, the PDF says {said(key, c!.value)} (page {c!.page}: &ldquo;{c!.quote}&rdquo;)
              </li>
            ))}
          </ul>
        ) : <p className={s.wellHint}>Every box the automatic read found matches what was sent.</p>
      ) : <p className={s.wellHint}>Not read automatically; check the terms against the PDF.</p>}
    </div>
  );
}
