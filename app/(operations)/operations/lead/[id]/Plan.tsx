"use client";

import { useState, useTransition } from "react";
import { Ico } from "@/components/rift/icons";
import { ownerLabel, type Owner, type PlanItem } from "@/lib/core/plan";
import { openClientPlan, closeClientPlan, addStep, tickStep, dropStep, addMoveInSteps } from "../../actions";
import type { Drift } from "@/lib/core/seam";

/**
 * The agent's end of the client's own page.
 *
 * Two things, kept apart on purpose.
 *
 * The LINK is a decision: opening one means somebody outside this product can
 * read a page about themselves, and closing it breaks every copy at once. It
 * is not a toggle to flick past on the way to something else, so closing asks.
 *
 * The STEPS are ordinary work. Written to be read by the client, which is the
 * whole difference between this and the note log above it: a note is the
 * agent's record, including his judgement about somebody, and the moment those
 * two surfaces blur he stops writing honestly in either.
 */
export function Plan({ leadId, items, token, origin, agentFirst, clientFirst }: {
  leadId: string;
  items: PlanItem[];
  token: string | null;
  /** Null when NEXT_PUBLIC_SITE_URL is unset: there is then no link to give out. */
  origin: string | null;
  agentFirst: string;
  /* Both names, because ownerLabel renders in the second person and "You"
     means a different person on this page than on theirs. */
  clientFirst: string | null;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(token);
  const [copied, setCopied] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  /* What moved since their readout, held until the agent has seen it. Publishing
     is blocked while this has anything in it and `disclosed` is false. */
  const [drifts, setDrifts] = useState<Drift[]>([]);
  const [warns, setWarns] = useState<string[]>([]);

  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState<Owner>("client");
  const [ownerName, setOwnerName] = useState("");
  const [dueOn, setDueOn] = useState("");

  /* Both halves required. A copy button that hands over "null/plan/abc" is
     worse than no button: the agent sends it, the client opens nothing, and
     the first person to find out is the client. */
  const url = link && origin ? `${origin}/plan/${link}` : null;

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) { setError(r.error ?? "that did not work"); return; }
      setError(null);
      after?.();
    });

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* Clipboard access can be refused, and a button that says "Copied" when
         nothing was copied is how somebody pastes an empty message. */
      setError("Could not copy. Select the link and copy it by hand.");
    }
  };

  return (
    <section className="card p-4" style={{ marginTop: 18 }}>
      <div className="between gap-2 wrap">
        <div>
          <div className="t-md w6">Their plan</div>
          <div className="t-xs c-4" style={{ marginTop: 2 }}>
            A page they can open. What is agreed, who owes it, and by when.
          </div>
        </div>

        {!link ? (
          <button className="btn btn-p btn-sm" disabled={pending}
            onClick={() => start(async () => {
              const r = await openClientPlan(leadId, false);
              if (r.ok) { setLink(r.token); setWarns(r.warns ?? []); setDrifts([]); setError(null); return; }
              /* A refusal because figures moved is not an error to print above
                 the panel that is about to list them: printing both says the
                 same thing twice and buries the part he can act on. */
              const moved = r.drifts ?? [];
              setDrifts(moved);
              setError(moved.length ? null : r.error);
            })}>
            <Ico.share size={14} />Open their page
          </button>
        ) : null}
      </div>

      {error ? <p className="t-xs c-neg" style={{ marginTop: 10 }}>{error}</p> : null}

      {/* The disclosure. Publishing stops here until he has seen what moved:
          not as a warning he can scroll past, but as the thing standing
          between him and the button. A client who was shown one number and
          opens a plan showing another has no way to know which was wrong, and
          the fix is not to be more accurate, it is to say what changed. */}
      {drifts.length ? (
        <div className="card p-4" style={{ marginTop: 12, background: "var(--warn-wash)", borderColor: "var(--warn-line)" }}>
          <div className="row gap-2">
            <Ico.alert size={15} className="c-warn" style={{ flex: "none", marginTop: 2 }} />
            <div className="grow">
              <div className="t-sm w6">
                {drifts.length === 1 ? "One figure has" : `${drifts.length} figures have`} moved since their readout.
              </div>
              <p className="t-xs c-3" style={{ marginTop: 4, lineHeight: 1.55 }}>
                They have already been shown these numbers and may well have repeated them to
                somebody. Tell them what changed and why, then publish.
              </p>

              <div className="col gap-1" style={{ marginTop: 10 }}>
                {drifts.map((d) => (
                  <div key={d.field} className="t-xs" style={{ lineHeight: 1.5 }}>
                    <span className="w6">{d.field}</span>{" "}
                    <span className="num">${d.was.toLocaleString()}</span>
                    {" → "}
                    <span className="num w6">${d.now.toLocaleString()}</span>{" "}
                    <span className="c-3">
                      ({d.deltaPct > 0 ? "+" : ""}{d.deltaPct}%, {d.cause})
                    </span>
                  </div>
                ))}
              </div>

              <button className="btn btn-p btn-sm" style={{ marginTop: 12 }} disabled={pending}
                onClick={() => run(async () => {
                  const r = await openClientPlan(leadId, true);
                  if (r.ok) { setLink(r.token); setWarns(r.warns ?? []); setDrifts([]); }
                  return r;
                })}>
                I have told them, publish
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {warns.length ? (
        <div style={{ marginTop: 10 }}>
          {warns.map((w) => (
            <p key={w} className="t-xs c-warn" style={{ lineHeight: 1.55 }}>{w}</p>
          ))}
        </div>
      ) : null}

      {link && !origin ? (
        <p className="t-xs c-warn" style={{ marginTop: 10, lineHeight: 1.6 }}>
          The page is open, but this deployment has no site address configured, so there is no
          link to give out. Set NEXT_PUBLIC_SITE_URL and it will appear here.
        </p>
      ) : null}

      {url ? (
        <div className="col gap-2" style={{ marginTop: 14 }}>
          <div className="row gap-2 wrap" style={{
            padding: "9px 12px", borderRadius: 8, background: "var(--sunk)", border: "1px solid var(--line-2)",
          }}>
            <Ico.share size={13} className="c-4" style={{ flex: "none" }} />
            <code className="t-xs grow" style={{
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0,
            }}>{url}</code>
            <button className="btn btn-g btn-sm" onClick={copy} style={{ flex: "none" }}>
              {copied ? <><Ico.check size={13} />Copied</> : "Copy"}
            </button>
          </div>

          <div className="row gap-2 wrap">
            <a href={url} target="_blank" rel="noreferrer" className="t-xs c-3">
              Open it as they will see it
            </a>
            <span className="spacer" />
            {!confirmClose ? (
              <button className="t-xs c-4" onClick={() => setConfirmClose(true)}>Close this link</button>
            ) : (
              <span className="row gap-2">
                {/* Asked, because it cannot be undone for anybody holding the
                    old link: including people they forwarded it to. */}
                <span className="t-xs c-3">Break every copy of this link?</span>
                <button className="btn btn-g btn-sm" onClick={() => setConfirmClose(false)}>No</button>
                <button className="btn btn-s btn-sm" disabled={pending}
                  onClick={() => run(() => closeClientPlan(leadId), () => { setLink(null); setConfirmClose(false); })}>
                  Close it
                </button>
              </span>
            )}
          </div>
        </div>
      ) : (
        <p className="t-xs c-4" style={{ marginTop: 12, lineHeight: 1.6, maxWidth: 520 }}>
          Nothing is shared until you open one. You can write the steps first and send the link
          when it is worth reading.
        </p>
      )}

      {/* The steps. Visible whether or not a link is open: writing the plan
          and deciding to share it are separate decisions. */}
      <div className="col gap-1" style={{ marginTop: 18 }}>
        {items.length === 0 ? (
          <p className="t-xs c-4">No steps yet.</p>
        ) : items.map((item) => (
          <div key={item.id} className="between gap-2" style={{
            padding: "9px 0", borderBottom: "1px solid var(--line-3)", alignItems: "flex-start",
          }}>
            <div className="row gap-2" style={{ alignItems: "flex-start", minWidth: 0 }}>
              <button
                aria-label={item.doneAt ? "Mark not done" : "Mark done"}
                aria-pressed={Boolean(item.doneAt)}
                disabled={pending}
                onClick={() => run(() => tickStep(leadId, item.id, !item.doneAt))}
                style={{
                  flex: "none", marginTop: 1, width: 18, height: 18, borderRadius: 5,
                  border: "1px solid var(--line)", display: "grid", placeItems: "center",
                  background: item.doneAt ? "var(--pos-wash)" : "var(--paper)",
                }}>
                {item.doneAt ? <Ico.check size={12} className="c-pos" /> : null}
              </button>
              <div style={{ minWidth: 0 }}>
                <div className="t-sm" style={{
                  lineHeight: 1.45,
                  textDecoration: item.doneAt ? "line-through" : undefined,
                  color: item.doneAt ? "var(--ink-4)" : undefined,
                }}>{item.title}</div>
                <div className="t-2xs c-4" style={{ marginTop: 2 }}>
                  {ownerLabel(item, { agent: agentFirst, client: clientFirst }, "agent")}{item.dueOn ? ` · ${item.dueOn}` : " · no date"}
                </div>
              </div>
            </div>
            <button className="t-2xs c-4" disabled={pending} style={{ flex: "none" }}
              onClick={() => run(() => dropStep(leadId, item.id))}>Remove</button>
          </div>
        ))}
      </div>

      <div className="col gap-2" style={{ marginTop: 14 }}>
        <input
          className="input" value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="What is the next step?" aria-label="What is the next step?"
          maxLength={160}
        />
        <div className="row gap-2 wrap">
          {/* Three owners and no default of "nobody". A plan where nothing is
              owed by anyone is the thing every plan dies of. */}
          {([["client", clientFirst || "Them"], ["agent", "You"], ["other", "Someone else"]] as const).map(([id, label]) => (
            <button key={id} onClick={() => setOwner(id)} aria-pressed={owner === id}
              className={`chip ${owner === id ? "chip-ink" : ""}`}
              style={{ cursor: "pointer", height: 26, padding: "0 10px" }}>{label}</button>
          ))}
          {owner === "other" ? (
            <input className="input" style={{ width: 150, height: 30 }} value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder="Who?" aria-label="Who is it waiting on?" maxLength={80} />
          ) : null}
          <input className="input" type="date" style={{ width: 150, height: 30 }}
            value={dueOn} onChange={(e) => setDueOn(e.target.value)} aria-label="Due date" />
          <button className="btn btn-s btn-sm" disabled={pending || title.trim().length < 3}
            onClick={() => run(
              () => addStep(leadId, title.trim(), owner, owner === "other" ? ownerName.trim() : null, dueOn || null),
              () => { setTitle(""); setDueOn(""); setOwnerName(""); },
            )}>
            <Ico.plus size={13} />Add
          </button>
        </div>
        {/* No date is a real answer and says so. A date invented to look
            organised is worse than none, because they measure you against it. */}
        <p className="t-2xs c-4">A date is optional. Without one it sits under “After that” on their page.</p>
        {/* B19: after a confirmed closing. Six steps with owners and no dates;
            the homestead deadline is the tax commissioner's to state, so add
            it once you have checked it for their county. */}
        <button className="btn btn-g btn-sm" style={{ alignSelf: "flex-start" }} disabled={pending}
          onClick={() => run(() => addMoveInSteps(leadId))}>
          <Ico.key size={13} />Add the move-in steps
        </button>
      </div>
    </section>
  );
}
