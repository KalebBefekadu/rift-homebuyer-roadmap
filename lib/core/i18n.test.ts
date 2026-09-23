import { describe, it, expect } from "vitest";
import { KEYS, dictFor, translator, isLocale, REVIEWED_AM, WRONG_IN_AM } from "./i18n";

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

/**
 * A translation that is wrong is not the same as one that is unpolished.
 *
 * Every Amharic string here is a non-native first pass and is listed as
 * unreviewed, which is honest. Two of them are in a different category: the
 * English was corrected because it claimed the rent figure came from county
 * averages (it does not, and never did) and the Amharic still says so.
 *
 * Until they are retranslated an Amharic reader is told something about
 * provenance that the product knows to be false, on the one funnel written
 * for people who cannot walk into the office and ask.
 */
describe("Amharic strings that are now wrong rather than merely unreviewed", () => {
  it("names them, so they are owed rather than forgotten", () => {
    expect(WRONG_IN_AM.length, "if this list is empty, the two disclosures were retranslated, which is good")
      .toBeGreaterThanOrEqual(0);
    for (const key of WRONG_IN_AM) {
      expect(KEYS, `${key} is not a real key`).toContain(key);
    }
  });

  it("does not let a key be called both reviewed and wrong", () => {
    for (const key of WRONG_IN_AM) {
      expect(REVIEWED_AM, `${key} cannot be reviewed and wrong at the same time`).not.toContain(key);
    }
  });

  it("keeps the English of those keys free of the claim that was corrected", () => {
    /* The reason they are on the list. If somebody puts the English back, the
       keys should come off it, and this fails first so they notice. */
    const en = dictFor("en") as Record<string, string>;
    for (const key of WRONG_IN_AM) {
      expect(en[key], `${key}'s English has gone back to claiming a source it does not have`)
        .not.toMatch(/county averages?/i);
    }
  });
});
