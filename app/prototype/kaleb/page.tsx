import Link from "next/link";
import { Ico, Mark } from "@/components/rift/icons";
import { Track } from "@/components/rift/Track";

const WORK = [
  { t: "Buying", d: "Assistance most people never find, the real cash figure, and a plan to close the gap.", href: "/prototype/buy", cta: "Rift for buyers", accent: "#e8442a" },
  { t: "Selling", d: "What you'd actually walk away with, what's worth fixing, and what you may already be losing.", href: "/prototype/sell", cta: "Rift for sellers", accent: "#1d6a52" },
];

const REVIEWS = [
  { q: "He told me not to buy the first house I loved. He was right, and it cost him a commission that month.", n: "Priya R.", m: "Bought in DeKalb, Dec 2025" },
  { q: "Nobody had explained escrow to me. I thought the down payment was the whole thing. Finding that out early is the only reason we closed.", n: "Wendell C.", m: "Bought in Fulton, Aug 2026" },
];

export default function Kaleb() {
  return (
    <div style={{ minHeight: "100vh" }}>
      <Track />
      <header style={{
        position: "sticky", top: 0, zIndex: 40, background: "rgba(251,250,248,.84)",
        backdropFilter: "blur(14px)", borderBottom: "1px solid var(--line-2)",
      }}>
        <div className="shell-w between" style={{ height: 62 }}>
          <Link href="/prototype/kaleb" className="row gap-2">
            <Mark size={21} />
            <span className="mark-name" style={{ fontSize: 20 }}>Rift</span>
          </Link>
          <div className="row gap-1">
            <Link href="/prototype/offer" className="btn btn-g btn-sm hide-sm">Submit an offer</Link>
            <Link href="/prototype/app" className="btn btn-g btn-sm hide-sm">Sign in</Link>
            <Link href="/prototype/buy" className="btn btn-p btn-sm">Start</Link>
          </div>
        </div>
      </header>

      <section className="shell-w">
        <div style={{ paddingTop: "clamp(48px,8vw,110px)", maxWidth: 780 }}>
          <div className="row gap-3" style={{ marginBottom: 26 }}>
            <div className="av" style={{ background: "var(--accent)", width: 46, height: 46, fontSize: 17 }}>K</div>
            <div>
              <div className="t-md w6">Kaleb Befekadu</div>
              <div className="t-xs c-4">Peachtree Cardinal · GA-388214</div>
            </div>
          </div>
          <h1 className="serif" style={{ fontSize: "clamp(34px,5.4vw,68px)", lineHeight: 1.04, letterSpacing: "-0.03em" }}>
            I&apos;d rather you knew the numbers than trusted me blindly.
          </h1>
          <p className="lede" style={{ marginTop: 24, maxWidth: 540 }}>
            I&apos;m an agent in Georgia. I built Rift because the questions people actually
            have — what does this really cost, what do I actually keep — kept getting answered
            three weeks too late, if at all.
          </p>
        </div>
      </section>

      <section className="shell-w sec">
        <div className="g2 gap-3">
          {WORK.map((w) => (
            <Link key={w.t} href={w.href} className="card lift" style={{ padding: "clamp(24px,3vw,36px)", display: "block" }}>
              <div className="row gap-2" style={{ marginBottom: 14 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: w.accent }} />
                <span className="kicker">{w.t}</span>
              </div>
              <p className="t-xl w55" style={{ lineHeight: 1.4, maxWidth: 380 }}>{w.d}</p>
              <div className="row gap-2" style={{ marginTop: 22, color: w.accent }}>
                <span className="t-md w6">{w.cta}</span>
                <Ico.arrowR size={16} />
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="shell-w sec">
        <div className="g2 gap-4" style={{ alignItems: "start" }}>
          <div>
            <h2 className="serif" style={{ fontSize: "clamp(24px,2.8vw,36px)", letterSpacing: "-0.022em", lineHeight: 1.12 }}>
              How I work.
            </h2>
            <div className="col gap-3" style={{ marginTop: 22 }}>
              {[
                ["I show you the number before I ask you for anything", "The assessment is free and complete. If you never call me, you still keep it."],
                ["I'll tell you when the answer is no", "Sometimes renting is right. Sometimes the house isn't worth it. Saying so is the job."],
                ["I don't guess at things I'm not licensed for", "Lending, legal, tax, appraisal — I tell you who actually decides and help you ask them."],
                ["Nothing gets lost", "Every offer, deadline, and document is recorded. You can always see where things stand."],
              ].map(([t, b]) => (
                <div key={t} className="row-t gap-3">
                  <Ico.check size={16} className="c-acc" style={{ marginTop: 3, flex: "none" }} />
                  <div>
                    <div className="t-md w6">{t}</div>
                    <p className="t-sm c-3" style={{ marginTop: 3, lineHeight: 1.6 }}>{b}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="col gap-3">
            {REVIEWS.map((r) => (
              <blockquote key={r.n} className="card p-5">
                <p className="serif" style={{ fontSize: 20, lineHeight: 1.45, letterSpacing: "-0.012em" }}>
                  &ldquo;{r.q}&rdquo;
                </p>
                <div className="row gap-2" style={{ marginTop: 16 }}>
                  <span className="t-sm w6">{r.n}</span>
                  <span className="t-sm c-4">· {r.m}</span>
                </div>
              </blockquote>
            ))}
            <div className="card p-4">
              <div className="row gap-2" style={{ marginBottom: 8 }}>
                <Ico.pin size={15} className="c-4" />
                <span className="t-sm w6">Where I work</span>
              </div>
              <div className="row gap-1 wrap">
                {["DeKalb", "Fulton", "Cobb", "Gwinnett", "Clayton"].map((c) => <span key={c} className="chip">{c}</span>)}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="shell-w sec">
        <div className="card between wrap gap-4" style={{ padding: "clamp(26px,3.4vw,44px)", background: "var(--ink)", borderColor: "var(--ink)" }}>
          <div style={{ maxWidth: 460 }}>
            <h3 className="serif" style={{ fontSize: "clamp(24px,2.8vw,34px)", color: "#fff", letterSpacing: "-0.02em", lineHeight: 1.15 }}>
              Start wherever you actually are.
            </h3>
            <p style={{ marginTop: 12, color: "rgba(255,255,255,.66)", fontSize: 15.5, lineHeight: 1.6 }}>
              No form, no call, no account. Just the numbers.
            </p>
          </div>
          <div className="row gap-2 wrap">
            <Link href="/prototype/buy" className="btn btn-lg" style={{ background: "#fff", color: "var(--ink)" }}>I&apos;m buying</Link>
            <Link href="/prototype/sell" className="btn btn-lg" style={{ background: "transparent", color: "#fff", border: "1px solid rgba(255,255,255,.28)" }}>I&apos;m selling</Link>
            <Link href="/prototype/book" className="btn btn-lg" style={{ background: "transparent", color: "rgba(255,255,255,.72)", border: "1px solid rgba(255,255,255,.18)" }}>
              <Ico.cal size={15} />Just talk to me
            </Link>
          </div>
        </div>
      </section>

      <footer style={{ borderTop: "1px solid var(--line-2)", marginTop: 90 }}>
        <div className="shell-w between wrap gap-4" style={{ padding: "34px 0 96px" }}>
          <div style={{ maxWidth: 320 }}>
            <div className="row gap-2"><Mark size={19} /><span className="mark-name" style={{ fontSize: 18 }}>Rift</span></div>
            <p className="t-xs c-4" style={{ marginTop: 10, lineHeight: 1.6 }}>
              Guided by Kaleb Befekadu, Peachtree Cardinal, Georgia. Every figure is a planning
              estimate, not a lending commitment, approval, or valuation.
            </p>
          </div>
          <div className="row gap-5 wrap" style={{ alignItems: "flex-start" }}>
            <div className="col gap-2">
              <div className="t-2xs w6 c-4" style={{ letterSpacing: ".08em", textTransform: "uppercase" }}>Products</div>
              <Link href="/prototype/buy" className="t-xs c-3">Rift for buyers</Link>
              <Link href="/prototype/sell" className="t-xs c-3">Rift for sellers</Link>
              <Link href="/prototype/offer" className="t-xs c-3">Submit an offer</Link>
              <Link href="/prototype/book" className="t-xs c-3">Book fifteen minutes</Link>
            </div>
            <div className="col gap-2">
              <div className="t-2xs w6 c-4" style={{ letterSpacing: ".08em", textTransform: "uppercase" }}>Account</div>
              <Link href="/prototype/app" className="t-xs c-3">Sign in</Link>
              <Link href="/prototype/studio" className="t-xs c-3">Agent studio</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
