import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { BUY_FUNNEL, applyWording } from "@/lib/core/funnel";

/**
 * The editor cannot reach the engine, even at the point of writing.
 *
 * `applyWording` is proved safe in lib/core/wording.test.ts. These assert the
 * two places that could bypass it: the publish path, which writes rows, and
 * the read path, which builds the funnel a visitor sees. Both have to go
 * through the merge rather than around it: a publish that wrote the caller's
 * questions directly would put a payload-controlled `bound` or `type` into the
 * database, and every safety property would then be one read away from gone.
 */

const funnelDb = readFileSync("lib/db/funnel.ts", "utf8");
const assessmentsDb = readFileSync("lib/db/assessments.ts", "utf8");

describe("publishing", () => {
  const body = funnelDb.slice(funnelDb.indexOf("export async function publishWording"));

  it("builds the rows from the code's definition, not from the caller", () => {
    /* `edited` is applyWording(definition, wording). If this ever maps over
       something the caller sent, the constraint is gone. */
    expect(body).toContain("const edited = applyWording(definition, wording)");
    expect(body).toContain("edited.questions.map(");
  });

  it("takes every structural column from that definition", () => {
    for (const field of ["kind: q.kind", "bound: q.bound", "type: q.type", "required: q.required"]) {
      expect(body, field).toContain(field);
    }
  });

  it("creates a new version rather than rewriting the current one", () => {
    /* Contract 4.6. Rewriting the wording on the version somebody is pinned
       to answers "what were they asked" wrongly while looking like a record. */
    expect(body).toContain('.from("rift_funnel_versions")');
    expect(body).toContain(".insert({ funnel_id: funnelId, version: next");
    expect(body).not.toMatch(/rift_funnel_versions[\s\S]{0,200}\.update\(/);
  });

  it("refuses rather than reports success when the questions do not write", () => {
    /* A version with no questions in it is worse than no version: it looks
       like a record of what somebody was asked. */
    expect(body).toContain("the questions were not published");
  });

  it("drops the cached version id, which now points at the old one", () => {
    expect(body).toContain("cache.delete(side)");
  });
});

describe("reading", () => {
  const body = assessmentsDb.slice(assessmentsDb.indexOf("export async function readFunnel"));

  it("applies the stored words to the code's own funnel", () => {
    expect(body).toContain("applyWording(fallback,");
  });

  it("falls back to the built-in funnel when the words cannot be read", () => {
    /* The assessment is the second most valuable page in the product. Its
       right answer when the database is slow is the funnel that shipped. */
    expect(body).toContain('source: "built-in" as const');
  });

  it("never builds a question from a row", () => {
    /* The only route from the database into the funnel is applyWording.
       A `q.type = row.type` anywhere here would undo the whole design. */
    expect(body).not.toMatch(/type:\s*(row|r|data)\./);
    expect(body).not.toMatch(/bound:\s*(row|r|data)\./);
  });
});

describe("the round trip", () => {
  it("survives what the store would hand back", () => {
    /* readWording's exact output shape, including the nulls it converts and
       the option labels it rebuilds from jsonb. */
    const fromStore = {
      county: {
        title: "Whereabouts in Georgia?",
        description: undefined,
        fieldLabel: undefined,
        optionLabels: {},
      },
      ownership: {
        title: undefined,
        description: undefined,
        fieldLabel: undefined,
        optionLabels: Object.fromEntries(
          (BUY_FUNNEL.questions.find((q) => q.id === "ownership")!.options ?? [])
            .map((o) => [o.value, `${o.label}!`]),
        ),
      },
    };

    const f = applyWording(BUY_FUNNEL, fromStore);
    expect(f.questions.find((q) => q.id === "county")!.title).toBe("Whereabouts in Georgia?");
    expect(f.questions.map((q) => q.id)).toEqual(BUY_FUNNEL.questions.map((q) => q.id));

    const own = f.questions.find((q) => q.id === "ownership")!;
    const original = BUY_FUNNEL.questions.find((q) => q.id === "ownership")!;
    expect(own.options?.map((o) => o.value)).toEqual(original.options?.map((o) => o.value));
    expect(own.options?.[0]?.label.endsWith("!")).toBe(true);
  });
});

describe("publishing invalidates the page it changes", () => {
  /* /buy/start and /sell/start are cached now: they render the same funnel
     for everybody, and paying a dynamic render on the page where the product
     first asks for something cost about 1.7 seconds against 0.19 for the
     landing page people arrive from.
     
     That trade is only safe because publishing revalidates them. Without this
     call the editor appears to work, reports success, writes the version:
     and the questions a visitor reads keep saying the old thing for five
     minutes, which is exactly long enough for the agent to conclude the
     feature is broken, or worse, to not notice. */
  const actions = readFileSync("app/(studio)/studio/actions.ts", "utf8");
  const body = actions.slice(actions.indexOf("export async function publishQuestions"));

  it("revalidates the assessment page for the side it published", () => {
    expect(body).toContain("revalidatePath(`/${side}/start`)");
  });

  it("and the page the agent is looking at", () => {
    expect(body).toContain('revalidatePath("/studio/questions")');
  });
});
