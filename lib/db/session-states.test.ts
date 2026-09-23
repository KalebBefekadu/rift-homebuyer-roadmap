import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * A blip must not look like an expired session.
 *
 * `currentAgent()` returned `AgentSession | null`, and null meant four things:
 * nobody is signed in, Supabase is not configured, the auth call did not
 * answer within two seconds, and the agent row could not be read. Every page
 * turned all four into `redirect("/studio/sign-in")`.
 *
 * So a two-second blip signed the agent out: not really, the cookie was still
 * there and the next request worked, but he was looking at a sign-in page,
 * which says his session expired. It reproduces on the first request after a
 * cold start, which on Vercel is the first thing he does in the morning.
 *
 * Same discipline as DbResult, in the one place it was missing: "it did not
 * work" and "there is nobody here" are different facts.
 */

function pages(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const e of readdirSync(d)) {
      const p = join(d, e);
      if (statSync(p).isDirectory()) { walk(p); continue; }
      if (e === "page.tsx") out.push(p);
    }
  };
  walk(dir);
  return out;
}

const STUDIO = pages("app/(studio)");

describe("every Studio page", () => {
  it("was found at all", () => {
    /* A guard that silently walks an empty list is worse than no guard. */
    expect(STUDIO.length).toBeGreaterThan(4);
  });

  for (const page of STUDIO) {
    const src = readFileSync(page, "utf8");
    /* The sign-in page itself has no session to check. */
    if (!/agentSession|currentAgent/.test(src)) continue;

    /* The sign-in page itself is exempt, and only it. It uses the session to
       send an ALREADY signed-in agent away; on "unknown" it shows the form,
       which is both what it would have done anyway and the right answer:
       somebody who cannot be confirmed should be offered a way in. Every other
       page runs the other direction, and that direction is where the lie is. */
    const sendsToSignIn = /redirect\("\/studio\/sign-in"\)/.test(src);
    const isSignIn = page.includes("sign-in");

    it(`${page} asks for three answers, not two`, () => {
      if (isSignIn) {
        expect(src, "the sign-in page may use currentAgent(), but only to redirect a signed-in agent AWAY")
          .toMatch(/if \(agent\) redirect\("\/studio"\)/);
        return;
      }
      expect(src, "uses currentAgent(), which collapses an outage into a signed-out visitor")
        .not.toMatch(/await currentAgent\(\)/);
      expect(src).toMatch(/await agentSession\(\)/);
    });

    it(`${page} does not send an agent to sign in over an outage`, () => {
      if (!sendsToSignIn || isSignIn) return;

      /* The redirect must be guarded by the signed-out state specifically.
         `if (!agent) redirect(...)` is the shape that caused this. */
      expect(src, "redirects to sign-in without first distinguishing 'unknown'")
        .toMatch(/session\.state === "signed-out"[\s\S]{0,80}redirect\("\/studio\/sign-in"\)/);
      expect(src, "nothing handles the 'unknown' state")
        .toMatch(/session\.state === "unknown"/);
    });
  }
});

describe("what the unknown state renders", () => {
  const src = readFileSync("app/(studio)/studio/Unavailable.tsx", "utf8");

  it("says outright that this is not being signed out", () => {
    /* The whole reason the page exists. A sign-in form makes a claim about
       what happened, and the claim is wrong. */
    expect(src).toMatch(/not the same as being signed out/i);
  });

  it("gives a way back that is not a sign-in form", () => {
    expect(src).toMatch(/href="\/studio"/);
  });

  it("says what actually failed", () => {
    /* The reason is passed through rather than generalised. "The sign-in check
       did not answer in time" and "the database is not configured" need
       different actions from the one person who can take either. */
    expect(src).toMatch(/\{reason\}/);
  });
});

describe("the session itself", () => {
  const src = readFileSync("lib/db/session.ts", "utf8");

  it("calls a timeout unknown and an auth error signed-out", () => {
    /* The distinction that makes the whole thing work. A missing, malformed or
       expired token IS an auth error: that is genuinely signed out. Only the
       absence of an answer is unknown. */
    expect(src).toMatch(/if \(timedOut\) return \{ state: "unknown"/);
    expect(src).toMatch(/auth\.error[\s\S]{0,60}state: "signed-out"/);
  });

  it("treats a signed-in user who is not an agent as signed out, not unknown", () => {
    /* The question was asked and answered, and the answer was no. Reporting
       it as unknown would loop somebody who can never get in. */
    expect(src).toMatch(/if \(!agent\) return \{ state: "signed-out"/);
  });

  it("keeps currentAgent() for the write actions, and says why", () => {
    /* An action that cannot confirm the session must refuse either way, so
       the distinction buys nothing there, but a PAGE has somewhere better to
       send a person than a form they do not need. */
    expect(src).toMatch(/export async function currentAgent\(\)/);
    expect(src).toMatch(/Every PAGE should use `agentSession\(\)`/);
  });
});
