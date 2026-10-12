import { describe, it, expect } from "vitest";
import { readRecord, signRecord } from "./signed";

describe("signed record tokens", () => {
  const id = "3f2a8c1e-0000-4000-8000-000000000001";
  it("reads back the id it was given", () => {
    expect(readRecord("s", "equb", signRecord("s", "equb", id, 60_000))).toBe(id);
  });
  it("refuses another secret, another purpose, a changed id and an expired token", () => {
    const t = signRecord("s", "equb", id, 60_000, 1_000);
    expect(readRecord("x", "equb", t, 1_000)).toBeNull();
    expect(readRecord("s", "plan", t, 1_000)).toBeNull();
    expect(readRecord("s", "equb", t.replace(id, id.replace("1", "2")), 1_000)).toBeNull();
    expect(readRecord("s", "equb", t, 62_000)).toBeNull();
  });
  it("refuses garbage and an empty secret", () => {
    expect(readRecord("s", "equb", "nope")).toBeNull();
    expect(readRecord("", "equb", signRecord("", "equb", id, 60_000))).toBeNull();
  });
});
