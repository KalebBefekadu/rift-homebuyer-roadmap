"use client";

import { useState } from "react";
import { post } from "../post";
import { translator, type Locale } from "@/lib/core/i18n";

/** The client's own switch for "something new was shared" emails (WS11.5). Saved on change. */
export function NoticesToggle({ journeyId, on: start, agentFirst, locale = "en" }: { journeyId: string; on: boolean; agentFirst: string; locale?: Locale }) {
  const t = translator(locale);
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
            if (r.ok) { setOn(next); setSay({ ok: true, text: t(next ? "pt.acc.on" : "pt.acc.off") }); }
            else setSay({ ok: false, text: r.error ?? t("pt.acc.notSaved") });
          }} />
        <span>{t("pt.acc.notices", { agent: agentFirst })}</span>
      </label>
      {say ? <p role={say.ok ? "status" : "alert"} className={`t-xs ${say.ok ? "c-pos" : "c-neg"}`} style={{ marginTop: 4 }}>{say.text}</p> : null}
    </div>
  );
}
