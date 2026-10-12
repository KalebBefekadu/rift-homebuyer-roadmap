import Link from "next/link";
import { money } from "@/lib/core/compute";
import { read, type Submission } from "@/lib/core/offer-intake";
import { financingLabel } from "@/lib/core/offers";
import { termChips } from "@/lib/core/offer-board";
import { inDays } from "@/lib/core/deadline";
import { daysUntil, georgiaDay } from "@/lib/core/day";
import type { InboundOffer } from "@/lib/db/offer-intake";
import type { PendingUpload, UploadFile } from "@/lib/db/offer-upload";
import { RemoveUpload } from "./RemoveUpload";
import type { Candidates } from "@/lib/core/offer-extract";
import k from "../_business/kit.module.css";
import s from "./offers.module.css";
import { Answer } from "./Answer";

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
export function InboundCards({ offers, now, answeredOf }: {
  offers: InboundOffer[];
  now: Date;
  /** What the board decided for each offer: recorded, or inferred from the lead's reply. */
  answeredOf: Map<string, boolean>;
}) {
  return (
    <div className={s.cards}>
      {offers.map((o) => {
        const r = read({
          address: o.address ?? "", price: o.price, concessions: o.concessions,
          repairCredit: o.repairCredit, earnest: o.earnest,
          financing: o.financing as Submission["financing"], financingOther: o.financingOther,
          closeOn: o.closeOn, dueDiligenceDays: o.dueDiligenceDays, uploadToken: null,
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

            {o.pdfUrl || o.read || o.pdfs.length ? <PdfRead o={o} /> : null}

            {r.gaps.length ? (
              <ul className={s.gaps}>{r.gaps.map((g) => <li key={g}>{g}</li>)}</ul>
            ) : null}

            {o.note ? <p className={s.note}>&ldquo;{o.note}&rdquo;</p> : null}

            {o.answerable ? (
              <Answer
                offerId={o.id}
                answered={answeredOf.get(o.id) ?? false}
                respondBy={o.answer?.respondBy ?? null}
                inferred={!o.answer}
                by={o.answer?.by ?? null}
              />
            ) : null}

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
      {o.pdfs.length > 1 ? (
        <>
          <div className={s.wellRow}><span className={k.strong}>Sent with {o.pdfs.length} PDFs</span></div>
          <PdfList files={o.pdfs} />
        </>
      ) : (
        <div className={s.wellRow}>
          <span className={k.strong}>Sent with a PDF</span>
          {o.pdfUrl ?? o.pdfs[0]?.url ? <a href={(o.pdfUrl ?? o.pdfs[0]?.url)!} target="_blank" rel="noopener noreferrer" className="btn btn-g btn-sm">Open the PDF</a> : <span className={k.muted}>The PDF link did not load</span>}
        </div>
      )}
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

/** Each PDF on an offer, the offer first and then its addenda (WS8.3). */
function PdfList({ files }: { files: UploadFile[] }) {
  return (
    <ul className={s.diff}>
      {files.map((f, i) => (
        <li key={`${f.name}-${i}`}>
          {f.url ? <a href={f.url} target="_blank" rel="noopener noreferrer" className={k.link}>{f.name}</a> : <span>{f.name} <span className={k.muted}>(the link did not load)</span></span>}
          <span className={k.muted}> · {i === 0 ? "the offer" : "added after"}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * PDFs uploaded without the form being sent (manual review WS8.2). The
 * sender was told Kaleb has the offer, so each is a call to make. What the
 * automatic read found is shown as the read's, never as terms anybody
 * confirmed.
 */
export function UploadCards({ uploads, now }: { uploads: PendingUpload[]; now: Date }) {
  return (
    <div className={s.cards}>
      {uploads.map((u) => {
        const arrived = inDays(daysUntil(georgiaDay(new Date(u.at)), now));
        const found = Object.entries(u.read ?? {}).filter(([, c]) => c);
        return (
          <article key={u.id} id={`upload-${u.id}`} className={s.card}>
            <div className={s.cardHead}>
              <div>
                <div className={s.cardTitle}>{u.read?.address?.value ?? "Address not read"}</div>
                <div className={s.cardSub}>{u.name} · uploaded {arrived} · the form was not sent</div>
              </div>
              <span className="chip chip-warn">PDF only</span>
            </div>
            <div className={s.well}>
              <div className={s.wellRow}><span className={k.strong}>{u.files.length === 1 ? "The PDF" : `${u.files.length} PDFs`}</span></div>
              <PdfList files={u.files} />
              {found.length ? (
                <>
                  <p className={s.wellHint}>What the automatic read found. The sender never confirmed these; check them against the PDF.</p>
                  <ul className={s.diff}>
                    {found.map(([key, c]) => <li key={key}>{FIELD_LABEL[key as keyof Candidates] ?? key}: {said(key, c!.value)} (page {c!.page})</li>)}
                  </ul>
                </>
              ) : <p className={s.wellHint}>Not read automatically. The PDF is the offer.</p>}
            </div>
            <div className={s.contact}>
              <a href={`tel:${u.phone.replace(/[^0-9+]/g, "")}`} className={k.link}>{u.phone}</a>
              {u.email ? <a href={`mailto:${u.email}`} className={k.link}>{u.email}</a> : <span className={k.muted}>No email given</span>}
              <RemoveUpload uploadId={u.id} />
            </div>
          </article>
        );
      })}
    </div>
  );
}
