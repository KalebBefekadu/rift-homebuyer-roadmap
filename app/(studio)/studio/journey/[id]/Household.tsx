"use client";

import { useState } from "react";
import {
  DEFAULT_SCOPES, ROLE_LABEL, SCOPE_LABEL, SCOPES, type MemberState, type Role, type Scope,
} from "@/lib/core/journey";
import { useWrite } from "./useWrite";
import type { Sent } from "../send";

export interface MemberView {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  scopes: Scope[];
  state: MemberState;
  acceptedAt: string | null;
  inviteExpiresAt: string | null;
}

const STATE_LABEL: Record<MemberState, string> = {
  invited: "Invited, not joined",
  active: "Joined",
  expired: "Invitation expired",
  revoked: "Access withdrawn",
};

const DAY = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/**
 * Who can see this journey, and how much.
 *
 * The invitation is a link the agent sends himself. Rift does not email it:
 * a message to a client is an external action he approves (decision D04),
 * and pasting it into his own email is that approval. The person opening it
 * must sign in with the same address before it grants anything.
 */
export function Household({ journeyId, members, defaultEmail, defaultName }: {
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
  const [link, setLink] = useState<{ link: string; expiresAt: string; who: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const { busy, error, setError, write } = useWrite(members.map((m) => `${m.id}:${m.state}:${m.inviteExpiresAt}`).join("|"));

  const done = (r: Sent, who: string) => {
    if (!r.ok) return false;
    if (typeof r.link === "string") setLink({ link: r.link, expiresAt: String(r.expiresAt), who });
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
                  <span className="chip t-2xs">{ROLE_LABEL[m.role]}</span>
                  <span className={`chip t-2xs ${m.state === "active" ? "chip-pos" : m.state === "expired" ? "chip-warn" : ""}`}>
                    {STATE_LABEL[m.state]}{m.state === "active" && m.acceptedAt ? ` ${DAY(m.acceptedAt)}` : ""}
                    {m.state === "invited" && m.inviteExpiresAt ? `, link good until ${DAY(m.inviteExpiresAt)}` : ""}
                  </span>
                </div>
                <div className="t-2xs c-4" style={{ marginTop: 3 }}>
                  {m.email} · sees {m.scopes.map((s) => SCOPE_LABEL[s].toLowerCase()).join(", ")}
                </div>
              </div>
              {m.state !== "revoked" ? (
                <div className="row gap-1">
                  {m.state === "invited" || m.state === "expired" ? (
                    <button className="btn btn-g btn-sm" disabled={busy}
                      onClick={async () => { done(await write("new-link", { journeyId, memberId: m.id }, { reload: false }), m.name ?? m.email); }}>
                      New link
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
        <p className="t-xs c-4">Nobody invited yet. Invite the buyer so they can confirm the brief and react to homes themselves.</p>
      )}

      {error ? <p role="alert" className="t-xs c-neg" style={{ marginTop: 8 }}>{error}</p> : null}

      {link ? (
        <div role="status" className="card p-3" style={{ marginTop: 10, borderColor: "var(--pos-line)", background: "var(--pos-wash)" }}>
          <div className="t-sm w6">Invitation link for {link.who}</div>
          <p className="t-2xs c-3" style={{ marginTop: 4, lineHeight: 1.5 }}>
            Shown once. Send it yourself, by email or text. It works until {DAY(link.expiresAt)}, and only for somebody who signs in with that address.
          </p>
          <div className="row gap-2" style={{ marginTop: 8 }}>
            <input className="input" readOnly value={link.link} onFocus={(e) => e.currentTarget.select()} aria-label="Invitation link" />
            <button className="btn btn-s btn-sm" onClick={async () => {
              try { await navigator.clipboard.writeText(link.link); setCopied(true); setTimeout(() => setCopied(false), 2500); }
              catch { setError("Could not copy. Select the link and copy it by hand."); }
            }}>{copied ? "Copied" : "Copy"}</button>
          </div>
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
                {(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
            </label>
          </div>
          <fieldset className="row gap-3 wrap" style={{ marginTop: 8, border: 0, padding: 0 }}>
            <legend className="t-2xs c-4" style={{ marginBottom: 4 }}>They can see</legend>
            {SCOPES.map((s) => (
              <label key={s} className="row gap-1 t-xs">
                <input type="checkbox" style={{ width: 16, height: 16, flex: "none" }} checked={scopes.includes(s)}
                  onChange={(e) => setScopes(e.target.checked ? [...scopes, s] : scopes.filter((x) => x !== s))} />
                {SCOPE_LABEL[s]}
              </label>
            ))}
          </fieldset>
          <p className="t-2xs c-4" style={{ marginTop: 6, lineHeight: 1.5 }}>
            {role === "viewer" ? "A viewer reads only. " : "Buyers and co-buyers can confirm the brief, ask for changes and react to homes. "}
            Leave price and fees off for somebody who is helping but should not see the budget.
          </p>
          <div className="row gap-2" style={{ marginTop: 10 }}>
            <button className="btn btn-p btn-sm" disabled={busy || !email.trim() || scopes.length === 0}
              onClick={async () => {
                if (done(await write("invite", { journeyId, email, name, role, scopes }, { reload: false }), name || email)) setOpen(false);
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
