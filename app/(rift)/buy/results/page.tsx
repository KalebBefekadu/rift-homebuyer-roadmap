import type { Metadata } from "next";
import { matchForVisitor } from "@/lib/db/match";
import { currentRate } from "@/lib/db/rates";
import { cashToClose, cashGap, gapLevers, monthlyComputed } from "@/lib/core/compute";
import { parseReadoutParams } from "@/lib/core/params";
import { buyerReadout } from "@/lib/core/results";
import { firstTimeFrom } from "@/lib/core/funnel";
import { Readout } from "./Readout";

export const metadata: Metadata = {
  title: "Your readout",
  description: "What buying actually takes, worked out from your answers.",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/**
 * The readout.
 *
 * Every figure is computed HERE, on the server, from the same engine and the
 * same registry read the landing page used. The browser receives numbers, never
 * the arithmetic — which matters for one reason above all others: this page is
 * shareable and URL-addressable, and a figure computed in the browser from
 * query parameters is a figure anybody can edit. "My readout says I need
 * $4,000" has to be false.
 *
 * The parameters still carry the answers, because the promise is that this
 * works with no account. What they cannot do is change the maths.
 */
export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) as string | undefined;

  /* Parsed and bounded in lib/core/params.ts, where it is tested adversarially.
     Every figure on this page comes from a query string a stranger can edit, so
     this is a trust boundary rather than a parsing convenience — and the
     failure it prevents is an arithmetically correct absurdity, which is worse
     than an error page because an error page cannot be screenshotted as
     something this product said. */
  const { inputs: i, ownership, timing, coBuyer, substituted } = parseReadoutParams(one);
  const county = i.county;

  const [{ match, source, windowDays }, rate] = await Promise.all([
    matchForVisitor(county, firstTimeFrom(ownership)),
    currentRate(),
  ]);

  /* The rate is applied to the inputs rather than left at the engine default,
     so the monthly figures and the assumption printed beside them are the same
     number. Showing one rate and computing with another is the exact class of
     defect this product cannot survive. */
  i.ratePct = rate.pct;

  const cash = cashToClose(i);
  const gap = cashGap(i);
  const levers = gapLevers(i);
  const monthly = monthlyComputed(i);
  const readout = buyerReadout(i, match, timing);
  const withHelp = cashGap({ ...i, assistance: Math.round((match.openMin + match.openMax) / 2) });

  const band = [i.price - 40_000, i.price, i.price + 40_000].map((p) => ({
    price: p,
    monthly: monthlyComputed({ ...i, price: p }).value,
  }));

  return (
    <Readout
      inputs={i}
      ownership={ownership}
      timing={timing}
      readout={readout}
      cash={cash}
      gap={gap}
      withHelpGap={withHelp}
      levers={levers}
      monthly={monthly}
      band={band}
      match={match}
      registrySource={source}
      windowDays={windowDays}
      rate={rate}
      coBuyer={coBuyer}
      substituted={substituted}
    />
  );
}
