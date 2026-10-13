"use client";

import { useState } from "react";

/**
 * After the closing, a link the household can pass on (audit portals-2026-10,
 * item 6). The words are the same for everybody (contract 4.9), and the link
 * opens the ordinary buyer page: nothing about this household travels with it.
 */
export function PassItOn({ link, agentFirst }: { link: string; agentFirst: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <section id="pass-it-on" className="card p-4" style={{ marginTop: 18 }} aria-labelledby="pass-h">
      <h2 id="pass-h" className="t-md w6">Know someone thinking about a move?</h2>
      <p className="t-sm c-3" style={{ marginTop: 6, lineHeight: 1.6 }}>
        This link takes them to the same free numbers you started with, before anybody asks for their details.
        It shows nothing about you or your move. If they want help after that, {agentFirst} will know you sent them.
      </p>
      <div className="row gap-2" style={{ marginTop: 10 }}>
        <input className="input" readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Link to pass on" />
        <button type="button" className="btn btn-s btn-sm" style={{ flex: "none" }} onClick={async () => {
          try { await navigator.clipboard.writeText(link); setCopied(true); setFailed(false); setTimeout(() => setCopied(false), 2500); }
          catch { setFailed(true); }
        }}>{copied ? "Copied" : "Copy"}</button>
      </div>
      {failed ? <p role="alert" className="t-xs c-3" style={{ marginTop: 6 }}>Could not copy. Select the link and copy it by hand.</p> : null}
    </section>
  );
}
