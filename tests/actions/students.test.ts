import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "../utils/test-db";
import { updateStudentStatus } from "@/lib/actions/students";
import { users } from "@/db/schema";

async function seed(db: any) {
  const now = Date.now();
  await db.insert(users).values([
    {
      id: "t1", name: "Prof", email: "p@x.com", passwordHash: "x",
      role: "TEACHER", status: "ACTIVE", createdAt: now,
    },
    {
      id: "s1", name: "Maria", email: "m@x.com", passwordHash: "x",
      role: "STUDENT", status: "PENDING", createdAt: now,
    },
    {
      id: "s2", name: "João", email: "j@x.com", passwordHash: "x",
      role: "STUDENT", status: "ACTIVE", createdAt: now,
    },
  ]);
}

describe("updateStudentStatus", () => {
  it("approves PENDING → ACTIVE", async () => {
    const db = createTestDb();
    await seed(db);
    const r = await updateStudentStatus(
      db,
      { userId: "s1", action: "APPROVE" },
      "t1"
    );
    expect(r.ok).toBe(true);
    const rows = await db.select().from(users).where(eq(users.id, "s1"));
    expect(rows[0].status).toBe("ACTIVE");
  });
  it("suspends and reactivates", async () => {
    const db = createTestDb();
    await seed(db);
    await updateStudentStatus(db, { userId: "s2", action: "SUSPEND" }, "t1");
    let rows = await db.select().from(users).where(eq(users.id, "s2"));
    expect(rows[0].status).toBe("SUSPENDED");
    await updateStudentStatus(
      db,
      { userId: "s2", action: "REACTIVATE" },
      "t1"
    );
    rows = await db.select().from(users).where(eq(users.id, "s2"));
    expect(rows[0].status).toBe("ACTIVE");
  });
  it("promotes to TEACHER", async () => {
    const db = createTestDb();
    await seed(db);
    const r = await updateStudentStatus(
      db,
      { userId: "s2", action: "PROMOTE" },
      "t1"
    );
    expect(r.ok).toBe(true);
    const rows = await db.select().from(users).where(eq(users.id, "s2"));
    expect(rows[0].role).toBe("TEACHER");
  });
  it("cannot act on self", async () => {
    const db = createTestDb();
    await seed(db);
    const r = await updateStudentStatus(
      db,
      { userId: "t1", action: "SUSPEND" },
      "t1"
    );
    expect(r.ok).toBe(false);
  });
  it("cannot suspend the last active teacher (non-self actor)", async () => {
    const db = createTestDb();
    const now = Date.now();
    await db.insert(users).values([
      {
        id: "t1", name: "P", email: "p@x.com", passwordHash: "x",
        role: "TEACHER", status: "ACTIVE", createdAt: now,
      },
      {
        id: "s8", name: "Other", email: "o@x.com", passwordHash: "x",
        role: "TEACHER", status: "PENDING", createdAt: now,
      },
    ]);
    const r = await updateStudentStatus(
      db,
      { userId: "t1", action: "SUSPEND" },
      "s8"
    );
    expect(r.ok).toBe(false);
  });
  it("allows suspending one of two active teachers", async () => {
    const db = createTestDb();
    const now = Date.now();
    await db.insert(users).values([
      {
        id: "t1", name: "P1", email: "p1@x.com", passwordHash: "x",
        role: "TEACHER", status: "ACTIVE", createdAt: now,
      },
      {
        id: "t2", name: "P2", email: "p2@x.com", passwordHash: "x",
        role: "TEACHER", status: "ACTIVE", createdAt: now,
      },
    ]);
    const r = await updateStudentStatus(
      db,
      { userId: "t2", action: "SUSPEND" },
      "t1"
    );
    expect(r.ok).toBe(true);
  });
});
