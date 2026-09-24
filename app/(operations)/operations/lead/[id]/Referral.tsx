"use client";

import { useState } from "react";
import Link from "next/link";
import { Ico } from "@/components/rift/icons";

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
  token,
  origin,
  firstName,
  sent,
  referrer,
}: {
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
    <section style={{ marginTop: 28 }}>
      <div className="t-2xs c-4 w6" style={{ letterSpacing: ".07em", textTransform: "uppercase" }}>
        Referrals
      </div>

      <div className="card p-4" style={{ marginTop: 10 }}>
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
              <code className="t-xs c-3 trunc" style={{
                background: "var(--sunk)", padding: "6px 9px", borderRadius: 6, maxWidth: 380,
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
    </section>
  );
}
