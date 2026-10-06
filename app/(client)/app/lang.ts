import "server-only";
import { cookies } from "next/headers";
import { isLocale, LANG_COOKIE, translator, type Locale } from "@/lib/core/i18n";

/**
 * The portal's language (manual review WS11.6), from the cookie the language
 * switch sets. The portal renders on the server, so a choice saved only in
 * the browser would arrive one render too late. English when unset.
 */
export async function portalLocale(): Promise<Locale> {
  try {
    const v = (await cookies()).get(LANG_COOKIE)?.value;
    return isLocale(v) ? v : "en";
  } catch {
    return "en";
  }
}

export async function portalT() {
  const locale = await portalLocale();
  return { locale, t: translator(locale) };
}
