"use client";

import { useState } from "react";
import { Ico } from "@/components/rift/icons";

/** A coordinator's sign-in: a one-time link, sent only to an address on a team. The answer is the same either way. */
export function TeamSignIn({ error, notMember }: { error: string | null; notMember: string | null }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");

  const send = async () => {
    setState("sending");
    try {
      const res = await fetch("/api/operations/team", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op: "signin", email }),
      });
      setState(res.ok ? "sent" : "failed");
    } catch {
      setState("failed");
    }
  };

  if (state === "sent") {
    return (
      <div className="card p-5">
        <div className="row gap-2"><Ico.mail size={16} className="c-pos" aria-hidden /><span className="t-md w6">Check your email.</span></div>
        <p className="t-sm c-3" style={{ marginTop: 10, lineHeight: 1.65 }}>
          If that address is on a team, there is a link in the inbox that signs you in. It works once, so open it on the
          device you want to use.
        </p>
      </div>
    );
  }
  return (
    <div className="card p-5">
      <h1 className="serif" style={{ fontSize: 26 }}>Sign in as a coordinator</h1>
      <p className="t-sm c-3" style={{ marginTop: 8, lineHeight: 1.6 }}>Use the address your agent added you with. We email you a link; there is no password.</p>
      {notMember ? <p className="t-sm c-warn" style={{ marginTop: 10 }}>You are signed in, but {notMember.replace(/^signed in, but /, "")}. Ask your agent to add this address.</p> : null}
      {error ? <p className="t-sm c-warn" style={{ marginTop: 10 }}>That link did not work{error === "expired" ? ": it had expired or was already used" : ""}. Ask for a new one below.</p> : null}
      <form className="col gap-3" style={{ marginTop: 16 }} onSubmit={(e) => { e.preventDefault(); if (email.trim()) void send(); }}>
        <label className="t-sm">Email
          <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" style={{ marginTop: 4 }} />
        </label>
        {state === "failed" ? <p role="alert" className="t-xs c-neg">That did not go through. Try again in a minute.</p> : null}
        <button className="btn btn-p" disabled={state === "sending"}>{state === "sending" ? "Sending…" : "Email me a link"}</button>
      </form>
    </div>
  );
}
