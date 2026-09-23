import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb } from "../utils/test-db";
import {
  saveAttendanceKeyword,
  openAttendance,
  closeAttendance,
  confirmAttendance,
  justifyAbsence,
  suspendStudentFromLesson,
} from "@/lib/actions/attendance";
import { users, lessons, attendances } from "@/db/schema";
import { eq } from "drizzle-orm";

async function seed(db: any) {
  const now = Date.now();
  await db.insert(users).values([
    { id: "t1", name: "Prof", email: "p@x.com", passwordHash: "x", role: "TEACHER", status: "ACTIVE", createdAt: now },
    { id: "s1", name: "Maria", email: "m@x.com", passwordHash: "x", role: "STUDENT", status: "ACTIVE", createdAt: now },
    { id: "s2", name: "João", email: "j@x.com", passwordHash: "x", role: "STUDENT", status: "ACTIVE", createdAt: now },
    { id: "s3", name: "Zé", email: "z@x.com", passwordHash: "x", role: "STUDENT", status: "SUSPENDED", createdAt: now, suspensionReason: "faltas" },
  ]);
  await db.insert(lessons).values({
    id: "l1", title: "Aula", description: "", date: "2026-09-22",
    isPublished: true, createdAt: now,
  });
}

let db: any;
beforeEach(async () => {
  db = createTestDb();
  await seed(db);
});

describe("saveAttendanceKeyword", () => {
  it("saves keyword", async () => {
    const r = await saveAttendanceKeyword(db, { lessonId: "l1", keyword: " Graça " });
    expect(r.ok).toBe(true);
    const rows = await db.select().from(lessons).where(eq(lessons.id, "l1"));
    expect(rows[0].attendanceKeyword).toBe("Graça");
  });
});

describe("openAttendance", () => {
  it("requires keyword and sets expiry", async () => {
    const bad = await openAttendance(db, { lessonId: "l1", keyword: "", durationMinutes: 30 });
    expect(bad.ok).toBe(false);
    const ok = await openAttendance(db, { lessonId: "l1", keyword: "GRAÇA", durationMinutes: 30 });
    expect(ok.ok).toBe(true);
    const rows = await db.select().from(lessons).where(eq(lessons.id, "l1"));
    expect(rows[0].isAttendanceOpen).toBe(true);
    expect(rows[0].attendanceExpiresAt).toBeGreaterThan(Date.now());
    expect(rows[0].attendanceKeyword).toBe("GRAÇA");
  });
});

describe("confirmAttendance", () => {
  it("rejects when closed", async () => {
    const r = await confirmAttendance(db, "s1", { lessonId: "l1", keyword: "GRAÇA" });
    expect(r.ok).toBe(false);
  });
  it("accepts normalized keyword when open", async () => {
    await openAttendance(db, { lessonId: "l1", keyword: "Graça", durationMinutes: 30 });
    const r = await confirmAttendance(db, "s1", { lessonId: "l1", keyword: "  GRAÇA " });
    expect(r.ok).toBe(true);
    const rows = await db.select().from(attendances);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("PRESENT");
    expect(rows[0].confirmedAt).toBeTypeOf("number");
  });
  it("rejects wrong keyword", async () => {
    await openAttendance(db, { lessonId: "l1", keyword: "GRAÇA", durationMinutes: 30 });
    const r = await confirmAttendance(db, "s1", { lessonId: "l1", keyword: "perdao" });
    expect(r.ok).toBe(false);
  });
  it("rejects duplicate PRESENT", async () => {
    await openAttendance(db, { lessonId: "l1", keyword: "GRAÇA", durationMinutes: 30 });
    await confirmAttendance(db, "s1", { lessonId: "l1", keyword: "GRAÇA" });
    const r = await confirmAttendance(db, "s1", { lessonId: "l1", keyword: "GRAÇA" });
    expect(r.ok).toBe(false);
  });
  it("rejects suspended student", async () => {
    await openAttendance(db, { lessonId: "l1", keyword: "GRAÇA", durationMinutes: 30 });
    const r = await confirmAttendance(db, "s3", { lessonId: "l1", keyword: "GRAÇA" });
    expect(r.ok).toBe(false);
  });
  it("rejects when expired", async () => {
    await openAttendance(db, { lessonId: "l1", keyword: "GRAÇA", durationMinutes: 30 });
    await db.update(lessons).set({ attendanceExpiresAt: Date.now() - 1 }).where(eq(lessons.id, "l1"));
    const r = await confirmAttendance(db, "s1", { lessonId: "l1", keyword: "GRAÇA" });
    expect(r.ok).toBe(false);
  });
});

describe("closeAttendance", () => {
  it("closes and marks ABSENT for ACTIVE without row", async () => {
    await openAttendance(db, { lessonId: "l1", keyword: "GRAÇA", durationMinutes: 30 });
    await confirmAttendance(db, "s1", { lessonId: "l1", keyword: "GRAÇA" });
    const r = await closeAttendance(db, { lessonId: "l1" });
    expect(r.ok).toBe(true);
    const rows = await db.select().from(attendances);
    const byStudent = Object.fromEntries(rows.map((a: any) => [a.studentId, a.status]));
    expect(byStudent.s1).toBe("PRESENT");
    expect(byStudent.s2).toBe("ABSENT");
    expect(byStudent.s3).toBeUndefined();
    const lessonsRow = await db.select().from(lessons).where(eq(lessons.id, "l1"));
    expect(lessonsRow[0].isAttendanceOpen).toBe(false);
  });
});

describe("justifyAbsence", () => {
  it("sets JUSTIFIED", async () => {
    await openAttendance(db, { lessonId: "l1", keyword: "GRAÇA", durationMinutes: 30 });
    await closeAttendance(db, { lessonId: "l1" });
    const r = await justifyAbsence(db, { lessonId: "l1", studentId: "s2" });
    expect(r.ok).toBe(true);
    const rows = await db.select().from(attendances);
    const j = rows.find((a: any) => a.studentId === "s2");
    expect(j.status).toBe("JUSTIFIED");
  });
});

describe("suspendStudentFromLesson", () => {
  it("suspends student with reason", async () => {
    const r = await suspendStudentFromLesson(db, "t1", { studentId: "s1", reason: "Faltas" });
    expect(r.ok).toBe(true);
    const u = await db.select().from(users);
    const s1 = u.find((x: any) => x.id === "s1");
    expect(s1.status).toBe("SUSPENDED");
    expect(s1.suspensionReason).toBe("Faltas");
  });
  it("blocks suspending last active teacher", async () => {
    const r = await suspendStudentFromLesson(db, "t1", { studentId: "t1", reason: "x" });
    expect(r.ok).toBe(false);
  });
});
