import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { agentSession } from "@/lib/db/session";
import { Unavailable } from "../Unavailable";
import { inboundOffers, type InboundOffer } from "@/lib/db/offer-intake";
import { read, type Submission } from "@/lib/core/offer-intake";
import { Ico } from "@/components/rift/icons";
import { money } from "@/lib/core/compute";

export const metadata: Metadata = { title: "Offers in" };
export const dynamic = "force-dynamic";


/**
 * Offers that arrived through the public form.
 *
 * This screen is the reason the feature is allowed to exist. /offer tells a
 * stranger their offer has been delivered, on a document with a deadline
 * attached to it, and an offer sitting in a table nobody opens would make the
 * whole thing worse than not having it: a promise kept by the database and
 * broken by the product.
 *
 * Each one is read the same way the submitter's own page read it, from the
 * same function. If Kaleb sees a different number from the one the sender was
 * shown, one of them is being lied to, and the only way to be sure that never
 * happens is for there to be one piece of arithmetic.
 */
export default async function OffersInPage() {
  const session = await agentSession();
  if (session.state === "unknown") return <Unavailable reason={session.reason} />;
  if (session.state === "signed-out") redirect("/operations/sign-in");

  const q = await inboundOffers();
  const failed = !q.ok ? q.error : null;
  const unavailable = q.ok && "skipped" in q ? q.reason : null;
  const offers = q.ok && "data" in q ? q.data : [];

  return (
    <>

      <main className="shell-w sec" style={{ paddingTop: 28, maxWidth: 820 }}>
        <h1 className="serif" style={{ fontSize: "clamp(24px,3vw,34px)", letterSpacing: "-0.02em" }}>
          Offers in
        </h1>
        <p className="t-sm c-3" style={{ marginTop: 8, maxWidth: 600, lineHeight: 1.6 }}>
          Submitted at <Link href="/offer" className="u">/offer</Link> by people with no account.
          Each one is also a relationship: somebody writing offers in Georgia is somebody worth
          knowing whether or not this one lands.
        </p>

        {failed ? (
          <div className="card p-4" style={{ marginTop: 20 }}>
            <div className="row gap-2">
              <Ico.alert size={15} className="c-neg" style={{ flex: "none", marginTop: 2 }} />
              <div>
                <div className="t-sm w6">This did not load.</div>
                <p className="t-xs c-3" style={{ marginTop: 4 }}>{failed}.</p>
                <p className="t-xs c-4" style={{ marginTop: 6 }}>
                  Not the same as nothing having arrived. Somebody may be waiting on a reply.
                </p>
              </div>
            </div>
          </div>
        ) : unavailable ? (
          <div className="card p-4" style={{ marginTop: 20 }}>
            <div className="t-sm w6">Nothing to read from.</div>
            <p className="t-xs c-3" style={{ marginTop: 4 }}>{unavailable}.</p>
          </div>
        ) : offers.length === 0 ? (
          <div className="card p-4" style={{ marginTop: 20 }}>
            <div className="t-sm w6">Nothing has come in yet.</div>
            <p className="t-xs c-3" style={{ marginTop: 6, lineHeight: 1.6 }}>
              The page works with no account and no login, so the way this fills up is somebody
              sending the link to an agent who is writing an offer today.
            </p>
          </div>
        ) : (
          <div className="col gap-3" style={{ marginTop: 22 }}>
            {offers.map((o) => {
              /* The same read the sender was shown. One piece of arithmetic,
                 or one of the two people looking at this is being told
                 something the other is not. */
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

              return (
                <article key={o.id} className="card p-4">
                  <div className="between wrap gap-2">
                    <div className="grow" style={{ minWidth: 220 }}>
                      <div className="t-md w6">{o.address ?? "No address given"}</div>
                      <div className="t-xs c-3" style={{ marginTop: 3 }}>
                        {o.from}{o.firm ? ` · ${o.firm}` : ""}
                        {o.representing === "self" ? " · buying themselves" : " · for their buyer"}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flex: "none" }}>
                      <div className="num t-lg">{money(o.price)}</div>
                      <div className="t-2xs c-4">offered</div>
                    </div>
                  </div>

                  {r.askedBack > 0 ? (
                    <div className="card p-3" style={{ marginTop: 12, background: "var(--sunk)" }}>
                      <div className="between wrap gap-2">
                        <span className="t-xs c-3">Worth the same to a seller as a clean offer at</span>
                        <span className="num t-md">{money(r.equivalentCleanPrice)}</span>
                      </div>
                      <p className="t-2xs c-4" style={{ marginTop: 4 }}>
                        {money(r.askedBack)} asked back. Assumes a {r.commissionPct}% commission.
                      </p>
                    </div>
                  ) : null}

                  <div className="row gap-2 wrap" style={{ marginTop: 12 }}>
                    <span className="chip">{o.financing === "other" && o.financingOther ? `Other: ${o.financingOther}` : o.financing}</span>
                    {o.closeOn ? <span className="chip">Close {o.closeOn}</span> : null}
                    {o.dueDiligenceDays !== null ? <span className="chip">{o.dueDiligenceDays} days due diligence</span> : null}
                    {o.earnest > 0 ? <span className="chip">{money(o.earnest)} earnest</span> : null}
                    {o.contingencies.map((c) => <span key={c} className="chip">{c}</span>)}
                  </div>

                  {o.pdfUrl || o.read ? <PdfRead o={o} /> : null}

                  {r.gaps.length ? (
                    <ul className="t-xs c-warn" style={{ marginTop: 10, paddingLeft: 16, lineHeight: 1.6 }}>
                      {r.gaps.map((g) => <li key={g}>{g}</li>)}
                    </ul>
                  ) : null}

                  {o.note ? (
                    <p className="t-xs c-2" style={{ marginTop: 10, lineHeight: 1.6 }}>&ldquo;{o.note}&rdquo;</p>
                  ) : null}

                  <div className="row gap-3 wrap" style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--line-3)" }}>
                    {o.email ? <a href={`mailto:${o.email}`} className="t-xs u">{o.email}</a> : null}
                    {o.phone ? <span className="t-xs c-3">{o.phone}</span> : null}
                    {o.submitterLeadId ? (
                      <Link href={`/operations/lead/${o.submitterLeadId}`} className="t-xs u">Their record</Link>
                    ) : (
                      <span className="t-xs c-4">No relationship record. The lead write did not land.</span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </>
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
  const differs = Object.entries(o.read ?? {}).filter(([k, c]) => c && String(sent[k as keyof typeof sent] ?? "") !== c.value);
  return (
    <div className="card p-3" style={{ marginTop: 12, background: "var(--sunk)" }}>
      <div className="between wrap gap-2">
        <span className="t-xs w6">Sent with a PDF</span>
        {o.pdfUrl ? <a href={o.pdfUrl} target="_blank" rel="noopener noreferrer" className="btn btn-g btn-sm">Open the PDF</a> : <span className="t-2xs c-4">The PDF link did not load</span>}
      </div>
      {o.read ? (
        differs.length ? (
          <ul className="t-xs c-warn" style={{ marginTop: 8, paddingLeft: 16, lineHeight: 1.6 }}>
            {differs.map(([k, c]) => (
              <li key={k}>{k}: sent &ldquo;{sent[k as keyof typeof sent] || "blank"}&rdquo;, the PDF says &ldquo;{c!.value}&rdquo; (page {c!.page}: &ldquo;{c!.quote}&rdquo;)</li>
            ))}
          </ul>
        ) : <p className="t-2xs c-3" style={{ marginTop: 6 }}>Every box the automatic read found matches what was sent.</p>
      ) : <p className="t-2xs c-4" style={{ marginTop: 6 }}>Not read automatically; check the terms against the PDF.</p>}
    </div>
  );
}
