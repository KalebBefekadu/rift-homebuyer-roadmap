import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * "Save my plan": what happens to the save email's outcome.
 *
 * The day-zero follow-up is skipped only when the save email is recorded as
 * sent (lib/db/nurture-save-email.test.ts). That is only true if this route
 * records what actually happened: a send, a switched-off sender, and a
 * failure are three different facts, and recording one as another either
 * duplicates the email or leaves somebody without their link.
 */

const seen: { recorded: unknown[][]; emails: Record<string, unknown>[] } = { recorded: [], emails: [] };
let emailResult: Record<string, unknown> = { ok: true };
let attach: Record<string, unknown> = { ok: true, data: { token: "tok-abc" } };
let record: Record<string, unknown> = { ok: true, data: { recorded: true } };

vi.mock("@/lib/db/leads", () => ({
  captureLead: async () => ({ ok: true, data: { id: "lead-1", score: { band: "now", score: 80, headline: "h", action: "a", signals: [] } } }),
}));
vi.mock("@/lib/db/saved-plan", () => ({ attachPlan: async () => attach }));
vi.mock("@/lib/db/email", () => ({
  sendSavedPlan: async (e: Record<string, unknown>) => { seen.emails.push(e); return emailResult; },
  sendNewLead: async () => ({ ok: true }),
}));
vi.mock("@/lib/db/nurture", () => ({
  recordSaveEmail: async (...a: unknown[]) => { seen.recorded.push(a); return record; },
}));
vi.mock("@/lib/db/service", () => ({ currentAgentEmail: async () => "agent@example.com" }));
const captured = vi.fn();
vi.mock("@/lib/monitoring/capture", () => ({ captureOpError: (...a: unknown[]) => captured(...a) }));

const { POST } = await import("./route");
const { reset } = await import("@/lib/core/ratelimit");

const post = () =>
  POST(new Request("https://rift.test/api/plan/save", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.9" },
    body: JSON.stringify({ name: "Sam", email: "sam@example.com", side: "buy", answers: { county: "Cobb" }, values: [] }),
  }));

beforeEach(() => {
  seen.recorded = []; seen.emails = []; captured.mockReset(); reset();
  emailResult = { ok: true };
  attach = { ok: true, data: { token: "tok-abc" } };
  record = { ok: true, data: { recorded: true } };
});

describe("POST /api/plan/save: the save email's outcome", () => {
  it("records a delivered email as sent", async () => {
    const res = await post();
    expect((await res.json()).emailed).toBe(true);
    expect(seen.recorded).toEqual([["lead-1", "sent", undefined]]);
  });

  it("records a switched-off sender as skipped, with the reason, never as sent", async () => {
    emailResult = { ok: true, skipped: true, reason: "BREVO_API_KEY is not set" };
    const res = await post();
    expect((await res.json()).emailed).toBe(false);
    expect(seen.recorded).toEqual([["lead-1", "skipped", "BREVO_API_KEY is not set"]]);
  });

  it("records a failed send as failed, with what went wrong", async () => {
    emailResult = { ok: false, error: "Brevo said 400" };
    await post();
    expect(seen.recorded).toEqual([["lead-1", "failed", "Brevo said 400"]]);
  });

  it("records nothing when there is no plan link to have emailed", async () => {
    attach = { ok: false, error: "the lead for this plan was not found" };
    const res = await post();
    expect((await res.json()).url).toBeNull();
    expect(seen.emails).toHaveLength(0);
    expect(seen.recorded).toHaveLength(0);
  });

  it("still answers the visitor when the record cannot be written, and reports it", async () => {
    record = { ok: false, error: "statement timeout" };
    const res = await post();
    expect(res.status).toBe(200);
    expect((await res.json()).emailed).toBe(true);
    expect(captured).toHaveBeenCalledWith(expect.objectContaining({ message: "statement timeout" }), expect.objectContaining({ op: "email.planRecord" }));
  });
});
