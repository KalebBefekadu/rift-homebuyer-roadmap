import { describe, it, expect, vi, beforeEach } from "vitest";
import { fakeDb, type Answers, type Fake } from "./test/fake-db";

/**
 * The other way into the client list.
 *
 * `board()` answers "who have I left alone too long" — only people with a
 * stage, sorted by neglect. It cannot answer "somebody just rang and said
 * their name", which is the question an agent actually asks under pressure.
 *
 * What is asserted here is mostly about what the query must NOT quietly do:
 * lose the agent scope, treat a search box as a place to write PostgREST
 * syntax, or show the first hundred of four hundred without saying so.
 */

let db: Fake;
const build = (answers: Answers = {}) => { db = fakeDb(answers); return db; };

vi.mock("./service", () => ({
  serviceClient: () => db,
  currentAgentId: async () => "agent-1",
}));
vi.mock("@/lib/monitoring/capture", () => ({ captureOpError: vi.fn() }));

const { roster } = await import("./clients");

const rows = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `l${i}`, name: `P${i}`, side: "buy", created_at: "2026-09-01T00:00:00Z",
  }));

beforeEach(() => { vi.clearAllMocks(); });

describe("scoping", () => {
  it("never reads anybody else's people", async () => {
    /* The service client bypasses RLS entirely, so this filter is the only
       thing between one agent's roster and the whole table. */
    build();
    await roster();
    expect(db.calls[0]!.filters).toContain("eq:agent_id=agent-1");
  });

  it("hides archived people by default and shows only them when asked", async () => {
    build();
    await roster();
    expect(db.calls[0]!.filters).toContain("is:archived_at=null");

    build();
    await roster({ filter: "archived" });
    expect(db.calls[0]!.filters).toContain("not:archived_at.is=null");
    expect(db.calls[0]!.filters).not.toContain("is:archived_at=null");
  });

  it("separates people being worked from people nobody has picked up", async () => {
    /* The second group is the one `board()` cannot show at all, and the one
       most likely to be lost. */
    build();
    await roster({ filter: "working" });
    expect(db.calls[0]!.filters).toContain("not:stage.is=null");

    build();
    await roster({ filter: "new" });
    expect(db.calls[0]!.filters).toContain("is:stage=null");
  });
});

describe("the search box", () => {
  it("looks in a name, an email and a phone number", async () => {
    /* A missed call is a number, not a name. */
    build();
    await roster({ q: "sara" });
    const or = db.calls[0]!.filters.find((f) => f.startsWith("or:"))!;
    expect(or).toContain("name.ilike");
    expect(or).toContain("email.ilike");
    expect(or).toContain("phone.ilike");
  });

  it("does not let a typed comma become part of the query", async () => {
    /* PostgREST's `or` is comma-separated and parenthesised. A name with a
       comma in it would otherwise be read as a second condition — at best an
       error, at worst a filter nobody wrote. */
    build();
    await roster({ q: "O'Brien, Sara (Mrs)" });
    const or = db.calls[0]!.filters.find((f) => f.startsWith("or:"))!;
    const conditions = or.slice(3).split(",");
    expect(conditions, "the search text split the query into extra conditions").toHaveLength(3);
    expect(or).not.toContain("(");
  });

  it("applies no text filter at all for a blank box", async () => {
    build();
    await roster({ q: "   " });
    expect(db.calls[0]!.filters.some((f) => f.startsWith("or:"))).toBe(false);
  });

  it("bounds what it will search for", async () => {
    build();
    await roster({ q: "x".repeat(500) });
    const or = db.calls[0]!.filters.find((f) => f.startsWith("or:"))!;
    expect(or.length).toBeLessThan(400);
  });
});

describe("how much it returns", () => {
  it("says when the list was cut short, rather than looking complete", async () => {
    /* A list that silently shows the first hundred of four hundred is the same
       lie as one that shows none of them. */
    build({ rift_leads: { data: rows(101) } });
    const r = await roster({ limit: 100 });

    expect(r.ok && "data" in r && r.data.people).toHaveLength(100);
    expect(r.ok && "data" in r && r.data.more).toBe(true);
  });

  it("does not claim there are more when the page is exactly full", async () => {
    build({ rift_leads: { data: rows(100) } });
    const r = await roster({ limit: 100 });
    expect(r.ok && "data" in r && r.data.more).toBe(false);
  });

  it("asks for one more row than it intends to show", async () => {
    /* Which is what makes "there are others" a fact rather than a guess from
       a full page. */
    build();
    await roster({ limit: 25 });
    expect(db.calls[0]!.filters).toContain("limit:26");
  });

  it("refuses an absurd limit rather than asking for the whole table", async () => {
    build();
    await roster({ limit: 100_000 });
    const limit = Number(db.calls[0]!.filters.find((f) => f.startsWith("limit:"))!.slice(6));
    expect(limit).toBeLessThanOrEqual(501);
  });
});

describe("ordering", () => {
  it("returns people newest first, not by score", async () => {
    /* Deliberately unranked. Today's screen has an opinion about who matters;
       this one must not, or it becomes a second ranking to disagree with. */
    build();
    await roster();
    expect(db.calls[0]!.filters).toContain("order:created_at desc");

    /* Only the ORDER is asserted on. `score` is in the select list, as it must
       be — the row shows the band. Grepping the whole filter list for it would
       pass or fail on which columns are fetched, which is not what this test
       is about. */
    const orders = db.calls[0]!.filters.filter((f) => f.startsWith("order:"));
    expect(orders).toEqual(["order:created_at desc"]);
  });
});

describe("what it reports back", () => {
  it("echoes the filters it actually applied", async () => {
    /* So the page cannot describe a search it did not run — including the
       search text after it has been stripped. */
    build();
    const r = await roster({ q: "sa,ra", filter: "working", side: "sell" });
    expect(r.ok && "data" in r && r.data.applied)
      .toEqual({ q: "sa ra", filter: "working", side: "sell" });
  });

  it("degrades with no database rather than returning an empty roster", async () => {
    /* "You have nobody" and "we could not ask" are the same picture and
       completely different facts. */
    const saved = db;
    db = undefined as unknown as Fake;
    const r = await roster();
    db = saved;

    expect(r.ok).toBe(true);
    expect("skipped" in r).toBe(true);
    expect("data" in r).toBe(false);
  });
});
