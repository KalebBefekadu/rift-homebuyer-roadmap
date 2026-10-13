import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CAUTION, FUNDING_TEXT, GEORGIA_PROGRAMS, type LoanType, type ProgramRecord } from "@/lib/core/assistance";
import { amountView, areaText, buyerStatus, formText, keyRules } from "@/lib/core/program-view";
import { showDay } from "@/lib/core/day";
import { currentPrograms } from "@/lib/db/program-checks";
import { rulesOrDefaults } from "@/lib/db/settings";
import { currentAgentId } from "@/lib/db/service";
import { SiteHeader } from "@/components/rift/site/SiteHeader";
import { SiteFooter } from "@/components/rift/site/SiteFooter";
import { Ico } from "@/components/rift/icons";

export const revalidate = 3600;

/* Every record that has ever been confirmed gets a page. One found but never
   confirmed from an official source has never been shown to anybody, and a
   page would be the first place it was. */
const listed = (p: ProgramRecord) => p.status === "active" || Boolean(p.withheldReason);

export function generateStaticParams() {
  return GEORGIA_PROGRAMS.filter(listed).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = GEORGIA_PROGRAMS.find((x) => x.slug === slug && listed(x));
  if (!p) return { title: "Program not found" };
  return {
    title: `${p.name}: Georgia home buying help`,
    description: `${p.name}, from ${p.administrator}: ${formText(p).toLowerCase()}, ${areaText(p).toLowerCase()}. The rules, the amount, the official source and the day it was last checked.`,
  };
}

const DAY = (iso: string) => showDay(iso, { month: "long", day: "numeric", year: "numeric" });
const LOAN: Record<LoanType, string> = { fha: "FHA", conventional: "Conventional", va: "VA", usda: "USDA" };
const FIRST_TIME: Record<ProgramRecord["firstTime"], string> = {
  required: "Yes, for first-time buyers",
  "not-required": "No, any buyer",
  "not-stated": "Not stated on the program's page",
};
const COMBINES: Record<ProgramRecord["combines"], string> = {
  yes: "Yes, with other help",
  no: "No, used on its own",
  unknown: "Not stated; ask the administrator",
};

/**
 * One Georgia program, in public (audit 12 Oct §3 #2, D40).
 *
 * People search for programs by name and by county, and the list page was a
 * table with no page to land on. This is that page: the rules, the amount, the
 * official source and the day it was last checked, and a way to check it
 * against your own answers. The words come from the same view functions
 * Operations uses (lib/core/program-view.ts), so the agent and a stranger
 * cannot be told two different things about one program.
 *
 * A program past its review date, or withdrawn by a reviewer, keeps its page
 * but shows none of its terms (handoff §4.4): the page says it is being
 * checked again and points at the source. Same rule as the list, where it is
 * withheld and counted.
 */
export default async function ProgramPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const record = GEORGIA_PROGRAMS.find((x) => x.slug === slug);
  if (!record || !listed(record)) notFound();
  /* As buyers see it today: renewed by its checks, or withheld by them. */
  const p = (await currentPrograms()).find((x) => x.slug === slug) ?? record;

  const { rules } = await rulesOrDefaults(await currentAgentId());
  const status = buyerStatus(p, new Date(), rules.registryDays.value);
  const shown = status === "shown";
  const amount = amountView(p);
  const county = p.area.counties.length === 1 ? p.area.counties[0] : null;

  return (
    <div className="buy">
      <SiteHeader side="buy" current="/buy/programs" />
      <main className="shell-w">
        <section className="sec-sm measure">
          <Link href="/buy/programs" className="t-sm c-3 row gap-1"><Ico.chevL size={13} />All Georgia programs</Link>
          <div className="kicker c-brand mt-4">{p.administrator}</div>
          <h1 className="serif d2 mt-2">{p.name}</h1>
          <p className="lede mt-3">{areaText(p)}. {p.terms}</p>
          <div className="row wrap gap-2 mt-3">
            <span className="chip"><Ico.doc size={12} />{formText(p)}</span>
            {shown ? (
              <span className={`chip ${p.funding === "open" ? "chip-pos" : "chip-warn"}`}>
                {p.funding === "open" ? <Ico.check size={12} /> : <Ico.alert size={12} />}{FUNDING_TEXT[p.funding]}
              </span>
            ) : (
              <span className="chip chip-warn"><Ico.clock size={12} />Being checked again</span>
            )}
          </div>
        </section>

        {shown ? (
          <>
            <section className="sec-sm measure" aria-labelledby="amount-h">
              <div className="card p-5">
                <h2 id="amount-h" className="t-sm c-3 w55">How much</h2>
                <div className="answer-fig mt-2">{amount.headline}</div>
                {amount.basis ? <p className="t-sm c-3 mt-2">{amount.basis}.</p> : null}
                {amount.higher ? <p className="t-sm c-2 mt-2">Up to {amount.higher.text}{amount.higher.counted ? "." : ", which the administrator confirms."}</p> : null}
                <p className="t-xs c-4 mt-3" style={{ lineHeight: 1.6 }}>
                  The most the program offers. What you could receive depends on its rules and your purchase.
                </p>
              </div>
            </section>

            <section className="sec-sm measure" aria-labelledby="who-h">
              <h2 id="who-h" className="t-xl serif">Who it is for</h2>
              {keyRules(p).length ? (
                <ul className="col gap-2 mt-3">
                  {keyRules(p).map((r) => (
                    <li key={r} className="row-t gap-2 t-md"><Ico.check size={14} className="c-brand" style={{ flex: "none", marginTop: 4 }} />{r}</li>
                  ))}
                </ul>
              ) : null}
              <dl className="card mt-4" style={{ overflow: "hidden" }}>
                {[
                  ["First-time buyers only", FIRST_TIME[p.firstTime] + (p.firstTimeNote ? `. ${p.firstTimeNote}` : "")],
                  ["Credit score", p.minCredit ? `At least ${p.minCredit.score}${p.minCredit.note ? `. ${p.minCredit.note}` : ""}` : "Not stated on the program's page"],
                  ["Loan types", p.loanTypes ? p.loanTypes.map((l) => LOAN[l]).join(", ") : "Not stated on the program's page"],
                  ["Combines with other help", COMBINES[p.combines] + (p.combinesNote ? `. ${p.combinesNote}` : "")],
                  ...(p.onlyFor ? [["Only for", p.onlyFor.note]] : []),
                  ...(p.fundingNote ? [["Funding", p.fundingNote]] : []),
                ].map(([k, v]) => (
                  <div key={k} className="between gap-3" style={{ padding: "12px 16px", borderBottom: "1px solid var(--line-3)", alignItems: "flex-start" }}>
                    <dt className="t-sm c-3" style={{ flex: "none", maxWidth: "45%" }}>{k}</dt>
                    <dd className="t-sm w55" style={{ margin: 0, textAlign: "right" }}>{v}</dd>
                  </div>
                ))}
              </dl>
              {p.conditions.length ? (
                <>
                  <h3 className="t-md w6 mt-4">What it asks of you</h3>
                  <ul className="col gap-1 mt-2">
                    {p.conditions.map((c) => <li key={c} className="t-sm c-2">{c}</li>)}
                  </ul>
                </>
              ) : null}
            </section>
          </>
        ) : (
          <section className="sec-sm measure">
            <div className="card p-5 row-t gap-3">
              <Ico.clock size={16} className="c-warn" style={{ flex: "none", marginTop: 3 }} />
              <p className="t-md c-2" style={{ lineHeight: 1.6 }}>
                This program is being checked again against its official page, so its terms are not
                shown here until that is done. Its own page has the current rules.
              </p>
            </div>
          </section>
        )}

        <section className="sec-sm measure">
          <div className="card p-5" style={{ background: "var(--brand-wash)", borderColor: "var(--brand-line)" }}>
            <div className="t-md w6">Does it fit you?</div>
            <p className="t-sm c-2" style={{ marginTop: 4 }}>
              Six quick questions check your answers against this program and every other one in Georgia, and say what still needs confirming.
            </p>
            <Link href={county ? `/buy/assistance?c=${encodeURIComponent(county)}` : "/buy/assistance"} className="btn btn-brand btn-lg mt-3" style={{ maxWidth: "100%", whiteSpace: "normal" }}>
              Check if it fits me<Ico.arrowR size={15} />
            </Link>
          </div>
        </section>

        <section className="sec-sm measure">
          <p className="t-sm c-3" style={{ lineHeight: 1.6 }}>
            Source: <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer" className="c-brand">{p.sourceName}<Ico.arrowUpR size={11} /></a>.
            {" "}Last checked against it on {DAY(p.checkedOn)}{p.sourceDated ? `; the page itself is dated ${DAY(p.sourceDated)}` : ""}.
          </p>
          <p className="t-xs c-4 mt-3" style={{ lineHeight: 1.6 }}>{CAUTION}</p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
