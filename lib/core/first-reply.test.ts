import { describe, it, expect } from "vitest";
import { firstReply, replyChannels, REPLY_NOTE } from "./first-reply";

describe("the first reply to a new lead", () => {
  it("names the agent and what they did, and carries no figure", () => {
    const r = firstReply({ agentName: "Kaleb Befekadu", name: "Marcus Bell", side: "buy" });
    expect(r.text).toBe("Hi Marcus, this is Kaleb Befekadu. I saw the buying plan you worked out on Rift. Is now a good time for a quick call about it?");
    expect(r.text).not.toMatch(/\$|\d/);
    expect(r.subject).toBe("Your buying plan");
  });

  it("speaks to a seller as a seller, and to somebody who left no name without inventing one", () => {
    expect(firstReply({ agentName: "Kaleb Befekadu", name: "Grace Whitfield", side: "sell" }).text).toMatch(/^Hi Grace, .*selling plan/);
    expect(firstReply({ agentName: "Kaleb Befekadu", name: null, side: "buy" }).text).toMatch(/^Hi, this is Kaleb/);
  });

  it("offers a text only with phone consent, a call with any number, and email with an address", () => {
    expect(replyChannels({ phone: "(404) 555-0142", phoneConsent: true, email: "a@b.co" })).toEqual(["call", "text", "email"]);
    expect(replyChannels({ phone: "(404) 555-0142", phoneConsent: false, email: null })).toEqual(["call"]);
    expect(replyChannels({ phone: null, phoneConsent: true, email: "a@b.co" })).toEqual(["email"]);
  });

  it("records each way of replying as the contact kind Relationships counts", () => {
    expect(Object.keys(REPLY_NOTE).sort()).toEqual(["call", "email", "text"]);
  });
});
