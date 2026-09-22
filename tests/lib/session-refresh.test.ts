import { describe, it, expect, beforeAll } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "../utils/test-db";
import { registerUser } from "@/lib/actions/auth";
import { createSessionToken } from "@/lib/auth/session";
import { loadFreshSession, statusRedirectPath } from "@/lib/auth/session-refresh";
import { users } from "@/db/schema";

beforeAll(() => {
  process.env.SESSION_SECRET = "test-secret-of-at-least-32-characters!!";
});

describe("loadFreshSession", () => {
  it("reflects ACTIVE status after DB approval despite stale PENDING JWT", async () => {
    const db = createTestDb();
    const user = await registerUser(db, {
      name: "Aluno",
      email: "aluno@x.com",
      password: "123456",
    });
    const staleToken = await createSessionToken({
      sub: user.id,
      role: user.role,
      name: user.name,
      status: "PENDING",
    });
    expect((await loadFreshSession(db, staleToken))?.status).toBe("PENDING");

    await db.update(users).set({ status: "ACTIVE" }).where(eq(users.id, user.id));

    const fresh = await loadFreshSession(db, staleToken);
    expect(fresh?.status).toBe("ACTIVE");
    expect(fresh?.role).toBe("STUDENT");
  });

  it("reflects role change after promote", async () => {
    const db = createTestDb();
    const user = await registerUser(db, {
      name: "Aluna",
      email: "aluna@x.com",
      password: "123456",
    });
    await db
      .update(users)
      .set({ role: "TEACHER", status: "ACTIVE" })
      .where(eq(users.id, user.id));
    const staleToken = await createSessionToken({
      sub: user.id,
      role: "STUDENT",
      name: user.name,
      status: "PENDING",
    });
    const fresh = await loadFreshSession(db, staleToken);
    expect(fresh).toMatchObject({ role: "TEACHER", status: "ACTIVE" });
  });

  it("returns null for invalid or missing user", async () => {
    const db = createTestDb();
    expect(await loadFreshSession(db, "not-a-jwt")).toBeNull();
    const token = await createSessionToken({
      sub: "missing-id",
      role: "STUDENT",
      name: "X",
      status: "ACTIVE",
    });
    expect(await loadFreshSession(db, token)).toBeNull();
  });
});

describe("statusRedirectPath", () => {
  it("routes by status and role", () => {
    expect(
      statusRedirectPath({ status: "ACTIVE", role: "STUDENT" } as never)
    ).toBeNull();
    expect(
      statusRedirectPath({ status: "PENDING", role: "STUDENT" } as never)
    ).toBe("/dashboard/pending");
    expect(
      statusRedirectPath({ status: "SUSPENDED", role: "STUDENT" } as never)
    ).toBe("/dashboard/suspended");
    expect(
      statusRedirectPath({ status: "ACTIVE", role: "TEACHER" } as never)
    ).toBeNull();
  });
});
