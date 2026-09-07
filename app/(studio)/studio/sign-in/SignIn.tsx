"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Ico, Mark } from "@/components/rift/icons";

export function SignIn({ reason }: { reason?: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error" | "unconfigured">("idle");
  const [error, setError] = useState("");

  const send = async () => {
    const supabase = createClient();
    if (!supabase) { setState("unconfigured"); return; }

    setState("sending");
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/studio`,
        /* No implicit sign-up. An account that appears because somebody typed
           an address into this box would be an agent account. */
        shouldCreateUser: false,
      },
    });

    if (err) {
      setState("error");
      /* Deliberately vague. "No account with that address" tells anybody who
         finds this page which addresses are real, and there is one. */
      setError("That did not work. If the address is right, check the inbox anyway.");
      return;
    }
    setState("sent");
  };

  return (
    <main className="shell-w sec" style={{ maxWidth: 460 }}>
      <div className="row gap-2" style={{ marginBottom: 22 }}>
        <Mark size={20} />
        <span className="mark-name" style={{ fontSize: 19 }}>Rift</span>
        <span className="chip chip-out t-2xs">Studio</span>
      </div>

      {state === "sent" ? (
        <div className="card p-5">
          <div className="row gap-2">
            <Ico.mail size={16} className="c-pos" />
            <span className="t-md w6">Check your email.</span>
          </div>
          <p className="t-sm c-3" style={{ marginTop: 10, lineHeight: 1.65 }}>
            There is a link in your inbox that signs you in. It works once and expires shortly,
            so open it on the device you want to be signed in on.
          </p>
        </div>
      ) : (
        <div className="card p-5">
          <h1 className="serif" style={{ fontSize: 26, letterSpacing: "-0.02em" }}>Sign in</h1>
          <p className="t-sm c-3" style={{ marginTop: 8, lineHeight: 1.6 }}>
            A link, not a password. One person signs into this, and a password would be one more
            thing for them to store and eventually reuse.
          </p>

          <label className="field" style={{ marginTop: 16 }}>
            <span className="label">Email</span>
            <input
              className="input"
              type="email"
              autoComplete="email"
              value={email}
              placeholder="you@example.com"
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") send(); }}
            />
          </label>

          {reason && state === "idle" ? (
            <p className="t-xs c-3 row gap-2" style={{ marginTop: 10, lineHeight: 1.5 }}>
              <Ico.info size={12} style={{ flex: "none", marginTop: 2 }} />
              {reason === "expired"
                ? "That link had already been used or has expired. They are single-use on purpose."
                : reason === "unconfigured"
                  ? "Authentication is not configured on this deployment yet."
                  : "Something was missing from that link. Ask for a fresh one."}
            </p>
          ) : null}

          {state === "error" ? (
            <p className="t-xs c-neg row gap-2" style={{ marginTop: 10 }}>
              <Ico.alert size={12} style={{ flex: "none", marginTop: 2 }} />{error}
            </p>
          ) : null}

          {state === "unconfigured" ? (
            <p className="t-xs c-3 row gap-2" style={{ marginTop: 10, lineHeight: 1.5 }}>
              <Ico.info size={12} style={{ flex: "none", marginTop: 2 }} />
              Authentication is not configured on this deployment, so there is nothing to sign
              into yet. Set the Supabase keys and run the bootstrap.
            </p>
          ) : null}

          <button
            className="btn btn-p"
            style={{ width: "100%", marginTop: 16 }}
            disabled={!email.trim() || state === "sending"}
            onClick={send}
          >
            {state === "sending" ? "Sending…" : "Email me a link"}
          </button>

          <p className="t-2xs c-4" style={{ marginTop: 12, lineHeight: 1.5 }}>
            There is no sign-up. Accounts are created deliberately, because anybody who could
            create one here would be an agent.
          </p>
        </div>
      )}

      <Link href="/buy" className="t-xs c-3" style={{ display: "inline-block", marginTop: 18 }}>
        ← Rift for buyers
      </Link>
    </main>
  );
}
