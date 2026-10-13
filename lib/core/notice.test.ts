import { describe, expect, it } from "vitest";
import { datesToRemind, noticeDue, shouldTell, workIsTheirs, NOTICE_WINDOW_HOURS } from "./notice";
import { buildNotice } from "./email";

describe("telling a client something new is shared (WS11.5)", () => {
  const member = { side: "buy" as const, scopes: ["search", "homes", "money"] as ("search" | "homes" | "money")[], joined: true, revoked: false };

  it("tells only people who joined, are still on it, and can see the thing", () => {
    expect(shouldTell("home", member)).toBe(true);
    expect(shouldTell("home", { ...member, joined: false })).toBe(false);
    expect(shouldTell("home", { ...member, revoked: true })).toBe(false);
    expect(shouldTell("offer", { ...member, scopes: ["search", "homes"] })).toBe(false);
    expect(shouldTell("pricing", member)).toBe(false);
    expect(shouldTell("pricing", { ...member, side: "sell" })).toBe(true);
  });

  it("sends one email per kind in a window, not one per click", () => {
    const now = new Date("2026-10-06T18:00:00Z");
    expect(noticeDue(null, now)).toBe(true);
    expect(noticeDue("2026-10-06T17:00:00Z", now)).toBe(false);
    expect(noticeDue(new Date(now.getTime() - NOTICE_WINDOW_HOURS * 3_600_000).toISOString(), now)).toBe(true);
  });

  it("names the kind of thing and links to its tab, never the details", () => {
    const e = buildNotice({
      to: "a@example.com", name: "Abebe Kebede", agentName: "Kaleb Befekadu", journeyLabel: "First home",
      kind: "offer", journeyUrl: "https://rift.example/app/j/0f8fad5b-d9cb-469f-a165-70867728950e",
    });
    expect(e.subject).toBe("Kaleb needs your answer on Rift");
    expect(e.html).toContain("https://rift.example/app/j/0f8fad5b-d9cb-469f-a165-70867728950e?tab=offers");
    expect(e.html).toContain("https://rift.example/app/account");
    expect(e.html).not.toMatch(/\$\d/);
  });

  it("tells a buyer or seller, never a viewer, when something is put on their list (audit portals-2026-10)", () => {
    expect(shouldTell("yours", { ...member, scopes: [], role: "buyer" })).toBe(true);
    expect(shouldTell("yours", { ...member, side: "sell", scopes: [], role: "co-buyer" })).toBe(true);
    expect(shouldTell("yours", { ...member, role: "viewer" })).toBe(false);
    expect(shouldTell("yours", member)).toBe(false);
    const e = buildNotice({ to: "a@example.com", name: null, agentName: "Kaleb Befekadu", journeyLabel: "First home", kind: "yours", journeyUrl: "https://rift.example/app/j/0f8fad5b-d9cb-469f-a165-70867728950e" });
    expect(e.subject).toBe("Kaleb put something on your list in Rift");
    expect(e.html).toContain("?tab=today");
  });

  it("counts only open work the client owns as theirs to do", () => {
    expect(workIsTheirs({ owner: "client", state: "waiting" })).toBe(true);
    expect(workIsTheirs({ owner: "client", state: "confirmed" })).toBe(false);
    expect(workIsTheirs({ owner: "other", state: "waiting" })).toBe(false);
  });

  it("reminds only checked, open, near dates of work the client owns, and the email names no date (decision 4)", () => {
    const view = (days: number, over: object = {}) => ({ verified: true, missed: false, state: "active", days, ...over });
    const contract = {
      journeyId: "j1", outcome: null,
      work: [{ workstream: "insurance", owner: "client" }, { workstream: "financing", owner: "other" }],
      dates: [
        { id: "ins", kind: "contractual", workstream: "insurance", view: view(2) },
        { id: "far", kind: "contractual", workstream: "insurance", view: view(3) },
        { id: "lender", kind: "contractual", workstream: "financing", view: view(1) },
        { id: "unchecked", kind: "contractual", workstream: "insurance", view: view(1, { verified: false }) },
        { id: "passed", kind: "contractual", workstream: "insurance", view: view(-1, { missed: true }) },
      ],
    };
    expect(datesToRemind([contract])).toEqual([{ journeyId: "j1", deadlineId: "ins" }]);
    expect(datesToRemind([{ ...contract, outcome: { outcome: "closed" } }])).toEqual([]);
    const e = buildNotice({ to: "a@example.com", name: null, agentName: "Kaleb Befekadu", journeyLabel: "First home", kind: "date", journeyUrl: "https://rift.example/app/j/0f8fad5b-d9cb-469f-a165-70867728950e" });
    expect(e.subject).toBe("Kaleb has a contract date of yours coming up");
    expect(e.html).not.toMatch(/\d{1,2}\/\d|Oct|Nov|Dec|Jan/);
  });
});

