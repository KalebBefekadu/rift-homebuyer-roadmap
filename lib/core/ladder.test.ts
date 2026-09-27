import { describe, it, expect } from "vitest";
import { valueLadder } from "./ladder";

describe("the value ladder (Blueprint v5 §5.1)", () => {
  it("counts sessions, not events, and a second value only when it is a different one", () => {
    const l = valueLadder([
      { session: "a", name: "value_view", tool: "cash" }, { session: "a", name: "value_answer", tool: "cash" },
      { session: "a", name: "value_answer", tool: "cash" },
      { session: "b", name: "value_answer", tool: "cash" }, { session: "b", name: "value_answer", tool: "assistance" },
      { session: "c", name: "value_view", tool: "timeline" },
    ]);
    expect(l.finishedOne).toBe(2);
    expect(l.finishedTwo).toBe(1);
    expect(l.rate).toBe(0.5);
    expect(l.byValue.find((x) => x.tool === "cash")).toEqual({ tool: "cash", opened: 1, finished: 2 });
    expect(l.byValue.find((x) => x.tool === "timeline")).toEqual({ tool: "timeline", opened: 1, finished: 0 });
  });

  it("with nobody finishing, there is no rate rather than a zero", () => {
    expect(valueLadder([]).rate).toBeNull();
  });
});
