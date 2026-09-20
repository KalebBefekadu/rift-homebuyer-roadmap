import { describe, it, expect } from "vitest";
import { readPmms, parsePmmsDate, PMMS_LAG_DAYS } from "@/lib/core/pmms";

/* The real file's header, verbatim, 20 September 2026. The fifteen-year rate
   sits two columns after the thirty-year one, which is the mistake this parser
   exists to make impossible. */
const HEADER = "date,pmms30,pmms30p,pmms15,pmms15p,pmms51,pmms51p,pmms51m,pmms51spread";
const REAL_TAIL = [
  "8/27/2026,6.66,,5.98,,,,,",
  "9/3/2026,6.71,,6.04,,,,,",
  "9/10/2026,6.76,,6.09,,,,,",
  "9/17/2026,6.95,,6.26,,,,,",
].join("\n");

const on = (iso: string) => new Date(`${iso}T12:00:00Z`);

describe("reading the published rate", () => {
  it("takes the newest thirty-year rate from the real file", () => {
    const r = readPmms(`${HEADER}\n${REAL_TAIL}`, on("2026-09-20"));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    /* 6.95 is the figure recorded by hand from freddiemac.com/pmms on 17
       September 2026, so this asserts against a known-good answer rather than
       against the parser's own opinion. */
    expect(r.pct).toBe(6.95);
    expect(r.asOf).toBe("2026-09-17");
    expect(r.lagDays).toBe(3);
    expect(r.lagging).toBe(false);
  });

  it("never mistakes the fifteen-year rate for the thirty-year one", () => {
    const r = readPmms(`${HEADER}\n${REAL_TAIL}`, on("2026-09-20"));
    expect(r.ok && r.pct).not.toBe(6.26);
  });

  it("follows the column when the file is reordered", () => {
    /* The failure mode this guards: a positional read would take the date
       column's 6.26 or the string "9/17/2026" and record it. */
    const moved = "pmms15,date,pmms30\n6.26,9/17/2026,6.95";
    const r = readPmms(moved, on("2026-09-20"));
    expect(r.ok && r.pct).toBe(6.95);
  });

  it("refuses when the thirty-year column is gone rather than guessing", () => {
    const r = readPmms("date,rate30yr\n9/17/2026,6.95", on("2026-09-20"));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toMatch(/shape has changed/);
  });

  it("refuses when the date column is gone", () => {
    const r = readPmms("week,pmms30\n9/17/2026,6.95", on("2026-09-20"));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toMatch(/shape has changed/);
  });

  it("refuses an empty file instead of recording nothing as something", () => {
    expect(readPmms("", on("2026-09-20")).ok).toBe(false);
    expect(readPmms(HEADER, on("2026-09-20")).ok).toBe(false);
  });

  it("skips blank and unparseable cells rather than reading them as zero", () => {
    /* `Number("")` is 0, which is finite. A rate of 0% would pass every check
       that only asks whether the parse succeeded. */
    const csv = `${HEADER}\n9/17/2026,6.95,,6.26,,,,,\n9/24/2026,,,6.30,,,,,`;
    const r = readPmms(csv, on("2026-09-27"));
    expect(r.ok && r.pct).toBe(6.95);
    expect(r.ok && r.asOf).toBe("2026-09-17");
  });

  it("refuses a rate outside the plausible band", () => {
    /* 0.0695 rather than 6.95 is the classic entry error, and it would
       understate every monthly payment in the product by hundreds. */
    expect(readPmms(`${HEADER}\n9/17/2026,0.0695,,,,,,,`, on("2026-09-20")).ok).toBe(false);
    expect(readPmms(`${HEADER}\n9/17/2026,695,,,,,,,`, on("2026-09-20")).ok).toBe(false);
  });

  it("refuses a rate dated in the future", () => {
    /* Recording one would make the freshness check permanently green — the
       product would stop asking for a rate it no longer has. */
    const r = readPmms(`${HEADER}\n12/31/2027,6.95,,,,,,,`, on("2026-09-20"));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toMatch(/in the future/);
  });

  it("records a lagging file but says that it is lagging", () => {
    /* A file that has quietly stopped updating would otherwise produce a run
       of successful-looking runs, each recording the same stale number. */
    const r = readPmms(`${HEADER}\n9/17/2026,6.95,,,,,,,`, on("2026-10-20"));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lagging).toBe(true);
    expect(r.lagDays).toBeGreaterThan(PMMS_LAG_DAYS);
  });

  it("takes the newest row even if the file is not in order", () => {
    const csv = `${HEADER}\n9/17/2026,6.95,,,,,,,\n8/27/2026,6.66,,,,,,,`;
    expect(readPmms(csv, on("2026-09-20")).ok && readPmms(csv, on("2026-09-20"))).toMatchObject({ pct: 6.95 });
  });
});

describe("the published date format", () => {
  it("reads M/D/YYYY, which is what the file uses", () => {
    expect(parsePmmsDate("9/17/2026")).toBe("2026-09-17");
    expect(parsePmmsDate("12/3/2026")).toBe("2026-12-03");
    expect(parsePmmsDate(" 4/2/1971 ")).toBe("1971-04-02");
  });

  it("rejects a date that does not exist", () => {
    /* `new Date("2026-02-30")` rolls forward to 2 March. An `as_of` nobody can
       find in the published file is worse than no rate. */
    expect(parsePmmsDate("2/30/2026")).toBeNull();
    expect(parsePmmsDate("13/1/2026")).toBeNull();
  });

  it("rejects anything that is not a date", () => {
    for (const bad of ["", "date", "2026-09-17", "9/17/26", "x/y/z"]) {
      expect(parsePmmsDate(bad), bad).toBeNull();
    }
  });
});
