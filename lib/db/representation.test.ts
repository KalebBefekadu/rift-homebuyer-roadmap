import { describe, it, expect, vi, beforeEach } from "vitest";
import { fakeDb, type Answers, type Fake } from "./test/fake-db";

/**
 * The gate, at the layer that enforces it.
 *
 * `lib/core/representation.test.ts` covers what the rule IS. This covers
 * where it is applied — on the write, not in the form — and the distinction
 * the whole thing turns on: a read that FAILED is not "no agreement". Refusing
 * to let an agent move somebody because a query timed out turns a database
 * blip into a compliance alarm he has no way to diagnose from the screen.
 */

let db: Fake;
const build = (answers: Answers = {}) => { db = fakeDb(answers); return db; };

vi.mock("./service", () => ({
  serviceClient: () => db,
  currentAgentId: async () => "agent-1",
}));
vi.mock("@/lib/monitoring/capture", () => ({ captureOpError: vi.fn() }));

const { representationOf, setRepresentation, setStage, lapsingAgreements } = await import("./clients");

const REP = (over: Record<string, unknown> = {}) => ({
  representation: "none",
  representation_signed_on: null,
  representation_expires_on: null,
  ...over,
});

const iso = (days: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

beforeEach(() => { vi.clearAllMocks(); });

describe("representationOf", () => {
  it("is scoped to this agent", async () => {
    build({ "select rift_leads": { data: REP() } });
    await representationOf("lead-1");
    expect(db.calls[0]!.filters).toContain("eq:agent_id=agent-1");
  });

  it("reads what is stored", async () => {
    build({ "select rift_leads": { data: REP({
      representation: "signed", representation_signed_on: "2026-01-01", representation_expires_on: "2026-12-31",
    }) } });
    const r = await representationOf("lead-1");
    expect(r.ok && "data" in r && r.data).toEqual({
      status: "signed", signedOn: "2026-01-01", expiresOn: "2026-12-31",
    });
  });

  it("reads an unrecognised status as none, which refuses rather than permits", async () => {
    /* A status outside the vocabulary fails isCovered either way. The reason
       to normalise it is the chip: otherwise the screen renders whatever
       string the database happened to contain, as though it meant something. */
    build({ "select rift_leads": { data: REP({ representation: "probably fine" }) } });
    const r = await representationOf("lead-1");
    expect(r.ok && "data" in r && r.data.status).toBe("none");
  });

  it("reports a failed read rather than answering none", async () => {
    build({ "select rift_leads": { error: { message: "timeout" } } });
    expect((await representationOf("lead-1")).ok).toBe(false);
  });
});

describe("setRepresentation", () => {
  it("refuses a signed agreement with no date", async () => {
    /* The dates are the evidentiary value. "Signed" with no date says an
       agreement exists without saying when it began, which is the question
       that actually gets asked. */
    build();
    const r = await setRepresentation("lead-1", "signed", {});
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(/date it was signed/);
    expect(db.to("update rift_leads")).toHaveLength(0);
  });

  it("refuses a status outside the vocabulary without asking the database", async () => {
    build();
    const r = await setRepresentation("lead-1", "probably fine" as never, {});
    expect(r.ok).toBe(false);
    expect(db.calls).toHaveLength(0);
  });

  it("clears both dates whenever the status is not signed", async () => {
    /* An expiry date against a lead with nothing signed is a deadline the
       agent has no way to meet, rendered on his screen as though he does. */
    build({ "update rift_leads": { data: { id: "lead-1" } }, "insert rift_lead_notes": { data: {} } });
    await setRepresentation("lead-1", "declined", { signedOn: "2026-01-01", expiresOn: "2026-12-31" });
    const patch = db.to("update rift_leads")[0]!.payload as Record<string, unknown>;
    expect(patch.representation_signed_on).toBeNull();
    expect(patch.representation_expires_on).toBeNull();
  });

  it("writes a note, because a column holds only the latest answer", async () => {
    build({ "update rift_leads": { data: { id: "lead-1" } }, "insert rift_lead_notes": { data: {} } });
    await setRepresentation("lead-1", "signed", { signedOn: "2026-02-02", expiresOn: "2026-08-08" });
    const note = db.to("insert rift_lead_notes")[0]!.payload as Record<string, unknown>;
    expect(String(note.body)).toContain("2026-02-02");
    expect(String(note.body)).toContain("2026-08-08");
  });

  it("says so when a signed agreement has no end date", async () => {
    build({ "update rift_leads": { data: { id: "lead-1" } }, "insert rift_lead_notes": { data: {} } });
    await setRepresentation("lead-1", "signed", { signedOn: "2026-02-02" });
    const note = db.to("insert rift_lead_notes")[0]!.payload as Record<string, unknown>;
    expect(String(note.body)).toContain("no end date");
  });

  it("is scoped to this agent", async () => {
    build({ "update rift_leads": { data: { id: "lead-1" } }, "insert rift_lead_notes": { data: {} } });
    await setRepresentation("lead-1", "prepared");
    expect(db.to("update rift_leads")[0]!.filters).toContain("eq:agent_id=agent-1");
  });
});

describe("the gate on setStage", () => {
  /* Two selects happen: the current stage, then the representation. */
  const stageThen = (rep: Record<string, unknown>, stage = "Financing", side = "buy") => {
    let nth = 0;
    return build({
      "select rift_leads": () => (++nth === 1 ? { data: { stage, side } } : { data: rep }),
      "update rift_leads": { data: { id: "lead-1" } },
      "insert rift_lead_notes": { data: {} },
    });
  };

  it("refuses a move past the gate with nothing signed, and says why", async () => {
    stageThen(REP());
    const r = await setStage("lead-1", "Searching" as never);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(/Ready to shop/);
    expect(db.to("update rift_leads")).toHaveLength(0);
  });

  it("allows the same move once an agreement is on file", async () => {
    stageThen(REP({
      representation: "signed", representation_signed_on: iso(-10), representation_expires_on: iso(90),
    }));
    expect((await setStage("lead-1", "Searching" as never)).ok).toBe(true);
  });

  it("refuses again once that agreement has lapsed", async () => {
    stageThen(REP({
      representation: "signed", representation_signed_on: iso(-400), representation_expires_on: iso(-1),
    }));
    const r = await setStage("lead-1", "Searching" as never);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(/expired/);
  });

  it("allows a move that stops at the gate", async () => {
    stageThen(REP(), "Building readiness");
    expect((await setStage("lead-1", "Ready to shop" as never)).ok).toBe(true);
  });

  it("uses the seller's gate for a seller", async () => {
    stageThen(REP(), "Exploring", "sell");
    const r = await setStage("lead-1", "Reviewing offers" as never);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(/Preparing the property/);
  });

  it("never blocks the terminal stages", async () => {
    for (const stage of ["Closed", "Lost"]) {
      stageThen(REP(), "Searching");
      expect((await setStage("lead-1", stage as never)).ok, stage).toBe(true);
    }
  });

  it("does not block when the representation read itself failed", async () => {
    /* THE DISTINCTION. "We could not check" is not "there is none", and a
       timed-out query must not read to the agent as a compliance problem. */
    let nth = 0;
    build({
      "select rift_leads": () => (++nth === 1
        ? { data: { stage: "Financing", side: "buy" } }
        : { error: { message: "timeout" } }),
      "update rift_leads": { data: { id: "lead-1" } },
      "insert rift_lead_notes": { data: {} },
    });
    expect((await setStage("lead-1", "Searching" as never)).ok).toBe(true);
  });
});

describe("lapsingAgreements", () => {
  it("asks only for signed agreements with a date, inside the horizon", async () => {
    build({ "select rift_leads": { data: [] } });
    await lapsingAgreements();
    const f = db.calls[0]!.filters.join(" ");
    expect(f).toContain("eq:agent_id=agent-1");
    expect(f).toContain("eq:representation=signed");
    expect(f).toMatch(/lte:representation_expires_on/);
    expect(f).toMatch(/is:archived_at=null/);
  });

  it("includes what has already lapsed", async () => {
    /* An agreement that ran out last week is more urgent than one running out
       next week, and a list that quietly drops it is worse than no list. */
    build({ "select rift_leads": { data: [
      { id: "l1", name: "Past", side: "buy", representation: "signed",
        representation_signed_on: iso(-400), representation_expires_on: iso(-7) },
    ] } });
    const r = await lapsingAgreements();
    const row = r.ok && "data" in r ? r.data[0] : null;
    expect(row?.standing.effective).toBe("expired");
    expect(row?.standing.covered).toBe(false);
  });
});
