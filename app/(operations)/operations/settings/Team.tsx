"use client";

import { useState } from "react";
import { Ico } from "@/components/rift/icons";
import { COORDINATOR_CAN, COORDINATOR_CANNOT, MEMBER_STATE_LABEL, memberError, memberState, type TeamMember } from "@/lib/core/team";
import { useWrite } from "../journey/[id]/useWrite";

const DAY = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const TONE = { invited: "chip-warn", active: "chip-pos", removed: "" } as const;
const ICON = { invited: "clock", active: "checkCircle", removed: "x" } as const;

/**
 * The team (Blueprint v5 §8.7): add a coordinator, send them the link,
 * remove them with a reason. Adding someone sends nothing: the agent sends
 * the link himself, from his own email, which is also how he knows it went
 * (AUTO-01).
 */
export function Team({ members, unavailable, agentName }: { members: TeamMember[]; unavailable: string | null; agentName: string }) {
  const { busy, error, write } = useWrite(members.map((m) => `${m.id}:${memberState(m)}`).join("|"), "/api/operations/team");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const add = async () => {
    const bad = memberError({ name, email });
    if (bad) { setProblem(bad); return; }
    setProblem(null);
    const r = await write("team-add", { name, email }, { reload: false });
    if (r.ok) { setLink(String(r.link ?? "")); setAdding(false); setName(""); setEmail(""); }
  };

  return (
    <div className="col gap-3">
      <div className="card" style={{ overflow: "hidden" }}>
        <div className="between wrap gap-2" style={{ padding: "12px 16px", borderBottom: "1px solid var(--line-3)" }}>
          <span className="col" style={{ gap: 2 }}>
            <span className="t-sm w6">{agentName}</span>
            <span className="t-xs c-3">The agent. Everything, and the only one who can change who does what.</span>
          </span>
          <span className="chip t-2xs">You</span>
        </div>
        {members.map((m) => {
          const st = memberState(m);
          const I = Ico[ICON[st]];
          return (
            <div key={m.id} style={{ padding: "12px 16px", borderBottom: "1px solid var(--line-3)" }}>
              <div className="between wrap gap-2">
                <span className="col" style={{ gap: 2, minWidth: 0 }}>
                  <span className={`t-sm w6 ${st === "removed" ? "c-4" : ""}`}>{m.name}</span>
                  <span className="t-xs c-3" style={{ overflowWrap: "anywhere" }}>
                    Coordinator · {m.email} · added {DAY(m.invitedAt)}
                    {m.acceptedAt ? ` · first signed in ${DAY(m.acceptedAt)}` : ""}
                    {m.revokedAt ? ` · removed ${DAY(m.revokedAt)}: ${m.revokedReason}` : ""}
                  </span>
                </span>
                <span className="row gap-2">
                  <span className={`chip t-2xs ${TONE[st]}`}><I size={10} aria-hidden /> {MEMBER_STATE_LABEL[st]}</span>
                  {st !== "removed" && removing !== m.id ? (
                    <button className="btn btn-g btn-sm" onClick={() => { setRemoving(m.id); setReason(""); }}>Remove</button>
                  ) : null}
                </span>
              </div>
              {removing === m.id ? (
                <div className="row gap-2 wrap" style={{ marginTop: 10 }}>
                  <input className="input" placeholder="Why, for the record" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} style={{ flex: "1 1 220px" }} aria-label={`Why ${m.name} is being removed`} />
                  <button className="btn btn-s btn-sm" disabled={busy || !reason.trim()}
                    onClick={async () => { const r = await write("team-remove", { memberId: m.id, reason }); if (r.ok) setRemoving(null); }}>
                    {busy ? "Removing…" : "Remove"}
                  </button>
                  <button className="btn btn-g btn-sm" onClick={() => setRemoving(null)}>Cancel</button>
                </div>
              ) : null}
            </div>
          );
        })}
        {!members.length ? <p className="t-sm c-3" style={{ padding: "12px 16px" }}>Nobody else yet.</p> : null}
      </div>

      {unavailable ? <p className="t-xs c-warn">{unavailable}</p> : null}
      {error ? <p role="alert" className="t-xs c-neg">{error}</p> : null}
      {link ? (
        <div className="card p-4" style={{ borderColor: "var(--pos-line, var(--line))" }}>
          <p className="t-sm w6"><Ico.checkCircle size={13} className="c-pos" aria-hidden /> Added. Nothing has been sent.</p>
          <p className="t-sm c-3" style={{ marginTop: 6, lineHeight: 1.55 }}>
            Send them this link yourself. They sign in there with the address you gave, and see only the coordinator&apos;s steps.
          </p>
          <code className="t-sm" style={{ display: "block", marginTop: 8, padding: "8px 10px", background: "var(--sunk)", borderRadius: 6, overflowWrap: "anywhere" }}>{link}</code>
        </div>
      ) : null}

      {adding ? (
        <form className="card p-4 col gap-3" onSubmit={(e) => { e.preventDefault(); void add(); }}>
          <span className="t-sm w6">Add a coordinator</span>
          <label className="t-xs">Name<input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} style={{ marginTop: 4 }} /></label>
          <label className="t-xs">Email they will sign in with<input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} style={{ marginTop: 4 }} /></label>
          {problem ? <p role="alert" className="t-xs c-neg">{problem}</p> : null}
          <span className="row gap-2">
            <button className="btn btn-p btn-sm" disabled={busy}>{busy ? "Adding…" : "Add"}</button>
            <button type="button" className="btn btn-g btn-sm" onClick={() => setAdding(false)}>Cancel</button>
          </span>
        </form>
      ) : !unavailable ? (
        <button className="btn btn-s btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => { setAdding(true); setLink(null); }}>
          <Ico.plus size={12} aria-hidden /> Add a coordinator
        </button>
      ) : null}

      <div className="grid-2 gap-3" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
        <div>
          <p className="t-xs w6">A coordinator can</p>
          <ul className="t-xs c-3" style={{ margin: "4px 0 0", paddingLeft: 16, lineHeight: 1.6 }}>{COORDINATOR_CAN.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
        <div>
          <p className="t-xs w6">A coordinator cannot</p>
          <ul className="t-xs c-3" style={{ margin: "4px 0 0", paddingLeft: 16, lineHeight: 1.6 }}>{COORDINATOR_CANNOT.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
      </div>
    </div>
  );
}
