import { describe, it, expect } from "vitest";
import { senderVerdict, setupCounts, setupItems, setupTodo, STATE_WORD, type SetupFacts } from "./setup";
import { DEFAULT_RULES, type BusinessRules } from "./settings";
import type { JobHealth } from "./jobs";

const ALL_RULES = Object.keys(DEFAULT_RULES) as (keyof BusinessRules)[];

/** A deployment with everything done, to take pieces away from. */
const DONE: SetupFacts = {
  undecided: [],
  profile: { name: "Kaleb Befekadu", email: "kaleb@example.com", phone: "404 555 0100", license: "123456", brokerage: "Peachtree Cardinal" },
  email: { key: true, sender: true, verdict: "ready" },
  calendar: { key: true, eventType: true },
  ai: true,
  monitoring: true,
  cronSecret: true,
  jobs: [{ job: "nurture-run", label: "Follow-up emails", state: "ok", lastSuccess: "2026-09-28T14:00:00Z", lastRun: null, problem: null }],
  site: { explicit: true, resolved: "https://example.com" },
  amharic: { unreviewed: 0, total: 100, wrong: 0 },
};

const item = (f: SetupFacts, id: string) => setupItems(f).find((i) => i.id === id)!;

describe("the setup list", () => {
  it("is all done when everything is", () => {
    const c = setupCounts(setupItems(DONE));
    expect(c.open).toBe(0);
    expect(c.done).toBe(c.total);
  });

  it("gives every state a word, so none rests on colour", () => {
    for (const w of Object.values(STATE_WORD)) expect(w.length).toBeGreaterThan(2);
  });

  it("puts what is failing first, then what is unset, and done last", () => {
    const items = setupItems({ ...DONE, undecided: ["commissionPct"], email: { key: true, sender: true, verdict: "awaiting" } });
    expect(items[0]!.id).toBe("email");
    expect(items[0]!.state).toBe("broken");
    expect(items[1]!.id).toBe("rule:commissionPct");
    expect(items.at(-1)!.state).toBe("done");
  });

  it("lists each undecided rule on its own, pointing at its row, and says which are the broker's", () => {
    const items = setupItems({ ...DONE, undecided: ALL_RULES });
    const rules = items.filter((i) => i.group === "decisions");
    expect(rules).toHaveLength(ALL_RULES.length);
    expect(rules.every((r) => r.state === "todo")).toBe(true);
    const retention = rules.find((r) => r.id === "rule:clientRetentionYears")!;
    expect(retention.affects).toMatch(/broker/i);
    expect(retention.action).toMatchObject({ kind: "link", href: "#rule-clientRetentionYears" });
  });

  it("never reads rules or a profile it could not load as done", () => {
    const items = setupItems({ ...DONE, undecided: null, profile: null });
    expect(item({ ...DONE, undecided: null }, "rules").state).toBe("broken");
    expect(items.find((i) => i.id === "profile")!.state).toBe("broken");
  });

  it("asks for each missing profile detail", () => {
    const f = { ...DONE, profile: { ...DONE.profile!, license: null, phone: "  " } };
    expect(item(f, "profile:license").state).toBe("todo");
    expect(item(f, "profile:phone").state).toBe("todo");
    expect(item(f, "profile:brokerage").state).toBe("done");
  });
});

describe("set is not working", () => {
  it("does not call email done until Brevo has said the sender is verified", () => {
    const f = { ...DONE, email: { key: true, sender: true, verdict: null } };
    expect(item(f, "email").state).toBe("confirm");
    expect(item(f, "email").action).toMatchObject({ kind: "check", what: "email" });
  });

  it("says what to do for each thing Brevo can answer", () => {
    for (const verdict of ["awaiting", "unregistered", "blocked", "refused"] as const) {
      const e = item({ ...DONE, email: { key: true, sender: true, verdict } }, "email");
      expect(e.state).toBe("broken");
      expect(e.action?.kind).toBe("steps");
    }
    /* A timeout is not a verdict. */
    expect(item({ ...DONE, email: { key: true, sender: true, verdict: "unknown" } }, "email").state).toBe("confirm");
  });

  it("names the environment variable to set, and never a value", () => {
    const e = item({ ...DONE, email: { key: false, sender: false, verdict: null } }, "email");
    expect(e.state).toBe("todo");
    expect(JSON.stringify(e.action)).toMatch(/BREVO_API_KEY/);
    const cal = item({ ...DONE, calendar: { key: true, eventType: false } }, "calendar");
    expect(cal.affects).toMatch(/CAL_EVENT_TYPE_ID/);
    expect(cal.affects).not.toMatch(/CAL_API_KEY/);
  });

  it("goes by the jobs' outcomes once the secret is set", () => {
    const failed: JobHealth = { job: "retention-sweep", label: "Deleting expired records", state: "failed", lastSuccess: null, lastRun: null, problem: "x" };
    expect(item({ ...DONE, cronSecret: false }, "scheduler").state).toBe("todo");
    expect(item({ ...DONE, jobs: [failed] }, "scheduler").state).toBe("broken");
    expect(item({ ...DONE, jobs: [failed] }, "scheduler").affects).toMatch(/Deleting expired records/);
    expect(item({ ...DONE, jobs: null }, "scheduler").state).toBe("confirm");
    expect(item({ ...DONE, jobs: [{ ...failed, state: "never" }] }, "scheduler").state).toBe("confirm");
  });

  it("treats the Vercel address as usable and no address as a problem", () => {
    expect(item({ ...DONE, site: { explicit: false, resolved: "https://rift.vercel.app" } }, "site").state).toBe("optional");
    expect(item({ ...DONE, site: { explicit: false, resolved: null } }, "site").state).toBe("todo");
  });

  it("leaves AI optional: nothing fails without it", () => {
    expect(item({ ...DONE, ai: false }, "ai").state).toBe("optional");
  });

  it("puts the Amharic review on somebody else", () => {
    const a = item({ ...DONE, amharic: { unreviewed: 90, total: 100, wrong: 2 } }, "amharic");
    expect(a.state).toBe("waiting");
    expect(a.affects).toMatch(/90 of 100/);
  });
});

describe("the sidebar's count", () => {
  it("is the page's To do count, from configuration alone", () => {
    const f = { ...DONE, undecided: ["commissionPct", "registryDays"] as (keyof BusinessRules)[], monitoring: false, email: { key: true, sender: true, verdict: "awaiting" as const } };
    const page = setupCounts(setupItems(f)).todo;
    expect(setupTodo(f)).toBe(page);
    expect(page).toBe(3);
  });
});

describe("Brevo's answer", () => {
  const body = (senders: unknown[]) => JSON.stringify({ senders });

  it("is ready only for a verified sender matching the configured address", () => {
    expect(senderVerdict(200, body([{ email: "Kaleb@Example.com", active: true }]), "kaleb@example.com")).toBe("ready");
    expect(senderVerdict(200, body([{ email: "kaleb@example.com", active: false }]), "kaleb@example.com")).toBe("awaiting");
    expect(senderVerdict(200, body([{ email: "other@example.com", active: true }]), "kaleb@example.com")).toBe("unregistered");
  });

  it("tells the IP block from any other refusal", () => {
    expect(senderVerdict(401, "We have detected you are using an unrecognised IP address", "a@b.co")).toBe("blocked");
    expect(senderVerdict(401, "Key not found", "a@b.co")).toBe("refused");
    expect(senderVerdict(200, "not json", "a@b.co")).toBe("unknown");
  });
});
