import { describe, expect, it } from "vitest";
import { MOMENTS, type MomentState } from "@/lib/core/referral";
import { REFERRAL_STATE, dueNow, referralStats } from "@/app/prototype/studio/clients/referral-demo";

/**
 * The specification screen's fixture.
 *
 * These five clients are invented and are drawn only by `/prototype`, which
 * does not serve in production. The tests stay because the fixture still has
 * to obey the rules it illustrates: a specification that demonstrates the
 * wrong behaviour is worse than none, since it is what the next person builds
 * against.
 */

describe("the queue and the counts", () => {
  it("puts the strongest moment first", () => {
    const strengths = dueNow().map((x) => x.m.strength);
    expect(strengths).toEqual([...strengths].sort((a, b) => b - a));
  });

  it("carries only what is due or being held", () => {
    for (const { c, m } of dueNow()) {
      expect(["due", "held"]).toContain(c.states[m.id]);
    }
  });

  it("counts referrals without double-counting an advocate", () => {
    const s = referralStats();
    const sent = REFERRAL_STATE.flatMap((c) => c.sent);
    expect(s.sent).toBe(sent.length);
    expect(s.closed + s.active).toBeLessThanOrEqual(s.sent);
    expect(s.advocates).toBeLessThanOrEqual(REFERRAL_STATE.length);
    expect(s.advocates).toBe(REFERRAL_STATE.filter((c) => c.sent.length > 0).length);
  });

  it("only uses states the model defines", () => {
    const states: MomentState[] = ["waiting", "due", "sent", "acted", "declined", "held"];
    const ids = new Set(MOMENTS.map((m) => m.id));
    for (const c of REFERRAL_STATE) {
      for (const [id, st] of Object.entries(c.states)) {
        expect(ids.has(id as never), `${c.client} · ${id}`).toBe(true);
        expect(states).toContain(st);
      }
    }
  });
});
