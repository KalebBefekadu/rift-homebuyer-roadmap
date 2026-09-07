import type { Metadata } from "next";
import Link from "next/link";
import { Mark } from "@/components/rift/icons";
import { RETENTION } from "@/lib/core/privacy";

export const metadata: Metadata = {
  title: "How this works",
  description: "What Rift does for a seller, what it will not do, how the proceeds are worked out, and how it makes money.",
};

const STEPS: [string, string, string][] = [
  ["Six questions", "Timing, county, likely price, payoff, how long you have owned it, and who else is deciding.", "Free, no account"],
  ["Everything at once", "Net proceeds line by line, unclaimed value, what to fix and what to skip, and a dated preparation plan.", "Yours to keep"],
  ["A conversation, if you want one", "Kaleb walks in already knowing your numbers and your timeline.", "Only if you ask"],
  ["Through to closing", "Preparation, pricing, launch, showings, offers compared on net rather than price, and settlement.", "The whole way"],
];

const STAGES: [string, string][] = [
  ["Considering", "Goals, timing, likely costs, and whether now is right."],
  ["Preparing", "Repairs that pay back, documents, presentation, vendors."],
  ["Pricing and launch", "Strategy, estimated proceeds, marketing, launch plan."],
  ["Active listing", "Activity, feedback, showings, and honest adjustments."],
  ["Reviewing offers", "Compared on net proceeds, terms, timing and risk."],
  ["Under contract", "Contingencies, diligence, appraisal, title, obligations."],
  ["Closing", "Settlement, payoff, possession, and your proceeds."],
  ["After", "Records, the move, and what comes next."],
];

/**
 * The seller's "just tell me how this works" door.
 *
 * Says how Rift is paid, in plain terms, on the page about trust — because a
 * page about trust that avoids the commercial question is the least
 * trustworthy page on a site. That matters more on the seller side, where the
 * reader is being asked to believe a commission figure computed by the person
 * who would earn it.
 */
export default function SellHowPage() {
  return (
    <div className="sell">
      <header style={{ borderBottom: "1px solid var(--line-2)" }}>
        <div className="shell-w between" style={{ height: 56 }}>
          <Link href="/sell" className="row gap-2"><Mark size={19} /><span className="mark-name" style={{ fontSize: 18 }}>Rift</span></Link>
          <Link href="/sell/start" className="btn btn-p btn-sm">Get my numbers</Link>
        </div>
      </header>

      <main className="shell-w sec" style={{ maxWidth: 720 }}>
        <h1 className="serif" style={{ fontSize: "clamp(26px,3.6vw,42px)", lineHeight: 1.12, letterSpacing: "-0.025em" }}>
          How this works
        </h1>

        <Block title="What happens, in order">
          <div className="col gap-2" style={{ marginTop: 4 }}>
            {STEPS.map(([t, d, tag], n) => (
              <div key={t} className="card p-4 row gap-3" style={{ alignItems: "flex-start" }}>
                <div className="num c-brand" style={{ fontSize: 20, lineHeight: 1.2, minWidth: 28 }}>{n + 1}</div>
                <div className="grow">
                  <div className="between wrap gap-2">
                    <span className="t-md w6">{t}</span>
                    <span className="chip" style={{ flex: "none" }}>{tag}</span>
                  </div>
                  <p className="t-sm c-3" style={{ marginTop: 6, lineHeight: 1.6 }}>{d}</p>
                </div>
              </div>
            ))}
          </div>
        </Block>

        <Block title="Where the numbers come from">
          <p>
            Every figure is <strong>calculated</strong> — from your answers, published Georgia
            transfer tax, and typical costs for a sale of this size. Nothing is written by a
            language model and nothing is a number somebody typed in.
          </p>
          <p>
            Commission is shown at a typical rate, not a promise. It is negotiable, it is set in
            your listing agreement, and the readout tells you what rate it used so you can put a
            different one in.
          </p>
          <p>
            What we cannot know is your exact payoff on the day, what a buyer will ask for in
            concessions, or what an inspection turns up. Those are named on the readout rather
            than buried, so you can see which figures are solid and which will move.
          </p>
        </Block>

        <Block title="What this will not do">
          <p>
            It will not value your home. A likely price is your input, not our output — an
            algorithm that has never seen your kitchen should not be the thing that prices it.
            Bring a number you believe, or a range, and see what each end leaves you.
          </p>
          <p>
            It is not tax or legal advice. On exemptions, appeals and the capital gains
            exclusion, we tell you the question is worth asking and exactly who is allowed to
            answer it. That is the honest limit of what software can do here.
          </p>
        </Block>

        <Block title="How Kaleb is paid">
          <p>
            By commission, from the sale, set in your listing agreement and paid at closing. If
            you never list, or you list with somebody else, this costs you nothing and there is
            no invoice.
          </p>
          <p>
            That is the whole model. The readout is free because a seller who knows their real
            net is a better client than one who finds out at the settlement table — not because
            there is a charge waiting further in.
          </p>
        </Block>

        <Block title="If you do work with Kaleb">
          <p>These are the stages, and you can see where you are in all of them.</p>
          <div className="card" style={{ overflow: "hidden", marginTop: 12 }}>
            {STAGES.map(([t, d], n) => (
              <div key={t} className="row gap-3" style={{ padding: "12px 18px", borderBottom: n < STAGES.length - 1 ? "1px solid var(--line-3)" : undefined, alignItems: "flex-start" }}>
                <span className="t-2xs c-4 num" style={{ minWidth: 20, paddingTop: 3 }}>{n + 1}</span>
                <div>
                  <div className="t-sm w6">{t}</div>
                  <div className="t-xs c-4" style={{ marginTop: 2, lineHeight: 1.55 }}>{d}</div>
                </div>
              </div>
            ))}
          </div>
        </Block>

        <Block title="What we keep">
          <p>
            Your answers, so the readout works and your link stays live. An email address only if
            you give one. No phone number is asked for, and there is no call unless you request
            it.
          </p>
          <div className="card" style={{ overflow: "hidden", marginTop: 12 }}>
            {RETENTION.map((r, n) => (
              <div key={r.id} style={{ padding: "13px 18px", borderBottom: n < RETENTION.length - 1 ? "1px solid var(--line-3)" : undefined }}>
                <div className="between wrap gap-2">
                  <span className="t-sm w6 grow" style={{ minWidth: 200 }}>{r.what}</span>
                  <span className="chip" style={{ flex: "none" }}>{r.keptFor}</span>
                </div>
                <p className="t-xs c-4" style={{ marginTop: 6, lineHeight: 1.55 }}>{r.why}</p>
                <p className="t-xs c-3" style={{ marginTop: 4, lineHeight: 1.55 }}>{r.thenWhat}</p>
              </div>
            ))}
          </div>
          <p>You can have everything deleted at any time, and it is one link rather than a request.</p>
        </Block>

        <div className="row gap-3 wrap" style={{ marginTop: 34 }}>
          <Link href="/sell/start" className="btn btn-brand btn-lg">See what you would keep</Link>
          <Link href="/sell/unclaimed" className="btn btn-p btn-lg">Just check unclaimed value</Link>
        </div>
      </main>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 34 }}>
      <h2 className="t-lg w6 serif" style={{ letterSpacing: "-0.018em" }}>{title}</h2>
      <div className="col gap-2 t-sm c-2" style={{ marginTop: 10, lineHeight: 1.68 }}>{children}</div>
    </section>
  );
}
