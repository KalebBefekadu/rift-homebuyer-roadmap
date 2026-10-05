"use client";

import { useState } from "react";
import {
  DEFAULT_SCOPES, ROLE_LABEL, SCOPE_LABEL, SCOPES, type MemberState, type Role, type Scope,
} from "@/lib/core/journey";
import { useWrite } from "./useWrite";
import type { Sent } from "../send";
import { showDay } from "@/lib/core/day";
import { buildInvitation } from "@/lib/core/email";

export interface MemberView {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  scopes: Scope[];
  state: MemberState;
  acceptedAt: string | null;
  inviteExpiresAt: string | null;
  lastSignInAt: string | null;
}

const STATE_LABEL: Record<MemberState, string> = {
  invited: "Invited, not joined",
  active: "Joined",
  expired: "Invitation expired",
  revoked: "Access withdrawn",
};

const DAY = (iso: string) => showDay(iso, { month: "short", day: "numeric" });

/* The roles are stored as a buyer's, but a seller is not a "buyer" and has no
   search or homes to see: only the price scope reaches a seller's page. So the
   words, and the choices offered, follow the side of the journey. */
const ROLE_WORD: Record<"buy" | "sell", Record<Role, string>> = {
  buy: ROLE_LABEL,
  sell: { buyer: "Seller", "co-buyer": "Co-seller", viewer: "Can view" },
};
const sees = (side: "buy" | "sell", scopes: Scope[]) =>
  side === "sell"
    ? (scopes.includes("money") ? "price, proceeds and offers" : "progress only, not price or proceeds")
    : scopes.map((x) => SCOPE_LABEL[x].toLowerCase()).join(", ");

/**
 * Who can see this journey, and how much.
 *
 * The invitation is a link the agent sends himself, or has Rift email after
 * reading exactly what will go (WS10.4): a message to a client is an external
 * action he approves (decision D04), and pressing Send on the shown email is
 * that approval. Opening it, the person
 * creates a password for the invited address or asks for an email link to it,
 * and only that address can join.
 */
export function Household({ journeyId, side, members, defaultEmail, defaultName, agentName, journeyLabel }: {
  side: "buy" | "sell";
  agentName: string;
  journeyLabel: string;
  journeyId: string;
  members: MemberView[];
  defaultEmail: string;
  defaultName: string;
}) {
  const nobodyYet = members.filter((m) => m.state !== "revoked").length === 0;
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(nobodyYet ? defaultEmail : "");
  const [name, setName] = useState(nobodyYet ? defaultName : "");
  const [role, setRole] = useState<Role>(nobodyYet ? "buyer" : "co-buyer");
  const [scopes, setScopes] = useState<Scope[]>(DEFAULT_SCOPES[nobodyYet ? "buyer" : "co-buyer"]);
  const [link, setLink] = useState<{ link: string; expiresAt: string; who: string; memberId: string; email: string; name: string | null } | null>(null);
  /* Email this invitation (WS10.4): the email is shown first and sent only on Send. */
  const [drafting, setDrafting] = useState(false);
  const [emailed, setEmailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const { busy, error, setError, write } = useWrite(members.map((m) => `${m.id}:${m.state}:${m.inviteExpiresAt}`).join("|"));

  const done = (r: Sent, who: string, email: string, name: string | null) => {
    if (!r.ok) return false;
    if (typeof r.link === "string") {
      setLink({ link: r.link, expiresAt: String(r.expiresAt), who, memberId: String(r.memberId ?? ""), email, name });
      setDrafting(false);
      setEmailed(false);
    }
    return true;
  };

  return (
    <div>
      {members.length ? (
        <ul style={{ display: "grid", gap: 6 }}>
          {members.map((m) => (
            <li key={m.id} className="card p-3 between gap-2 wrap" style={{ display: "flex", opacity: m.state === "revoked" ? 0.6 : 1 }}>
              <div style={{ minWidth: 0 }}>
                <div className="row gap-2 wrap">
                  <span className="t-sm w6">{m.name ?? m.email}</span>
                  <span className="chip t-2xs">{ROLE_WORD[side][m.role]}</span>
                  <span className={`chip t-2xs ${m.state === "active" ? "chip-pos" : m.state === "expired" ? "chip-warn" : ""}`}>
                    {STATE_LABEL[m.state]}{m.state === "active" && m.acceptedAt ? ` ${DAY(m.acceptedAt)}` : ""}
                    {m.state === "invited" && m.inviteExpiresAt ? `, link good until ${DAY(m.inviteExpiresAt)}` : ""}
                  </span>
                </div>
                <div className="t-2xs c-4" style={{ marginTop: 3 }}>
                  {m.email} · sees {sees(side, m.scopes)}
                  {m.state === "active" ? <> · {m.lastSignInAt ? `last signed in ${DAY(m.lastSignInAt)}` : "no sign-in on record yet"}</> : null}
                </div>
              </div>
              {m.state !== "revoked" ? (
                <div className="row gap-1">
                  {m.state === "invited" || m.state === "expired" ? (
                    <button className="btn btn-g btn-sm" disabled={busy}
                      onClick={async () => {
                        if (m.state === "invited" && !confirm(`Make a new link for ${m.name ?? m.email}? The link you sent before stops working.`)) return;
                        done(await write("new-link", { journeyId, memberId: m.id }, { reload: false }), m.name ?? m.email, m.email, m.name);
                      }}>
                      New link
                    </button>
                  ) : null}
                  {m.state === "active" || m.state === "invited" ? (
                    <a className="btn btn-g btn-sm" href={`/app/preview/${journeyId}/${m.id}`} target="_blank" rel="noopener">
                      Preview as {side === "sell" ? "seller" : "client"}
                    </a>
                  ) : null}
                  {m.state === "active" ? (
                    <button className="btn btn-g btn-sm" disabled={busy}
                      onClick={async () => {
                        if (!confirm(`Email ${m.email} a sign-in link now?`)) return;
                        const r = await write("send-signin", { journeyId, memberId: m.id }, { reload: false });
                        if (r.ok) setSent(m.email);
                      }}>
                      Send sign-in email
                    </button>
                  ) : null}
                  <button className="btn btn-g btn-sm" disabled={busy}
                    onClick={() => {
                      if (confirm(`Withdraw ${m.name ?? m.email}'s access? They stop seeing this journey on their next page load.`)) {
                        void write("withdraw", { journeyId, memberId: m.id });
                      }
                    }}>
                    Withdraw
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="t-xs c-4">Nobody invited yet. {side === "buy" ? "Invite the buyer so they can confirm the brief and react to homes themselves." : "Invite the seller so they can see the pricing, the listing and the offers you release, and answer them."}</p>
      )}

      {error ? <p role="alert" className="t-xs c-neg" style={{ marginTop: 8 }}>{error}</p> : null}
      {sent ? <p role="status" className="t-xs c-pos" style={{ marginTop: 8 }}>Sign-in link sent to {sent}.</p> : null}

      {link ? (
        <div role="status" className="card p-3" style={{ marginTop: 10, borderColor: "var(--pos-line)", background: "var(--pos-wash)" }}>
          <div className="t-sm w6">Invitation link for {link.who}</div>
          <p className="t-2xs c-3" style={{ marginTop: 4, lineHeight: 1.5 }}>
            Shown once. Send it yourself, by email or text. It works until {DAY(link.expiresAt)}. Opening it, they create a password
            (or ask for an email link) for that address and join in one step. Any earlier link for them has stopped working.
          </p>
          <div className="row gap-2" style={{ marginTop: 8 }}>
            <input className="input" readOnly value={link.link} onFocus={(e) => e.currentTarget.select()} aria-label="Invitation link" />
            <button className="btn btn-s btn-sm" onClick={async () => {
              try { await navigator.clipboard.writeText(link.link); setCopied(true); setTimeout(() => setCopied(false), 2500); }
              catch { setError("Could not copy. Select the link and copy it by hand."); }
            }}>{copied ? "Copied" : "Copy"}</button>
          </div>
          {link.memberId ? (
            emailed ? (
              <p role="status" className="t-xs c-pos row gap-1" style={{ marginTop: 8 }}>Emailed to {link.email}.</p>
            ) : drafting ? (
              <div className="card p-3" style={{ marginTop: 10, background: "var(--paper)" }}>
                {(() => {
                  const e = buildInvitation({ to: link.email, name: link.name, agentName, journeyLabel, link: link.link });
                  return (
                    <>
                      <div className="t-2xs c-4">To {link.email}</div>
                      <div className="t-sm w6" style={{ marginTop: 4 }}>{e.subject}</div>
                      <pre className="t-xs c-2" style={{ marginTop: 6, whiteSpace: "pre-wrap", fontFamily: "inherit", lineHeight: 1.55 }}>{e.text}</pre>
                    </>
                  );
                })()}
                <div className="row gap-2" style={{ marginTop: 8 }}>
                  <button className="btn btn-p btn-sm" disabled={busy}
                    onClick={async () => {
                      const r = await write("email-invite", { journeyId, memberId: link.memberId, link: link.link }, { reload: false });
                      if (r.ok) { setEmailed(true); setDrafting(false); }
                    }}>{busy ? "Sending…" : "Send"}</button>
                  <button className="btn btn-g btn-sm" onClick={() => setDrafting(false)}>Cancel</button>
                </div>
              </div>
            ) : (
              <button className="btn btn-g btn-sm" style={{ marginTop: 8 }} onClick={() => setDrafting(true)}>Email this invitation</button>
            )
          ) : null}
        </div>
      ) : null}

      {open ? (
        <div className="card p-3" style={{ marginTop: 10, background: "var(--sunk)" }}>
          <div className="row gap-2 wrap">
            <label className="field" style={{ flex: "2 1 200px" }}>
              <span className="label">Email</span>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="field" style={{ flex: "1 1 140px" }}>
              <span className="label">Name</span>
              <input className="input" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="field" style={{ flex: "0 1 140px" }}>
              <span className="label">Role</span>
              <select className="input" value={role} onChange={(e) => { const r = e.target.value as Role; setRole(r); setScopes(DEFAULT_SCOPES[r]); }}>
                {(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_WORD[side][r]}</option>)}
              </select>
            </label>
          </div>
          <fieldset className="row gap-3 wrap" style={{ marginTop: 8, border: 0, padding: 0 }}>
            <legend className="t-2xs c-4" style={{ marginBottom: 4 }}>They can see</legend>
            {(side === "sell" ? (["money"] as Scope[]) : SCOPES).map((s) => (
              <label key={s} className="row gap-1 t-xs">
                <input type="checkbox" style={{ width: 16, height: 16, flex: "none" }} checked={scopes.includes(s)}
                  onChange={(e) => setScopes(e.target.checked ? [...scopes, s] : scopes.filter((x) => x !== s))} />
                {side === "sell" ? "Price, proceeds and offers" : SCOPE_LABEL[s]}
              </label>
            ))}
          </fieldset>
          <p className="t-2xs c-4" style={{ marginTop: 6, lineHeight: 1.5 }}>
            {side === "sell"
              ? "Sellers and co-sellers see what you release and answer on their page. Leave price, proceeds and offers off for somebody who is helping but should not see them."
              : <>{role === "viewer" ? "A viewer reads only. " : "Buyers and co-buyers can confirm the brief, ask for changes and react to homes. "}
                Leave price and fees off for somebody who is helping but should not see the budget.</>}
          </p>
          <div className="row gap-2" style={{ marginTop: 10 }}>
            <button className="btn btn-p btn-sm" disabled={busy || !email.trim() || scopes.length === 0}
              onClick={async () => {
                if (done(await write("invite", {
                  journeyId, email, name, role,
                  /* A seller has no search or homes to see; the server needs at least one scope, so those two ride along and only the price one is a choice. */
                  scopes: side === "sell" ? [...new Set<Scope>(["search", "homes", ...scopes.filter((x) => x === "money")])] : scopes,
                }, { reload: false }), name || email, email.trim().toLowerCase(), name.trim() || null)) setOpen(false);
              }}>
              {busy ? "Making link…" : "Make invitation link"}
            </button>
            <button className="btn btn-g btn-sm" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <button className="btn btn-s btn-sm" style={{ marginTop: 10 }} onClick={() => { setOpen(true); setLink(null); }}>
          Invite someone
        </button>
      )}
    </div>
  );
}
