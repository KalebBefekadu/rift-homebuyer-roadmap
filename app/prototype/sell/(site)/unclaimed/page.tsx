"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Ico } from "@/components/rift/icons";
import { SELLER_DEFAULTS, unclaimedValue, type SellerInputs } from "@/lib/prototype/compute";
import { GA_COUNTIES } from "@/lib/prototype/registry";

export default function Unclaimed() {
  const [s, setS] = useState<SellerInputs>({ ...SELLER_DEFAULTS, ageOver65: false, homesteadFiled: false });
  const set = <K extends keyof SellerInputs>(k: K, v: SellerInputs[K]) => setS((p) => ({ ...p, [k]: v }));
  const items = useMemo(() => unclaimedValue(s), [s]);

  return (
    <>
      <section className="shell-w">
        <div style={{ paddingTop: "clamp(40px,6vw,80px)", maxWidth: 700 }}>
          <div className="kicker c-brand">Unclaimed value</div>
          <h1 className="serif" style={{ fontSize: "clamp(32px,4.4vw,52px)", lineHeight: 1.06, marginTop: 14, letterSpacing: "-0.026em" }}>
            Money you may already be losing, every year.
          </h1>
          <p className="lede" style={{ marginTop: 18, maxWidth: 520 }}>
            Four questions. Nothing here is advice — each item names who actually decides.
          </p>
        </div>

        <div className="card p-5" style={{ marginTop: 30, maxWidth: 820 }}>
          <div className="g2 gap-4">
            <label className="field">
              <span className="label">County</span>
              <select className="select" value={s.county} onChange={(e) => set("county", e.target.value)}>
                {GA_COUNTIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label className="field">
              <div className="between" style={{ marginBottom: 5 }}>
                <span className="label" style={{ margin: 0 }}>Years owned</span>
                <span className="num t-sm">{s.yearsOwned}</span>
              </div>
              <input className="rng" type="range" min={0} max={40} step={1}
                value={s.yearsOwned} onChange={(e) => set("yearsOwned", Number(e.target.value))} />
            </label>
          </div>
          <div className="g2 gap-2" style={{ marginTop: 6 }}>
            <label className="opt" data-on={!s.homesteadFiled}>
              <input type="checkbox" checked={!s.homesteadFiled} onChange={(e) => set("homesteadFiled", !e.target.checked)} />
              <span>
                <span className="t-md w5">I&apos;ve never filed a homestead exemption</span>
                <span className="t-xs c-4" style={{ display: "block", marginTop: 2 }}>Or I&apos;m not sure whether I did</span>
              </span>
            </label>
            <label className="opt" data-on={s.ageOver65}>
              <input type="checkbox" checked={s.ageOver65} onChange={(e) => set("ageOver65", e.target.checked)} />
              <span>
                <span className="t-md w5">Someone on the deed is 62 or older</span>
                <span className="t-xs c-4" style={{ display: "block", marginTop: 2 }}>Several counties offer real relief at this age</span>
              </span>
            </label>
          </div>
        </div>
      </section>

      <section className="shell-w" style={{ paddingTop: 28 }}>
        <div className="between" style={{ marginBottom: 16, maxWidth: 820 }}>
          <h2 className="t-xl w6">{items.length} things worth confirming</h2>
          <Link href="/prototype/sell/start" className="btn btn-brand btn-sm">Full assessment <Ico.arrowR size={14} /></Link>
        </div>
        <div className="col gap-3" style={{ maxWidth: 820 }}>
          {items.map((u) => (
            <div key={u.title} className="card p-5">
              <div className="between wrap gap-3" style={{ alignItems: "flex-start" }}>
                <div style={{ maxWidth: 480 }}>
                  <h3 className="t-lg w6">{u.title}</h3>
                  <p className="t-md c-2" style={{ marginTop: 8, lineHeight: 1.6 }}>{u.detail}</p>
                </div>
                <div style={{ textAlign: "right", flex: "none" }}>
                  <div className="t-2xs c-4 w6" style={{ letterSpacing: ".07em", textTransform: "uppercase" }}>Possible value</div>
                  <div className="num w6 c-brand" style={{ fontSize: 16, marginTop: 4 }}>{u.estimate}</div>
                </div>
              </div>
              {u.urgency ? (
                <div className="row-t gap-2" style={{ marginTop: 12, padding: "9px 12px", background: "var(--warn-wash)", border: "1px solid var(--warn-line)", borderRadius: 8 }}>
                  <Ico.clock size={14} className="c-warn" style={{ marginTop: 1, flex: "none" }} />
                  <span className="t-sm c-2">{u.urgency}</span>
                </div>
              ) : null}
              <div className="row gap-2" style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line-3)" }}>
                <Ico.arrowR size={13} className="c-4" />
                <span className="t-sm c-3">Decided by <span className="w55 c-2">{u.decidedBy}</span> — not by us</span>
              </div>
            </div>
          ))}
        </div>

        <div className="card p-4" style={{ marginTop: 18, maxWidth: 820 }}>
          <div className="row-t gap-3">
            <Ico.info size={16} className="c-4" style={{ marginTop: 1, flex: "none" }} />
            <p className="t-sm c-3" style={{ lineHeight: 1.6 }}>
              Rift is not a tax advisor, an attorney, or an appraiser. We can tell you a question
              is worth asking and who to ask. We can&apos;t tell you the answer, and we won&apos;t
              pretend to.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
