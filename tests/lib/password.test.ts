import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("password", () => {
  it("hashes and verifies", async () => {
    const h = await hashPassword("Minha@Senha1");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("Minha@Senha1", h)).toBe(true);
  });
  it("rejects wrong password", async () => {
    const h = await hashPassword("Minha@Senha1");
    expect(await verifyPassword("outra", h)).toBe(false);
  });
  it("rejects malformed hash", async () => {
    expect(await verifyPassword("x", "invalido")).toBe(false);
  });
});
