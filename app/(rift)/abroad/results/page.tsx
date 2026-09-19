import type { Metadata } from "next";
import Link from "next/link";
import { GA_COUNTIES } from "@/lib/core/registry";
import { currentRate } from "@/lib/db/rates";
import {
  abroadReturns, breakEvenDownPct, parseAbroadParams, statusById, ASSUMPTIONS,
} from "@/lib/core/abroad";
import { money } from "@/lib/core/compute";
import { Ico, Mark } from "@/components/rift/icons";

export const metadata: Metadata = {
  title: "What this would take from where you are",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/**
 * The readout for a buyer abroad.
 *
 * It exists because the buyer readout is the wrong document for this person.
 * That one is built around closing a cash gap by saving, and it names Georgia
 * Dream and the other assistance programmes throughout — every one of which
 * requires the buyer to occupy the house, and most of which require a Social
 * Security number. Sending a foreign national there was the same false promise
 * this page's hero was built to avoid, reintroduced one click later.
 *
 * No questions of its own. The landing page already asked the four that matter
 * and they travel in the URL, so this renders immediately — and, like every
 * other readout here, it is addressable, ungated, and keeps working if the
 * person never speaks to anyone.
 */
export default async function AbroadResults({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) as string | undefined;

  const i = parseAbroadParams(one, GA_COUNTIES);
  const rate = await currentRate();

  /* The recorded rate, not the module's starting assumption. Showing one rate
     and computing with another is the class of defect this product cannot
     survive, and it is the one the hardcoded figure here was heading for. */
  const a = { ...ASSUMPTIONS, baseRatePct: rate.pct };
  const r = abroadReturns(i, a);
  const s = statusById(i.status);
  const breakEven = breakEvenDownPct(i, a);

  const back = `/abroad?s=${i.status}&u=${i.use}&p=${i.price}&c=${encodeURIComponent(i.county)}&d=${i.downPct}`;

  return (
    <div className="buy">
      <header style={{ borderBottom: "1px solid var(--line-2)" }}>
        <div className="shell-w between" style={{ height: 58 }}>
          <Link href="/abroad" className="row gap-2">
            <Mark size={20} />
            <span className="mark-name" style={{ fontSize: 19 }}>Rift</span>
            <span className="chip chip-brand hide-sm">From abroad</span>
          </Link>
          <Link href={back} className="t-sm c-2">Change my answers</Link>
        </div>
      </header>

      <main className="shell-w" style={{ paddingTop: "clamp(26px,4vw,48px)" }}>
        <div className="kicker c-brand">
          {money(i.price)} in {i.county} County · {i.use === "rent" ? "rented out" : "kept for your own use"}
        </div>
        <h1 className="serif" style={{ fontSize: "clamp(28px,4vw,46px)", lineHeight: 1.08, letterSpacing: "-0.026em", marginTop: 12, maxWidth: 760 }}>
          {r.cashFlow >= 0 && i.use === "rent"
            ? "It covers itself, and three other things pay you."
            : i.use === "rent"
              ? `It runs ${money(Math.abs(r.cashFlow))} a month short — and still returns ${r.returnPct.toFixed(1)}%.`
              : `You'd send ${money(r.cashIn)} and own it outright in thirty years.`}
        </h1>

        {/* What leaves the account. The first thing anyone abroad wants. */}
        <section className="sec">
          <div className="g2 gap-4">
            <div className="card" style={{ overflow: "hidden", alignSelf: "start" }}>
              <div className="between" style={{ padding: "14px 18px", borderBottom: "1px solid var(--line-2)" }}>
                <span className="t-md w6">What you&apos;d have to send</span>
                <span className="num t-sm c-4">{r.downPct}% down</span>
              </div>
              {[
                ["Down payment", r.down, `${r.downPct}% — the least a lender takes in your situation`],
                ["Closing costs", r.closing, `${ASSUMPTIONS.closingPct}% — attorney, title, recording, lender fees`],
              ].map(([l, v, n]) => (
                <div key={l as string} className="between" style={{ padding: "12px 18px", borderBottom: "1px solid var(--line-3)", gap: 12 }}>
                  <div className="grow">
                    <div className="t-sm w5">{l as string}</div>
                    <div className="t-xs c-4" style={{ marginTop: 1 }}>{n as string}</div>
                  </div>
                  <span className="num t-sm">{money(v as number)}</span>
                </div>
              ))}
              <div className="between" style={{ padding: "15px 18px", background: "var(--sunk)" }}>
                <span className="t-md w6">Before you own it</span>
                <span className="num" style={{ fontSize: 21 }}>{money(r.cashIn)}</span>
              </div>
            </div>

            <div className="card" style={{ overflow: "hidden", alignSelf: "start" }}>
              <div className="between" style={{ padding: "14px 18px", borderBottom: "1px solid var(--line-2)" }}>
                <span className="t-md w6">Every month</span>
                <span className="num t-sm c-4">{rate.pct.toFixed(2)}% + {s.ratePremium}</span>
              </div>
              {[
                ["Loan payment", r.monthly.pi],
                ["Property tax", r.monthly.tax],
                ["Insurance", r.monthly.insurance],
              ].map(([l, v]) => (
                <div key={l as string} className="between" style={{ padding: "11px 18px", borderBottom: "1px solid var(--line-3)" }}>
                  <span className="t-sm w5">{l as string}</span>
                  <span className="num t-sm c-neg">−{money(v as number)}</span>
                </div>
              ))}
              {i.use === "rent" ? (
                <>
                  <div className="between" style={{ padding: "11px 18px", borderBottom: "1px solid var(--line-3)" }}>
                    <span className="t-sm w5">Rent, estimated</span>
                    <span className="num t-sm">{money(r.rent)}</span>
                  </div>
                  {[
                    ["Management", r.operating.management, `${ASSUMPTIONS.managementPct}% — someone local, because you are not`],
                    ["Vacancy set-aside", r.operating.vacancy, `${ASSUMPTIONS.vacancyPct}% — about a month a year between tenants`],
                    ["Maintenance set-aside", r.operating.maintenance, `${ASSUMPTIONS.maintenancePct}% — repairs and turnover`],
                  ].map(([l, v, n]) => (
                    <div key={l as string} className="between" style={{ padding: "11px 18px", borderBottom: "1px solid var(--line-3)", gap: 12 }}>
                      <div className="grow">
                        <div className="t-sm w5">{l as string}</div>
                        <div className="t-xs c-4" style={{ marginTop: 1 }}>{n as string}</div>
                      </div>
                      <span className="num t-sm c-neg">−{money(v as number)}</span>
                    </div>
                  ))}
                  <div className="between" style={{ padding: "15px 18px", background: r.cashFlow >= 0 ? "var(--brand-wash)" : "var(--sunk)" }}>
                    <span className="t-md w6">{r.cashFlow >= 0 ? "Left over" : "Short"}</span>
                    <span className="num" style={{ fontSize: 21, color: r.cashFlow >= 0 ? "var(--brand-2)" : undefined }}>
                      {r.cashFlow < 0 ? "−" : ""}{money(Math.abs(r.cashFlow))}
                    </span>
                  </div>
                </>
              ) : (
                <div className="between" style={{ padding: "15px 18px", background: "var(--sunk)" }}>
                  <span className="t-md w6">Costs you, each month</span>
                  <span className="num" style={{ fontSize: 21 }}>{money(r.monthly.total)}</span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* The part nobody counts. */}
        <section className="sec">
          <h2 className="serif" style={{ fontSize: "clamp(22px,2.6vw,32px)", letterSpacing: "-0.02em", maxWidth: 560 }}>
            Where the first year actually goes.
          </h2>
          <p className="t-md c-3" style={{ marginTop: 12, maxWidth: 560, lineHeight: 1.65 }}>
            Cash flow is the smallest of the three, and the only one most people look at.
          </p>
          <div className="g3 gap-3" style={{ marginTop: 22 }}>
            {[
              ["Rent, after everything", r.year1.cashFlow, "Spendable. The only part that reaches your account."],
              ["Loan paid down", r.year1.principal, "Not spendable, but yours. The tenant paid it, not you."],
              [`Appreciation at ${ASSUMPTIONS.appreciationPct}%`, r.year1.appreciation, `On the whole ${money(i.price)}, not on what you put in.`],
            ].map(([t, v, n]) => (
              <div key={t as string} className="card p-4">
                <div className="t-xs c-4">{t as string}</div>
                <div className="num" style={{ fontSize: 26, marginTop: 6, color: (v as number) < 0 ? "var(--neg)" : undefined }}>
                  {(v as number) < 0 ? "−" : ""}{money(Math.abs(v as number))}
                </div>
                <p className="t-xs c-3" style={{ marginTop: 6, lineHeight: 1.55 }}>{n as string}</p>
              </div>
            ))}
          </div>
          <div className="card p-4" style={{ marginTop: 14, background: "var(--sunk)" }}>
            <div className="between wrap gap-3">
              <div>
                <div className="t-md w6">Year one, all in</div>
                <p className="t-sm c-3" style={{ marginTop: 4, lineHeight: 1.6 }}>
                  On the {money(r.cashIn)} you sent. Appreciation is an estimate and can be
                  negative; the other two are contractual.
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="num" style={{ fontSize: 28 }}>{money(r.year1.total)}</div>
                <div className="t-sm c-3">{r.returnPct.toFixed(1)}% of what you sent</div>
              </div>
            </div>
          </div>
        </section>

        {/* The one thing in the way, named plainly. */}
        <section className="sec">
          <div className="g2 gap-4">
            <div className="card p-5">
              <div className="kicker c-brand">The one thing in your way</div>
              <div className="t-lg w6" style={{ marginTop: 10 }}>
                {i.use === "live"
                  ? "It earns nothing while you hold it"
                  : r.cashFlow >= 0
                    ? "Finding a tenant who stays"
                    : breakEven !== null
                      ? `At ${r.downPct}% down it does not cover itself`
                      : "At this price nothing covers itself"}
              </div>
              <p className="t-sm c-3" style={{ marginTop: 8, lineHeight: 1.65 }}>
                {i.use === "live"
                  ? `Held empty it costs ${money(r.monthly.total)} a month. ${money(r.year1.principal)} of the first year is principal, so it is not lost — but it is not income either.`
                  : r.cashFlow >= 0
                    ? `The figures assume about a month empty a year. Two months empty turns ${money(r.cashFlow)} a month into roughly ${money(r.cashFlow - r.rent / 12)}.`
                    : breakEven !== null
                      ? `You would need ${breakEven}% down — ${money((i.price * breakEven) / 100)} instead of ${money(r.down)} — for the rent to cover everything. A cheaper house in the same county gets there with less.`
                      : `No down payment makes the rent cover the costs at ${money(i.price)} in ${i.county}. A cheaper house, or a county with a better rent-to-price ratio, will.`}
              </p>
            </div>
            <div className="card p-5">
              <div className="kicker c-brand">What a lender will ask you for</div>
              <div className="t-lg w6" style={{ marginTop: 10 }}>{s.label.replace(/^I(&apos;m|'m| have| live)/, "You$1")}</div>
              <p className="t-sm c-3" style={{ marginTop: 8, lineHeight: 1.65 }}>{s.asks}</p>
              <p className="t-xs c-4" style={{ marginTop: 10, lineHeight: 1.6 }}>
                Rate shown is {rate.pct.toFixed(2)}% plus about {s.ratePremium} points for this
                paper. {rate.source}.
              </p>
            </div>
          </div>
        </section>

        <section className="sec">
          <div className="card" style={{ padding: "clamp(24px,3vw,40px)", background: "var(--ink)", borderColor: "var(--ink)" }}>
            <h3 className="serif" style={{ fontSize: "clamp(21px,2.6vw,30px)", color: "#fff", letterSpacing: "-0.02em", maxWidth: 520, lineHeight: 1.15 }}>
              This page keeps working whether or not you call.
            </h3>
            <p style={{ marginTop: 12, color: "rgba(255,255,255,.62)", fontSize: 15, lineHeight: 1.6, maxWidth: 520 }}>
              Save the link. Nothing here expires, and no one has your details unless you give
              them.
            </p>
            <div className="row gap-2 wrap" style={{ marginTop: 22 }}>
              <Link href="/book?v=abroad" className="btn btn-lg" style={{ background: "#fff", color: "var(--ink)" }}>
                Fifteen minutes with Kaleb <Ico.arrowR size={15} />
              </Link>
              <Link href={back} className="btn btn-lg" style={{ background: "transparent", color: "#fff", border: "1px solid rgba(255,255,255,.24)" }}>
                Change my answers
              </Link>
            </div>
          </div>
        </section>

        <p className="t-xs c-4 sec" style={{ maxWidth: 720, lineHeight: 1.6, paddingBottom: 60 }}>
          Planning estimates, not a loan approval, a rent guarantee, or a valuation. Down
          payments and rate premiums reflect what lenders in this market publish for each
          situation; your own lender&apos;s terms decide. Rent is estimated from county
          averages, not from a specific property. U.S. tax on rental income and the FIRPTA
          withholding on sale are real and are questions for a cross-border accountant, not
          for an agent.
        </p>
      </main>
    </div>
  );
}
