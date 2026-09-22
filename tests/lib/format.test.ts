import { describe, it, expect } from "vitest";
import { formatDate, formatDateTime, nextTuesdayISO } from "@/lib/utils/format";

describe("format", () => {
  it("formats YYYY-MM-DD to DD/MM/YYYY", () => {
    expect(formatDate("2026-09-22")).toBe("22/09/2026");
  });
  it("formats datetime day", () => {
    expect(formatDateTime(Date.UTC(2026, 8, 22, 19, 30))).toMatch(/22\/09\/2026/);
  });
  it("next tuesday", () => {
    expect(nextTuesdayISO("2026-09-17")).toBe("2026-09-22");
    expect(nextTuesdayISO("2026-09-22")).toBe("2026-09-29");
  });
});
