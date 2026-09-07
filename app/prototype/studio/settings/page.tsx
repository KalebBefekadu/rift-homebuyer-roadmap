"use client";

import { useEffect, useState } from "react";
import { StudioHead, StudioBody } from "@/components/rift/Shell";
import { Ico } from "@/components/rift/icons";
import { FunnelEditor } from "@/components/rift/FunnelEditor";
import { RETENTION, PHONE_CONSENT, EMAIL_NOTE, CONSENT_VERSION } from "@/lib/prototype/privacy";
import { PROGRAMS, daysSinceVerified, isStale } from "@/lib/core/registry";
import {
  readRules, writeRule, resetRules, undecided, RULE_LABEL, DEFAULT_RULES,
  type BusinessRules,
} from "@/lib/core/settings";

const TABS = ["Automation", "Business rules", "Funnels", "Programs", "Playbooks", "Privacy", "Profile"] as const;

const WORKFLOWS: [string, "manual" | "approve" | "auto"][] = [
  ["Nurture updates", "approve"],
  ["Living-package updates", "approve"],
  ["Document date extraction", "approve"],
  ["Meeting recaps", "approve"],
  ["Registry verification watch", "auto"],
  ["Task and reminder creation", "auto"],
  ["Review and referral requests", "approve"],
  ["Vendor coordination", "manual"],
];

const PROTECTED = [
  "Presenting or declining to present an offer",
  "Sending or signing any agreement",
  "Stating a price opinion",
  "Asserting a legal or lending conclusion",
];

const PLAYBOOKS = [
  { n: "Nurture cadence", t: "Lead not ready, no action due", runs: 34, state: "Healthy", mode: "Approve" },
  { n: "Post-closing gift", t: "Transaction reaches Closed", runs: 6, state: "Failed", mode: "Approve" },
  { n: "Review and referral", t: "Closing day, and two weeks after", runs: 9, state: "Healthy", mode: "Approve" },
  { n: "Registry watch", t: "Daily", runs: 212, state: "Healthy", mode: "Auto" },
];

export default function Settings() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Automation");
  const [mode, setMode] = useState<"review" | "balanced" | "high">("balanced");
  const [wf, setWf] = useState(Object.fromEntries(WORKFLOWS));

  return (
    <>
      <StudioHead
        title="Settings"
        actions={<button className="btn btn-p btn-sm">Save changes</button>}
        tabs={TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            height: 36, padding: "0 11px", fontSize: 13,
            fontWeight: tab === t ? 600 : 500, color: tab === t ? "var(--ink)" : "var(--ink-3)",
            borderBottom: `2px solid ${tab === t ? "var(--ink)" : "transparent"}`, marginBottom: -1,
          }}>{t}</button>
        ))}
      />
      <StudioBody>
        {tab === "Automation" ? (
          <div className="split">
            <div className="col gap-3">
              <div className="card p-5">
                <div className="t-md w6" style={{ marginBottom: 3 }}>How much Rift does on its own</div>
                <p className="t-sm c-4" style={{ marginBottom: 16 }}>Sets the default. Individual workflows can differ.</p>
                <div className="col gap-2">
                  {([
                    ["review", "Review everything", "Rift prepares, you approve all of it"],
                    ["balanced", "Balanced", "Routine work runs; anything important waits for you"],
                    ["high", "High automation", "Trusted workflows run inside explicit limits"],
                  ] as const).map(([k, t, d]) => (
                    <label key={k} className="opt" data-on={mode === k}>
                      <input type="radio" checked={mode === k} onChange={() => setMode(k)} />
                      <div>
                        <div className="t-md w55">{t}</div>
                        <div className="t-xs c-4" style={{ marginTop: 1 }}>{d}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="card" style={{ overflow: "hidden" }}>
                <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line-2)" }}>
                  <span className="t-sm w6">Per workflow</span>
                </div>
                {WORKFLOWS.map(([name]) => (
                  <div key={name} className="between" style={{ padding: "11px 16px", borderBottom: "1px solid var(--line-3)", gap: 12 }}>
                    <span className="t-sm grow">{name}</span>
                    <div className="row" style={{ gap: 2, background: "var(--sunk)", padding: 2, borderRadius: 7 }}>
                      {(["manual", "approve", "auto"] as const).map((m) => (
                        <button key={m} onClick={() => setWf({ ...wf, [name]: m })} style={{
                          height: 24, padding: "0 9px", borderRadius: 5, fontSize: 11.5, fontWeight: 550,
                          textTransform: "capitalize",
                          background: wf[name] === m ? "var(--paper)" : "transparent",
                          color: wf[name] === m ? "var(--ink)" : "var(--ink-4)",
                          boxShadow: wf[name] === m ? "var(--sh-1)" : "none",
                        }}>{m}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="col gap-3">
              <div className="card p-4">
                <div className="row gap-2" style={{ marginBottom: 10 }}>
                  <Ico.lock size={15} className="c-3" />
                  <span className="t-sm w6">Always manual</span>
                </div>
                <p className="t-xs c-4" style={{ marginBottom: 12, lineHeight: 1.55 }}>
                  No mode changes these.
                </p>
                {PROTECTED.map((p) => (
                  <div key={p} className="row-t gap-2" style={{ padding: "7px 0", borderTop: "1px solid var(--line-3)" }}>
                    <Ico.lock size={12} className="c-4" style={{ marginTop: 3 }} />
                    <span className="t-sm c-2">{p}</span>
                  </div>
                ))}
              </div>

              <div className="card p-4">
                <div className="t-sm w6" style={{ marginBottom: 12 }}>Spend this month</div>
                <div className="between" style={{ marginBottom: 6 }}>
                  <span className="num" style={{ fontSize: 22 }}>$31</span>
                  <span className="t-xs c-4">of $48</span>
                </div>
                <div className="meter"><i style={{ width: "65%" }} /></div>
                <table className="tbl" style={{ marginTop: 12 }}><tbody>
                  {[["Offer intake", "12 of 40"], ["Documents", "9 of 20"], ["Meetings", "2 of 8"], ["Tools & packages", "Free"]].map(([a, b]) => (
                    <tr key={a}><td className="c-4" style={{ padding: "6px 0" }}>{a}</td><td className="num-c num t-sm" style={{ padding: "6px 0" }}>{b}</td></tr>
                  ))}
                </tbody></table>
              </div>
            </div>
          </div>
        ) : null}

        {tab === "Funnels" ? (
          <div style={{ maxWidth: 860 }}>
            <div style={{ marginBottom: 20 }}>
              <h2 className="t-xl w6">The questions people are asked</h2>
              <p className="t-sm c-3" style={{ marginTop: 5, lineHeight: 1.6, maxWidth: 640 }}>
                These are the public funnels. Edits are live the moment you make them — there is no
                publish step, because a draft nobody ships is worse than a change you can undo.
              </p>
            </div>
            <FunnelEditor />
          </div>
        ) : null}

        {tab === "Programs" ? (
          <div className="card" style={{ overflow: "hidden" }}>
            <div className="between" style={{ padding: "12px 16px", borderBottom: "1px solid var(--line-2)" }}>
              <div>
                <span className="t-sm w6">Assistance registry</span>
                <div className="t-xs c-4" style={{ marginTop: 1 }}>Anything unverified for 90 days stops being shown to clients</div>
              </div>
              <button className="btn btn-s btn-sm"><Ico.plus size={13} />Add program</button>
            </div>
            <div className="scroll-x">
              <table className="tbl tbl-hov">
                <thead><tr><th style={{ paddingLeft: 16 }}>Program</th><th>County</th><th className="num-c">Range</th><th>Funding</th><th>Verified</th><th style={{ paddingRight: 16 }}>Status</th></tr></thead>
                <tbody>
                  {PROGRAMS.map((p) => {
                    const stale = isStale(p); const d = daysSinceVerified(p);
                    return (
                      <tr key={p.id} style={{ opacity: stale ? 0.62 : 1 }}>
                        <td style={{ paddingLeft: 16 }}>
                          <div className="w55">{p.name}</div>
                          <div className="t-xs c-4">{p.administrator}</div>
                        </td>
                        <td className="t-sm c-3">{p.county ?? "Statewide"}</td>
                        <td className="num-c num">${(p.min / 1000).toFixed(0)}k–${(p.max / 1000).toFixed(1)}k</td>
                        <td><span className={`chip ${p.funding === "open" ? "chip-pos" : p.funding === "waitlist" ? "chip-warn" : "chip"}`}>{p.funding}</span></td>
                        <td className={`t-sm num ${d > 60 ? "c-warn" : "c-4"}`}>{d}d ago</td>
                        <td style={{ paddingRight: 16 }}>
                          {stale
                            ? <span className="chip chip-neg"><Ico.alert size={10} />Suppressed</span>
                            : <span className="chip chip-pos"><Ico.check size={10} />Live</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {tab === "Playbooks" ? (
          <div className="col gap-3">
            {PLAYBOOKS.map((p) => (
              <div key={p.n} className="card p-4">
                <div className="between wrap gap-3">
                  <div>
                    <div className="row gap-2">
                      <span className="t-md w6">{p.n}</span>
                      <span className={`chip ${p.state === "Failed" ? "chip-neg" : "chip-pos"}`}>
                        {p.state === "Failed" ? <Ico.alert size={10} /> : <Ico.check size={10} />}{p.state}
                      </span>
                      <span className="chip">{p.mode}</span>
                    </div>
                    <div className="t-xs c-4" style={{ marginTop: 4 }}>Runs when: {p.t} · {p.runs} runs</div>
                    {p.state === "Failed" ? (
                      <div className="t-sm c-neg" style={{ marginTop: 8 }}>
                        Artist mailbox rejected the message. Fallback task assigned to you.
                      </div>
                    ) : null}
                  </div>
                  <div className="row gap-2">
                    {p.state === "Failed" ? <button className="btn btn-a btn-sm">Open fallback</button> : null}
                    <button className="btn btn-s btn-sm">Edit</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {tab === "Privacy" ? (
          <div style={{ maxWidth: 820 }}>
            <div style={{ marginBottom: 20 }}>
              <h2 className="t-xl w6">What you hold, and what you promised</h2>
              <p className="t-sm c-3" style={{ marginTop: 5, lineHeight: 1.6, maxWidth: 660 }}>
                People give this product their savings balance before they have agreed to anything.
                These rules are shown to them at the bottom of every readout, so what is written
                here is a promise rather than a policy.
              </p>
            </div>

            <div className="col gap-2">
              {RETENTION.map((r) => (
                <div key={r.id} className="card p-4">
                  <div className="between wrap gap-2">
                    <span className="t-md w6 grow" style={{ minWidth: 240 }}>{r.what}</span>
                    <span className="chip chip-acc">{r.keptFor}</span>
                  </div>
                  <p className="t-sm c-3" style={{ marginTop: 8, lineHeight: 1.6, maxWidth: 640 }}>{r.why}</p>
                  <div className="row gap-2" style={{ marginTop: 10 }}>
                    <span className="chip"><Ico.x size={11} />Then: {r.thenWhat}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="card p-5" style={{ marginTop: 20 }}>
              <div className="between wrap gap-2">
                <div className="row gap-2">
                  <Ico.shield size={15} className="c-3" />
                  <span className="t-md w6">Calling and texting consent</span>
                </div>
                <span className="chip mono">v{CONSENT_VERSION}</span>
              </div>
              <p className="t-sm c-3" style={{ marginTop: 8, lineHeight: 1.6, maxWidth: 660 }}>
                US rules require prior express <b>written</b> consent before an autodialled or
                prerecorded marketing call or text. A pre-ticked box is not consent, and consent
                buried in a terms link is not consent. The exact wording shown has to be stored
                with the record, which is why it is versioned here rather than living in a component.
              </p>
              <div className="card p-4" style={{ marginTop: 14, background: "var(--sunk)" }}>
                <div className="t-2xs c-4 w6" style={{ letterSpacing: ".07em", textTransform: "uppercase" }}>Shown beside a phone number</div>
                <p className="t-sm" style={{ marginTop: 8, lineHeight: 1.6 }}>{PHONE_CONSENT}</p>
              </div>
              <div className="card p-4" style={{ marginTop: 10, background: "var(--sunk)" }}>
                <div className="t-2xs c-4 w6" style={{ letterSpacing: ".07em", textTransform: "uppercase" }}>Shown beside an email address</div>
                <p className="t-sm" style={{ marginTop: 8, lineHeight: 1.6 }}>{EMAIL_NOTE}</p>
              </div>
              <div className="row gap-2" style={{ marginTop: 14 }}>
                <span className="chip chip-warn"><Ico.alert size={11} />Not reviewed by counsel</span>
                <span className="t-xs c-4">Written to be honest and specific. A lawyer signs it off before it collects a real number.</span>
              </div>
            </div>

            <div className="card p-5" style={{ marginTop: 14 }}>
              <div className="row gap-2">
                <Ico.lock size={15} className="c-3" />
                <span className="t-md w6">What measurement records</span>
              </div>
              <p className="t-sm c-3" style={{ marginTop: 8, lineHeight: 1.6, maxWidth: 660 }}>
                Funnel events carry the question id and the seconds spent on it. They never carry
                the answer. We can see that someone stopped on &ldquo;how much do you have
                saved&rdquo;; we cannot see what they typed before they stopped. That distinction is
                what makes it defensible to measure the thing at all.
              </p>
            </div>
          </div>
        ) : null}

        {tab === "Business rules" ? <Rules /> : null}

        {tab === "Profile" ? (
          <div className="split">
            <div className="card p-5">
              <div className="row gap-3" style={{ marginBottom: 20 }}>
                <div className="av av-lg" style={{ background: "var(--accent)", width: 52, height: 52, fontSize: 18 }}>K</div>
                <div><div className="t-lg w6">Kaleb Befekadu</div><div className="t-sm c-4">Peachtree Cardinal · Georgia</div></div>
              </div>
              <div className="g2 gap-3">
                {[["Display name", "Kaleb Befekadu"], ["Brokerage", "Peachtree Cardinal"], ["Email", "kaleb@example.com"], ["Phone", "(404) 555-0100"], ["License", "GA-388214"], ["Service area", "DeKalb, Fulton, Cobb, Gwinnett"]].map(([l, v]) => (
                  <label key={l} className="field"><span className="label">{l}</span><input className="input" defaultValue={v} /></label>
                ))}
              </div>
            </div>
            <div className="card p-4">
              <div className="t-sm w6" style={{ marginBottom: 10 }}>How clients see you</div>
              <div className="tint p-4 center">
                <div className="av" style={{ background: "var(--accent)", width: 44, height: 44, fontSize: 16, margin: "0 auto 10px" }}>K</div>
                <div className="t-md w6">Rift, guided by Kaleb</div>
                <div className="t-xs c-4" style={{ marginTop: 3 }}>Peachtree Cardinal</div>
              </div>
            </div>
          </div>
        ) : null}
      </StudioBody>
    </>
  );
}

/* ================================================================== *
 * Business rules
 *
 * Five decisions were listed in the handoff as "needs the business owner, not
 * engineering", and every one of them was sitting in the code as a literal.
 * That is the worst of both worlds: the owner cannot change it and the engineer
 * is not allowed to. A decision that lives in a constant has already been made
 * by whoever typed the constant.
 * ================================================================== */

function Rules() {
  /* DEFAULTS on the first render, not storage — reading localStorage here would
     make the client's first paint disagree with the server's HTML. */
  const [r, setR] = useState<BusinessRules>(DEFAULT_RULES);
  const [open, setOpen] = useState<(keyof BusinessRules)[]>([]);

  useEffect(() => {
    const sync = () => { setR(readRules()); setOpen(undecided()); };
    sync();
    window.addEventListener("rift:rules", sync);
    return () => window.removeEventListener("rift:rules", sync);
  }, []);

  const set = <K extends keyof BusinessRules>(k: K, v: BusinessRules[K]["value"]) => {
    writeRule(k, v);
    setR(readRules()); setOpen(undecided());
  };
  const isOpen = (k: keyof BusinessRules) => open.includes(k);

  const Row = ({ k, children }: { k: keyof BusinessRules; children: React.ReactNode }) => (
    <div className="card p-4">
      <div className="between wrap gap-2">
        <span className="t-sm w6">{RULE_LABEL[k]}</span>
        {isOpen(k)
          ? <span className="chip chip-warn"><Ico.alert size={10} />Still on the default</span>
          : <span className="chip chip-pos"><Ico.check size={10} />Decided</span>}
      </div>
      <div style={{ margin: "10px 0" }}>{children}</div>
      <p className="t-xs c-3" style={{ lineHeight: 1.6 }}>
        <span className="w6">What it changes: </span>{r[k].affects}
      </p>
      <p className="t-xs c-4" style={{ marginTop: 4, lineHeight: 1.55 }}>
        <span className="w6">Whose call: </span>{r[k].owner}
      </p>
    </div>
  );

  return (
    <div className="col gap-4">
      <div className="card p-4" style={{ background: "var(--sunk)" }}>
        <div className="between wrap gap-2">
          <div className="row gap-2">
            <Ico.scale size={15} className="c-3" />
            <span className="t-sm w6">The decisions engineering is not allowed to make for you</span>
          </div>
          {open.length
            ? <span className="chip chip-warn">{open.length} of 6 still on the default</span>
            : <span className="chip chip-pos">All six decided</span>}
        </div>
        <p className="t-sm c-3" style={{ marginTop: 7, lineHeight: 1.6, maxWidth: 720 }}>
          Each of these was a constant in a file. Touching one below records it as
          <em> chosen</em> rather than inherited — the distinction matters, because two of them
          are the broker&apos;s to make and one of them has a legal floor.
        </p>
      </div>

      <div className="split">
        <div className="col gap-3">
          <Row k="commissionPct">
            <label className="field" style={{ maxWidth: 180 }}>
              <span className="label">Percent of sale price</span>
              <input className="input" type="number" step="0.1" min="0" max="10"
                value={r.commissionPct.value}
                onChange={(e) => set("commissionPct", Number(e.target.value))} />
            </label>
          </Row>

          <Row k="autoEmailReadout">
            <div className="col gap-2">
              {([[true, "Send it the moment they finish"], [false, "Only when they ask for it"]] as const).map(([v, t]) => (
                <label key={String(v)} className="opt" data-on={r.autoEmailReadout.value === v}>
                  <input type="radio" checked={r.autoEmailReadout.value === v} onChange={() => set("autoEmailReadout", v)} />
                  <span className="t-sm">{t}</span>
                </label>
              ))}
            </div>
          </Row>

          <Row k="marketUnrepresented">
            <div className="col gap-2">
              {([[false, "No — leave them alone"], [true, "Yes, after the transaction closes"]] as const).map(([v, t]) => (
                <label key={String(v)} className="opt" data-on={r.marketUnrepresented.value === v}>
                  <input type="radio" checked={r.marketUnrepresented.value === v} onChange={() => set("marketUnrepresented", v)} />
                  <span className="t-sm">{t}</span>
                </label>
              ))}
            </div>
          </Row>
        </div>

        <div className="col gap-3">
          <Row k="registryOwner">
            <label className="field"><span className="label">Name</span>
              <input className="input" value={r.registryOwner.value}
                onChange={(e) => set("registryOwner", e.target.value)} />
            </label>
          </Row>

          <Row k="registryDays">
            <label className="field" style={{ maxWidth: 180 }}>
              <span className="label">Days before suppression</span>
              <input className="input" type="number" step="15" min="15" max="365"
                value={r.registryDays.value}
                onChange={(e) => set("registryDays", Number(e.target.value))} />
            </label>
          </Row>

          <Row k="clientRetentionYears">
            <label className="field" style={{ maxWidth: 180 }}>
              <span className="label">Years after closing</span>
              <input className="input" type="number" step="1" min="1" max="15"
                value={r.clientRetentionYears.value}
                onChange={(e) => set("clientRetentionYears", Number(e.target.value))} />
            </label>
            <p className="t-xs c-warn row gap-2" style={{ marginTop: 8 }}>
              <Ico.alert size={11} style={{ flex: "none", marginTop: 2 }} />
              This is the one setting with a legal floor. Confirm it with the broker before
              anything starts deleting on it.
            </p>
          </Row>

          <button className="btn btn-g btn-sm" onClick={resetRules}>Back to the defaults</button>
        </div>
      </div>
    </div>
  );
}
