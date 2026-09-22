import { describe, it, expect } from "vitest";
import { createTestDb } from "../utils/test-db";
import { registerUser, authenticate } from "@/lib/actions/auth";

describe("auth actions", () => {
  it("registers STUDENT PENDING", async () => {
    const db = createTestDb();
    const user = await registerUser(db, {
      name: "Maria Silva",
      email: "maria@x.com",
      password: "123456",
    });
    expect(user.role).toBe("STUDENT");
    expect(user.status).toBe("PENDING");
  });
  it("rejects duplicate email case-insensitive", async () => {
    const db = createTestDb();
    await registerUser(db, { name: "Maria", email: "maria@x.com", password: "123456" });
    await expect(
      registerUser(db, { name: "Outra", email: "MARIA@X.COM", password: "123456" })
    ).rejects.toThrow();
  });
  it("authenticates correct / rejects wrong password", async () => {
    const db = createTestDb();
    await registerUser(db, {
      name: "Maria Silva",
      email: "maria@x.com",
      password: "123456",
    });
    const ok = await authenticate(db, { email: "maria@x.com", password: "123456" });
    expect(ok?.email).toBe("maria@x.com");
    expect(await authenticate(db, { email: "maria@x.com", password: "errada" })).toBeNull();
  });
});
