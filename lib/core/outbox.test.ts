import { describe, it, expect } from "vitest";
import { canMove, canonical, currentState, programAlertDraft, sendBlockers, type OutboxEvent } from "./outbox";

const draft = programAlertDraft({ to: "Buyer@Example.com", name: "Test Buyer", program: "Georgia Dream", change: "the maximum is now $12,000.", sourceUrl: "https://dca.georgia.gov/x", planUrl: "https://rift.test/saved/abc", agentFirst: "Kaleb" });
const ev = (state: OutboxEvent["state"], at: string, hash: string | null = null): OutboxEvent => ({ state, at: `2026-10-01T${at}:00Z`, by: "Kaleb", hash, detail: null });
const ok = { hash: "h1", leadExists: true, optedOut: false, repliedSinceApproval: false };

describe("the outbox (Blueprint v5 §10.2, AUTO-01 to AUTO-03)", () => {
  it("an approval covers exact content: any change to any part is a different message", () => {
    expect(canonical(draft)).toBe(canonical({ ...draft, to: "buyer@example.com" }));
    for (const change of [{ subject: "x" }, { body: `${draft.body}.` }, { to: "other@example.com" }, { name: "Someone" }]) {
      expect(canonical({ ...draft, ...change })).not.toBe(canonical(draft));
    }
  });

  it("moves only forward, and a sent or discarded message never moves again", () => {
    expect(canMove("prepared", "approved")).toBe(true);
    expect(canMove("prepared", "running")).toBe(false);
    expect(canMove("unknown", "running")).toBe(false);
    expect(canMove("succeeded", "cancelled")).toBe(false);
    expect(canMove("cancelled", "approved")).toBe(false);
  });

  it("sends only what was approved, as approved, to somebody still there who has not opted out or replied", () => {
    const approved = [ev("prepared", "10:00"), ev("approved", "10:05", "h1")];
    expect(currentState(approved)).toBe("approved");
    expect(sendBlockers({ ...ok, events: approved })).toEqual([]);
    expect(sendBlockers({ ...ok, events: [ev("prepared", "10:00")] }).join()).toMatch(/not approved/);
    expect(sendBlockers({ ...ok, hash: "h2", events: approved }).join()).toMatch(/changed after it was approved/);
    expect(sendBlockers({ ...ok, leadExists: false, events: approved }).join()).toMatch(/deleted/);
    expect(sendBlockers({ ...ok, optedOut: true, events: approved }).join()).toMatch(/opted out/);
    expect(sendBlockers({ ...ok, repliedSinceApproval: true, events: approved }).join()).toMatch(/replied/);
  });

  it("the program alert says what changed, points at the official page, and promises nothing", () => {
    expect(draft.subject).toBe("Georgia Dream has changed");
    expect(draft.body).toContain("https://dca.georgia.gov/x");
    expect(draft.body).toContain("Hi Test,");
    expect(draft.body).not.toMatch(/qualif|guarantee|you are eligible/i);
  });
});
