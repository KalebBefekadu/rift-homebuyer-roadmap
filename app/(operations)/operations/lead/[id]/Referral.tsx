"use client";

import { useState, useTransition } from "react";
import { georgiaDay } from "@/lib/core/day";
import { setClosingDate } from "./actions";
import Link from "next/link";
import { Ico } from "@/components/rift/icons";
import { Section, Notice } from "../../ui";
import css from "./record.module.css";

/**
 * The link this person can hand to somebody else, and what it has produced.
 *
 * `referred_by` existed for a day with three readers and no writer, so the
 * advocacy figure could not move. This panel is the human half of the fix:
 * without somewhere to GET the link, the column stays empty however correct
 * the plumbing behind it is.
 *
 * It is deliberately on the agent's screen rather than the client's. Every ask
 * in this product belongs to a moment with a reason and a time (MOMENTS in
 * lib/core/referral.ts), and a permanent "refer a friend" box on somebody's
 * plan page is exactly the untimed ask those moments exist to prevent.
 * Kaleb decides when to send this. The product does not decide for him.
 */
export function Referral({
  leadId,
  closedOn,
  token,
  origin,
  firstName,
  sent,
  referrer,
}: {
  leadId: string;
  /** The closing the Advocacy moments count from; undefined when it could not be read. */
  closedOn: string | null | undefined;
  /** Null when nobody has asked for one yet. */
  token: string | null;
  origin: string | null;
  firstName: string | null;
  sent: { id: string; name: string | null; stage: string | null }[];
  referrer: { id: string; name: string | null } | null;
}) {
  const [copied, setCopied] = useState(false);
  const who = firstName || "They";
  const link = token && origin ? `${origin}/buy?r=${token}` : null;

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      /* Clipboard access can be refused, and the link is visible and
         selectable above regardless. Saying "Copied" when nothing was is the
         thing worth avoiding. */
    }
  };

  return (
    <Section id="referrals" title="Referrals" hint="Who sent them, who they have sent, and a link they can pass on. You decide when to offer it.">
      <div className="card p-4">
        <ClosedOn leadId={leadId} closedOn={closedOn} />
        {/* Who sent THEM. Read before who they sent, because it is the fact
            most likely to change how the agent treats the relationship. */}
        {referrer ? (
          <div className="row gap-2" style={{ alignItems: "center", marginBottom: 14 }}>
            <Ico.arrowR size={13} className="c-acc" style={{ flex: "none" }} />
            <span className="t-sm c-2">
              Sent here by{" "}
              <Link href={`/operations/lead/${referrer.id}`} className="w6">
                {referrer.name ?? "someone"}
              </Link>
            </span>
          </div>
        ) : null}

        {link ? (
          <>
            <div className="t-sm w6">{who} can pass this on</div>
            <p className="t-xs c-3" style={{ marginTop: 5, lineHeight: 1.6, maxWidth: 520 }}>
              Anyone who starts an assessment from this link is recorded as having come
              from {who.toLowerCase() === "they" ? "them" : who}. It opens the normal
              buyer page and shows nothing about {who.toLowerCase() === "they" ? "their" : `${who}’s`} own
              situation.
            </p>
            <div className="row gap-2 wrap" style={{ marginTop: 10, alignItems: "center" }}>
              <code className={`t-xs c-3 ${css.code}`} style={{
                background: "var(--sunk)", padding: "6px 9px", borderRadius: 6, maxWidth: "100%",
              }}>{link}</code>
              <button type="button" className="btn btn-g btn-sm" onClick={copy}>
                <Ico.share size={13} />{copied ? "Copied" : "Copy link"}
              </button>
            </div>
          </>
        ) : (
          /* No token and no origin are different problems and neither is the
             client's fault, so neither gets a cheerful empty state. */
          <p className="t-sm c-3" style={{ lineHeight: 1.6 }}>
            {origin
              ? "A referral link has not been made for this person yet."
              : "A referral link needs the site address, and NEXT_PUBLIC_SITE_URL is not set."}
          </p>
        )}

        {sent.length > 0 ? (
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--line-3)" }}>
            <div className="t-xs c-3 w6">
              {sent.length === 1 ? "One person" : `${sent.length} people`} came from{" "}
              {who.toLowerCase() === "they" ? "them" : who}
            </div>
            <div className="col gap-1" style={{ marginTop: 8 }}>
              {sent.map((p) => (
                <div key={p.id} className="row gap-2" style={{ alignItems: "center" }}>
                  <Ico.check size={12} className="c-pos" style={{ flex: "none" }} />
                  <Link href={`/operations/lead/${p.id}`} className="t-sm">
                    {p.name ?? "Unnamed"}
                  </Link>
                  {p.stage ? <span className="chip t-2xs">{p.stage}</span> : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </Section>
  );
}

/**
 * The closing date the Advocacy moments count from: the closing itself,
 * thirty days, six months and each anniversary. Set on its own when the
 * journey's contract is recorded closed; corrected here when the real day
 * differs, which moves every moment still to come.
 */
function ClosedOn({ leadId, closedOn }: { leadId: string; closedOn: string | null | undefined }) {
  const [value, setValue] = useState(closedOn ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  if (closedOn === undefined) {
    return <div style={{ marginBottom: 14 }}><Notice tone="warn" title="The closing date did not load">The moments after a closing cannot be shown or changed here right now.</Notice></div>;
  }
  const save = (next: string | null) => start(async () => {
    const r = await setClosingDate(leadId, next);
    if (!r.ok) { setMsg({ ok: false, text: r.error }); return; }
    setValue(next ?? "");
    setMsg({ ok: true, text: next ? "Saved. The moments after the closing count from this day." : "Cleared. No moment after a closing is due until a date is set." });
  });
  const form = (
    <>
      <div className="row gap-2 wrap" style={{ alignItems: "flex-end" }}>
        <label className="col gap-1 t-xs">Closed on
          <input type="date" className="input input-sm" value={value} max={georgiaDay()} onChange={(e) => setValue(e.target.value)} />
        </label>
        <button type="button" className="btn btn-g btn-sm" disabled={pending || !value || value === (closedOn ?? "")} onClick={() => save(value)}>{pending ? "Saving…" : "Save"}</button>
        {closedOn ? <button type="button" className="u t-xs" disabled={pending} onClick={() => save(null)}>Clear</button> : null}
      </div>
      <p className="t-xs c-4" style={{ marginTop: 6, lineHeight: 1.55 }}>
        {closedOn ? "The Advocacy moments after a closing count from this day." : "Not closed. Recording the contract as closed on the journey sets this; set it here for a closing handled before Rift."}
      </p>
      {msg ? <p role="status" className={`t-xs ${msg.ok ? "c-pos" : "c-neg"}`} style={{ marginTop: 4 }}>{msg.ok ? <Ico.check size={12} style={{ verticalAlign: -2 }} /> : <Ico.x size={12} style={{ verticalAlign: -2 }} />} {msg.text}</p> : null}
    </>
  );

  /* Collapsed until there is a closing to speak of. An empty "Closed on" date
     at the top of every record, including a lead who arrived this morning,
     asks a question that is not theirs yet. */
  return (
    <div style={{ marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid var(--line-3)" }}>
      {closedOn || msg ? form : (
        <details>
          <summary className="t-xs c-3" style={{ cursor: "pointer" }}>Closed before Rift? Set the closing date</summary>
          <div style={{ marginTop: 8 }}>{form}</div>
        </details>
      )}
    </div>
  );
}
