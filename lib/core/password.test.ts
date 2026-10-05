import { describe, it, expect } from "vitest";
import { passwordError, PASSWORD_MAX, PASSWORD_MIN } from "./password";

describe("passwordError", () => {
  it("accepts a long phrase", () => {
    expect(passwordError("correct horse battery")).toBeNull();
  });
  it("refuses short and over-long passwords", () => {
    expect(passwordError("a".repeat(PASSWORD_MIN - 1) + "b".slice(0, 0))).toMatch(/at least/);
    expect(passwordError("ab".repeat(PASSWORD_MAX))).toMatch(/or fewer/);
  });
  it("refuses one repeated character and the email itself", () => {
    expect(passwordError("aaaaaaaaaaaa")).toMatch(/repeated/);
    expect(passwordError("Kaleb@Example.com", "kaleb@example.com")).toMatch(/email/);
  });
});
