import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { buildNewLead, type NewLeadEmail } from "./email";
import { scoreLead } from "./lead";

/**
 * The alert that tells the agent somebody is waiting.
 *
 * Nothing did this before. Studio ranked leads, timed an SLA against them and
 * worked out the cadence they were owed, all of which needed Kaleb to already
 * be looking at the screen. A lead in the `now` band carries a fifteen-minute
 * reply target and arrived, until this, in total silence.
 *
 * These characterise the message rather than the markup: what a phone screen
 * has to show for him to decide whether to stop what he is doing.
 */

const base: NewLeadEmail = {
  to: "kaleb@example.com",
  name: "Marcus Webb",
  email: "marcus@example.com",
  side: "buy",
  band: "now",
  score: 82,
  headline: "Ready now, fully answered, contactable",
  action: "Call today",
  signals: [
    { label: "Timing", points: 30, note: "Wants to move in under three months" },
    { label: "Completion", points: 12, note: "Answered everything" },
    { label: "Co-buyer", points: -4, note: "Named someone else who decides" },
  ],
  timing: "0-3 months",
  county: "DeKalb",
  value: 325_000,
  source: "readout",
  studioUrl: "https://rift.example.com/studio/lead/abc",
};

const render = (o: Partial<NewLeadEmail> = {}) => buildNewLead({ ...base, ...o });

describe("what the subject line has to carry", () => {
  it("leads with the urgency, not with the product's name", () => {
    /* Read on a lock screen, where roughly this much is visible. "Rift: new
       lead" tells him nothing he can act on and trains him to open it later. */
    expect(render()!.subject).toBe("Call today: Marcus Webb, buying in DeKalb County");
  });

  it("says which side without being opened", () => {
    expect(render({ side: "sell" })!.subject).toContain("selling");
  });

  it("marks a buyer from abroad, because it is a different conversation", () => {
    /* No Georgia Dream, no Social Security number, a wire from another
       country. Worth two words in a subject line. */
    expect(render({ source: "abroad" })!.subject).toContain("from abroad");
  });

  it("does not say abroad about anybody else", () => {
    expect(render({ source: "readout" })!.subject).not.toContain("abroad");
  });

  it("copes with no name", () => {
    const s = render({ name: undefined })!.subject;
    expect(s).toContain("Someone");
    expect(s).not.toContain("undefined");
  });

  it("copes with no county", () => {
    const s = render({ county: undefined })!.subject;
    expect(s).not.toContain("undefined");
    expect(s).not.toContain("County");
  });

  it("carries the band's own label for each band", () => {
    expect(render({ band: "soon" })!.subject.startsWith("This week")).toBe(true);
    expect(render({ band: "later" })!.subject.startsWith("Scheduled")).toBe(true);
    expect(render({ band: "nurture" })!.subject.startsWith("Nurture")).toBe(true);
  });
});

describe("what the body has to carry", () => {
  it("states the reply window, because the band alone does not", () => {
    expect(render({ band: "now" })!.html).toContain("within 15 minutes");
    expect(render({ band: "soon" })!.html).toContain("within 4 hours");
  });

  it("gives a way to reach them", () => {
    expect(render()!.html).toContain("marcus@example.com");
  });

  it("gives the phone number when there is one", () => {
    expect(render({ phone: "(404) 555-0142" })!.html).toContain("(404) 555-0142");
  });

  it("quotes their timing in their own words", () => {
    expect(render()!.html).toContain("0-3 months");
  });

  it("shows the deal size", () => {
    expect(render()!.html).toContain("$325,000");
  });

  it("omits the deal size rather than printing $0", () => {
    /* A lead from /book has no price behind it. "Target price $0" is the
       house failure mode: a figure that renders perfectly and is about
       nothing. */
    expect(render({ value: 0 })!.html).not.toContain("$0");
  });

  it("links straight to the person", () => {
    expect(render()!.html).toContain("https://rift.example.com/studio/lead/abc");
  });

  it("shows the three strongest signals, by magnitude", () => {
    const html = render()!.html;
    expect(html).toContain("Wants to move in under three months");
    /* Negative points are as informative as positive ones: a named
       co-decider changes the first call. */
    expect(html).toContain("Named someone else who decides");
  });

  it("survives a lead with no signals at all", () => {
    const html = render({ signals: [] })!.html;
    expect(html).not.toContain("What moved the ranking");
    expect(html).not.toContain("undefined");
  });
});

describe("when it refuses", () => {
  it("does not send about somebody who left no way to reach them", () => {
    /* An alert with no available action at the end of it. One of those and
       the next one gets opened more slowly; a few and the stream stops being
       opened at all. */
    expect(buildNewLead({ ...base, email: undefined, phone: undefined })).toBeNull();
  });

  it("sends when only a phone number was given", () => {
    expect(buildNewLead({ ...base, email: undefined, phone: "(404) 555-0142" })).not.toBeNull();
  });
});

describe("nothing leaks or breaks", () => {
  it("escapes a name that is markup", () => {
    const html = render({ name: '<script>alert(1)</script>' })!.html;
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });

  it("prints no NaN, undefined or unresolved template anywhere", () => {
    for (const o of [
      {}, { name: undefined }, { county: undefined }, { value: 0 }, { timing: "" },
      { signals: [] }, { phone: "(404) 555-0142" }, { band: "nurture" as const },
    ]) {
      const built = render(o)!;
      for (const text of [built.subject, built.html]) {
        expect(text).not.toContain("NaN");
        expect(text).not.toContain("undefined");
        expect(text).not.toContain("${");
      }
    }
  });

  it("describes a real score rather than an invented one", () => {
    /* Fed from the actual scorer, so a change to banding cannot leave this
       email describing a band the product no longer assigns. */
    const s = scoreLead({
      side: "buy", timing: "0-3 months", completion: 1, hoursSince: 0,
      value: 325_000, monthsToReady: 0, coBuyer: false, contactable: true, source: "readout",
    });
    const built = buildNewLead({ ...base, band: s.band, score: s.score, headline: s.headline, action: s.action, signals: s.signals })!;
    expect(built.subject).toContain(s.band === "now" ? "Call today" : "");
    expect(built.html).toContain(String(s.score));
  });
});

describe("the capture route still sends it", () => {
  /* The builder being correct proves nothing about whether anything calls it.
     That gap is this codebase's whole bug history: /api/attribution's helpers
     were right and tested while the caller fed them the wrong value, and both
     crons exported the wrong verb behind a green suite. */
  const route = readFileSync("app/api/capture/route.ts", "utf8");

  it("calls sendNewLead", () => {
    expect(route).toContain("sendNewLead(");
  });

  it("awaits it rather than leaving it floating", () => {
    /* A serverless invocation ends with the response. An un-awaited promise
       is dropped, which would make this the kind of feature that is wired up,
       reviewed, merged, and never once runs. */
    expect(route).toMatch(/await sendNewLead\(/);
  });

  it("sends only after the lead is stored", () => {
    const capture = route.indexOf("await captureLead(");
    const alert = route.indexOf("sendNewLead(");
    expect(capture).toBeGreaterThan(-1);
    expect(alert).toBeGreaterThan(capture);
  });

  it("does not fail the capture when the alert fails", () => {
    /* The relationship outlives the notification about it. */
    const after = route.slice(route.indexOf("sendNewLead("));
    expect(after).not.toMatch(/if \(!sent\.ok\) return NextResponse/);
  });
});
