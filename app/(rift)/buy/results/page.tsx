import type { Metadata } from "next";
import { matchForVisitor } from "@/lib/db/match";
import { currentRate } from "@/lib/db/rates";
import { BUYER_DEFAULTS, cashToClose, cashGap, gapLevers, monthlyComputed, type BuyerInputs } from "@/lib/core/compute";
import { buyerReadout } from "@/lib/core/results";
import { firstTimeFrom, type Ownership } from "@/lib/core/funnel";
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

  /* Every input is clamped to a defensible range. A negative price or a
     billion-dollar saving rate produces a nonsense readout, and a nonsense
     readout screenshotted is worse than an error page. */
  const clamp = (n: number, lo: number, hi: number, fallback: number) =>
    Number.isFinite(n) && n >= lo && n <= hi ? n : fallback;

  const county = one("c") || BUYER_DEFAULTS.county;
  const ownership = (one("o") || "none") as Ownership;
  const timing = one("t") || "3 to 9 months";

  const i: BuyerInputs = {
    ...BUYER_DEFAULTS,
    county,
    price: clamp(Number(one("p")), 50_000, 5_000_000, BUYER_DEFAULTS.price),
    savings: clamp(Number(one("s")), 0, 5_000_000, BUYER_DEFAULTS.savings),
    monthlySaving: clamp(Number(one("r")), 0, 100_000, BUYER_DEFAULTS.monthlySaving),
    /* Never folded into the headline. The gap we lead with is the one that is
       true today; assistance is upside, conditional on a lender saying yes. */
    assistance: 0,
  };

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
    />
  );
}
