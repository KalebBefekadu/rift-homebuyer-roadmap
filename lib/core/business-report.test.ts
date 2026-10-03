import { describe, expect, it } from "vitest";
import { businessFunnel, bySource, channelOf, pipelineOf, periodFrom, type AttributionRow, type LeadRow } from "./business-report";

const NOW = new Date("2026-09-30T16:00:00Z");

const lead = (id: string, over: Partial<LeadRow> = {}): LeadRow => ({
  id, source: "funnel", stage: null, sessionId: `s-${id}`, createdAt: "2026-09-20T12:00:00Z", archived: false, closedOn: null, value: null, ...over,
});
const attr = (sessionId: string, source: string | null, medium: string | null, firstAt = "2026-09-20T12:00:00Z", ref: string | null = null): AttributionRow =>
  ({ sessionId, source, medium, referrer: null, ref, firstAt });

describe("where a visit came from", () => {
  it("reads the first touch in the words an agent would use", () => {
    expect(channelOf({ source: "google", medium: "organic" })).toBe("Organic search");
    expect(channelOf({ source: "google", medium: "cpc" })).toBe("Paid search");
    expect(channelOf({ source: "facebook", medium: "paid-social" })).toBe("Paid social");
    expect(channelOf({ source: "instagram", medium: "organic" })).toBe("Social");
    expect(channelOf({ source: "newsletter", medium: "email" })).toBe("Email");
    expect(channelOf({ source: "zillow", medium: "referral" })).toBe("Other sites");
    expect(channelOf({ source: "referral", medium: "share" })).toBe("Word of mouth");
    expect(channelOf({ source: "(direct)", medium: null })).toBe("Direct or unknown");
    expect(channelOf({ source: null, medium: null })).toBe("Direct or unknown");
  });

  it("calls a referral handle word of mouth whatever else the visit said", () => {
    expect(channelOf({ source: "google", medium: "organic", ref: "abc123" })).toBe("Word of mouth");
  });
});

describe("the funnel", () => {
  const leads = [
    lead("a", { stage: "Closed", closedOn: "2026-09-25", value: 340_000 }),
    lead("b", { stage: "Searching" }),
    lead("c"),
    lead("d", { createdAt: "2026-05-01T12:00:00Z", stage: "Closed", closedOn: "2026-06-01", value: 400_000 }),
    lead("e", { source: "manual", stage: "Financing" }),
  ];
  const attributions = [attr("s-a", "google", "organic"), attr("s-b", "google", "cpc"), attr("s-c", null, null), attr("s-d", "google", "organic", "2026-05-01T12:00:00Z"), attr("x1", null, null), attr("x2", null, null)];

  it("counts visitors and the cohort of leads that arrived in the period, and what became of them", () => {
    const f = businessFunnel({ leads, attributions, finishedOne: 5, days: 90, now: NOW });
    const by = Object.fromEntries(f.steps.map((s) => [s.id, s.count]));
    /* Visitors: s-a, s-b, s-c, x1, x2 in the window; s-d arrived in May. */
    expect(by).toEqual({ visitors: 5, finished: 5, leads: 3, clients: 2, closed: 1 });
  });

  it("leaves a lead added by hand out of the funnel and says how many there were", () => {
    expect(businessFunnel({ leads, attributions, finishedOne: 5, days: 90, now: NOW }).addedByHand).toBe(1);
  });

  it("gives each step a rate of the step before, with what it is a share of", () => {
    const f = businessFunnel({ leads, attributions, finishedOne: 5, days: 90, now: NOW });
    expect(f.steps.find((s) => s.id === "clients")!.rate).toEqual({ pct: 67, of: "leads" });
    expect(f.steps.find((s) => s.id === "closed")!.rate).toEqual({ pct: 50, of: "taken on" });
  });

  it("never reports more than a hundred percent, or a rate with no denominator", () => {
    /* Fewer sessions finished a value than leads arrived: tracking missed someone. */
    const f = businessFunnel({ leads, attributions, finishedOne: 2, days: 90, now: NOW });
    expect(f.steps.find((s) => s.id === "leads")!.rate).toBeNull();
    const none = businessFunnel({ leads: [], attributions: [], finishedOne: 0, days: 90, now: NOW });
    expect(none.steps.every((s) => s.rate === null)).toBe(true);
  });

  it("does not guess a step it could not read", () => {
    const f = businessFunnel({ leads, attributions, finishedOne: null, days: 90, now: NOW });
    expect(f.steps.find((s) => s.id === "finished")!.count).toBeNull();
    expect(f.steps.find((s) => s.id === "finished")!.rate).toBeNull();
  });

  it("counts closings by the day they closed, not by when the person arrived", () => {
    const f = businessFunnel({ leads, attributions, finishedOne: 5, days: 365, now: NOW });
    expect(f.closings).toEqual({ count: 2, priced: 2, volume: 740_000 });
    expect(businessFunnel({ leads, attributions, finishedOne: 5, days: 30, now: NOW }).closings).toEqual({ count: 1, priced: 1, volume: 340_000 });
  });

  it("falls back to ninety days for anything it does not know", () => {
    expect(periodFrom("30")).toBe(30);
    expect(periodFrom("7")).toBe(90);
    expect(periodFrom(undefined)).toBe(90);
  });
});

describe("sources", () => {
  const leads = [
    lead("a", { stage: "Closed" }), lead("b", { stage: "Searching" }), lead("c"),
    lead("r", { source: "referral", sessionId: null }), lead("m", { source: "manual", sessionId: null }),
    lead("u", { sessionId: null }),
  ];
  const attributions = [attr("s-a", "google", "organic"), attr("s-b", "google", "organic"), attr("s-c", "facebook", "paid-social"), attr("o1", "google", "organic")];

  it("attributes a lead to its first touch and counts how far each source got", () => {
    const rows = bySource({ leads, attributions, days: 90, now: NOW });
    const organic = rows.find((r) => r.channel === "Organic search")!;
    expect(organic).toMatchObject({ visitors: 3, leads: 2, clients: 2, closed: 1, rate: 67 });
  });

  it("keeps referrals, hand-added people and untracked leads as their own rows rather than dropping them", () => {
    const rows = bySource({ leads, attributions, days: 90, now: NOW });
    expect(rows.find((r) => r.channel === "Client referral")!.leads).toBe(1);
    expect(rows.find((r) => r.channel === "Added by hand")!.leads).toBe(1);
    expect(rows.find((r) => r.channel === "Direct or unknown")!.leads).toBe(1);
    /* Every lead of the period is in exactly one row. */
    expect(rows.reduce((a, r) => a + r.leads, 0)).toBe(6);
  });

  it("gives no rate to a source with no visitors counted", () => {
    const rows = bySource({ leads, attributions, days: 90, now: NOW });
    expect(rows.find((r) => r.channel === "Client referral")!.rate).toBeNull();
  });
});

describe("the pipeline", () => {
  const live = [
    { stage: "Searching", value: 400_000, valueKnown: true },
    { stage: "Searching", value: 0, valueKnown: false },
    { stage: "Under contract", value: 500_000, valueKnown: true },
    { stage: "Closed", value: 999_999, valueKnown: true },
  ];

  it("weights each stage, multiplies by the commission setting, and orders stages by progress", () => {
    const p = pipelineOf(live, [], 3);
    expect(p.stages.map((s) => s.stage)).toEqual(["Searching", "Under contract"]);
    /* Assumed weights: Searching 45%, Under contract 90%. */
    expect(p.weighted).toBeCloseTo(400_000 * 0.45 + 500_000 * 0.9);
    expect(p.commission).toBeCloseTo(p.weighted * 0.03);
    expect(p.value).toBe(900_000);
  });

  it("counts somebody nobody priced as a person and adds nothing to the money", () => {
    const p = pipelineOf(live, [], 3);
    expect(p.people).toBe(3);
    expect(p.priced).toBe(2);
    expect(p.unpriced).toBe(1);
  });

  it("does not forecast from a stage somebody has already finished", () => {
    expect(pipelineOf(live, [], 3).stages.some((s) => s.stage === "Closed")).toBe(false);
  });

  it("labels every stage with what its odds rest on", () => {
    for (const s of pipelineOf(live, [], 3).stages) expect(s.basis).toBe("assumed");
  });
});
