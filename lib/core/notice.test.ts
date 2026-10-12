import { describe, expect, it } from "vitest";
import { noticeDue, shouldTell, NOTICE_WINDOW_HOURS } from "./notice";
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
});
