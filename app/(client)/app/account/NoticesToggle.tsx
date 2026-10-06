"use client";

import { useState } from "react";
import { post } from "../post";

/** The client's own switch for "something new was shared" emails (WS11.5). Saved on change. */
export function NoticesToggle({ journeyId, on: start, agentFirst }: { journeyId: string; on: boolean; agentFirst: string }) {
  const [on, setOn] = useState(start);
  const [say, setSay] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div style={{ marginTop: 10 }}>
      <label className="row gap-2 t-sm" style={{ alignItems: "flex-start" }}>
        <input type="checkbox" checked={on} disabled={busy} style={{ marginTop: 3 }}
          onChange={async (e) => {
            const next = e.target.checked;
            setBusy(true); setSay(null);
            const r = await post({ action: "notices", journeyId, on: next });
            setBusy(false);
            if (r.ok) { setOn(next); setSay({ ok: true, text: next ? "Saved. We will email you." : "Saved. No more of these emails." }); }
            else setSay({ ok: false, text: r.error ?? "That did not save. Try again." });
          }} />
        <span>Email me when {agentFirst} shares something new or needs my answer. The email says what kind of thing it is, never the details.</span>
      </label>
      {say ? <p role={say.ok ? "status" : "alert"} className={`t-xs ${say.ok ? "c-pos" : "c-neg"}`} style={{ marginTop: 4 }}>{say.text}</p> : null}
    </div>
  );
}
