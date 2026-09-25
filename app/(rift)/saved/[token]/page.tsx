import type { Metadata } from "next";
import Link from "next/link";
import { readSavedPlan } from "@/lib/db/saved-plan";
import { valueById, valuesFor, missingPhrase } from "@/lib/core/values";
import { SiteHeader } from "@/components/rift/site/SiteHeader";
import { SiteFooter } from "@/components/rift/site/SiteFooter";
import { Ico } from "@/components/rift/icons";
import { hrefFor } from "@/lib/core/saved-plan";
import { ForgetMe } from "@/components/rift/Forget";

export const metadata: Metadata = {
  title: "Your saved plan",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const DAY = (iso: string) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "");

/**
 * A saved plan, reopened by its private link (Blueprint v5 §5.5).
 *
 * The figures are shown as they were saved, with the day; each one reopens
 * its value, which works it out again with today's rates. The same rule as a
 * shared readout: what somebody was told is never silently rewritten.
 */
export default async function SavedPlanPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const read = await readSavedPlan(token);
  const opened = read.ok && "data" in read ? read.data : null;
  const side = opened?.plan.side ?? "buy";
  const tone = side === "sell" ? "sell" : side === "abroad" ? "abroad" : "buy";

  if (!opened) {
    return (
      <div className={tone}>
        <SiteHeader side={side} />
        <main className="shell-w narrow sec ctr">
          <h1 className="serif d3">{read.ok ? "This plan link does not open anything." : "We cannot open this right now."}</h1>
          <p className="lede mt-3">
            {read.ok
              ? "It may have been deleted at your request, or the link was copied incompletely."
              : "The link is fine; something on our side is not. Try again in a few minutes."}
          </p>
          <div className="cta-row mt-4"><Link href={`/${side}`} className="btn btn-brand btn-lg">Start again</Link></div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const { plan } = opened;
  const done = new Set(plan.values.map((v) => v.tool));
  const known = new Set(Object.keys(plan.answers));
  const more = valuesFor(plan.side).filter((v) => !done.has(v.id));

  return (
    <div className={tone}>
      <SiteHeader side={plan.side} />
      <main className="shell-w">
        <section className="sec-sm">
          <div className="kicker c-brand">Your plan</div>
          <h1 className="serif d2 mt-2">{opened.name ? `${opened.name.split(/\s+/)[0]}'s plan` : "Your plan"}</h1>
          <p className="lede mt-3 measure">Saved on {DAY(opened.savedAt)}. The figures are as they were that day; open one to work it out again with today&apos;s numbers.</p>
        </section>

        <section className="sec-sm">
          <div className="trio">
            {plan.values.map((v) => {
              const def = valueById(v.tool);
              return (
                <Link key={v.tool} href={v.href || hrefFor(v.tool, plan.answers) || "/"} className="card p-5 lift value-card">
                  <div className="kicker c-brand">{v.label}</div>
                  <div className="num" style={{ fontSize: 30 }}>{v.figure}</div>
                  <p className="t-sm c-3 grow">{def?.question}</p>
                  <span className="row gap-1 t-sm w6 c-brand">Open it again<Ico.arrowR size={14} /></span>
                </Link>
              );
            })}
          </div>
        </section>

        {more.length ? (
          <section className="sec" aria-labelledby="more-h">
            <h2 id="more-h" className="serif d3">Still to find out</h2>
            <div className="trio mt-4">
              {more.map((v) => (
                <Link key={v.id} href={hrefFor(v.id, plan.answers) ?? v.href} className="card p-5 lift value-card">
                  <div className="kicker c-brand">{v.name}</div>
                  <div className="t-lg w6 serif">{v.question}</div>
                  <p className="t-sm c-3 grow">{v.gives}</p>
                  <div className="between"><span className="t-xs c-4">{missingPhrase(v.asks.filter((k) => !known.has(k)).length)}</span><span className="row gap-1 t-sm w6 c-brand">{v.cta}<Ico.arrowR size={14} /></span></div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section className="sec">
          <div className="card p-5 between wrap gap-3">
            <div className="measure">
              <div className="t-md w6">Want Kaleb to look at it with you?</div>
              <p className="t-sm c-3" style={{ marginTop: 4 }}>A short call, at a time that suits you. No obligation.</p>
            </div>
            <Link href={`/book?v=${plan.side === "sell" ? "sell" : "buy"}`} className="btn btn-brand">Book a call</Link>
          </div>
          <p className="t-xs c-4 mt-3">Anyone with this link can open the plan.</p>
          {/* By the link, not the browser session: this page is usually
              opened from the email, on a device that never saw the save. */}
          <div className="mt-3">
            <ForgetMe
              side={plan.side === "sell" ? "sell" : "buy"}
              planToken={token}
              labels={{
                blurb: "Delete this plan, your contact details and your consent record, from here and on our side. The link stops working.",
                cta: "Delete all of it",
                working: "Deleting\u2026",
                done: "Deleted. The plan, your details and your consent record are gone, and this link no longer opens anything.",
                partial: "There was nothing stored on our side to remove. It may already have been deleted.",
              }}
            />
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
