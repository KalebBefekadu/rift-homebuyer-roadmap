"use client";

import { useEffect, useState } from "react";
import { isLocale, type Locale } from "@/lib/core/i18n";
import { rememberLocale } from "./LangSwitch";

/**
 * The language a page shows, shared by the abroad and Equb pages.
 *
 * The server decides first from ?lang, so an Amharic link renders Amharic in
 * the HTML. Only when the link did not say does the saved choice (or the
 * browser's language) apply, and the choice is reflected onto <html lang> so
 * a screen reader switches voice with the page, and put back on the way out.
 */
export function useLocale(initial: Locale, pinned: boolean): [Locale, (l: Locale) => void] {
  const [locale, setLocale] = useState<Locale>(initial);
  useEffect(() => {
    if (pinned) return;
    try {
      const saved = window.localStorage.getItem("rift.locale");
      if (isLocale(saved)) { setLocale(saved); return; }
      if (navigator.language?.toLowerCase().startsWith("am")) setLocale("am");
    } catch { /* storage unavailable: the server's choice stands */ }
  }, [pinned]);
  useEffect(() => {
    document.documentElement.lang = locale;
    /* The cookie too, so the choice carries into the client portal (WS11.6). */
    rememberLocale(locale);
    return () => { document.documentElement.lang = "en"; };
  }, [locale]);
  return [locale, setLocale];
}
