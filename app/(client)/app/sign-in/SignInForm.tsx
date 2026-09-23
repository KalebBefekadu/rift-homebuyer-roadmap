"use client";

import { useState } from "react";
import { Ico } from "@/components/rift/icons";
import { post } from "../post";

export function SignInForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (!email.trim()) return;
    setState("sending");
    const r = await post({ action: "signin", email });
    if (!r.ok) { setError(r.error ?? "That did not work."); setState("idle"); return; }
    setError(null);
    setState("sent");
  };

  if (state === "sent") {
    return (
      <div role="status" style={{ marginTop: 16 }}>
        <div className="row gap-2"><Ico.mail size={16} className="c-pos" /><span className="t-md w6">Check your email.</span></div>
        <p className="t-sm c-3" style={{ marginTop: 8, lineHeight: 1.6 }}>
          If {email.trim()} has been invited, a sign-in link is on its way. It works once. Nothing arrived after a few
          minutes? Check spam, then ask your agent to confirm the address they invited.
        </p>
      </div>
    );
  }

  return (
    <>
      <label className="field" style={{ marginTop: 16 }}>
        <span className="label">Email</span>
        <input className="input" type="email" autoComplete="email" value={email} placeholder="you@example.com"
          onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} />
      </label>
      {error ? <p role="alert" className="t-xs c-neg" style={{ marginTop: 8 }}>{error}</p> : null}
      <button className="btn btn-p" style={{ marginTop: 14, width: "100%" }} disabled={state === "sending" || !email.trim()} onClick={send}>
        {state === "sending" ? "Sending…" : "Email me a sign-in link"}
      </button>
    </>
  );
}
