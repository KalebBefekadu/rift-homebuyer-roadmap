import type { Metadata } from "next";
import Link from "next/link";
import { readSavedPlan } from "@/lib/db/saved-plan";
import { valueById, valuesFor, missingPhrase } from "@/lib/core/values";
import { SiteHeader } from "@/components/rift/site/SiteHeader";
import { SiteFooter } from "@/components/rift/site/SiteFooter";
import { Ico } from "@/components/rift/icons";
import { hrefFor } from "@/lib/core/saved-plan";
import { matchAssistance, KIND_LABEL, CAUTION, type Occupation } from "@/lib/core/assistance";
import { assistancePlan } from "@/lib/core/assistance-plan";
import { firstTimeFrom, type Ownership } from "@/lib/core/funnel";
import { hasAll } from "@/lib/core/asks";
import { currentPrograms } from "@/lib/db/program-checks";
import { rulesOrDefaults } from "@/lib/db/settings";
import { currentAgentId } from "@/lib/db/service";
import { PrintButton } from "@/components/rift/PrintButton";
import { ForgetMe } from "@/components/rift/Forget";
import { money } from "@/lib/core/compute";
import { showDay } from "@/lib/core/day";

export const metadata: Metadata = {
  title: "Your saved plan",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const DAY = (iso: string) => (iso ? showDay(iso, { month: "long", day: "numeric", year: "numeric" }) : "");

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

  /* My assistance plan (D14): worked out today from the saved answers, so a
     program that closed or changed since is not in it. */
  const a = plan.answers;
  let assist: ReturnType<typeof assistancePlan> | null = null;
  let combination: ReturnType<typeof matchAssistance>["combination"] = null;
  if (plan.side === "buy" && hasAll(a, valueById("assistance")!.asks)) {
    const [{ rules }, programs] = await Promise.all([rulesOrDefaults(await currentAgentId()), currentPrograms()]);
    const profile = {
      county: String(a.county), firstTime: firstTimeFrom(String(a.ownership) as Ownership), price: Number(a.price),
      income: Number(a.income), household: Number(a.household), occupation: String(a.occupation) as Occupation | "other",
    };
    const r = matchAssistance(profile, { today: new Date(), windowDays: rules.registryDays.value, programs });
    combination = r.combination;
    assist = r.matches.length ? assistancePlan(r.matches, profile) : null;
  }

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

        {assist ? (
          <section className="sec" aria-labelledby="assist-h">
            <div className="between wrap gap-3">
              <div>
                <div className="kicker c-brand">My assistance plan</div>
                <h2 id="assist-h" className="serif d3 mt-2">What to do about each program</h2>
                <p className="t-sm c-3 mt-2 measure">Worked out today from your saved answers. Potential matches only: lenders and the programs decide.</p>
              </div>
              <span className="no-print"><PrintButton /></span>
            </div>
            {combination ? (
              <div className="card p-4 mt-4" style={{ background: "var(--brand-wash)", borderColor: "var(--brand-line)" }}>
                <div className="t-md w6">Potential combination: {combination.programs[0].program.name} + {combination.programs[1].program.name}</div>
                <p className="t-sm c-2 mt-1">Up to {money(combination.total)} together, because both programs&apos; rules allow it. Compatibility and current availability must be verified.</p>
              </div>
            ) : null}
            <div className="col gap-3 mt-4">
              {assist.programs.map((p) => (
                <article key={p.program.slug} className="card p-5">
                  <div className="between wrap gap-2">
                    <div>
                      <h3 className="t-lg w6">{p.program.name}</h3>
                      <div className="t-sm c-3">{KIND_LABEL[p.program.kind]} · up to {money(p.amount)}</div>
                    </div>
                    <a href={p.program.sourceUrl} target="_blank" rel="noopener noreferrer" className="btn btn-s btn-sm no-print">Official source<Ico.arrowUpR size={12} /></a>
                  </div>
                  <p className="t-sm c-2 mt-2"><strong>Lender:</strong> {p.lender}</p>
                  <ol className="mt-2" style={{ paddingLeft: 20 }}>
                    {p.steps.map((st) => <li key={st} className="t-sm c-2" style={{ lineHeight: 1.6, marginTop: 4 }}>{st}</li>)}
                  </ol>
                </article>
              ))}
            </div>
            <div className="card p-5 mt-4">
              <h3 className="t-lg w6">Documents to gather</h3>
              <ul className="mt-2" style={{ paddingLeft: 20 }}>
                {assist.documents.map((d) => <li key={d} className="t-sm c-2" style={{ lineHeight: 1.6, marginTop: 4 }}>{d}</li>)}
              </ul>
            </div>
            <p className="t-xs c-4 mt-3 measure" style={{ lineHeight: 1.6 }}>{CAUTION}</p>
          </section>
        ) : null}

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
          <p className="t-xs c-4 mt-3">Anyone with this link can open the plan. <Link href="/privacy" className="btn-link">What we keep</Link></p>
          <div className="mt-3" style={{ maxWidth: 560 }}>
            <ForgetMe side={plan.side === "sell" ? "sell" : "buy"} planToken={token} />
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
