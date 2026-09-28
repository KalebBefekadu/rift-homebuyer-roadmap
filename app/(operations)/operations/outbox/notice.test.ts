import { describe, it, expect } from "vitest";
import { sendNotice, stepNotice } from "./notice";

/**
 * Every outbox answer reaches the screen as words.
 *
 * The case that matters most is the refusal: the last check before sending
 * holds the message back, it stays approved, and without its reason the agent
 * sees an item that simply did not go.
 */
describe("sendNotice", () => {
  it("names why an approved message was held back", () => {
    const n = sendNotice({ ok: true, data: { state: "approved", detail: null, blockers: ["the person replied after it was approved; read that first"] } });
    expect(n.ok).toBe(false);
    expect(n.text).toBe("Approved, not sent: the person replied after it was approved; read that first.");
  });

  it("says sent only when it was", () => {
    expect(sendNotice({ ok: true, data: { state: "succeeded", detail: "abc", blockers: [] } })).toEqual({ ok: true, text: "Sent." });
  });

  it("keeps a possible send apart from a failure", () => {
    const n = sendNotice({ ok: true, data: { state: "unknown", detail: "timed out", blockers: [] } });
    expect(n.ok).toBe(false);
    expect(n.text).toMatch(/may have sent \(timed out\)/);
    expect(sendNotice({ ok: true, data: { state: "failed", detail: "Brevo said no", blockers: [] } }).text).toBe("Did not send: Brevo said no.");
  });

  it("reports a refusal or a missing database as not sent", () => {
    expect(sendNotice({ ok: false, error: "It is cancelled and cannot be approved" }).text).toBe("Not sent: It is cancelled and cannot be approved.");
    expect(sendNotice({ ok: true, skipped: true, reason: "no database configured" }).text).toBe("Not sent: no database configured.");
  });
});

describe("stepNotice", () => {
  it("carries the failure rather than the success line", () => {
    expect(stepNotice({ ok: false, error: "It cannot be discarded now" }, "Discarded.")).toEqual({ ok: false, text: "It cannot be discarded now." });
    expect(stepNotice({ ok: true, data: true }, "Discarded.")).toEqual({ ok: true, text: "Discarded." });
  });
});
