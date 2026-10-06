"use client";

import { LANG_COOKIE, LOCALES, type Locale } from "@/lib/core/i18n";

/** Remember the choice where the server can read it (the portal) and where the public pages do (localStorage). */
export function rememberLocale(l: Locale) {
  try { document.cookie = `${LANG_COOKIE}=${l}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`; } catch { /* ignore */ }
  try { window.localStorage.setItem("rift.locale", l); } catch { /* ignore */ }
}

/**
 * English or Amharic, for the client portal (manual review WS11.6). A full
 * reload after choosing, because the portal is rendered on the server and
 * components/rift/useRefresh.ts records that a refresh does not always land.
 */
export function LangSwitch({ locale, label }: { locale: Locale; label: string }) {
  return (
    <div role="group" aria-label={label} className="row gap-1">
      {LOCALES.map((l) => (
        <button key={l.id} type="button" lang={l.id} aria-pressed={l.id === locale}
          className={`btn btn-sm ${l.id === locale ? "btn-s" : "btn-g"}`}
          onClick={() => { if (l.id === locale) return; rememberLocale(l.id); window.location.reload(); }}>
          {l.native}
        </button>
      ))}
    </div>
  );
}
