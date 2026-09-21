import { describe, it, expect, vi, beforeEach } from "vitest";
import { fakeDb, type Answers, type Fake } from "./test/fake-db";
import type { LeadInput } from "@/lib/core/lead";

/**
 * What capturing a lead actually writes.
 *
 * This is the one write in the product that cannot be retried later, because
 * the person has closed the tab. It is also the write that carries the
 * liability: a phone number, a consent record, and somebody's finances.
 *
 * Two properties matter more than the rest and neither was tested. A number
 * held without consent is pure liability — it cannot lawfully be called, and
 * it still has to be disclosed and deleted. And a refusal has to be recorded,
 * because a refusal is the evidence that proves the number was never called.
 */

let db: Fake;
const build = (answers: Answers = {}) => {
  db = fakeDb({ "insert rift_leads": { data: [{ id: "lead-1" }] }, ...answers });
  return db;
};

vi.mock("./service", () => ({
  serviceClient: () => db,
  currentAgentId: async () => "agent-1",
}));
vi.mock("./funnel", () => ({ currentVersionId: async () => "fv-1" }));
vi.mock("@/lib/monitoring/capture", () => ({ captureOpError: vi.fn() }));

const { captureLead } = await import("./leads");

const LEAD: LeadInput = {
  side: "buy", timing: "In the next 3 months", county: "Fulton",
  price: 350_000, savings: 12_000, monthlySaving: 600,
} as unknown as LeadInput;

const base = {
  side: "buy" as const, lead: LEAD, assessmentId: "a-1", sessionId: "sess-1",
  name: "Sara", email: "sara@example.com",
};

beforeEach(() => { vi.clearAllMocks(); });

describe("the phone number", () => {
  it("is not stored at all without consent", async () => {
    build();
    await captureLead({ ...base, phone: "404-555-0100" });

    const row = db.to("insert rift_leads")[0]!.payload as Record<string, unknown>;
    expect(row.phone, "a number was stored with no consent behind it").toBeNull();
  });

  it("is not stored when consent was explicitly refused", async () => {
    build();
    await captureLead({
      ...base, phone: "404-555-0100",
      phoneConsent: { granted: false, wording: "May we call you?" },
    });

    const row = db.to("insert rift_leads")[0]!.payload as Record<string, unknown>;
    expect(row.phone).toBeNull();
  });

  it("is stored when consent was given", async () => {
    build();
    await captureLead({
      ...base, phone: "404-555-0100",
      phoneConsent: { granted: true, wording: "May we call you?" },
    });

    expect((db.to("insert rift_leads")[0]!.payload as Record<string, unknown>).phone)
      .toBe("404-555-0100");
  });
});

describe("the consent record", () => {
  it("records a REFUSAL as well as a grant", async () => {
    /* The refusal is the evidence. Without the row there is nothing proving
       the number was never called — only the absence of a call. */
    build();
    await captureLead({
      ...base, phone: "404-555-0100",
      phoneConsent: { granted: false, wording: "May we call you?" },
    });

    const consents = db.to("insert rift_consents")[0]!.payload as Record<string, unknown>[];
    const phone = consents.find((c) => c.kind === "phone");
    expect(phone, "a refusal left no record at all").toBeTruthy();
    expect(phone!.granted).toBe(false);
    expect(phone!.wording).toBe("May we call you?");
  });

  it("stores the exact wording the person agreed to, not a summary of it", async () => {
    /* A consent record that does not say what was on the screen proves
       nothing. The wording is the evidence. */
    build();
    const wording = "Email me my readout and occasional follow-ups. I can stop any time.";
    await captureLead({ ...base, emailConsentWording: wording });

    const consents = db.to("insert rift_consents")[0]!.payload as Record<string, unknown>[];
    expect(consents.find((c) => c.kind === "email")!.wording).toBe(wording);
  });

  it("carries the session handle, so erasure can find it later", async () => {
    /* Leads and consents are the two tables `forget()` reaches by session.
       Without this the delete button reports success and leaves both. */
    build();
    await captureLead({ ...base, emailConsentWording: "yes" });

    expect((db.to("insert rift_leads")[0]!.payload as Record<string, unknown>).session_id).toBe("sess-1");
    const consents = db.to("insert rift_consents")[0]!.payload as Record<string, unknown>[];
    expect(consents[0]!.session_id).toBe("sess-1");
  });

  it("writes nothing when there was no wording to record", async () => {
    /* A consent row with no wording is worse than none: it asserts that
       somebody agreed to something nobody can produce. */
    build();
    await captureLead({ ...base });
    expect(db.to("insert rift_consents")).toHaveLength(0);
  });
});

describe("what it keeps for later", () => {
  it("pins the funnel version the person actually answered", async () => {
    /* A readout produced under v3 has to keep making sense after v5 ships,
       or last Tuesday's answers get reinterpreted against questions that
       person was never asked. */
    build();
    await captureLead(base);
    expect((db.to("insert rift_leads")[0]!.payload as Record<string, unknown>).funnel_version_id).toBe("fv-1");
  });

  it("keeps the raw answers so the score can decay with them", async () => {
    /* Without them a three-week-old lead keeps the urgency it earned on the
       day, and the agent calls the wrong person first. */
    build();
    await captureLead(base);
    expect((db.to("insert rift_leads")[0]!.payload as Record<string, unknown>).lead_input).toBeTruthy();
  });

  it("scores the lead even with no database, and says it did not store it", async () => {
    /* The caller has to be able to act on the band regardless. A skip that
       carried no score would make an unconfigured deployment look like an
       uninterested visitor. */
    const saved = db;
    db = undefined as unknown as Fake;
    const r = await captureLead(base);
    db = saved;

    expect(r.ok).toBe(true);
    expect("skipped" in r && r.reason).toMatch(/scored but not stored/i);
  });
});

describe("before the session_id migration has run", () => {
  it("saves the lead without the column rather than losing it", async () => {
    /* Migrations here are applied by hand against production. Deploying this
       file first would make PostgREST reject every insert on an unknown
       column — turning a fix to the delete button into a total outage of the
       one write that cannot be retried. */
    build({
      "insert rift_leads": (_c, nth) =>
        nth === 1
          ? { error: { message: `column "session_id" of relation "rift_leads" does not exist` } }
          : { data: [{ id: "lead-1" }] },
    });

    const r = await captureLead(base);
    expect(r.ok, "the lead was lost rather than saved without the column").toBe(true);

    const attempts = db.to("insert rift_leads");
    expect(attempts).toHaveLength(2);
    expect(attempts[1]!.payload).not.toHaveProperty("session_id");
    /* Everything else survived the retry. */
    expect(attempts[1]!.payload).toMatchObject({ email: "sara@example.com", side: "buy" });
  });

  it("reports the missing column rather than swallowing it", async () => {
    /* What is lost is the handle erasure uses. Silently dropping it would
       leave the delete button quietly unable to reach the person. */
    const { captureOpError } = await import("@/lib/monitoring/capture");
    build({
      "insert rift_leads": (_c, nth) =>
        nth === 1 ? { error: { message: `column "session_id" does not exist` } } : { data: [{ id: "lead-1" }] },
    });

    await captureLead(base);
    expect(captureOpError).toHaveBeenCalled();
    const call = (captureOpError as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]!;
    expect(JSON.stringify(call)).toContain("20260920020000");
  });

  it("does not retry a failure that has nothing to do with the column", async () => {
    /* Retrying an unrelated error would double every failed write, and the
       second attempt would be missing a field for no reason. */
    build({ "insert rift_leads": { error: { message: "permission denied" } } });

    const r = await captureLead(base);
    expect(r.ok).toBe(false);
    expect(db.to("insert rift_leads")).toHaveLength(1);
  });
});
