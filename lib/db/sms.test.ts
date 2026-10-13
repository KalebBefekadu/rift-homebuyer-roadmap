import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The new-lead text: off and saying why until it can actually send, and only
 * ever to the agent's own number.
 */

let phone: string | null = "404-555-0123";
vi.mock("@/lib/db/service", () => ({ currentAgentPhone: async () => phone }));
vi.mock("@/lib/monitoring/capture", () => ({ captureOpError: () => {} }));
const fetchSpy = vi.fn();
vi.stubGlobal("fetch", fetchSpy);

const { sendAgentText } = await import("./sms");

beforeEach(() => {
  phone = "404-555-0123";
  fetchSpy.mockReset();
  process.env.BREVO_API_KEY = "k";
  process.env.BREVO_SMS_SENDER = "Rift";
});

describe("sendAgentText", () => {
  it("sends to the agent's number, in Brevo's shape", async () => {
    fetchSpy.mockResolvedValue(new Response('{"messageId":7}', { status: 201 }));
    const r = await sendAgentText("hello");
    expect(r).toEqual({ ok: true, messageId: "7" });
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("https://api.brevo.com/v3/transactionalSMS/send");
    expect(JSON.parse(init.body)).toMatchObject({ sender: "Rift", recipient: "14045550123", content: "hello", type: "transactional" });
  });

  it("is skipped, with the reason, without a sender name", async () => {
    delete process.env.BREVO_SMS_SENDER;
    const r = await sendAgentText("hello");
    expect(r).toMatchObject({ ok: true, skipped: true, reason: expect.stringContaining("BREVO_SMS_SENDER") });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("is skipped when Settings has no number, or one it cannot read", async () => {
    phone = null;
    expect(await sendAgentText("x")).toMatchObject({ skipped: true, reason: "no phone number in Settings" });
    phone = "555-0123";
    expect(await sendAgentText("x")).toMatchObject({ skipped: true, reason: expect.stringContaining("could not be read") });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("reports a refusal as a failure, never as sent", async () => {
    fetchSpy.mockResolvedValue(new Response("not enough credits", { status: 402 }));
    const r = await sendAgentText("hello");
    expect(r.ok).toBe(false);
  });
});
