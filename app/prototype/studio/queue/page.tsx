"use client";

import { useEffect, useMemo, useState } from "react";
import { StudioHead, StudioBody } from "@/components/rift/Shell";
import { Ico } from "@/components/rift/icons";
import { Trust } from "@/components/rift/Trust";
import {
  SEQUENCES, sequenceFor, queue, nextFor, autonomy, STOPS, stopLabel,
  CHANNEL_LABEL, type Enrolment, type Channel,
} from "@/lib/core/nurture";
import {
  SEEDED, readAsked, clearAsked, openItems, overdue, promote, nextRung, ceilingNote,
  KIND_LABEL, REVIEW_SLA_HOURS, type ReviewItem,
} from "@/lib/core/review";
import { CROSSINGS, CARRY_LABEL, CARRY_CHIP, DRIFT_PCT, drift, mustDisclose, canPublish } from "@/lib/core/seam";
import { BAND_LABEL, BAND_TONE } from "@/lib/core/lead";
import { money } from "@/lib/core/compute";

const TABS = ["Follow-up", "Review", "Publishing"] as const;

const CH_ICON: Record<Channel, React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>> = {
  email: Ico.mail, text: Ico.send, call: Ico.bell, task: Ico.check,
};

/* Enrolments stand in for what the real build derives from the lead record and
   the sequence log. Deliberately mixed: two live, one stopped, one downgraded
   for want of phone consent — the three states an agent actually sees. */
const ENROLLED: Enrolment[] = [
  { leadId: "l1", name: "Tomas Reyes", band: "now", daysIn: 3, stopped: null, phoneConsent: true, done: ["n1", "n2"] },
  { leadId: "l2", name: "Alina Whitfield", band: "soon", daysIn: 11, stopped: null, phoneConsent: false, done: ["s1", "s2"] },
  { leadId: "l3", name: "Grant Mureithi", band: "now", daysIn: 7, stopped: "replied", phoneConsent: true, done: ["n1", "n2", "n3"] },
  { leadId: "l4", name: "Sasha Bell", band: "later", daysIn: 96, stopped: null, phoneConsent: false, done: ["l1", "l2"] },
  { leadId: "l5", name: "Ronit Shah", band: "nurture", daysIn: 31, stopped: null, phoneConsent: false, done: ["d1"] },
  { leadId: "l6", name: "Cassie Devlin", band: "soon", daysIn: 47, stopped: null, phoneConsent: true, done: ["s1", "s2", "s3", "s4"] },
];

export default function Queue() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Follow-up");
  return (
    <>
      <StudioHead
        title="Queue"
        sub="Everything waiting on a person rather than on the software"
        tabs={TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            height: 36, padding: "0 11px", fontSize: 13,
            fontWeight: tab === t ? 600 : 500, color: tab === t ? "var(--ink)" : "var(--ink-3)",
            borderBottom: `2px solid ${tab === t ? "var(--ink)" : "transparent"}`, marginBottom: -1,
          }}>{t}</button>
        ))}
      />
      <StudioBody>
        {tab === "Follow-up" ? <Cadence /> : null}
        {tab === "Review" ? <Review /> : null}
        {tab === "Publishing" ? <Publishing /> : null}
      </StudioBody>
    </>
  );
}

/* ================================================================== *
 * Follow-up
 * ================================================================== */

function Cadence() {
  const [rows, setRows] = useState(ENROLLED);
  const due = queue(rows);
  const send = (leadId: string, stepId: string) =>
    setRows((r) => r.map((e) => (e.leadId === leadId ? { ...e, done: [...e.done, stepId] } : e)));
  const stop = (leadId: string) =>
    setRows((r) => r.map((e) => (e.leadId === leadId ? { ...e, stopped: "replied" as const } : e)));

  const autoDue = due.filter((d) => d.step.auto).length;

  return (
    <div className="col gap-4">
      <div className="card p-4" style={{ background: "var(--sunk)" }}>
        <div className="between wrap gap-2">
          <div className="row gap-2">
            <Ico.refresh size={15} className="c-3" />
            <span className="t-sm w6">A band was a label. This is the thing that actually follows people up.</span>
          </div>
          <span className="chip">{autoDue} of {due.length} go out without him</span>
        </div>
        <p className="t-sm c-3" style={{ marginTop: 7, lineHeight: 1.6, maxWidth: 720 }}>
          Most of a solo agent&apos;s revenue is sitting in people who weren&apos;t ready the week
          they arrived and were never spoken to again. Every touch below has to carry something
          new — if a step has nothing to give, it shouldn&apos;t exist. A reply stops the whole
          sequence on the spot, because software that keeps sending after somebody answered
          proves there was never a person on this end.
        </p>
      </div>

      <div>
        <div className="between" style={{ marginBottom: 8 }}>
          <span className="t-sm w6">Due today</span>
          <span className="t-xs c-4">{due.length} touch{due.length === 1 ? "" : "es"}</span>
        </div>
        {due.length ? (
          <div className="card" style={{ overflow: "hidden" }}>
            {due.map((d, i) => {
              const I = CH_ICON[d.channel];
              return (
                <div key={d.e.leadId} className="row gap-3" style={{
                  padding: "12px 14px", alignItems: "flex-start",
                  borderBottom: i === due.length - 1 ? undefined : "1px solid var(--line-3)",
                }}>
                  <I size={15} className="c-3" style={{ marginTop: 3, flex: "none" }} />
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="row wrap gap-2">
                      <span className="t-sm w6">{d.e.name}</span>
                      <span className={`chip ${BAND_TONE[d.e.band]}`}>{BAND_LABEL[d.e.band]}</span>
                      <span className="chip">{CHANNEL_LABEL[d.channel]}</span>
                      {d.step.auto ? <span className="chip chip-pos"><Ico.bolt size={10} />Automatic</span> : <span className="chip chip-warn">Needs him</span>}
                      {d.late > 0 ? <span className="chip chip-neg">{d.late}d late</span> : null}
                    </div>
                    <p className="t-sm" style={{ marginTop: 5 }}>{d.step.says}</p>
                    <p className="t-xs c-3" style={{ marginTop: 4, lineHeight: 1.55 }}>
                      <span className="w6">Gives them: </span>{d.step.gives}
                    </p>
                    {d.downgraded ? (
                      <p className="t-xs c-4 row gap-2" style={{ marginTop: 6 }}>
                        <Ico.lock size={11} />{d.downgraded}
                      </p>
                    ) : null}
                  </div>
                  <div className="col gap-1" style={{ flex: "none" }}>
                    <button className="btn btn-p btn-sm" onClick={() => send(d.e.leadId, d.step.id)}>Send</button>
                    <button className="btn btn-g btn-sm" onClick={() => stop(d.e.leadId)}>They replied</button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="card p-5 center col gap-2">
            <Ico.checkCircle size={20} className="c-pos" />
            <span className="t-sm w55">Nothing owed today.</span>
            <span className="t-xs c-4">A cadence with an empty day is working. One that never empties is a treadmill.</span>
          </div>
        )}
      </div>

      <div>
        <div className="t-sm w6" style={{ marginBottom: 8 }}>Everyone enrolled</div>
        <div className="card" style={{ overflow: "hidden" }}>
          {rows.map((e, i) => {
            const nxt = nextFor(e);
            const seq = sequenceFor(e.band);
            return (
              <div key={e.leadId} className="between wrap gap-2" style={{
                padding: "11px 14px",
                borderBottom: i === rows.length - 1 ? undefined : "1px solid var(--line-3)",
                opacity: e.stopped ? 0.62 : 1,
              }}>
                <div style={{ minWidth: 0 }}>
                  <div className="row wrap gap-2">
                    <span className="t-sm w55">{e.name}</span>
                    <span className="chip">{seq.name}</span>
                    <span className="t-2xs c-4">{e.done.length}/{seq.steps.length} sent</span>
                  </div>
                  <p className="t-xs c-3" style={{ marginTop: 4 }}>
                    {e.stopped
                      ? <><span className="w6">Stopped — {stopLabel(e.stopped).label}.</span> {stopLabel(e.stopped).why}</>
                      : nxt ? <>Next in {nxt.inDays} day{nxt.inDays === 1 ? "" : "s"} — {nxt.step.says}</>
                      : seq.ends}
                  </p>
                </div>
                {e.stopped ? <span className="chip chip-neg"><Ico.pause size={10} />Stopped</span> : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="split">
        <div className="col gap-3">
          <div className="t-sm w6">The four sequences</div>
          {SEQUENCES.map((s) => {
            const a = autonomy(s.band);
            return (
              <div key={s.band} className="card p-4">
                <div className="between wrap gap-2">
                  <span className="t-sm w6">{s.name}</span>
                  <div className="row gap-2">
                    <span className={`chip ${BAND_TONE[s.band]}`}>{BAND_LABEL[s.band]}</span>
                    <span className="chip">{a.auto}/{a.total} automatic</span>
                  </div>
                </div>
                <p className="t-xs c-3" style={{ margin: "6px 0 10px", lineHeight: 1.6 }}>{s.why}</p>
                <div className="col gap-1">
                  {s.steps.map((st) => {
                    const I = CH_ICON[st.channel];
                    return (
                      <div key={st.id} className="row gap-2" style={{ padding: "6px 0", borderTop: "1px solid var(--line-3)" }}>
                        <span className="num t-2xs c-4" style={{ minWidth: 34 }}>Day {st.day}</span>
                        <I size={12} className="c-4" style={{ flex: "none" }} />
                        <span className="t-xs grow">{st.says}</span>
                        {st.auto ? <Ico.bolt size={11} className="c-pos" /> : <span className="t-2xs c-4">him</span>}
                      </div>
                    );
                  })}
                </div>
                <p className="t-2xs c-4" style={{ marginTop: 9 }}>{s.ends}</p>
              </div>
            );
          })}
        </div>
        <aside className="col gap-3">
          <div className="card p-4">
            <div className="t-sm w6" style={{ marginBottom: 8 }}>What stops a sequence</div>
            <div className="col gap-2">
              {STOPS.map((s) => (
                <div key={s.id}>
                  <div className="t-xs w6">{s.label}</div>
                  <p className="t-xs c-3" style={{ lineHeight: 1.5 }}>{s.why}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="card p-4" style={{ background: "var(--sunk)" }}>
            <div className="row gap-2" style={{ marginBottom: 6 }}>
              <Ico.lock size={13} className="c-3" />
              <span className="t-sm w6">Consent gates the channel</span>
            </div>
            <p className="t-xs c-3" style={{ lineHeight: 1.6 }}>
              No written phone consent means a text step becomes an email step. It does not
              mean silence, and it does not mean sending the text anyway. Two people in this
              queue are on that path right now.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ================================================================== *
 * Review — the surface that finally produces `pending-review`
 * ================================================================== */

function Review() {
  const [asked, setAsked] = useState<ReviewItem[]>([]);
  const [items, setItems] = useState<ReviewItem[]>(SEEDED);
  const [naming, setNaming] = useState<string | null>(null);
  const [who, setWho] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => setAsked(readAsked());
    sync();
    window.addEventListener("rift:review", sync);
    return () => window.removeEventListener("rift:review", sync);
  }, []);

  const all = useMemo(() => [...asked, ...items], [asked, items]);
  const open = openItems(all);
  const late = open.filter(overdue).length;

  const bump = (i: ReviewItem, confirmedBy?: string) => {
    const to = nextRung(i);
    if (!to) return;
    const r = promote(i, to, confirmedBy);
    if (!r.ok) { setErr(r.why); return; }
    setErr(null); setNaming(null); setWho("");
    setItems((rows) => rows.map((x) => (x.id === i.id ? r.item : x)));
    setAsked((rows) => rows.map((x) => (x.id === i.id ? r.item : x)));
  };

  return (
    <div className="col gap-4">
      <div className="card p-4" style={{ background: "var(--sunk)" }}>
        <div className="between wrap gap-2">
          <div className="row gap-2">
            <Ico.shield size={15} className="c-3" />
            <span className="t-sm w6">The rung of the trust ladder that had nowhere to come from</span>
          </div>
          {late ? <span className="chip chip-neg"><Ico.clock size={11} />{late} past {REVIEW_SLA_HOURS}h</span> : <span className="chip chip-pos">All inside {REVIEW_SLA_HOURS}h</span>}
        </div>
        <p className="t-sm c-3" style={{ marginTop: 7, lineHeight: 1.6, maxWidth: 720 }}>
          Every readout now carries a control that says <em>ask Kaleb to check this</em>, and it
          lands here. A figure moves up by an event, never by time passing — and not everything
          can reach the top. A lender&apos;s pre-approval can be verified. His opinion of a
          repair budget cannot be, ever, so the product does not offer a button that pretends
          otherwise.
        </p>
      </div>

      {err ? (
        <div className="card p-3 row gap-2" style={{ borderColor: "var(--neg)" }}>
          <Ico.alert size={14} className="c-neg" style={{ flex: "none", marginTop: 1 }} />
          <span className="t-sm">{err}</span>
        </div>
      ) : null}

      <div className="card" style={{ overflow: "hidden" }}>
        {all.map((i, ix) => {
          const to = nextRung(i);
          const cap = ceilingNote(i);
          return (
            <div key={i.id} style={{ padding: "13px 15px", borderBottom: ix === all.length - 1 ? undefined : "1px solid var(--line-3)" }}>
              <div className="between wrap gap-2">
                <div className="row wrap gap-2">
                  <span className="t-sm w6">{i.who}</span>
                  <span className="chip">{KIND_LABEL[i.kind]}</span>
                  <Trust state={i.state} short />
                  {overdue(i) ? <span className="chip chip-neg">{i.waitingHours}h waiting</span>
                    : i.state === "pending-review" ? <span className="chip">{i.waitingHours}h waiting</span> : null}
                  {i.raisedBy === "client" ? <span className="chip chip-acc">They asked</span> : null}
                  {i.raisedBy === "system" ? <span className="chip chip-warn">Rift flagged it</span> : null}
                </div>
                <span className="mono t-sm w6">{i.claim}</span>
              </div>
              <p className="t-sm" style={{ marginTop: 5 }}>{i.what}</p>
              <p className="t-xs c-3" style={{ marginTop: 4, lineHeight: 1.55 }}>
                <span className="w6">To advance: </span>{i.toAdvance}
              </p>
              {i.confirmedBy ? (
                <p className="t-xs c-3 row gap-2" style={{ marginTop: 6 }}>
                  <Ico.checkCircle size={11} className="c-pos" />Confirmed by {i.confirmedBy}
                </p>
              ) : null}

              {naming === i.id ? (
                <div className="row wrap gap-2" style={{ marginTop: 9 }}>
                  <input className="input" style={{ maxWidth: 320 }} autoFocus placeholder="Who confirmed it, and when"
                    value={who} onChange={(e) => setWho(e.target.value)} />
                  <button className="btn btn-p btn-sm" onClick={() => bump(i, who)}>Mark verified</button>
                  <button className="btn btn-g btn-sm" onClick={() => { setNaming(null); setErr(null); }}>Cancel</button>
                </div>
              ) : to ? (
                <div className="row wrap gap-2" style={{ marginTop: 9 }}>
                  <button className="btn btn-p btn-sm" onClick={() => (to === "verified" ? setNaming(i.id) : bump(i))}>
                    {to === "reviewed" ? "I have been through it" : to === "verified" ? "A lender confirmed it" : "Send for review"}
                  </button>
                  {to === "verified" ? <span className="t-2xs c-4">Needs a name — an unsigned verification is still an estimate.</span> : null}
                </div>
              ) : (
                <p className="t-xs c-4 row gap-2" style={{ marginTop: 8 }}><Ico.info size={11} />{cap}</p>
              )}
            </div>
          );
        })}
      </div>

      {asked.length ? (
        <div className="between wrap gap-2">
          <span className="t-xs c-4">{asked.length} of these came from the live readout in this browser.</span>
          <button className="btn btn-g btn-sm" onClick={() => { clearAsked(); setAsked([]); }}>Clear the ones I raised</button>
        </div>
      ) : (
        <p className="t-xs c-4">
          Open a readout, press <span className="w6">Ask Kaleb to check this</span>, and the item appears at the top of this queue.
        </p>
      )}
    </div>
  );
}

/* ================================================================== *
 * Publishing — the readout → plan seam
 * ================================================================== */

const DRIFTS = [
  drift("Cash to close", 31190, 32410, "Rate moved 0.25% since 24 Aug, which moves the prepaid interest and the escrow set-up."),
  drift("Matched assistance", 10000, 10000, "No change. Georgia Dream limits were re-checked on 4 Sep."),
  drift("Monthly at target", 2357, 2388, "Same cause as the cash figure."),
];

function Publishing() {
  const [disclosed, setDisclosed] = useState(false);
  const [agreement, setAgreement] = useState(false);
  const material = mustDisclose(DRIFTS);
  const check = canPublish({
    hasAgreement: agreement, hasSnapshot: true, drifts: DRIFTS, disclosed,
    trustStates: ["preliminary", "pending-review", "preliminary"],
  });

  return (
    <div className="col gap-4">
      <div className="card p-4" style={{ background: "var(--sunk)" }}>
        <div className="row gap-2">
          <Ico.layers size={15} className="c-3" />
          <span className="t-sm w6">What happens to a free readout when it becomes a paid plan</span>
        </div>
        <p className="t-sm c-3" style={{ marginTop: 7, lineHeight: 1.6, maxWidth: 720 }}>
          This was the undefined moment, and it is the expensive one: it is where a stranger
          becomes a client, and the only place two systems hold an opinion about the same number.
          The readout they were given is frozen and kept forever, because a document that
          rewrites itself was never theirs. The plan recalculates — and when it disagrees with
          what they were shown, it has to say so out loud.
        </p>
      </div>

      <div className="split">
        <div className="col gap-3">
          <div className="t-sm w6">Publishing Maya Ellison&apos;s plan</div>
          <div className="card p-4">
            <div className="between" style={{ marginBottom: 10 }}>
              <span className="t-sm w6">Figures that moved since her readout</span>
              <span className="chip">Threshold {DRIFT_PCT}%</span>
            </div>
            <div className="col gap-2">
              {DRIFTS.map((d) => (
                <div key={d.field} style={{ padding: "8px 0", borderTop: "1px solid var(--line-3)" }}>
                  <div className="between wrap gap-2">
                    <span className="t-sm w55">{d.field}</span>
                    <span className="row gap-2">
                      <span className="mono t-xs c-4" style={{ textDecoration: d.material ? "line-through" : undefined }}>{money(d.was)}</span>
                      <Ico.arrowR size={11} className="c-4" />
                      <span className="mono t-sm w6">{money(d.now)}</span>
                      <span className={`chip ${d.material ? "chip-warn" : "chip-pos"}`}>
                        {d.deltaPct > 0 ? "+" : ""}{d.deltaPct}%
                      </span>
                    </span>
                  </div>
                  <p className="t-xs c-3" style={{ marginTop: 3, lineHeight: 1.5 }}>{d.cause}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-4">
            <div className="t-sm w6" style={{ marginBottom: 9 }}>Before it can go out</div>
            <div className="col gap-2">
              <label className="opt" data-on={agreement}>
                <input type="checkbox" checked={agreement} onChange={() => setAgreement(!agreement)} />
                <div>
                  <div className="t-sm w55">Representation agreement signed</div>
                  <p className="t-xs c-3">Publishing a plan first is the wrong order, and in most cases the wrong side of the line.</p>
                </div>
              </label>
              <label className="opt" data-on={disclosed}>
                <input type="checkbox" checked={disclosed} onChange={() => setDisclosed(!disclosed)} />
                <div>
                  <div className="t-sm w55">She has been shown what changed, and why</div>
                  <p className="t-xs c-3">
                    {material.length} figure{material.length === 1 ? " moved" : "s moved"} more than {DRIFT_PCT}%. Replacing a
                    number she has already told her partner is how you lose a client in one screen.
                  </p>
                </div>
              </label>
            </div>

            <div className="col gap-2" style={{ marginTop: 12 }}>
              {check.blocks.map((b) => (
                <p key={b} className="t-xs row gap-2"><Ico.x size={12} className="c-neg" style={{ flex: "none", marginTop: 1 }} />{b}</p>
              ))}
              {check.warns.map((w) => (
                <p key={w} className="t-xs c-3 row gap-2"><Ico.alert size={12} className="c-warn" style={{ flex: "none", marginTop: 1 }} />{w}</p>
              ))}
            </div>

            <button className="btn btn-p" disabled={!check.ok} style={{ marginTop: 12, width: "100%" }}>
              {check.ok ? "Publish the plan" : `${check.blocks.length} thing${check.blocks.length === 1 ? "" : "s"} in the way`}
            </button>
          </div>
        </div>

        <aside>
          <div className="card" style={{ overflow: "hidden" }}>
            <div className="t-sm w6" style={{ padding: "11px 14px", borderBottom: "1px solid var(--line-2)" }}>
              What crosses, and what does not
            </div>
            {CROSSINGS.map((c, i) => (
              <div key={c.field} style={{ padding: "10px 14px", borderBottom: i === CROSSINGS.length - 1 ? undefined : "1px solid var(--line-3)" }}>
                <div className="between wrap gap-2">
                  <span className="t-xs w6">{c.field}</span>
                  <span className={`chip ${CARRY_CHIP[c.carry]}`}>{CARRY_LABEL[c.carry]}</span>
                </div>
                <p className="t-xs c-3" style={{ marginTop: 3, lineHeight: 1.5 }}>{c.why}</p>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
