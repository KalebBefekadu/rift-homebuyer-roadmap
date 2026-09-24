import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Every write in the data layer degrades visibly, or the house rule is a
 * comment rather than a property.
 *
 * The rule, stated in docs/integrations.md and in a dozen docblocks: a missing
 * integration returns `{ ok: true, skipped: true, reason }`: never a throw,
 * and never a bare success. The whole `DbResult` discriminated union exists to
 * make "it worked", "it failed" and "there was nothing to work with" three
 * different answers, because collapsing the third into either of the others is
 * how this product ends up doing nothing in production while every local run
 * looks fine.
 *
 * It is exactly what happened twice already. Both crons answered the wrong
 * verb and reported success for the life of the deployment. The sitemap served
 * a valid document with no URLs in it and returned 200.
 *
 * Until now nothing tested it, because `server-only` made lib/db unimportable
 * outside Next. It is aliased in vitest.config.ts now, so this walks the whole
 * layer with no database configured and asserts the contract on every export
 * that touches one. A new function that throws, or that quietly returns
 * `done()` when there is nothing behind it, fails here.
 */

const REAL = { ...process.env };

beforeAll(() => {
  /* No database, no keys. The shape a deployment has before anybody has
     configured it, and the shape /prototype runs in on purpose. */
  for (const k of [
    "SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "BREVO_API_KEY", "BREVO_FROM_EMAIL", "CAL_API_KEY", "CAL_EVENT_TYPE_ID",
  ]) delete process.env[k];
});

afterAll(() => { Object.assign(process.env, REAL); });

type Result = { ok: boolean; skipped?: boolean; reason?: string; error?: string };

/** Ran, did not throw, and said which of the three things happened. */
function contract(name: string, r: unknown) {
  const v = r as Result;
  expect(v, `${name} returned nothing`).toBeTruthy();
  expect(typeof v.ok, `${name} has no ok`).toBe("boolean");

  if (v.ok && "skipped" in v) {
    expect(typeof v.reason, `${name} skipped with no reason`).toBe("string");
    expect(v.reason!.length, `${name} skipped with an empty reason`).toBeGreaterThan(3);
    return "skipped";
  }
  if (!v.ok) {
    expect(typeof v.error, `${name} failed with no error`).toBe("string");
    return "failed";
  }
  return "done";
}

describe("with nothing configured at all", () => {
  it("the service client is null rather than a broken client", async () => {
    const { serviceClient, currentAgentId, currentAgentEmail } = await import("./service");
    expect(serviceClient()).toBeNull();
    expect(await currentAgentId()).toBeNull();
    expect(await currentAgentEmail()).toBeNull();
  });

  it("captures nothing, and says so, rather than throwing", async () => {
    const { captureLead, markReplied, rankedLeads } = await import("./leads");
    const { captureTouch } = await import("./attribution");
    const { recordEvents, funnelReport } = await import("./events");

    expect(contract("captureLead", await captureLead({
      assessmentId: null, side: "buy",
      lead: { side: "buy", timing: "", completion: 0, hoursSince: 0, value: 0, monthsToReady: null, coBuyer: false, contactable: false, source: "t" },
    }))).toBe("skipped");
    expect(contract("markReplied", await markReplied("x", "y"))).toBe("skipped");
    expect(contract("rankedLeads", await rankedLeads(5))).toBe("skipped");
    expect(contract("captureTouch", await captureTouch("s", {}))).toBe("skipped");
    /* A real event, not an empty array. `recordEvents([])` correctly reports
       `done({ written: 0 })`: nothing was skipped for want of a database,
       there was simply nothing to write, and those are different facts. */
    expect(contract("recordEvents", await recordEvents([
      { sessionId: "s", name: "readout_view", side: "buy" },
    ]))).toBe("skipped");
    expect(contract("recordEvents(nothing to write)", await recordEvents([]))).toBe("done");
    expect(contract("funnelReport", await funnelReport("buy"))).toBe("skipped");
  });

  it("runs the assessment path without a database", async () => {
    const a = await import("./assessments");
    expect(contract("startAssessment", await a.startAssessment({ sessionId: "s", side: "buy" }))).toBe("skipped");
    expect(contract("saveAnswer", await a.saveAnswer("s", "k", 1))).toBe("skipped");
    expect(contract("completeAssessment", await a.completeAssessment("s"))).toBe("skipped");
    expect(contract("saveReadout", await a.saveReadout({
      assessmentId: "s", side: "buy", inputs: {}, figures: {},
    }))).toBe("skipped");
    expect(contract("readByToken", await a.readByToken("t"))).toBe("skipped");
  });

  it("still serves the funnel, because the built-in one is the right answer", async () => {
    /* The one place where `done` is correct with no database. The assessment
       is the second most valuable page in the product and the fallback IS the
       definition the compute engine was written against. */
    const { readFunnel } = await import("./assessments");
    const r = await readFunnel("buy");
    expect(contract("readFunnel", r)).toBe("done");
    expect((r as { data: { source: string } }).data.source).toBe("built-in");
    expect((r as { data: { funnel: { questions: unknown[] } } }).data.funnel.questions.length).toBeGreaterThan(3);
  });

  it("still serves the programme registry, from the seeded copy", async () => {
    /* Same rule: the seed is real verified data, and labelling it is what
       keeps the fallback honest rather than silent. */
    const { readRegistry, readStale } = await import("./programs");
    const r = await readRegistry(new Date("2026-09-20T12:00:00Z"));
    expect(contract("readRegistry", r)).toBe("done");
    expect((r as { data: { source: string } }).data.source).toBe("seed");
    expect(contract("readStale", await readStale(new Date("2026-09-20T12:00:00Z")))).toBe("done");
  });

  it("degrades the cadence rather than pretending to send", async () => {
    const n = await import("./nurture");
    expect(contract("enrol", await n.enrol("l", "now", false))).toBe("skipped");
    expect(contract("stop", await n.stop("l", "replied", "a"))).toBe("skipped");
    expect(contract("due", await n.due(new Date()))).toBe("skipped");
    expect(contract("claimStep", await n.claimStep("e", "s", "email", null))).toBe("skipped");
  });

  it("degrades retention rather than reporting a deletion that did not happen", async () => {
    /* The worst possible false success in the product. */
    const r = await import("./retention");
    expect(contract("sweep", await r.sweep(new Date()))).toBe("skipped");
    expect(contract("forget", await r.forget("s"))).toBe("skipped");
    expect(contract("overdue", await r.overdue(new Date()))).toBe("skipped");
  });

  it("degrades the agent's own surfaces", async () => {
    const c = await import("./clients");
    expect(contract("board", await c.board())).toBe("skipped");
    expect(contract("dueActions", await c.dueActions())).toBe("skipped");
    expect(contract("readLead", await c.readLead("x"))).toBe("skipped");

    const s = await import("./settings");
    expect(contract("readAgentRules", await s.readAgentRules("a"))).toBe("skipped");
    expect(contract("saveRule", await s.saveRule("a", "commissionPct", 3, "me"))).toBe("skipped");
    expect(contract("clearRule", await s.clearRule("a", "commissionPct"))).toBe("skipped");

    const rv = await import("./review");
    expect(contract("openItems", await rv.openItems())).toBe("skipped");

    const rc = await import("./recovery");
    expect(contract("abandoned", await rc.abandoned())).toBe("skipped");
  });

  it("falls back to defaults rather than failing the page that needs them", async () => {
    /* The forecast has to render something. `rulesOrDefaults` is the one
       caller that cannot propagate a skip, so it converts it. */
    const { rulesOrDefaults } = await import("./settings");
    const r = await rulesOrDefaults(null);
    expect(r.rules.commissionPct.value).toBe(2.5);
    expect(r.undecided.length).toBeGreaterThan(0);
    expect(r.decided).toEqual([]);
  });

  it("degrades the funnel editor", async () => {
    const f = await import("./funnel");
    expect(await f.currentVersionId("buy")).toBeNull();
    expect(contract("readWording", await f.readWording("buy"))).toBe("skipped");
    expect(contract("publishWording", await f.publishWording("buy", {}, "me", "n"))).toBe("skipped");
    /* And still returns a usable funnel, for the same reason readFunnel does. */
    expect((await f.funnelWithWording("buy")).questions.length).toBeGreaterThan(3);
  });
});

describe("email with no sender verified", () => {
  it("reports not-configured rather than sending or throwing", async () => {
    const e = await import("./email");
    for (const [name, r] of [
      ["sendReadout", await e.sendReadout({ to: "a@b.co", shareUrl: "u", county: "DeKalb", side: "buy", cashToClose: 26_000, gap: 0, monthsToClose: 2 })],
      ["sendNewLead", await e.sendNewLead({ to: "a@b.co", email: "c@d.co", side: "buy", band: "now", score: 80, headline: "h", action: "a", signals: [], timing: "0-3 months", value: 325_000, source: "readout", studioUrl: "u" })],
    ] as const) {
      expect(contract(name, r)).toBe("skipped");
      /* Names the missing variable. "Email failed" sends somebody to the
         logs; "BREVO_API_KEY not set" is the whole diagnosis. */
      expect((r as { reason: string }).reason).toMatch(/BREVO/);
    }
  });

  it("refuses a message it has no figures for, before it refuses for config", async () => {
    /* Order matters. A readout email with a zero in it is worse than no
       email, so that check comes first and says something different. */
    const { sendReadout } = await import("./email");
    const r = await sendReadout({ to: "a@b.co", shareUrl: "u", county: "DeKalb", side: "sell" });
    expect(contract("sendReadout(no figures)", r)).toBe("skipped");
    expect((r as { reason: string }).reason).toContain("nothing worth sending");
  });
});

describe("the calendar with no credentials", () => {
  it("offers no invented slots, and says which of the two it is", async () => {
    /* "Kaleb is free at 2pm" and "we cannot see Kaleb's diary" are different
       facts, and four plausible-looking times would be the product lying
       about a person's availability.
       
       Its own shape rather than DbResult, because a caller rendering a list
       of times needs an empty list it can still map over, so the honesty
       lives in `source` instead of in `skipped`. Asserted on its own terms. */
    const { availability } = await import("./calendar");
    const a = await availability();
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    expect(a.slots).toEqual([]);
    expect(a.source).toBe("unconfigured");
    if (a.source !== "unconfigured") return;
    expect(a.reason).toMatch(/CAL_API_KEY/);
  });

  it("holds no slot it cannot actually hold", async () => {
    const { book } = await import("./calendar");
    expect(contract("book", await book({
      start: "2026-10-01T14:00:00Z", name: "A", email: "a@b.co", topic: "t",
    }))).toBe("skipped");
  });
});

/**
 * AT38: the journey layer, walked the same way. Every read and write a journey
 * page makes says which of the three things happened, with nothing configured,
 * instead of throwing or claiming an empty journey is a real one.
 *
 * Walked by listing each module's exports rather than naming them, so a new
 * function joins the walk the day it is written. The shapers (pure functions
 * over rows) and the few with their own shapes are named and checked apart.
 */
describe("the journey layer with nothing configured (AT38)", () => {
  const MODULES = ["journeys", "search", "shortlist", "tours", "progress", "bids", "documents", "deadlines", "client", "jobs", "retention", "summary", "pilot"] as const;
  const OWN_SHAPE = new Set([
    "journeyTablesMissing", "inviteTokenHash", "trackedCron", "clientSession",
    "shapeRevision", "shapeHomes", "shapeEvents", "shapeUpdates", "shapeSteps", "shapeTours", "newHomeError", "maskEmail",
  ]);
  const ID = "00000000-0000-4000-8000-000000000001";
  /* Plausible arguments for any signature: ids for strings, a membership-shaped
     object for objects. A function that dereferences a field it was not given
     would throw here, which is itself a finding. */
  const member = {
    journeyId: ID, memberId: ID, agentId: ID, role: "buyer", scopes: ["search", "homes", "money"],
    name: "A", journeyLabel: "A", side: "buy", agentName: "Kaleb",
  };

  for (const mod of MODULES) {
    it(`${mod}: every export degrades with a reason`, async () => {
      const m = (await import(`./${mod}`)) as Record<string, unknown>;
      let walked = 0;
      for (const [name, fn] of Object.entries(m)) {
        if (typeof fn !== "function" || OWN_SHAPE.has(name) || /^[A-Z]/.test(name)) continue;
        const args = Array.from({ length: Math.max(fn.length, 1) }, (_, i) => (i === 0 && mod === "client" && !/^(myJourneys|memberOf|invitationByToken|acceptInvitation|mayReceiveSignIn)$/.test(name) ? member : ID));
        let r: unknown;
        try {
          r = await (fn as (...a: unknown[]) => unknown)(...args);
        } catch (e) {
          throw new Error(`${mod}.${name} threw with nothing configured: ${(e as Error).message}`);
        }
        if (r === undefined || r === null || typeof r !== "object" || !("ok" in (r as object))) continue;
        expect(contract(`${mod}.${name}`, r), `${mod}.${name}`).not.toBe("done");
        walked++;
      }
      expect(walked, `${mod} had nothing to walk`).toBeGreaterThan(0);
    });
  }

  it("the client's session reads as unknown or signed out, never signed in", async () => {
    const { clientSession } = await import("./client");
    const s = await clientSession().catch(() => ({ state: "threw" }));
    expect(["unknown", "signed-out"]).toContain((s as { state: string }).state);
  });
});

/**
 * AT38: manual work never waits on a provider. No journey module sends email,
 * books a calendar slot or calls out to anything but the database, so with
 * Brevo, Cal and every other service down the agent can still enter the
 * brief, homes, showings, offers, documents and dates by hand.
 */
describe("manual journey work depends on no provider (AT38)", () => {
  for (const mod of ["journeys", "search", "shortlist", "tours", "progress", "bids", "documents", "deadlines", "client", "pilot"]) {
    it(`${mod} imports no email, calendar or outside call`, () => {
      const src = readFileSync(resolve(__dirname, `${mod}.ts`), "utf8");
      expect(src).not.toMatch(/from "\.\/(email|calendar)"|brevo|api\.cal\.com|anthropic|openai/i);
      expect(src.replace(/storage|\.from\(/g, ""), `${mod} calls fetch`).not.toMatch(/\bfetch\(/);
    });
  }
});
