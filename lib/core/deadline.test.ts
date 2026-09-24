import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  amendmentError, buyerDateLine, countDate, deadlineError, deadlineView, federalHolidays, inDays, resolve, whenText,
  type DeadlineInput, type Revision,
} from "./deadline";
import { JOBS, JOB_IDS, jobHealth, runDetail, type JobRun } from "./jobs";

const base: DeadlineInput = { rule: "as-written", date: "2026-10-03", sourceTerm: "Paragraph 12, due diligence", verified: true };
const rev = (input: DeadlineInput, extra: Partial<Revision> = {}): Revision => ({
  ...resolve(input)!, seq: 1, state: "active", rule: input.rule, triggerLabel: input.triggerLabel ?? null, triggerDate: input.triggerDate ?? null,
  days: input.days ?? null, sourceTerm: input.sourceTerm, sourcePage: null, sourceDocumentId: null, amendment: null,
  verified: input.verified, note: null, by: "Kaleb", at: "2026-09-23T12:00:00Z", ...extra,
});

describe("a date without a time stays a date (AT26)", () => {
  it("stores no time and no instant when the document gives none", () => {
    expect(resolve(base)).toEqual({ dueDate: "2026-10-03", dueTime: null, timezone: "America/New_York", dueAt: null });
    expect(whenText(resolve(base)!)).toBe("Sat, Oct 3 (no time stated)");
  });

  it("is due all of that day in its own zone, and past only the next", () => {
    const r = [rev(base)];
    expect(deadlineView(r, "contractual", new Date("2026-10-04T03:59:00Z")).timing).toBe("due-today"); // 11:59 PM Oct 3 in Georgia
    expect(deadlineView(r, "contractual", new Date("2026-10-04T04:01:00Z")).timing).toBe("past"); // 12:01 AM Oct 4
  });

  it("counts in days, never hours", () => {
    const v = deadlineView([rev(base)], "contractual", new Date("2026-10-01T15:00:00Z"));
    expect(v.days).toBe(2);
    expect(inDays(v.days!)).toBe("in 2 days");
  });

  it("uses a stated time as the instant, in the zone given", () => {
    const r = resolve({ ...base, time: "17:00" })!;
    expect(r.dueAt).toBe("2026-10-03T21:00:00.000Z");
    expect(whenText(r)).toBe("Sat, Oct 3, 5:00 PM (Georgia time)");
    const v = deadlineView([rev({ ...base, time: "17:00" })], "contractual", new Date("2026-10-03T21:30:00Z"));
    expect(v.timing).toBe("past");
  });
});

describe("only named rules are counted (AT28)", () => {
  it("counts calendar days from the day after the trigger", () => {
    expect(countDate("calendar-days-v1", { triggerDate: "2026-09-23", days: 10 })).toBe("2026-10-03");
  });

  it("counts business days past weekends and federal holidays", () => {
    // Fri Oct 9 2026 + 1 business day: Mon Oct 12 is Columbus Day, so Tue Oct 13.
    expect(countDate("business-days-v1", { triggerDate: "2026-10-09", days: 1 })).toBe("2026-10-13");
    // Wed Nov 25 + 2: Thanksgiving Thu Nov 26, then Fri 27, Mon 30.
    expect(countDate("business-days-v1", { triggerDate: "2026-11-25", days: 2 })).toBe("2026-11-30");
  });

  it("knows observed holidays", () => {
    expect(federalHolidays(2026).has("2026-07-03")).toBe(true); // July 4 2026 is a Saturday
    expect(federalHolidays(2027).has("2027-12-31")).toBe(true); // Jan 1 2028 is a Saturday
    expect(federalHolidays(2026).has("2026-11-11")).toBe(true);
  });

  it("keeps the same wall-clock time across the change back from daylight saving", () => {
    const before = resolve({ ...base, date: "2026-10-31", time: "17:00" })!;
    const after = resolve({ ...base, rule: "calendar-days-v1", date: null, triggerLabel: "Binding agreement", triggerDate: "2026-10-31", days: 2, time: "17:00" })!;
    expect(before.dueAt).toBe("2026-10-31T21:00:00.000Z"); // EDT
    expect(after.dueDate).toBe("2026-11-02");
    expect(after.dueAt).toBe("2026-11-02T22:00:00.000Z"); // EST
  });

  it("wants the trigger, the days and where it comes from", () => {
    expect(deadlineError({ ...base, sourceTerm: "" })).toMatch(/where it comes from/);
    expect(deadlineError({ ...base, rule: "calendar-days-v1", date: null, triggerDate: "2026-09-23", days: 10 })).toMatch(/counted from/);
    expect(deadlineError({ ...base, rule: "business-days-v1", date: null, triggerLabel: "Binding", triggerDate: "2026-09-23", days: 0 })).toMatch(/number of days/);
    expect(deadlineError({ ...base, date: "2026-02-30" })).toMatch(/as it is written/);
    expect(deadlineError({ ...base, time: "5pm" })).toMatch(/time as it is written/);
    expect(deadlineError({ ...base, timezone: "Mars/Olympus" })).toMatch(/time zone/);
  });
});

describe("an unchecked date is a task, and a missed one is not a conclusion (AT29)", () => {
  it("never shows the buyer an unchecked date", () => {
    const v = deadlineView([rev({ ...base, verified: false })], "contractual", new Date("2026-09-30T12:00:00Z"));
    expect(buyerDateLine("Due diligence ends", v, "Kaleb")).toBeNull();
  });

  it("marks a passed contractual date as missed until the agent records what happened, and says nothing legal", () => {
    const v = deadlineView([rev(base)], "contractual", new Date("2026-10-05T12:00:00Z"));
    expect(v.missed).toBe(true);
    const line = buyerDateLine("Due diligence ends", v, "Kaleb")!;
    expect(line).toBe("Due diligence ends was Sat, Oct 3 (no time stated). Kaleb is handling what happens next.");
    expect(line).not.toMatch(/waived|terminat|extended|void|lost/i);
    expect(deadlineView([rev(base), rev(base, { seq: 2, state: "met" })], "contractual", new Date("2026-10-05T12:00:00Z")).missed).toBe(false);
  });

  it("does not treat the agent's own target as a contractual miss", () => {
    expect(deadlineView([rev(base)], "target", new Date("2026-10-05T12:00:00Z")).missed).toBe(false);
  });
});

describe("amendments (AT27)", () => {
  it("need a name, at least one date, each date once, and every new date checked", () => {
    const moved = { deadlineId: "d1", remove: false, input: { ...base, date: "2026-10-06" } };
    expect(amendmentError("Amendment 1, executed Oct 2", [moved])).toBeNull();
    expect(amendmentError("", [moved])).toMatch(/Name the amendment/);
    expect(amendmentError("Amendment 1", [])).toMatch(/at least one/);
    expect(amendmentError("Amendment 1", [moved, moved])).toMatch(/once/);
    expect(amendmentError("Amendment 1", [{ ...moved, input: { ...moved.input, verified: false } }])).toMatch(/checked against it/);
    expect(amendmentError("Amendment 1", [{ deadlineId: "d2", remove: true, input: null }])).toBeNull();
  });

  it("moves the date the reminders are read from: the latest revision is the only one that counts", () => {
    const v = deadlineView([rev(base), rev({ ...base, date: "2026-10-06" }, { seq: 2, amendment: "Amendment 1" })], "contractual", new Date("2026-10-05T12:00:00Z"));
    expect(v.timing).toBe("upcoming");
    expect(v.current.dueDate).toBe("2026-10-06");
    expect(v.missed).toBe(false);
  });
});

describe("scheduled jobs (AT29, REQ-QUALITY-04)", () => {
  const T0 = "2026-09-20T00:00:00Z";
  const run = (ok: boolean, at: string, detail: string | null = null, finished = true): JobRun =>
    ({ job: "nurture-run", ok, detail, startedAt: at, finishedAt: finished ? at : null });

  it("reports a failed run with what it means", () => {
    const h = jobHealth("nurture-run", [run(true, "2026-09-22T14:00:00Z"), run(false, "2026-09-23T14:00:00Z", "Brevo 401")], T0, new Date("2026-09-23T15:00:00Z"));
    expect(h.state).toBe("failed");
    expect(h.problem).toMatch(/Follow-up emails failed on .*Brevo 401\. Follow-ups that are due are not being sent/);
  });

  it("reports a run that never came", () => {
    const h = jobHealth("nurture-run", [run(true, "2026-09-21T14:00:00Z")], T0, new Date("2026-09-23T15:00:00Z"));
    expect(h.state).toBe("missed");
    expect(h.problem).toMatch(/has not run since/);
  });

  it("does not call a job missed before it has had a chance to run", () => {
    expect(jobHealth("rates-refresh", [], T0, new Date("2026-09-23T00:00:00Z")).problem).toBeNull();
    expect(jobHealth("rates-refresh", [], T0, new Date("2026-10-01T00:00:00Z")).state).toBe("never");
  });

  it("keeps addresses out of what it stores", () => {
    expect(runDetail(new Error("Brevo refused devon@example.com"))).toBe("Brevo refused [address]");
  });

  it("matches the schedules in vercel.json", () => {
    const crons = (JSON.parse(readFileSync("vercel.json", "utf8")).crons as { path: string }[]).map((c) => c.path).sort();
    expect(JOB_IDS.map((j) => JOBS[j].path).sort()).toEqual(crons);
  });
});
