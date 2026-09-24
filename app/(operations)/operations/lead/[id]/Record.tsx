"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { STAGE_NAMES, STALL_CHIP, type LeadNote, type ManagedLead, type NoteKind, type Stage } from "@/lib/core/pipeline";
import { logContact, moveStage, archive, planNextAction } from "../../actions";

const KINDS: { id: NoteKind; label: string }[] = [
  { id: "call", label: "Call" },
  { id: "text", label: "Text" },
  { id: "email", label: "Email" },
  { id: "meeting", label: "Met" },
  { id: "note", label: "Note" },
];

const KIND_LABEL: Record<NoteKind, string> = {
  call: "Call", text: "Text", email: "Email", meeting: "Met", note: "Note", stage: "Moved",
};

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

const daysSince = (iso: string | null) =>
  iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000) : null;

export function Record({ lead, notes }: { lead: ManagedLead; notes: LeadNote[] }) {
  const [pending, start] = useTransition();
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<NoteKind>("call");
  const [error, setError] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [reason, setReason] = useState("");
  const [action, setAction] = useState("");
  const [due, setDue] = useState("");

  const plan = () => {
    if (!action.trim() || !due) return;
    setError(null);
    start(async () => {
      const r = await planNextAction(lead.id, action, due);
      if (!r.ok) { setError(r.error); return; }
      setAction(""); setDue("");
    });
  };

  const done = () => {
    setError(null);
    start(async () => {
      const r = await planNextAction(lead.id, null, null, `Done: ${lead.nextAction}`);
      if (!r.ok) setError(r.error);
    });
  };

  const save = () => {
    if (!body.trim()) return;
    setError(null);
    start(async () => {
      const r = await logContact(lead.id, kind, body);
      if (!r.ok) { setError(r.error); return; }
      setBody("");
    });
  };

  const move = (stage: Stage) => {
    setError(null);
    start(async () => {
      const r = await moveStage(lead.id, stage);
      if (!r.ok) setError(r.error);
    });
  };

  const doArchive = () => {
    if (!reason.trim()) return;
    setError(null);
    start(async () => {
      const r = await archive(lead.id, reason);
      if (!r.ok) { setError(r.error); return; }
      setArchiving(false);
      setReason("");
    });
  };

  const inStage = daysSince(lead.stageSince);

  /* Compared as dates, not timestamps. An action due today is not overdue at
     nine in the morning because the row was written at five last night. */
  const today = new Date().toISOString().slice(0, 10);
  const overdue = Boolean(lead.nextDue && lead.nextDue < today);
  const dueLabel = !lead.nextDue
    ? ""
    : lead.nextDue === today
      ? "today"
      : overdue
        ? `overdue since ${new Date(lead.nextDue + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
        : new Date(lead.nextDue + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <main className="shell-w" style={{ paddingTop: 26, paddingBottom: 80 }}>
      <Link href="/operations" className="t-sm c-3">← Operations</Link>

      <header className="between wrap gap-3" style={{ marginTop: 14 }}>
        <div>
          <h1 className="serif" style={{ fontSize: "clamp(24px,3vw,34px)", letterSpacing: "-0.02em" }}>
            {lead.name ?? lead.email ?? "Unnamed"}
          </h1>
          <div className="row gap-2 wrap" style={{ marginTop: 8 }}>
            <span className="chip">{lead.side === "buy" ? "Buyer" : "Seller"}</span>
            {lead.source !== "funnel" ? <span className="chip">Added by hand</span> : <span className="chip">From the funnel</span>}
            {lead.stall ? (
              <span className={`chip ${STALL_CHIP[lead.stall.level].c}`}>{STALL_CHIP[lead.stall.level].l}</span>
            ) : null}
            {lead.archivedAt ? <span className="chip chip-warn">Archived</span> : null}
          </div>
        </div>
        <div className="row gap-3 wrap">
          {lead.phone ? <a href={`tel:${lead.phone}`} className="btn btn-p">{lead.phone}</a> : null}
          {lead.email ? <a href={`mailto:${lead.email}`} className="btn btn-p">{lead.email}</a> : null}
        </div>
      </header>

      {lead.archivedAt ? (
        <div className="card p-4" style={{ marginTop: 16, background: "var(--sunk)" }}>
          <div className="t-sm w6">Archived {when(lead.archivedAt)}</div>
          <p className="t-sm c-3" style={{ marginTop: 4 }}>{lead.archivedReason}</p>
        </div>
      ) : null}

      {error ? (
        <div className="card p-4" style={{ marginTop: 16, borderColor: "var(--neg)" }}>
          <div className="t-sm w6">That did not save.</div>
          <p className="t-sm c-3" style={{ marginTop: 4 }}>{error}</p>
        </div>
      ) : null}

      <div className="grid-2 gap-4" style={{ marginTop: 24, alignItems: "start" }}>
        {/* Left: where they are, and the history */}
        <div>
          <section className="card p-5">
            <div className="between wrap gap-2">
              <div className="t-md w6">Where they are</div>
              {inStage !== null ? (
                <span className="t-xs c-4">{inStage === 0 ? "moved today" : `${inStage} day${inStage === 1 ? "" : "s"} here`}</span>
              ) : null}
            </div>

            {lead.stall && lead.stall.level !== "moving" ? (
              <div style={{ marginTop: 10 }}>
                <p className="t-sm c-3" style={{ lineHeight: 1.6 }}>{lead.stall.reason}</p>
                <p className="t-sm w5" style={{ marginTop: 6, lineHeight: 1.6 }}>{lead.stall.unstick}</p>
              </div>
            ) : null}

            <div className="row gap-2 wrap" style={{ marginTop: 14 }}>
              {STAGE_NAMES.map((s) => (
                <button
                  key={s}
                  className={`btn btn-sm ${s === lead.stage ? "btn-p" : "btn-s"}`}
                  disabled={pending || Boolean(lead.archivedAt)}
                  onClick={() => move(s as Stage)}
                >
                  {s}
                </button>
              ))}
            </div>
          </section>

          <section style={{ marginTop: 22 }}>
            <div className="t-md w6">What has been said</div>
            {notes.length === 0 ? (
              <div className="card p-4" style={{ marginTop: 10, background: "var(--sunk)" }}>
                <p className="t-sm c-3" style={{ lineHeight: 1.6 }}>
                  Nothing recorded yet. The first note is usually everything you already know
                  about them. It is worth two minutes now and unrecoverable later.
                </p>
              </div>
            ) : (
              <div className="card" style={{ marginTop: 10, overflow: "hidden" }}>
                {notes.map((n, i) => (
                  <div key={n.id} style={{
                    padding: "13px 17px",
                    borderBottom: i === notes.length - 1 ? undefined : "1px solid var(--line-3)",
                    background: n.kind === "stage" ? "var(--sunk)" : undefined,
                  }}>
                    <div className="between wrap gap-2">
                      <span className="t-xs c-4 w6" style={{ letterSpacing: ".05em", textTransform: "uppercase" }}>
                        {KIND_LABEL[n.kind]}
                      </span>
                      <span className="t-xs c-4">{when(n.at)}</span>
                    </div>
                    <p className="t-sm" style={{ marginTop: 5, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{n.body}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right: what is owed, then record something */}
        <div>
          <section className="card p-5" style={{ marginBottom: 18 }}>
            <div className="t-md w6">What you owe them next</div>
            {lead.nextAction ? (
              <div style={{ marginTop: 10 }}>
                <div className="between wrap gap-2">
                  <span className="t-sm w6 grow" style={{ minWidth: 180 }}>{lead.nextAction}</span>
                  <span className={`chip ${overdue ? "chip-neg" : "chip-pos"}`} style={{ flex: "none" }}>
                    {dueLabel}
                  </span>
                </div>
                <button className="btn btn-p btn-sm" style={{ marginTop: 12 }} disabled={pending} onClick={done}>
                  {pending ? "Saving…" : "Done"}
                </button>
              </div>
            ) : (
              <>
                <p className="t-sm c-3" style={{ marginTop: 6, lineHeight: 1.6 }}>
                  Nothing scheduled. One thing at a time: a queue of six things owed to the same
                  person is a queue nobody works.
                </p>
                <input
                  className="input"
                  style={{ marginTop: 12 }}
                  aria-label="The next thing to do"
                  placeholder="Call about the Oakhurst listing"
                  value={action}
                  onChange={(e) => setAction(e.target.value)}
                  disabled={pending || Boolean(lead.archivedAt)}
                />
                <input
                  className="input"
                  type="date"
                  aria-label="When it is due"
                  style={{ marginTop: 10 }}
                  value={due}
                  onChange={(e) => setDue(e.target.value)}
                  disabled={pending || Boolean(lead.archivedAt)}
                />
                <button
                  className="btn btn-p"
                  style={{ width: "100%", marginTop: 10 }}
                  disabled={pending || !action.trim() || !due || Boolean(lead.archivedAt)}
                  onClick={plan}
                >
                  Schedule it
                </button>
              </>
            )}
          </section>

          <section className="card p-5">
            <div className="t-md w6">Record what happened</div>
            <div className="row gap-2 wrap" style={{ marginTop: 12 }}>
              {KINDS.map((k) => (
                <button
                  key={k.id}
                  className={`btn btn-sm ${kind === k.id ? "btn-p" : "btn-s"}`}
                  onClick={() => setKind(k.id)}
                  disabled={pending}
                >
                  {k.label}
                </button>
              ))}
            </div>
            <textarea
              className="input"
              rows={5}
              style={{ marginTop: 12, resize: "vertical", lineHeight: 1.55 }}
              placeholder="Pre-approved to 340. Wants Decatur, needs to be in before the school year. Wife is the decider."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={pending || Boolean(lead.archivedAt)}
            />
            <button
              className="btn btn-p"
              style={{ width: "100%", marginTop: 10 }}
              disabled={pending || !body.trim() || Boolean(lead.archivedAt)}
              onClick={save}
            >
              {pending ? "Saving…" : "Save it"}
            </button>
            <p className="t-xs c-4" style={{ marginTop: 10, lineHeight: 1.55 }}>
              Notes cannot be edited or deleted afterwards. The point of a record is that it says
              what was true at the time.
            </p>
          </section>

          <section className="card p-5" style={{ marginTop: 18 }}>
            <div className="t-md w6">Details</div>
            <dl className="col gap-2" style={{ marginTop: 10 }}>
              <Row k="Added" v={when(lead.createdAt)} />
              {lead.contactBasis ? <Row k="Why you can contact them" v={lead.contactBasis} /> : null}
              {lead.score !== null ? <Row k="Funnel score" v={`${lead.score} (${lead.band})`} /> : null}
            </dl>
          </section>

          {!lead.archivedAt ? (
            <section style={{ marginTop: 18 }}>
              {archiving ? (
                <div className="card p-4">
                  <div className="t-sm w6">Why are you archiving them?</div>
                  <input
                    className="input"
                    style={{ marginTop: 8 }}
                    placeholder="Bought with another agent"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                  <div className="row gap-2" style={{ marginTop: 10 }}>
                    <button className="btn btn-p btn-sm" disabled={pending || !reason.trim()} onClick={doArchive}>Archive</button>
                    <button className="btn btn-g btn-sm" onClick={() => setArchiving(false)}>Cancel</button>
                  </div>
                  <p className="t-xs c-4" style={{ marginTop: 10, lineHeight: 1.55 }}>
                    Archiving takes them off the board. Nothing is deleted, and the record stays.
                  </p>
                </div>
              ) : (
                <button className="btn btn-g btn-sm" onClick={() => setArchiving(true)}>Archive this record</button>
              )}
            </section>
          ) : null}
        </div>
      </div>
    </main>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="between wrap gap-2">
      <dt className="t-sm c-4">{k}</dt>
      <dd className="t-sm w5" style={{ textAlign: "right", maxWidth: 240 }}>{v}</dd>
    </div>
  );
}
