import type { Metadata } from "next";
import Link from "next/link";
import { Ico, Mark } from "@/components/rift/icons";
import { AgentSchema } from "@/components/rift/Agent";
import {
  money, cashToClose, netProceeds, BUYER_DEFAULTS, SELLER_DEFAULTS,
} from "@/lib/core/compute";

export const metadata: Metadata = {
  title: "Know the real number before you talk to anyone",
  description:
    "Buying or selling a home in Georgia. A complete, computed readout of what it actually takes — free, no account, and yours to keep whether or not you ever speak to us.",
};

/* Both figures are arithmetic on published Georgia rates, so a day is safe. */
export const revalidate = 86400;

/**
 * The front door.
 *
 * Until now `/` served the development index — a page that opened with "this is
 * the development root, not the product" and linked to the specification. Every
 * person who typed the bare domain landed on it.
 *
 * It asks one question, because there is exactly one thing the product needs to
 * know before it can be useful, and answering it is the whole navigation. The
 * third door is for somebody who is doing neither: the exemptions and appeal
 * deadlines are worth money to a homeowner who never moves, and putting that
 * where it asks for nothing is the most credible thing on the page.
 *
 * Both figures are computed from the same engine the readouts use, rather than
 * written into the copy, so the number here cannot drift from the number two
 * clicks later.
 */
export default function HomePage() {
  const buy = cashToClose({ ...BUYER_DEFAULTS, assistance: 0 });
  const sell = netProceeds(SELLER_DEFAULTS);

  return (
    <div className="buy">
      <AgentSchema />
      <header style={{
        position: "sticky", top: 0, zIndex: 40, background: "rgba(251,250,248,.86)",
        backdropFilter: "blur(14px)", borderBottom: "1px solid var(--line-2)",
      }}>
        <div className="shell-w between" style={{ height: 58 }}>
          <Link href="/" className="row gap-2">
            <Mark size={20} />
            <span className="mark-name" style={{ fontSize: 19 }}>Rift</span>
          </Link>
          <div className="row gap-3">
            <Link href="/buy/how" className="t-sm c-2 hide-sm">How it works</Link>
            <Link href="/buy/programs" className="t-sm c-2 hide-sm">Georgia programs</Link>
          </div>
        </div>
      </header>

      <section className="shell-w" style={{ paddingTop: "clamp(44px,7vw,96px)" }}>
        <div style={{ maxWidth: 780 }}>
          <h1 className="serif" style={{ fontSize: "clamp(34px,5.4vw,64px)", lineHeight: 1.03, letterSpacing: "-0.028em" }}>
            Know the real number before you talk to anyone.
          </h1>
          <p className="t-lg c-2" style={{ marginTop: 20, lineHeight: 1.6, maxWidth: 660 }}>
            Most people find out what a move actually costs in the last three weeks, from a
            settlement statement. This works it out first — free, with no account, and yours to
            keep whether or not you ever speak to us.
          </p>
        </div>

        <div className="grid-2 gap-4" style={{ marginTop: 38, alignItems: "stretch" }}>
          <Door
            href="/buy/start"
            kicker="I'm buying"
            title="The down payment is not the number."
            figure={money(buy.total)}
            caption={`is what has to be in an account on a ${money(BUYER_DEFAULTS.price)} home — not the ${money(buy.down)} down payment.`}
            cta="See what buying takes"
            secondary={{ href: "/buy", label: "How this works for buyers" }}
          />
          <Door
            href="/sell/start"
            kicker="I'm selling"
            title="The list price is not the number either."
            figure={money(sell.net)}
            caption={`is what reaches you on a ${money(SELLER_DEFAULTS.price)} sale, after the payoff and the cost of selling.`}
            cta="See what selling leaves you"
            secondary={{ href: "/sell", label: "How this works for sellers" }}
            tone="sell"
          />
        </div>
      </section>

      <section className="shell-w sec">
        <div className="card p-5 between wrap gap-3">
          <div style={{ maxWidth: 560 }}>
            <div className="t-lg w6 serif">Doing neither, and just want to stop overpaying?</div>
            <p className="t-sm c-3" style={{ marginTop: 8, lineHeight: 1.6 }}>
              Homestead and senior exemptions, assessment appeals, and the capital gains
              exclusion. Georgia homeowners miss these every year whether or not they ever move.
              This asks for nothing at all.
            </p>
          </div>
          <Link href="/sell/unclaimed" className="btn btn-p">Check unclaimed value</Link>
        </div>
      </section>

      {/* A fourth door, for people who are not in Georgia at all. They arrive
          believing they need a visa to own here, so the door says otherwise
          rather than describing a product. */}
      <section className="shell-w sec">
        <div className="card p-5 between wrap gap-3">
          <div style={{ maxWidth: 560 }}>
            <div className="t-lg w6 serif">Living outside the United States?</div>
            <p className="t-sm c-3" style={{ marginTop: 8, lineHeight: 1.6 }}>
              You don&apos;t need citizenship, a green card, or a visa to own property in
              Georgia, and you don&apos;t need to come here to close. See what you would
              actually have to send, and what it would rent for.
            </p>
          </div>
          <Link href="/abroad" className="btn btn-p">Buying from abroad</Link>
        </div>
      </section>

      <section className="shell-w sec">
        <div className="grid-3 gap-3">
          {[
            { i: <Ico.chart size={18} />, t: "Calculated, not written", d: "Every figure comes from your answers and published Georgia terms. Nothing here was typed by a person or produced by a language model." },
            { i: <Ico.shield size={18} />, t: "Nothing is held back", d: "There is no gated second half. You get the whole readout before anyone asks for an email address, and it keeps working if you never give one." },
            { i: <Ico.users size={18} />, t: "No call unless you ask", d: "No phone number is required, and nothing here commits you to working with us. Kaleb is paid a commission at closing, or not at all." },
          ].map((x) => (
            <div key={x.t} className="card p-5">
              <div className="c-brand">{x.i}</div>
              <div className="t-md w6" style={{ marginTop: 10 }}>{x.t}</div>
              <p className="t-sm c-3" style={{ marginTop: 6, lineHeight: 1.6 }}>{x.d}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="shell-w" style={{ paddingTop: 34, paddingBottom: 60, borderTop: "1px solid var(--line-2)", marginTop: 32 }}>
        <div className="row gap-3 wrap">
          <Link href="/buy" className="t-sm c-3">For buyers</Link>
          <Link href="/sell" className="t-sm c-3">For sellers</Link>
          <Link href="/buy/programs" className="t-sm c-3">Georgia programs</Link>
          <Link href="/buy/how" className="t-sm c-3">How this works</Link>
          <Link href="/privacy" className="t-sm c-3">What we keep</Link>
        </div>
        <p className="t-xs c-4" style={{ marginTop: 14, lineHeight: 1.6, maxWidth: 660 }}>
          Prepared by Rift, guided by Kaleb Befekadu, Peachtree Cardinal, Georgia. Every figure is
          a planning estimate, not a lending commitment, approval, or valuation. Not tax or legal
          advice.
        </p>
      </footer>
    </div>
  );
}

function Door({ href, kicker, title, figure, caption, cta, secondary, tone = "buy" }: {
  href: string;
  kicker: string;
  title: string;
  figure: string;
  caption: string;
  cta: string;
  secondary: { href: string; label: string };
  tone?: "buy" | "sell";
}) {
  return (
    <div className={`card p-5 ${tone}`} style={{ display: "flex", flexDirection: "column" }}>
      <div className="kicker c-brand">{kicker}</div>
      <div className="t-lg w6 serif" style={{ marginTop: 10, letterSpacing: "-0.018em", lineHeight: 1.2 }}>
        {title}
      </div>
      <div className="num" style={{ fontSize: "clamp(30px,4vw,42px)", marginTop: 18, color: "var(--brand-2)" }}>
        {figure}
      </div>
      <p className="t-sm c-3" style={{ marginTop: 8, lineHeight: 1.6, flexGrow: 1 }}>{caption}</p>
      <Link href={href} className="btn btn-brand btn-lg" style={{ width: "100%", marginTop: 18 }}>
        {cta}
      </Link>
      <Link href={secondary.href} className="t-sm c-3" style={{ marginTop: 12, textAlign: "center" }}>
        {secondary.label}
      </Link>
    </div>
  );
}
