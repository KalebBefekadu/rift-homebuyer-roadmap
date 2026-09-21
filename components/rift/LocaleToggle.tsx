"use client";

import { LOCALES, type Locale } from "@/lib/core/i18n";

/**
 * Switching language.
 *
 * Both options are always written in their own script. A language picker that
 * says "Amharic" in English is asking someone to find their language in a
 * language they came here to avoid.
 */
export function LocaleToggle({ locale, onChange }: {
  locale: Locale;
  onChange: (l: Locale) => void;
}) {
  return (
    <div className="row" role="group" aria-label="Language" style={{
      border: "1px solid var(--line-2)", borderRadius: 7, overflow: "hidden", flex: "none",
    }}>
      {LOCALES.map((l) => (
        <button key={l.id} type="button" onClick={() => onChange(l.id)}
          aria-pressed={locale === l.id} lang={l.id}
          style={{
            /* Tightened below 400px. This is the widest control in any
               header the product has, and at 320px it is the difference
               between the page fitting and the page scrolling sideways. */
            padding: "5px clamp(7px, 3vw, 10px)", fontSize: 12.5, lineHeight: 1.4,
            background: locale === l.id ? "var(--ink)" : "transparent",
            color: locale === l.id ? "#fff" : "var(--c-2)",
            border: 0, cursor: "pointer",
          }}>
          {l.native}
        </button>
      ))}
    </div>
  );
}
