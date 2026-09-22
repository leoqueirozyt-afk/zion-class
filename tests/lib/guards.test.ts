import { describe, it, expect } from "vitest";
import { evaluateAccess } from "@/lib/auth/guards";
import type { SessionPayload } from "@/lib/auth/session";

const s = (over: Partial<SessionPayload> = {}): SessionPayload => ({
  sub: "1",
  role: "STUDENT",
  name: "A",
  status: "ACTIVE",
  ...over,
});

describe("evaluateAccess", () => {
  it("allows public auth pages without session", () => {
    expect(evaluateAccess(null, "/login")).toEqual({ type: "allow" });
    expect(evaluateAccess(null, "/register")).toEqual({ type: "allow" });
    expect(evaluateAccess(null, "/")).toEqual({ type: "allow" });
  });
  it("redirects protected without session to login", () => {
    expect(evaluateAccess(null, "/dashboard")).toEqual({ type: "redirect", to: "/login" });
    expect(evaluateAccess(null, "/admin")).toEqual({ type: "redirect", to: "/login" });
  });
  it("pending student sees only pending page", () => {
    expect(evaluateAccess(s({ status: "PENDING" }), "/dashboard")).toEqual({
      type: "redirect",
      to: "/dashboard/pending",
    });
    expect(evaluateAccess(s({ status: "PENDING" }), "/dashboard/pending")).toEqual({
      type: "allow",
    });
  });
  it("suspended sees only suspended page", () => {
    expect(evaluateAccess(s({ status: "SUSPENDED" }), "/dashboard/x")).toEqual({
      type: "redirect",
      to: "/dashboard/suspended",
    });
    expect(evaluateAccess(s({ status: "SUSPENDED" }), "/dashboard/suspended")).toEqual({
      type: "allow",
    });
  });
  it("student blocked from admin", () => {
    expect(evaluateAccess(s(), "/admin")).toEqual({ type: "redirect", to: "/dashboard" });
  });
  it("teacher active allowed on admin", () => {
    expect(evaluateAccess(s({ role: "TEACHER" }), "/admin")).toEqual({ type: "allow" });
  });
  it("teacher pending blocked from admin", () => {
    expect(evaluateAccess(s({ role: "TEACHER", status: "PENDING" }), "/admin")).toEqual({
      type: "redirect",
      to: "/dashboard/pending",
    });
  });
  it("logged in redirected away from auth pages", () => {
    expect(evaluateAccess(s(), "/login")).toEqual({ type: "redirect", to: "/dashboard" });
    expect(evaluateAccess(s({ role: "TEACHER" }), "/login")).toEqual({
      type: "redirect",
      to: "/admin",
    });
    expect(evaluateAccess(s(), "/register")).toEqual({ type: "redirect", to: "/dashboard" });
  });
});
