"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useGo } from "@/components/rift/useRefresh";
import { Ico } from "@/components/rift/icons";
import { post } from "../../post";

export function InviteActions({ token, signedIn, mismatch, masked }: {
  token: string;
  signedIn: boolean;
  mismatch: string | null;
  masked: string;
}) {
  const router = useRouter();
  const go = useGo();
  const [state, setState] = useState<"idle" | "busy" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  const sendLink = async () => {
    setState("busy");
    const r = await post({ action: "invite-link", token });
    if (!r.ok) { setError(r.error ?? "That did not work."); setState("idle"); return; }
    setError(null);
    setState("sent");
  };

  const accept = async () => {
    setState("busy");
    const r = await post({ action: "accept", token });
    if (!r.ok) { setError(r.error ?? "That did not work."); setState("idle"); return; }
    go(`/app/j/${String(r.journeyId)}`);
  };

  if (state === "sent") {
    return (
      <div role="status" style={{ marginTop: 16 }}>
        <div className="row gap-2"><Ico.mail size={16} className="c-pos" /><span className="t-md w6">Check {masked}.</span></div>
        <p className="t-sm c-3" style={{ marginTop: 8, lineHeight: 1.6 }}>
          We sent a sign-in link. Open it on this device and you will come straight back here to join.
        </p>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 16 }}>
      {error ? <p role="alert" className="t-xs c-neg" style={{ marginBottom: 10 }}>{error}</p> : null}
      {signedIn && !mismatch ? (
        <button className="btn btn-p" style={{ width: "100%" }} disabled={state === "busy"} onClick={accept}>
          {state === "busy" ? "Joining…" : "Join"}
        </button>
      ) : (
        <>
          {signedIn && mismatch ? (
            <p className="t-xs c-3" style={{ marginBottom: 10, lineHeight: 1.6 }}>
              {mismatch} <a className="u" href="#" onClick={(e) => { e.preventDefault(); fetch("/app/sign-out", { method: "POST" }).then(() => router.refresh()); }}>Sign out</a> first.
            </p>
          ) : null}
          <button className="btn btn-p" style={{ width: "100%" }} disabled={state === "busy" || Boolean(signedIn && mismatch)} onClick={sendLink}>
            {state === "busy" ? "Sending…" : `Email a sign-in link to ${masked}`}
          </button>
          <p className="t-2xs c-4" style={{ marginTop: 8, lineHeight: 1.5 }}>
            No password. The link signs you in once, and joining uses it up.
          </p>
        </>
      )}
    </div>
  );
}
