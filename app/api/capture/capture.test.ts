import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Capture, from the outside: what a stranger's request can make the server
 * store, and what it can make the server send.
 */

const seen: { captured: Record<string, unknown>[]; readouts: Record<string, unknown>[] } = { captured: [], readouts: [] };

vi.mock("@/lib/db/leads", () => ({
  captureLead: async (input: Record<string, unknown>) => {
    seen.captured.push(input);
    return { ok: true, data: { id: "lead-1", score: { band: "now", score: 80, headline: "h", action: "a", signals: [] } } };
  },
}));
vi.mock("@/lib/db/email", () => ({
  sendReadout: async (r: Record<string, unknown>) => { seen.readouts.push(r); return { ok: true }; },
  sendNewLead: async () => ({ ok: true }),
}));
vi.mock("@/lib/db/service", () => ({ currentAgentEmail: async () => "agent@example.com" }));
vi.mock("@/lib/db/calendar", () => ({ book: async () => ({ ok: true, id: "b" }) }));
vi.mock("@/lib/monitoring/capture", () => ({ captureOpError: () => {} }));

const { POST } = await import("./route");
const { reset } = await import("@/lib/core/ratelimit");

const post = (body: Record<string, unknown>) =>
  POST(new Request("https://rift.test/api/capture", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.7" },
    body: JSON.stringify({ email: "person@example.com", lead: { side: "buy" }, ...body }),
  }));

beforeEach(() => { seen.captured = []; seen.readouts = []; reset(); });

describe("POST /api/capture: the session a lead is filed under", () => {
  it("keeps a session the browser minted for itself", async () => {
    await post({ sessionId: "s-mfx1k2ab-4fzyo82m" });
    expect(seen.captured[0]!.sessionId).toBe("s-mfx1k2ab-4fzyo82m");
  });

  it("stores no session rather than the placeholder every storage-less browser shares", async () => {
    /* Filed under "anon", this lead would be erased by any stranger's delete
       button, and would erase theirs. */
    const res = await post({ sessionId: "anon" });
    expect((await res.json()).stored).toBe(true);
    expect(seen.captured[0]!.sessionId).toBeUndefined();
  });

  it("files a lead whose assessment id is malformed without one, rather than losing it", async () => {
    /* /book copies `?a=` from its own URL. Postgres refusing a uuid it cannot
       parse failed the whole insert. */
    await post({ assessmentId: "not-a-uuid" });
    expect(seen.captured[0]!.assessmentId).toBeNull();
    await post({ assessmentId: "0b6f3c1e-8a2d-4c5e-9f10-2b3c4d5e6f70" });
    expect(seen.captured[1]!.assessmentId).toBe("0b6f3c1e-8a2d-4c5e-9f10-2b3c4d5e6f70");
  });
});

describe("POST /api/capture: the readout email", () => {
  const deliver = (shareUrl: string) => ({ deliver: { shareUrl, county: "DeKalb", cashToClose: 21_000, gap: 0 } });

  it("sends a link to this site, rebuilt from its parsed parts", async () => {
    const res = await post(deliver("https://rift.test/abroad/results?p=300000&lang=en#top"));
    expect((await res.json()).delivery).toBe("sent");
    expect(seen.readouts[0]!.shareUrl).toBe("https://rift.test/abroad/results?p=300000&lang=en");
  });

  it("refuses to email a stranger a link to anywhere else, and still stores the lead", async () => {
    for (const link of [
      "https://evil.example/login",
      "https://rift.test.evil.example/abroad/results",
      "javascript:alert(1)",
      "/abroad/results",
    ]) {
      const res = await post(deliver(link));
      const body = await res.json();
      expect(body.stored, link).toBe(true);
      expect(body.delivery, link).toBe("refused");
    }
    expect(seen.readouts).toEqual([]);
  });

  it("never lets a quote from the link reach the email's markup", async () => {
    await post(deliver('https://rift.test/r/abc"><img src=x onerror=alert(1)>'));
    const sent = String(seen.readouts[0]!.shareUrl);
    expect(sent).not.toContain('"');
    expect(sent).not.toContain("<");
  });
});

describe("POST /api/capture: an Equb seat request", () => {
  const seat = (over: Record<string, unknown> = {}) => ({
    name: "Hana",
    lead: { side: "buy", timing: "3 to 9 months", source: "equb", note: "Equb seat request · household of 4", value: 350_000 },
    ...over,
  });

  it("is stored with its source, timing and note for the agent", async () => {
    const res = await post(seat());
    expect((await res.json()).stored).toBe(true);
    expect(seen.captured[0]!.lead).toMatchObject({
      side: "buy", timing: "3 to 9 months", source: "equb", note: "Equb seat request · household of 4", value: 350_000,
    });
  });

  it("clamps a note a stranger made enormous, and ignores one that is not text", async () => {
    await post(seat({ lead: { side: "buy", source: "equb", note: "x".repeat(5_000) } }));
    expect(String((seen.captured[0]!.lead as { note: string }).note).length).toBe(300);
    await post(seat({ lead: { side: "buy", source: "equb", note: { not: "text" } } }));
    expect("note" in (seen.captured[1]!.lead as object)).toBe(false);
  });

  it("will not store a phone number without the consent box, even from this page", async () => {
    const res = await post(seat({ email: "", phone: "4045550100", phoneConsent: false }));
    expect(res.status).toBe(400);
    expect(seen.captured).toEqual([]);
  });

  it("needs a way to reach the person", async () => {
    const res = await post(seat({ email: "", phone: "" }));
    expect(res.status).toBe(400);
  });
});
