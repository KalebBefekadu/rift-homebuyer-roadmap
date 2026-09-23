import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { fakeDb, type Answers, type Fake } from "./test/fake-db";

/**
 * What the client's own page is allowed to know.
 *
 * `readPlanByToken` is the only query in this product that answers somebody
 * who is not the agent and has no session. The token is the whole
 * authorisation, and the row it lands on is the agent's working record of a
 * person: a score, a band, why they may lawfully be contacted, the signals
 * that produced their ranking, and (if it ever comes to it) the reason he
 * archived them.
 *
 * None of that was written to be read by the person it is about. A `select("*")`
 * here with fields picked off afterwards would put all of it on the server
 * rendering their page, one careless line away from being displayed.
 */

let db: Fake;
const build = (answers: Answers = {}) => { db = fakeDb(answers); return db; };

vi.mock("./service", () => ({
  serviceClient: () => db,
  currentAgentId: async () => "agent-1",
}));
vi.mock("@/lib/monitoring/capture", () => ({ captureOpError: vi.fn() }));

const { readPlanByToken, SAFE_LEAD_COLUMNS } = await import("./plan");

const TOKEN = "a".repeat(32);

beforeEach(() => { vi.clearAllMocks(); });

/** Everything on a lead row that is the agent's and not the client's. */
const PRIVATE = [
  "score", "band", "signals", "contact_basis", "archived_reason", "archived_at",
  "lead_input", "human_replied_at", "next_action", "next_due", "session_id",
  "email", "phone", "agent_id", "funnel_version_id", "source",
];

describe("the columns the client's page asks for", () => {
  it("names them, rather than selecting everything", () => {
    build({ rift_leads: { data: [{ id: "l1", name: "Sara Tesfaye", side: "buy" }] } });
    expect(SAFE_LEAD_COLUMNS).not.toBe("*");
    expect(SAFE_LEAD_COLUMNS.split(",").length).toBeLessThan(8);
  });

  it("includes nothing that belongs to the agent", () => {
    for (const column of PRIVATE) {
      expect(SAFE_LEAD_COLUMNS.split(","), `${column} must not reach the client's page`)
        .not.toContain(column);
    }
  });

  it("asks the database for exactly that list", () => {
    build({ rift_leads: { data: [{ id: "l1", name: "Sara", side: "buy" }] } });
    return readPlanByToken(TOKEN).then(() => {
      const select = db.to("select rift_leads")[0]!.filters.find((f) => f.startsWith("select:"))!;
      expect(select).toBe(`select:${SAFE_LEAD_COLUMNS}`);
    });
  });

  it("never reads the agent's notes", async () => {
    /* rift_lead_notes is his record of the relationship, including his
       judgement about somebody. A product that shows it to them teaches him to
       stop writing honestly, which costs more than the feature is worth. */
    build({ rift_leads: { data: [{ id: "l1", name: "Sara", side: "buy" }] } });
    await readPlanByToken(TOKEN);
    expect(db.calls.map((c) => c.table)).not.toContain("rift_lead_notes");
  });

  it("returns only the first name", async () => {
    /* Enough to address them. A full name on a page reachable by a forwarded
       link is more than the page needs. */
    build({ rift_leads: { data: [{ id: "l1", name: "Sara Tesfaye", side: "buy" }] } });
    const r = await readPlanByToken(TOKEN);
    expect(r.ok && "data" in r && r.data?.firstName).toBe("Sara");
  });
});

describe("the token itself", () => {
  it("refuses a short or empty token without asking the database", async () => {
    /* A query with an empty filter is a query that could match something. */
    for (const bad of ["", "   ", "abc", "x".repeat(15)]) {
      build();
      const r = await readPlanByToken(bad);
      expect(r.ok && "data" in r && r.data, `"${bad}" should find nothing`).toBeNull();
      expect(db.calls, `"${bad}" reached the database`).toHaveLength(0);
    }
  });

  it("refuses an absurdly long one too", async () => {
    build();
    await readPlanByToken("x".repeat(500));
    expect(db.calls).toHaveLength(0);
  });

  it("finds nothing when the token does not match", async () => {
    build({ rift_leads: { data: [] } });
    const r = await readPlanByToken(TOKEN);
    expect(r.ok && "data" in r && r.data).toBeNull();
  });

  it("keeps a failed read distinct from a revoked link", async () => {
    /* Telling somebody "this plan does not exist" when the database hiccupped
       says something false about their agent, and they cannot tell the
       difference. */
    build({ "select rift_leads": { error: { message: "connection reset" } } });
    const r = await readPlanByToken(TOKEN);
    expect(r.ok).toBe(false);
  });

  it("renders the plan even if the steps cannot be read", async () => {
    /* Losing the list is a thin page. Losing the page is a client who thinks
       the link their agent sent them is broken. */
    build({
      rift_leads: { data: [{ id: "l1", name: "Sara", side: "buy" }] },
      "select rift_plan_items": { error: { message: "timeout" } },
    });
    const r = await readPlanByToken(TOKEN);
    expect(r.ok && "data" in r && r.data?.firstName).toBe("Sara");
    expect(r.ok && "data" in r && r.data?.items).toEqual([]);
  });
});

describe("opening and closing the link", () => {
  it("hands back the existing token rather than minting a second one", async () => {
    /* An agent who clicks twice must not invalidate the link he sent an hour
       ago. The client would open it, see nothing, and have no way to tell that
       from the product being broken. */
    const { openPlan } = await import("./plan");
    build({ "select rift_leads": { data: [{ client_token: "already-open-token" }] } });

    const r = await openPlan("l1");
    expect(r.ok && "data" in r && r.data.token).toBe("already-open-token");
    expect(db.to("update rift_leads"), "a second token was minted").toHaveLength(0);
  });

  it("mints an unguessable one when there is none", async () => {
    const { openPlan } = await import("./plan");
    build({ "select rift_leads": { data: [{ client_token: null }] } });

    const r = await openPlan("l1");
    expect(r.ok && "data" in r && r.data.token.length).toBeGreaterThanOrEqual(24);
    expect(db.to("update rift_leads")).toHaveLength(1);
  });

  it("closes by nulling the token and keeps the steps", async () => {
    /* Nulling breaks every copy at once, which is the only way to take back a
       link that has been forwarded. Deleting the agreed steps as well would be
       a second mistake on top of the first. */
    const { closePlan } = await import("./plan");
    build();
    await closePlan("l1");

    expect(db.to("update rift_leads")[0]!.payload).toEqual({ client_token: null });
    expect(db.to("delete rift_plan_items")).toHaveLength(0);
  });

  it("scopes every write to the agent", async () => {
    const { openPlan, closePlan, addPlanItem, setPlanItemDone, removePlanItem } = await import("./plan");
    build({ "select rift_leads": { data: [{ client_token: null }] } });

    await openPlan("l1");
    await closePlan("l1");
    await addPlanItem({ leadId: "l1", title: "Send the agreement", owner: "agent" });
    await setPlanItemDone("i1", true);
    await removePlanItem("i1");

    const writes = db.calls.filter((c) => ["update", "insert", "delete"].includes(c.verb));
    expect(writes.length).toBeGreaterThan(3);
    for (const w of writes) {
      const scoped = w.filters.includes("eq:agent_id=agent-1")
        || (w.verb === "insert" && (w.payload as { agent_id?: string }).agent_id === "agent-1");
      expect(scoped, `unscoped ${w.verb} on ${w.table}: ${w.filters.join(" ")}`).toBe(true);
    }
  });
});

describe("what a step is allowed to be", () => {
  it("refuses a step with no words in it", async () => {
    const { addPlanItem } = await import("./plan");
    build();
    const r = await addPlanItem({ leadId: "l1", title: "  ", owner: "client" });
    expect(r.ok).toBe(false);
    expect(db.to("insert rift_plan_items")).toHaveLength(0);
  });

  it("refuses 'someone else' with no name", async () => {
    /* "Waiting on the county" and "waiting on your lender" are different
       sentences to the person reading it. An unnamed third party is neither. */
    const { addPlanItem } = await import("./plan");
    build();
    const r = await addPlanItem({ leadId: "l1", title: "Confirm eligibility", owner: "other", ownerName: " " });
    expect(r.ok).toBe(false);
  });

  it("appends rather than inserting into the middle", async () => {
    /* A new step arriving above ones the client has already read is
       disorienting on a page they check between other things. */
    const { addPlanItem } = await import("./plan");
    build({ "select rift_plan_items": { data: [{ sort: 7 }] } });
    await addPlanItem({ leadId: "l1", title: "Send the agreement", owner: "agent" });
    expect((db.to("insert rift_plan_items")[0]!.payload as { sort: number }).sort).toBe(8);
  });

  it("can untick, because a step ticked by mistake is one the client believes is handled", async () => {
    const { setPlanItemDone } = await import("./plan");
    build();
    await setPlanItemDone("i1", false);
    expect((db.to("update rift_plan_items")[0]!.payload as { done_at: unknown }).done_at).toBeNull();
  });
});

/**
 * The page itself, read as source.
 *
 * The query is narrow; this checks that the page has not gone around it.
 */
describe("the client's page", () => {
  const src = readFileSync("app/(rift)/plan/[token]/page.tsx", "utf8");

  it("is never indexed", () => {
    /* A link unguessable to a person is trivially findable by a crawler that
       has been given it. */
    expect(src).toMatch(/robots:\s*\{\s*index:\s*false/);
  });

  it("reads nothing but the plan", () => {
    for (const forbidden of ["readLead(", "rankedLeads", "lib/db/clients", "lib/db/leads", "lib/db/session"]) {
      expect(src, `the client's page must not reach for ${forbidden}`).not.toContain(forbidden);
    }
  });
});

/**
 * The three answers the client's page can give, and why they must stay apart.
 *
 * "We could not ask", "this link was closed" and "here is your plan" look the
 * same to whoever opens it, and two of them say something about their agent.
 * A page that reports an outage as a revoked link tells a client their agent
 * cut them off.
 */
describe("what the page says when there is no plan to show", () => {
  const src = readFileSync("app/(rift)/plan/[token]/page.tsx", "utf8");

  it("treats a skipped read as an outage, not as a closed link", () => {
    /* `skipped` is ok:true with no data, so a page that only checks `!read.ok`
       falls straight through to "no longer open": which is what the first
       draft of this page did, on every deployment with no database. */
    expect(src, "the page must branch on skipped before it decides the link is gone")
      .toMatch(/!read\.ok \|\| "skipped" in read/);
  });

  it("does not tell somebody their link expired when it did not", () => {
    const outage = src.slice(src.indexOf("!read.ok"), src.indexOf("if (!plan)"));
    expect(outage).toMatch(/does not mean your link has expired/i);
  });
});
