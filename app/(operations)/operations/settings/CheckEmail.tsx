"use client";

import { useState, useTransition } from "react";
import { checkEmailSender } from "./actions";

const SAID: Record<string, string> = {
  ready: "Brevo says the sender is verified.",
  awaiting: "Brevo has the address but it is not verified yet.",
  unregistered: "That address is not a sender in this Brevo account.",
  blocked: "Brevo's IP allowlist refused this server.",
  refused: "Brevo refused the key.",
  unknown: "Brevo did not answer. That is not a verdict; try again.",
};

/**
 * "Ask Brevo", on purpose.
 *
 * The answer is shown here as well as in the list, because the list is
 * re-rendered from a cache kept on one server and the next page load may be
 * served by another: the words under the button are the answer to the
 * question just asked, whichever server answers next.
 */
export function CheckEmail({ label }: { label: string }) {
  const [pending, start] = useTransition();
  const [said, setSaid] = useState("");
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
      <button
        type="button"
        className="btn btn-s btn-sm"
        disabled={pending}
        onClick={() => start(async () => {
          const r = await checkEmailSender();
          setSaid(!r.ok ? r.error : r.verdict ? SAID[r.verdict] ?? "" : "There is no key or sending address to ask about.");
        })}
      >
        {pending ? "Asking…" : label}
      </button>
      {said ? <span className="t-2xs c-3" role="status" style={{ maxWidth: 220, textAlign: "right" }}>{said}</span> : null}
    </span>
  );
}
