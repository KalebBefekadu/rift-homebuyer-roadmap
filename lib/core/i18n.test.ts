import { describe, it, expect } from "vitest";
import { KEYS, dictFor, translator, isLocale } from "./i18n";

describe("two languages", () => {
  it("translates every English key into Amharic", () => {
    /* A missing key falls back to English silently, which is the right runtime
       behaviour and the wrong thing to discover in production: the page half
       switches and looks broken to the only people who wanted it. */
    const am = dictFor("am");
    const missing = KEYS.filter((k) => !am[k]);
    expect(missing).toEqual([]);
  });

  it("leaves no Amharic value written in Latin script", () => {
    /* An untranslated string copied across is worse than a missing one: the
       fallback would have produced the same text without claiming to be a
       translation. Ethiopic occupies U+1200–U+137F. */
    const am = dictFor("am");
    const latin = KEYS.filter((k) => {
      const v = am[k];
      return /[a-z]{4,}/i.test(v) && !/[ሀ-፿]/.test(v);
    });
    expect(latin).toEqual([]);
  });

  it("falls back to English rather than printing a key", () => {
    expect(translator("am")("no.such.key")).toBe("no.such.key");
    expect(translator("am")("hero.h1")).not.toBe("hero.h1");
  });

  it("recognises only the locales it ships", () => {
    expect(isLocale("am")).toBe(true);
    expect(isLocale("fr")).toBe(false);
  });
});
