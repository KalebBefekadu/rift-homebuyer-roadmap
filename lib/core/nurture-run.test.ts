import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runOptions, DEFAULT_MAX_PER_RUN } from "@/lib/core/nurture";

/**
 * The nurture cron is the only thing in this product that reaches a person
 * unprompted, in bulk, on a timer. It ran for the life of the deployment with
 * neither a preview nor a ceiling, which was survivable only because no address
 * was configured and so nothing ever sent.
 *
 * That is the dangerous shape: the cohort accumulates while sending is off, so
 * the moment it is switched on the FIRST run is the largest one this product
 * will ever do: through a path that has never sent a real message.
 */
describe("what one nurture run is allowed to do", () => {
  const url = (q: string) => `https://rift.example/api/nurture/run${q}`;

  it("sends for real when nothing is asked for, because that is what a scheduler is for", () => {
    expect(runOptions(url(""))).toEqual({ dry: false, max: DEFAULT_MAX_PER_RUN });
  });

  it("caps rather than uncapping when max is absent", () => {
    /* The direction of the default is the whole point. Forgetting a limit must
       not mean not having one. */
    expect(runOptions(url("?dry=1")).max).toBe(DEFAULT_MAX_PER_RUN);
    expect(DEFAULT_MAX_PER_RUN).toBeGreaterThan(0);
  });

  it("reads dry as on for anything but an explicit off", () => {
    for (const q of ["?dry=1", "?dry=true", "?dry=", "?dry=yes", "?dry"]) {
      expect(runOptions(url(q)).dry, q).toBe(true);
    }
    for (const q of ["?dry=0", "?dry=false", "?dry=FALSE", ""]) {
      expect(runOptions(url(q)).dry, q).toBe(false);
    }
  });

  it("honours a max of zero", () => {
    /* "Send nothing" is a thing somebody may genuinely want, and it is not the
       same request as "you forgot to tell me". */
    expect(runOptions(url("?max=0")).max).toBe(0);
  });

  it("falls back to the cap for a garbage max rather than to no limit", () => {
    for (const q of ["?max=-5", "?max=abc", "?max="]) {
      expect(runOptions(url(q)).max, q).toBe(DEFAULT_MAX_PER_RUN);
    }
  });

  it("floors a fractional max instead of comparing against a fraction", () => {
    expect(runOptions(url("?max=3.7")).max).toBe(3);
  });

  it("still returns a usable answer for a URL it cannot parse", () => {
    /* A run that throws while working out its own safety limits is worse than
       one that uses the default. */
    expect(runOptions("not a url")).toEqual({ dry: false, max: DEFAULT_MAX_PER_RUN });
  });
});

/**
 * The property that makes `?dry=1` worth anything: a dry run must not be able
 * to write or send. A preview that half-commits is more dangerous than no
 * preview, because it is trusted.
 *
 * Asserted against the source rather than by mocking, because the thing being
 * guarded is that nobody later adds a call inside that branch.
 */
describe("a dry run cannot reach anybody", () => {
  const src = readFileSync(resolve(__dirname, "../../app/api/nurture/run/route.ts"), "utf8");

  /* Everything in this route that writes to the database or hands a message to
     a sending service. */
  const EFFECTS = ["claimStep", "markTouch", "sendTouch", "sendResume"];

  it("takes its limits from the shared helper rather than reading the URL itself", () => {
    expect(src).toContain("runOptions(req.url)");
  });

  it("does nothing but record an intention inside the dry branch", () => {
    const open = src.indexOf("if (dry) {");
    expect(open, "the dry branch").toBeGreaterThan(-1);

    /* Walk braces rather than matching a closing one by eye: a nested block
       inside would otherwise end the search early and the guard would pass on
       code it never read. */
    let depth = 0, end = -1;
    for (let i = src.indexOf("{", open); i < src.length; i++) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}" && --depth === 0) { end = i; break; }
    }
    expect(end, "the dry branch closes").toBeGreaterThan(open);

    const branch = src.slice(open, end);
    for (const effect of EFFECTS) {
      expect(branch, `a dry run must not call ${effect}`).not.toContain(effect);
    }
    expect(branch).toContain("continue;");
  });

  it("decides the budget before it claims anything", () => {
    /* The cap has to be checked ahead of the claim. Claiming and then declining
       to send marks a step as done that nobody was told about: the step is
       then never sent at all, which is worse than sending it late. */
    const budget = src.indexOf(">= max");
    expect(budget).toBeGreaterThan(-1);
    for (const effect of EFFECTS) {
      expect(src.indexOf(effect + "("), `${effect} is called after the budget check`)
        .toBeGreaterThan(budget);
    }
  });

  it("reports which kind of run it was", () => {
    /* A dry body is shaped like a real one. A reader who assumes the wrong one
       has either panicked over nothing or relaxed about something that went. */
    expect(src).toMatch(/ok: true,[\s\S]{0,400}\bdry,/);
  });

  it("reports what the cap held back", () => {
    expect(src).toContain("deferred");
  });
});

/**
 * AT37: a reply, opt-out or journey recorded after the queue was read stops
 * the send. The queue is read once, at the start of a run that can take a
 * minute; the recheck is what makes "immediate" true.
 */
describe("a stop after the queue was read still stops the send", () => {
  const src = readFileSync(resolve(__dirname, "../../app/api/nurture/run/route.ts"), "utf8");

  it("rechecks after the claim and before either send", () => {
    const claim = src.indexOf("claimStep(");
    const recheck = src.indexOf("stillOwed(");
    expect(recheck, "the send is rechecked").toBeGreaterThan(claim);
    expect(src.indexOf("sendTouch(")).toBeGreaterThan(recheck);
    expect(src.indexOf("sendResume(")).toBeGreaterThan(recheck);
  });

  it("reads the provider's opt-out list before the loop, and never stops a sequence on a dry run", () => {
    expect(src.indexOf("blockedContacts(")).toBeLessThan(src.indexOf("for (const t of queue.data)"));
    expect(src).toMatch(/if \(!dry && reason && agentId\)[\s\S]{0,80}stop\(/);
  });

  it("tries no other channel for somebody who opted out", () => {
    const at = src.indexOf("if (block) {");
    const branch = src.slice(at, src.indexOf("continue;", at));
    for (const other of ["sendTouch", "sendResume", "claimStep", "text"]) {
      expect(branch, other).not.toContain(other + "(");
    }
  });

  it("reports what was stopped and whether the opt-out list was read", () => {
    for (const k of ["optedOut", "stoppedBeforeSend", "optOuts:"]) expect(src).toContain(k);
  });
});
