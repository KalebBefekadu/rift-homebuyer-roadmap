"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Ico, Mark } from "@/components/rift/icons";
import { useTrack, useCaptureTouch } from "@/lib/rift/track";
import { SELLER_DEFAULTS, unclaimedValue, type SellerInputs } from "@/lib/core/compute";

export function Unclaimed({ counties }: { counties: string[] }) {
  const [s, setS] = useState<SellerInputs>({
    ...SELLER_DEFAULTS,
    ageOver65: false,
    homesteadFiled: false,
  });
  const set = <K extends keyof SellerInputs>(k: K, v: SellerInputs[K]) =>
    setS((p) => ({ ...p, [k]: v }));

  const items = useMemo(() => unclaimedValue(s), [s]);

  useCaptureTouch();
  useTrack({ name: "landing_view", side: "sell", meta: { page: "unclaimed" } });

  return (
    <div className="sell">
      <header style={{ borderBottom: "1px solid var(--line-2)" }}>
        <div className="shell-w between" style={{ height: 56 }}>
          <Link href="/sell" className="row gap-2">
            <Mark size={19} />
            <span className="mark-name" style={{ fontSize: 18 }}>Rift</span>
          </Link>
          <Link href="/sell/start" className="btn btn-p btn-sm">Full readout</Link>
        </div>
      </header>

      <section className="shell-w">
        <div style={{ paddingTop: "clamp(36px,5vw,72px)", maxWidth: 700 }}>
          <div className="kicker c-brand">Unclaimed value</div>
          <h1 className="serif" style={{ fontSize: "clamp(30px,4.4vw,52px)", lineHeight: 1.06, marginTop: 14, letterSpacing: "-0.026em" }}>
            Money you may already be losing, every year.
          </h1>
          <p className="t-lg c-2" style={{ marginTop: 16, lineHeight: 1.6 }}>
            None of this has anything to do with selling. These are exemptions, deadlines and
            reliefs Georgia homeowners routinely miss. Answer four things and we will tell you
            which are worth a phone call — and exactly who to call.
          </p>
        </div>
      </section>

      <section className="shell-w sec">
        <div className="grid-2 gap-4" style={{ alignItems: "start" }}>
          <div className="card p-5">
            <div className="t-md w6">About the home</div>

            <label className="field" style={{ marginTop: 16 }}>
              <span className="t-sm c-3">Which county?</span>
              <select className="input" value={s.county} onChange={(e) => set("county", e.target.value)}>
                {counties.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>

            <label className="field" style={{ marginTop: 14 }}>
              <span className="t-sm c-3">Roughly what is it worth? ({s.price.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })})</span>
              <input
                className="range"
                type="range"
                min={100_000}
                max={1_200_000}
                step={5_000}
                value={s.price}
                onChange={(e) => set("price", Number(e.target.value))}
              />
            </label>

            <label className="field" style={{ marginTop: 14 }}>
              <span className="t-sm c-3">How long have you owned it? ({s.yearsOwned} years)</span>
              <input
                className="range"
                type="range"
                min={0}
                max={40}
                step={1}
                value={s.yearsOwned}
                onChange={(e) => set("yearsOwned", Number(e.target.value))}
              />
            </label>

            <div className="col gap-2" style={{ marginTop: 16 }}>
              <label className="opt" data-on={s.homesteadFiled}>
                <input type="checkbox" checked={s.homesteadFiled} onChange={() => set("homesteadFiled", !s.homesteadFiled)} />
                <span className="t-sm">I have filed for homestead exemption</span>
              </label>
              <label className="opt" data-on={s.ageOver65}>
                <input type="checkbox" checked={s.ageOver65} onChange={() => set("ageOver65", !s.ageOver65)} />
                <span className="t-sm">Someone on the deed is 65 or older</span>
              </label>
            </div>

            <p className="t-xs c-4" style={{ marginTop: 16, lineHeight: 1.55 }}>
              Nothing here is stored, and nothing is sent. This runs in your browser.
            </p>
          </div>

          <div>
            <div className="between wrap gap-2">
              <div className="t-md w6">
                {items.length === 0 ? "Nothing obvious to chase" : `${items.length} worth a phone call`}
              </div>
              <span className="chip">{s.county} County</span>
            </div>

            {items.length === 0 ? (
              <div className="card p-5" style={{ marginTop: 12 }}>
                <p className="t-sm c-3" style={{ lineHeight: 1.6 }}>
                  On these answers there is nothing we would tell you to go after. That is a real
                  answer, not an empty one — you have filed what there is to file.
                </p>
              </div>
            ) : (
              <div className="col gap-2" style={{ marginTop: 12 }}>
                {items.map((u) => (
                  <div key={u.title} className="card p-4">
                    <div className="between wrap gap-2">
                      <span className="t-md w6 grow" style={{ minWidth: 200 }}>{u.title}</span>
                      <span className="num t-md c-brand" style={{ flex: "none" }}>{u.estimate}</span>
                    </div>
                    <p className="t-sm c-3" style={{ marginTop: 8, lineHeight: 1.6 }}>{u.detail}</p>
                    <div className="row gap-2 wrap" style={{ marginTop: 12 }}>
                      <span className="chip"><Ico.users size={12} />Decided by {u.decidedBy}</span>
                      {u.urgency ? <span className="chip chip-warn"><Ico.clock size={12} />{u.urgency}</span> : null}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <p className="t-xs c-4" style={{ marginTop: 14, lineHeight: 1.6 }}>
              We are not tax advisors or attorneys, and nothing here is advice. We notice the
              question is worth asking and tell you who is allowed to answer it. Amounts are
              typical ranges, not quotes.
            </p>

            <div className="card p-5" style={{ marginTop: 20 }}>
              <div className="t-md w6 serif">Thinking about selling too?</div>
              <p className="t-sm c-3" style={{ marginTop: 8, lineHeight: 1.6 }}>
                The full readout adds what actually reaches you after payoff and costs, and which
                pre-sale work comes back in the price.
              </p>
              <Link href="/sell/start" className="btn btn-brand" style={{ marginTop: 14 }}>
                See what you would keep
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
