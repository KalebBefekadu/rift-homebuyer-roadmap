import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Who waits on a read decides its deadline (lib/db/bounded.ts).
 *
 * A stranger on the public funnel gets two seconds, because past that people
 * leave and a fallback answer serves them better than a spinner. Everybody
 * else, the agent, a signed-in client, a client opening their own link, a
 * scheduled job, gets eight: they are not leaving, and the two seconds were
 * being spent on cold starts, so working pages said "could not be read".
 */
/* campaigns is in neither list: its public landing page reads with a
   visitor's deadline and the agent's Campaigns board with the longer one. */
const VISITOR = ["attribution", "program-checks", "questions", "settings", "saved-plan", "nurture", "plan"];
const PATIENT = [
  "portal", "progress", "listing", "clients", "referral", "bids", "transactions", "journeys", "tours", "search",
  "offer-room", "documents", "decisions", "deadlines", "seller", "outbox", "money", "shortlist", "offers",
  "lead-background", "dependencies", "desk", "pilot", "retention", "summary-links", "seam", "profile", "summary",
];
const src = (m: string) => readFileSync(`lib/db/${m}.ts`, "utf8");

describe("a read's deadline follows who is waiting", () => {
  for (const m of PATIENT) {
    it(`${m} waits the agent's deadline, not a visitor's`, () => {
      expect(src(m)).not.toMatch(/boundedRead\(/);
    });
  }
  for (const m of VISITOR) {
    it(`${m} keeps the visitor's deadline, because a stranger is waiting on it`, () => {
      expect(src(m)).not.toMatch(/boundedReport\(/);
    });
  }
});
