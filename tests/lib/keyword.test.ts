import { describe, it, expect } from "vitest";
import { normalizeKeyword, keywordsMatch } from "@/lib/attendance/keyword";

describe("normalizeKeyword", () => {
  it("trims and lowercases", () => {
    expect(normalizeKeyword("  Graça ")).toBe("graça");
    expect(normalizeKeyword("GRAÇA")).toBe("graça");
    expect(normalizeKeyword("MONTE SIÃO")).toBe("monte sião");
  });
  it("collapses internal whitespace", () => {
    expect(normalizeKeyword("  ALIANÇA  ")).toBe("aliança");
    expect(normalizeKeyword("MONTE   SIÃO")).toBe("monte sião");
  });
});

describe("keywordsMatch", () => {
  it("matches case/trim variants", () => {
    expect(keywordsMatch("GRAÇA", " graça ")).toBe(true);
    expect(keywordsMatch("Graça", "GRAÇA")).toBe(true);
    expect(keywordsMatch("GRAÇA", "perdão")).toBe(false);
  });
});
