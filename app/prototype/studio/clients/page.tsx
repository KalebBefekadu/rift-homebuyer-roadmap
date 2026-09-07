"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StudioHead, StudioBody } from "@/components/rift/Shell";
import { Ico } from "@/components/rift/icons";
import { CLIENTS, REP_CHIP } from "@/lib/prototype/clients";
import { ranked, sla, BAND_LABEL, BAND_TONE } from "@/lib/prototype/lead";
import { useAttribution, describeTouch } from "@/lib/prototype/attribution";
import { MOMENTS, REFERRAL_STATE, STATE_CHIP, dueNow, gate, referralStats } from "@/lib/prototype/referral";
import { stallOf, STALL_CHIP, forecast, commissionOn, weightFor, evidenceMix, BASIS_CHIP } from "@/lib/prototype/pipeline";
import { readRules, DEFAULT_RULES } from "@/lib/prototype/settings";
import { money } from "@/lib/prototype/compute";

const SOURCES = [
  { s: "Referral", leads: 14, consults: 9, clients: 6, spend: 0, per: "—" },
  { s: "Paid social", leads: 62, consults: 21, clients: 4, spend: 2340, per: "$585" },
  { s: "Organic search", leads: 38, consults: 9, clients: 3, spend: 0, per: "—" },
  { s: "Open house", leads: 19, consults: 11, clients: 4, spend: 620, per: "$155" },
  { s: "Workshop", leads: 24, consults: 14, clients: 3, spend: 410, per: "$137" },
  { s: "Rift Offer", leads: 11, consults: 2, clients: 1, spend: 0, per: "—" },
];

/**
 * Columns are DERIVED from each client's own stage, never listed separately.
 * The previous hard-coded version had drifted: it put the Okafors under
 * "Under contract" while their record said "Reviewing offers", called Priya
 * "Closed" where her record said "Homeownership", and left the Vances off the
 * board altogether. Two sources of truth for stage is one too many.
 */
const BOARD_ORDER = [
  "Exploring", "Building readiness", "Ready to shop", "Preparing the property",
  "Searching", "Reviewing offers", "Under contract", "Closing", "Homeownership",
];

const boardColumns = () => {
  const present = BOARD_ORDER.filter((st) => CLIENTS.some((c) => c.stage === st));
  const unknown = [...new Set(CLIENTS.map((c) => c.stage))].filter((st) => !BOARD_ORDER.includes(st));
  return [...present, ...unknown].map((st) => ({
    s: st,
    ids: CLIENTS.filter((c) => c.stage === st).map((c) => c.id),
  }));
};

const FILTERS = ["All", "Buyers", "Sellers", "Needs attention", "Nurture"] as const;

/* Days in the current stage. In the real build this is derived from the stage
   transition log rather than stored, so it can never drift from the timeline. */
const DAYS_IN_STAGE: Record<string, number> = {
  maya: 41, vance: 26, okafor: 12, pike: 3, beltran: 58, raman: 0,
};
const dollars = (v: string) => Number(v.replace(/[^0-9]/g, "")) || 0;

export default function Clients() {
  const [f, setF] = useState<(typeof FILTERS)[number]>("All");
  const [q, setQ] = useState("");
  const [view, setView] = useState<"Leads" | "List" | "Board" | "Sources" | "Referrals">("Leads");
  const [openLead, setOpenLead] = useState<string | null>(null);
  const LEADS_RANKED = ranked();
  /* Their readout stays pinned to the version they were actually asked. */
  const CURRENT_FV = Math.max(...LEADS_RANKED.map(({ lead }) => lead.funnelVersion));
  const attr = useAttribution();
  const [rules, setRules] = useState(DEFAULT_RULES);
  useEffect(() => {
    const sync = () => setRules(readRules());
    sync();
    window.addEventListener("rift:rules", sync);
    return () => window.removeEventListener("rift:rules", sync);
  }, []);
  const breached = LEADS_RANKED.filter(({ lead: l, score }) => sla(l, score.band).breached).length;

  const rows = CLIENTS.filter((c) => {
    if (q && !(c.name + c.county + c.stage).toLowerCase().includes(q.toLowerCase())) return false;
    if (f === "Buyers") return c.journey.includes("Buyer");
    if (f === "Sellers") return c.journey.includes("Seller");
    if (f === "Needs attention") return !!c.flag;
    if (f === "Nurture") return c.heat === "cool";
    return true;
  });

  return (
    <>
      <StudioHead
        title="Clients"
        sub={`${CLIENTS.length} relationships`}
        actions={<button className="btn btn-p btn-sm"><Ico.plus size={14} />New client</button>}
        tabs={FILTERS.map((x) => (
          <button key={x} onClick={() => setF(x)} className="row" style={{
            height: 36, padding: "0 11px", fontSize: 13, whiteSpace: "nowrap",
            fontWeight: f === x ? 600 : 500, color: f === x ? "var(--ink)" : "var(--ink-3)",
            borderBottom: `2px solid ${f === x ? "var(--ink)" : "transparent"}`, marginBottom: -1,
          }}>{x}</button>
        ))}
      />
      <StudioBody>
        <div className="row gap-2" style={{ marginBottom: 16 }}>
          <div className="rel grow" style={{ maxWidth: 320 }}>
            <Ico.search size={14} style={{ position: "absolute", left: 11, top: 13, color: "var(--ink-4)" }} />
            <input className="input" placeholder="Search clients" value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingLeft: 32 }} />
          </div>
          <div className="spacer" />
          <div className="row" style={{ gap: 2, background: "var(--sunk)", padding: 2, borderRadius: 8 }}>
            {(["Leads", "List", "Board", "Sources", "Referrals"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)} style={{
                height: 28, padding: "0 11px", borderRadius: 6, fontSize: 12.5, fontWeight: 550,
                background: view === v ? "var(--paper)" : "transparent",
                color: view === v ? "var(--ink)" : "var(--ink-4)",
                boxShadow: view === v ? "var(--sh-1)" : "none",
              }}>{v}</button>
            ))}
          </div>
        </div>

        {view === "Leads" ? (
          <>
            <div className="card p-4" style={{ marginBottom: 14, background: "var(--sunk)" }}>
              <div className="between wrap gap-2">
                <div className="row gap-2">
                  <Ico.layers size={15} className="c-3" />
                  <span className="t-sm w6">Ranked by what the answers say, not by when they arrived</span>
                </div>
                <div className="row gap-2">
                  {breached ? <span className="chip chip-neg"><Ico.clock size={11} />{breached} past the reply target</span> : null}
                  <Link href="/prototype/studio/queue" className="btn btn-g btn-sm"><Ico.refresh size={12} />Follow-up queue</Link>
                </div>
              </div>
              <p className="t-sm c-3" style={{ marginTop: 7, lineHeight: 1.6, maxWidth: 700 }}>
                An inbox makes everyone look equally urgent, which is the same as making nobody
                urgent. Open any row to see the arithmetic — a ranking you can&apos;t audit is one
                you stop trusting by the second week. Nothing here uses anything but the answers
                they gave.
              </p>
            </div>

            {attr ? (
              <div className="card p-3" style={{ marginBottom: 14 }}>
                <div className="between wrap gap-2">
                  <div className="row gap-2">
                    <Ico.pin size={13} className="c-3" />
                    <span className="t-sm w55">This browser is being attributed to <span className="mono">{describeTouch(attr.first)}</span></span>
                  </div>
                  <span className="t-xs c-4 mono">{attr.first.landing} · visit {attr.visits}</span>
                </div>
                <div className="t-xs c-4" style={{ marginTop: 6, lineHeight: 1.55 }}>
                  Live capture, not a fixture. Open a public page with{" "}
                  <span className="mono">?utm_source=facebook&amp;utm_campaign=dpa-help-aug</span> and come
                  back — first touch will not move, which is the entire point of first touch.
                </div>
              </div>
            ) : null}

            <div className="col gap-2">
              {LEADS_RANKED.map(({ lead: l, score: sc }) => (
                <div key={l.id} className="card" style={{ overflow: "hidden" }}>
                  <button className="row gap-3" style={{
                    padding: "13px 16px", width: "100%", textAlign: "left",
                    alignItems: "flex-start", background: "transparent", border: 0,
                  }} onClick={() => setOpenLead(openLead === l.id ? null : l.id)}>
                    <div style={{ flex: "none", textAlign: "center", minWidth: 42 }}>
                      <div className="num w6" style={{ fontSize: 20, lineHeight: 1 }}>{sc.score}</div>
                      <div className="t-2xs c-4">score</div>
                    </div>
                    <span className="av" style={{ background: l.color, flex: "none" }}>{l.initials}</span>
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="row gap-2 wrap">
                        <span className="t-md w55">{l.name}</span>
                        <span className={`chip ${BAND_TONE[sc.band]}`}>{BAND_LABEL[sc.band]}</span>
                        <span className="chip">{l.side === "buy" ? "Buyer" : "Seller"} · {l.county}</span>
                      </div>
                      <p className="t-sm c-3" style={{ marginTop: 5, lineHeight: 1.55 }}>{sc.headline}</p>
                      <div className="row gap-2 wrap" style={{ marginTop: 6 }}>
                        <span className="t-xs c-4">{l.source} · {money(l.value)}</span>
                        <span className={`chip ${sla(l, sc.band).breached ? "chip-neg" : sla(l, sc.band).repliedMins !== null ? "chip-pos" : "chip"}`}>
                          <Ico.clock size={11} />{sla(l, sc.band).humanLabel}
                        </span>
                      </div>
                    </div>
                    <div className="row gap-2" style={{ flex: "none" }}>
                      <span className="chip chip-acc">{sc.action}</span>
                      <Ico.chevD size={14} className="c-4" style={{ transform: openLead === l.id ? "rotate(180deg)" : undefined }} />
                    </div>
                  </button>

                  {openLead === l.id ? (
                    <div style={{ padding: "14px 16px", borderTop: "1px solid var(--line-2)", background: "var(--sunk)" }}>
                      <div className="split-w">
                        <div>
                          <div className="t-xs c-4 w6" style={{ letterSpacing: ".06em", textTransform: "uppercase" }}>How the score is made</div>
                          <table className="tbl" style={{ marginTop: 8 }}><tbody>
                            {sc.signals.map((g) => (
                              <tr key={g.label}>
                                <td className="w55" style={{ width: 160 }}>{g.label}</td>
                                <td className="t-sm c-3">{g.note}</td>
                                <td className="num-c num w6" style={{ width: 52, color: g.points < 0 ? "var(--neg)" : undefined }}>
                                  {g.points > 0 ? "+" : ""}{g.points}
                                </td>
                              </tr>
                            ))}
                            <tr><td className="w6">Total</td><td /><td className="num-c num w6">{sc.score}</td></tr>
                          </tbody></table>
                        </div>
                        <div>
                          <div className="t-xs c-4 w6" style={{ letterSpacing: ".06em", textTransform: "uppercase" }}>What opens the conversation</div>
                          <p className="t-sm c-2" style={{ marginTop: 8, lineHeight: 1.6 }}>{l.hook}</p>
                          {l.extras.length ? (
                            <div style={{ marginTop: 14 }}>
                              <div className="t-xs c-4 w6" style={{ letterSpacing: ".06em", textTransform: "uppercase" }}>Your own questions</div>
                              {l.extras.map((e) => (
                                <div key={e.q} className="card p-3" style={{ marginTop: 8 }}>
                                  <div className="t-xs c-4">{e.q}</div>
                                  <div className="t-sm" style={{ marginTop: 3 }}>&ldquo;{e.a}&rdquo;</div>
                                </div>
                              ))}
                            </div>
                          ) : null}
                          <div style={{ marginTop: 14 }}>
                            <div className="t-xs c-4 w6" style={{ letterSpacing: ".06em", textTransform: "uppercase" }}>Where they came from</div>
                            <table className="tbl" style={{ marginTop: 6 }}><tbody>
                              <tr><td className="w55" style={{ width: 130 }}>First touch</td><td className="t-sm c-3">{l.source}</td></tr>
                              <tr><td className="w55">Campaign</td><td className="t-sm c-3 mono">{l.campaign}</td></tr>
                              <tr><td className="w55">Landed on</td><td className="t-sm c-3 mono">{l.landing}</td></tr>
                              <tr>
                                <td className="w55">Answered</td>
                                <td className="t-sm c-3">
                                  <span className="mono">funnel v{l.funnelVersion}</span>
                                  {l.funnelVersion < CURRENT_FV ? (
                                    <span className="chip chip-warn" style={{ marginLeft: 8 }}>
                                      questions have changed since
                                    </span>
                                  ) : null}
                                </td>
                              </tr>
                            </tbody></table>
                          </div>

                          <div className="card p-3" style={{ marginTop: 12, background: "var(--paper)" }}>
                            <div className="row gap-2">
                              <Ico.bolt size={13} className={sla(l, sc.band).valueDelivered ? "c-pos" : "c-4"} />
                              <span className="t-sm w55">{sla(l, sc.band).valueLabel}</span>
                            </div>
                            <div className="t-xs c-4" style={{ marginTop: 5, lineHeight: 1.55 }}>
                              {sla(l, sc.band).humanLabel}. The clock that matters most already
                              stopped — they have their numbers either way.
                            </div>
                          </div>

                          <div className="row gap-2 wrap" style={{ marginTop: 14 }}>
                            <button className="btn btn-p btn-sm" disabled={!l.contactable}><Ico.send size={13} />{sc.action}</button>
                            <button className="btn btn-s btn-sm"><Ico.doc size={13} />Open their readout</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </>
        ) : null}

        {view === "Referrals" ? (
          <>
            <div className="card p-4" style={{ marginBottom: 14, background: "var(--sunk)" }}>
              <div className="row gap-2">
                <Ico.gift size={15} className="c-3" />
                <span className="t-sm w6">Referral is a set of moments, not a page you send at the end</span>
              </div>
              <p className="t-sm c-3" style={{ marginTop: 7, lineHeight: 1.6, maxWidth: 720 }}>
                Each moment has its own ask, and the ask scales with what the person has actually
                received. Asking for a name right after a free readout spends goodwill nobody
                earned yet; asking on closing day is the strongest thing this business has. One
                moment&apos;s correct ask is nothing at all.
              </p>
              <div className="row gap-4 wrap" style={{ marginTop: 14 }}>
                {(() => { const st = referralStats(); return [
                  ["Advocates", st.advocates], ["Sent on", st.sent],
                  ["Now active", st.active], ["Closed", st.closed],
                ]; })().map(([l, v]) => (
                  <div key={l as string} style={{ paddingRight: 20, borderRight: "1px solid var(--line-2)" }}>
                    <div className="t-2xs c-4 w6" style={{ letterSpacing: ".07em", textTransform: "uppercase" }}>{l}</div>
                    <div className="num" style={{ fontSize: 20, marginTop: 3 }}>{v as number}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card" style={{ overflow: "hidden", marginBottom: 14 }}>
              <div className="between" style={{ padding: "11px 16px", borderBottom: "1px solid var(--line-2)" }}>
                <span className="t-sm w6">Due today</span>
                <span className="t-xs c-4">Strongest moment first</span>
              </div>
              {dueNow().map(({ c, m }) => {
                const g = gate(c.mood);
                const held = c.states[m.id] === "held";
                return (
                  <div key={c.client + m.id} className="row gap-3" style={{ padding: "13px 16px", borderBottom: "1px solid var(--line-3)", alignItems: "flex-start" }}>
                    <span className="av" style={{ background: c.color, flex: "none" }}>{c.initials}</span>
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="row gap-2 wrap">
                        <span className="t-md w55">{c.client}</span>
                        <span className={`chip ${STATE_CHIP[c.states[m.id] ?? "waiting"].c}`}>{m.label}</span>
                        {m.gated ? (
                          <span className={`chip ${g.askPublicly ? "chip-pos" : "chip-warn"}`}>
                            <Ico.shield size={11} />{g.route}
                          </span>
                        ) : null}
                      </div>
                      <p className="t-sm c-2" style={{ marginTop: 5, lineHeight: 1.55 }}>
                        {held ? "Deliberately holding: " : ""}{m.ask}
                      </p>
                      <p className="t-xs c-4" style={{ marginTop: 4, lineHeight: 1.5 }}>
                        {/* The satisfaction gate only speaks for moments it governs. */}
                        {held ? m.why : m.gated ? g.note : m.why}
                      </p>
                    </div>
                    <div className="row gap-1" style={{ flex: "none" }}>
                      <button className="btn btn-p btn-sm" disabled={m.gated && !g.askPublicly}>
                        <Ico.send size={13} />Send
                      </button>
                      <button className="btn btn-g btn-sm">Skip</button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="card" style={{ overflow: "hidden" }}>
              <div className="scroll-x">
                <table className="tbl">
                  <thead><tr>
                    <th style={{ paddingLeft: 18 }}>Relationship</th>
                    {MOMENTS.map((m) => <th key={m.id} title={m.why} style={{ whiteSpace: "nowrap" }}>{m.label}</th>)}
                    <th style={{ paddingRight: 18 }}>Sent on</th>
                  </tr></thead>
                  <tbody>
                    {REFERRAL_STATE.map((c) => (
                      <tr key={c.client}>
                        <td className="w55" style={{ paddingLeft: 18, whiteSpace: "nowrap" }}>
                          {c.client}
                          <div className="t-xs c-4">{c.stage}</div>
                        </td>
                        {MOMENTS.map((m) => {
                          const st = c.states[m.id];
                          return (
                            <td key={m.id}>
                              {st ? <span className={`chip ${STATE_CHIP[st].c}`}>{STATE_CHIP[st].l}</span>
                                  : <span className="t-xs c-4">—</span>}
                            </td>
                          );
                        })}
                        <td style={{ paddingRight: 18 }}>
                          {c.sent.length ? c.sent.map((x) => (
                            <div key={x.who} className="t-xs" style={{ whiteSpace: "nowrap" }}>
                              {x.who} <span className="c-4">· {x.outcome}</span>
                            </div>
                          )) : <span className="t-xs c-4">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="t-xs c-4" style={{ marginTop: 12, lineHeight: 1.6, maxWidth: 720 }}>
              Nothing public is ever requested before a private check. Someone who says the move
              went badly is routed to you and is not asked for a rating — then or later. That is
              not rating management; it is that a complaint deserves an answer rather than a form.
            </p>
          </>
        ) : null}

        {view === "List" ? (
        <div className="card" style={{ overflow: "hidden" }}>
          <div className="scroll-x">
            <table className="tbl tbl-hov">
              <thead>
                <tr>
                  <th style={{ paddingLeft: 16 }}>Client</th>
                  <th>Stage</th>
                  <th>Source</th>
                  <th>Representation</th>
                  <th>Next</th>
                  <th className="num-c" style={{ paddingRight: 16 }}>Value</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} style={{ cursor: "pointer" }}>
                    <td style={{ paddingLeft: 16 }}>
                      <Link href={`/prototype/studio/clients/${c.id}`} className="row gap-3">
                        <div className="av av-sm" style={{ background: c.color }}>{c.av[0]}</div>
                        <div style={{ minWidth: 0 }}>
                          <div className="w55 row gap-2">
                            {c.name}
                            {c.heat === "hot" ? <span className="dot" style={{ background: "var(--accent)" }} /> : null}
                          </div>
                          <div className="t-xs c-4">{c.role} · {c.county}</div>
                        </div>
                      </Link>
                    </td>
                    <td>
                      <Link href={`/prototype/studio/clients/${c.id}`}>
                        <div className="t-sm">{c.stage}</div>
                        <div className="t-xs c-4">{c.journey}</div>
                      </Link>
                    </td>
                    <td>
                      <Link href={`/prototype/studio/clients/${c.id}`}>
                        <div className="t-sm">{c.source}</div>
                        {c.via ? <div className="t-xs c-4">via {c.via}</div> : null}
                      </Link>
                    </td>
                    <td><Link href={`/prototype/studio/clients/${c.id}`}><span className={`chip ${REP_CHIP[c.rep]}`}>{c.rep}</span></Link></td>
                    <td>
                      <Link href={`/prototype/studio/clients/${c.id}`}>
                        <div className="t-sm trunc" style={{ maxWidth: 220 }}>{c.next}</div>
                        <div className={`t-xs ${c.nextDue.startsWith("Overdue") || c.nextDue.startsWith("Tomorrow") ? "c-neg" : "c-4"}`}>{c.nextDue}</div>
                      </Link>
                    </td>
                    <td className="num-c num" style={{ paddingRight: 16 }}>
                      <Link href={`/prototype/studio/clients/${c.id}`}>{c.value}</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length === 0 ? (
            <div className="center" style={{ padding: "48px 24px" }}>
              <Ico.search size={22} className="c-4" />
              <p className="t-md w55" style={{ marginTop: 10 }}>No clients match</p>
              <button className="btn btn-g btn-sm" style={{ marginTop: 8 }} onClick={() => { setQ(""); setF("All"); }}>Clear filters</button>
            </div>
          ) : null}
        </div>
        ) : null}

        {view === "Board" ? (
          <>
            {/* Forward view. Weighted, because an unweighted pipeline forecast
                is a wish list, and a solo agent plans his year on this. */}
            {(() => {
              const rows = CLIENTS.filter((c) => c.stage !== "Closed")
                .map((c) => ({ name: c.name, stage: c.stage, value: dollars(c.value) }));
              const fc = forecast(rows);
              const totalW = fc.reduce((a, b) => a + b.weightedValue, 0);
              const pct = rules.commissionPct.value;
              const mix = evidenceMix([...new Set(rows.map((r) => r.stage))]);
              return (
                <div className="card" style={{ marginBottom: 14, overflow: "hidden" }}>
                  <div className="between wrap gap-2" style={{ padding: "12px 16px", borderBottom: "1px solid var(--line-2)" }}>
                    <span className="t-sm w6">Likely to close</span>
                    <span className="t-xs c-4">
                      Weighted by stage · {pct}% commission · {money(Math.round(commissionOn(totalW, pct)))} expected over four months
                    </span>
                  </div>
                  <div className="row" style={{ alignItems: "stretch" }}>
                    {fc.map((b, i) => (
                      <div key={b.month} className="grow" style={{ padding: "14px 16px", borderLeft: i ? "1px solid var(--line-3)" : undefined }}>
                        <div className="t-2xs c-4 w6" style={{ letterSpacing: ".07em", textTransform: "uppercase" }}>{b.month}</div>
                        <div className="row gap-2" style={{ alignItems: "baseline", marginTop: 5 }}>
                          <span className="num" style={{ fontSize: 21 }}>{b.expected}</span>
                          <span className="t-xs c-4">of {b.count}</span>
                        </div>
                        <div className="t-xs c-3" style={{ marginTop: 3 }}>
                          {b.weightedValue ? money(Math.round(commissionOn(b.weightedValue, pct))) : "—"}
                        </div>
                        <div className="t-2xs c-4 trunc" style={{ marginTop: 4 }}>
                          {b.names.length ? b.names.join(", ") : "Nothing expected"}
                        </div>
                        {b.count ? (
                          <span className={`chip ${BASIS_CHIP[b.basis].c}`} style={{ marginTop: 6 }}>
                            {BASIS_CHIP[b.basis].l}
                          </span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                  <div style={{ padding: "10px 16px", background: "var(--sunk)" }}>
                    <p className="t-xs c-4" style={{ lineHeight: 1.55 }}>
                      &ldquo;{fc[0].expected} of {fc[0].count}&rdquo; means the stages those relationships are
                      in historically produce that many closings. It is deliberately lower than the
                      headcount, and a forecast that matches the headcount is not a forecast.
                    </p>
                    <p className="t-xs c-4" style={{ marginTop: 6, lineHeight: 1.55 }}>
                      These odds used to be assumptions dressed up as his numbers. They now shrink
                      toward his own closed history and are labelled with what is behind them —
                      <span className="w6"> {mix.observed} from his history, {mix.blended} part-observed,
                      {" "}{mix.assumed} still assumed</span>. A stage needs twelve of his own outcomes
                      before it stops borrowing ours, because a solo agent forecasting from three
                      closings will believe a stage converts at 100%.
                    </p>
                    <div className="row wrap gap-2" style={{ marginTop: 8 }}>
                      {[...new Set(rows.map((r) => r.stage))].map((st) => {
                        const w = weightFor(st);
                        return (
                          <span key={st} className="chip" title={w.note}>
                            {st} · {Math.round(w.weight * 100)}%
                            <span className={`chip ${BASIS_CHIP[w.basis].c}`} style={{ marginLeft: 5 }}>{BASIS_CHIP[w.basis].l}</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}

          <div className="scroll-x">
            <div className="row gap-3" style={{ alignItems: "stretch", minWidth: 780 }}>
              {boardColumns().map((col) => (
                <div key={col.s} className="grow" style={{ minWidth: 150 }}>
                  <div className="between" style={{ marginBottom: 9 }}>
                    <span className="t-xs w6">{col.s}</span>
                    <span className="num t-xs c-4">{col.ids.length}</span>
                  </div>
                  <div className="col gap-2">
                    {col.ids.length === 0 ? (
                      <div style={{ border: "1px dashed var(--line)", borderRadius: 9, padding: "18px 10px", textAlign: "center" }}>
                        <span className="t-xs c-4">Empty</span>
                      </div>
                    ) : col.ids.map((id) => {
                      const c = CLIENTS.find((x) => x.id === id)!;
                      return (
                        <Link key={id} href={`/prototype/studio/clients/${id}`} className="card lift p-3" style={{ display: "block" }}>
                          <div className="row gap-2" style={{ marginBottom: 7 }}>
                            <div className="av av-sm" style={{ background: c.color }}>{c.av[0]}</div>
                            <span className="t-sm w55 trunc grow">{c.name}</span>
                          </div>
                          <div className="num t-sm">{c.value}</div>
                          <div className="t-xs c-4 trunc" style={{ marginTop: 3 }}>{c.next}</div>
                          {(() => {
                            const st = stallOf(c.stage, DAYS_IN_STAGE[c.id] ?? 0, c.flag, c.nextDue);
                            return (
                              <div className="row gap-1 wrap" style={{ marginTop: 8 }}>
                                <span className={`chip ${STALL_CHIP[st.level].c}`} title={`${st.reason} — ${st.unstick}`}>
                                  {st.level === "moving" ? <Ico.check size={10} /> : <Ico.clock size={10} />}
                                  {STALL_CHIP[st.level].l}
                                </span>
                                <span className="chip mono">{st.days}d / {st.normal}d</span>
                              </div>
                            );
                          })()}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* The stalls themselves, spelled out. A colour on a card is a hint;
              this is the list he can actually work through. */}
          {(() => {
            const stalls = CLIENTS
              .map((c) => ({ c, st: stallOf(c.stage, DAYS_IN_STAGE[c.id] ?? 0, c.flag, c.nextDue) }))
              .filter((x) => x.st.level !== "moving")
              .sort((a, b) => b.st.days / b.st.normal - a.st.days / a.st.normal);
            if (!stalls.length) return null;
            return (
              <div className="card" style={{ marginTop: 14, overflow: "hidden" }}>
                <div className="between" style={{ padding: "11px 16px", borderBottom: "1px solid var(--line-2)" }}>
                  <span className="t-sm w6">Stopped moving</span>
                  <span className="t-xs c-4">Worst overrun first</span>
                </div>
                {stalls.map(({ c, st }) => (
                  <div key={c.id} className="row gap-3" style={{ padding: "13px 16px", borderBottom: "1px solid var(--line-3)", alignItems: "flex-start" }}>
                    <span className="av" style={{ background: c.color, flex: "none" }}>{c.av}</span>
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="row gap-2 wrap">
                        <span className="t-md w55">{c.name}</span>
                        <span className={`chip ${STALL_CHIP[st.level].c}`}>{STALL_CHIP[st.level].l}</span>
                        <span className="chip mono">{st.days}d in {c.stage.toLowerCase()}</span>
                      </div>
                      <p className="t-sm c-2" style={{ marginTop: 5, lineHeight: 1.55 }}>{st.reason}</p>
                      <p className="t-xs c-4" style={{ marginTop: 3, lineHeight: 1.5 }}>{st.unstick}</p>
                    </div>
                    <Link href={`/prototype/studio/clients/${c.id}`} className="btn btn-s btn-sm" style={{ flex: "none" }}>
                      Open <Ico.arrowR size={13} />
                    </Link>
                  </div>
                ))}
              </div>
            );
          })()}
          </>
        ) : null}

        {view === "Sources" ? (
          <>
            <div className="g4 gap-3" style={{ marginBottom: 16 }}>
              {[["Advocacy share", "31%", "referral or repeat"], ["Booking rate", "27%", "snapshot to consult"],
                ["First touch", "9 min", "median"], ["Attribution", "97%", "known source"]].map(([l, v, n]) => (
                <div key={l} className="card p-4">
                  <div className="t-2xs c-4 w6" style={{ letterSpacing: ".07em", textTransform: "uppercase" }}>{l}</div>
                  <div className="num" style={{ fontSize: 24, marginTop: 6 }}>{v}</div>
                  <div className="t-xs c-4" style={{ marginTop: 2 }}>{n}</div>
                </div>
              ))}
            </div>
            <div className="card" style={{ overflow: "hidden" }}>
              <div className="between" style={{ padding: "12px 16px", borderBottom: "1px solid var(--line-2)" }}>
                <span className="t-sm w6">Where clients come from</span>
                <span className="t-xs c-4">Cost per client, not per lead</span>
              </div>
              <div className="scroll-x">
                <table className="tbl tbl-hov">
                  <thead><tr><th style={{ paddingLeft: 16 }}>Source</th><th>Volume</th><th className="num-c">Leads</th><th className="num-c">Consults</th><th className="num-c">Clients</th><th className="num-c">Spend</th><th className="num-c" style={{ paddingRight: 16 }}>Per client</th></tr></thead>
                  <tbody>
                    {SOURCES.map((x) => (
                      <tr key={x.s}>
                        <td className="w55" style={{ paddingLeft: 16 }}>{x.s}</td>
                        <td style={{ width: 150 }}><div className="meter"><i style={{ width: `${(x.leads / 62) * 100}%`, background: x.s === "Referral" ? "var(--pos)" : "var(--ink-4)" }} /></div></td>
                        <td className="num-c num">{x.leads}</td>
                        <td className="num-c num">{x.consults}</td>
                        <td className="num-c num">{x.clients}</td>
                        <td className="num-c num c-4">{x.spend ? `$${x.spend.toLocaleString()}` : "—"}</td>
                        <td className="num-c num w6" style={{ paddingRight: 16, color: x.per === "—" ? "var(--pos)" : undefined }}>{x.per}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : null}
      </StudioBody>
    </>
  );
}
