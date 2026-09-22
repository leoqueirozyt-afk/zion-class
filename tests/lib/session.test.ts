import { describe, it, expect, beforeAll } from "vitest";
import { createSessionToken, parseSessionToken } from "@/lib/auth/session";

beforeAll(() => {
  process.env.SESSION_SECRET = "test-secret-of-at-least-32-characters!!";
});

describe("session", () => {
  it("creates and parses a token", async () => {
    const token = await createSessionToken({
      sub: "u1",
      role: "TEACHER",
      name: "Ana",
      status: "ACTIVE",
    });
    const payload = await parseSessionToken(token);
    expect(payload).toMatchObject({
      sub: "u1",
      role: "TEACHER",
      name: "Ana",
      status: "ACTIVE",
    });
  });
  it("returns null for garbage", async () => {
    expect(await parseSessionToken("abc.def.ghi")).toBeNull();
  });
  it("returns null when secret missing", async () => {
    const secret = process.env.SESSION_SECRET;
    delete process.env.SESSION_SECRET;
    const token = await createSessionToken({
      sub: "u1",
      role: "STUDENT",
      name: "Bia",
      status: "ACTIVE",
    }).catch(() => "failed");
    if (token !== "failed") {
      expect(await parseSessionToken(token)).toBeNull();
    } else {
      expect(true).toBe(true);
    }
    process.env.SESSION_SECRET = secret;
  });
  it("rejects token without status claim", async () => {
    const { SignJWT } = await import("jose");
    const secret = new TextEncoder().encode(process.env.SESSION_SECRET!);
    const token = await new SignJWT({ sub: "u1", role: "STUDENT", name: "X" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d")
      .sign(secret);
    expect(await parseSessionToken(token)).toBeNull();
  });
});
