"use client";

import { REASON_LABEL } from "@/lib/core/seam";
import { useState, useTransition } from "react";
import { Ico } from "@/components/rift/icons";
import type { PlanItem } from "@/lib/core/plan";
import { openClientPlan, closeClientPlan } from "./actions";
import { Steps } from "./Steps";
import type { Drift } from "@/lib/core/seam";
import { money } from "@/lib/core/compute";
import { Section, Notice } from "../../ui";
import css from "./record.module.css";

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
export function Plan({ leadId, items, token, origin, agentFirst, clientFirst, unavailable = null }: {
  leadId: string;
  items: PlanItem[];
  /** Why the steps could not be read. `items` is then empty, which is not "no steps". */
  unavailable?: string | null;
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

  const openButton = !link ? (
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
  ) : undefined;

  return (
    <Section id="plan" title="Their plan" hint="A page they can open. What is agreed, who owes it, and by when." actions={openButton}>
    <div className="card p-4">
      {error ? <Notice tone="neg" title="That did not work">{error}</Notice> : null}

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
                    <span className="num">{money(d.was)}</span>
                    {" → "}
                    <span className="num w6">{d.now === null ? "no longer worked out" : money(d.now)}</span>{" "}
                    <span className="c-3">
                      ({d.deltaPct !== null ? `${d.deltaPct > 0 ? "+" : ""}${d.deltaPct}%` : "missing"}
                      {d.reasons.filter((r) => r !== "moved" && r !== "missing").map((r) => `, ${REASON_LABEL[r]}`).join("")}, {d.cause})
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
          <div className={css.linkRow}>
            <Ico.share size={13} className="c-4" style={{ flex: "none" }} />
            <code className={`t-xs grow ${css.code}`}>{url}</code>
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
      <Steps leadId={leadId} items={items} agentFirst={agentFirst} clientFirst={clientFirst} unavailable={unavailable} />
    </div>
    </Section>
  );
}
