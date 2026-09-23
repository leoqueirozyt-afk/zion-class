import { describe, it, expect } from "vitest";
import { createTestDb } from "../utils/test-db";
import {
  getResponsesMatrix,
  getLessonsWithResponseCounts,
  getAdminMetrics,
} from "@/lib/queries/admin";
import { users, lessons, questions, answers } from "@/db/schema";

async function seed(db: any) {
  const now = Date.now();
  await db.insert(users).values([
    {
      id: "t1", name: "Prof", email: "p@x.com", passwordHash: "x",
      role: "TEACHER", status: "ACTIVE", createdAt: now,
    },
    {
      id: "s1", name: "Maria", email: "m@x.com", passwordHash: "x",
      role: "STUDENT", status: "ACTIVE", createdAt: now,
    },
    {
      id: "s2", name: "João", email: "j@x.com", passwordHash: "x",
      role: "STUDENT", status: "ACTIVE", createdAt: now,
    },
  ]);
  await db.insert(lessons).values({
    id: "l1", title: "Aula", description: "", date: "2026-09-22",
    isPublished: true, createdAt: now,
  });
  await db.insert(questions).values([
    { id: "q1", lessonId: "l1", questionText: "P1", questionType: "TEXT", position: 0 },
    {
      id: "q2", lessonId: "l1", questionText: "P2", questionType: "MULTIPLE_CHOICE",
      options: JSON.stringify(["A", "B"]), correctOptionIndex: 1, position: 1,
    },
  ]);
  await db.insert(answers).values([
    { id: "a1", questionId: "q1", studentId: "s1", answerText: "resp maria", submittedAt: now },
    { id: "a2", questionId: "q2", studentId: "s1", answerText: "1", submittedAt: now },
    { id: "a3", questionId: "q1", studentId: "s2", answerText: "resp joao", submittedAt: now },
  ]);
}

describe("getResponsesMatrix", () => {
  it("builds students x questions with progress", async () => {
    const db = createTestDb();
    await seed(db);
    const m = (await getResponsesMatrix(db, "l1"))!;
    expect(m.lesson.title).toBe("Aula");
    expect(m.questions).toHaveLength(2);
    expect(m.students.map((s: { name: string }) => s.name).sort()).toEqual([
      "João",
      "Maria",
    ]);
    const maria = m.students.find(
      (s: { name: string }) => s.name === "Maria"
    )!;
    expect(maria.cells["q1"]).toBe("resp maria");
    expect(maria.cells["q2"]).toBe("1");
    const joao = m.students.find((s: { name: string }) => s.name === "João")!;
    expect(joao.cells["q1"]).toBe("resp joao");
    expect(joao.cells["q2"]).toBeUndefined();
    expect(m.answeredCount).toBe(1);
    expect(m.totalStudents).toBe(2);
  });
});

describe("getLessonsWithResponseCounts", () => {
  it("lists only lessons with answers, distinct students, active total", async () => {
    const db = createTestDb();
    await seed(db);
    await db.insert(lessons).values({
      id: "l-empty", title: "Sem respostas", description: "", date: "2026-01-01",
      isPublished: true, createdAt: Date.now(),
    });
    const rows = await getLessonsWithResponseCounts(db);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: "l1",
      title: "Aula",
      answeredCount: 2,
      totalActiveStudents: 2,
    });
    expect(rows[0].lastSubmittedAt).toBeTypeOf("number");
  });
});

describe("getAdminMetrics recent", () => {
  it("returns one row per student·lesson (not per question)", async () => {
    const db = createTestDb();
    await seed(db);
    const m = await getAdminMetrics(db);
    expect(m.recent).toHaveLength(2);
    const keys = m.recent.map(
      (r: { studentName: string; lessonId: string }) =>
        `${r.studentName}:${r.lessonId}`
    );
    expect(new Set(keys).size).toBe(keys.length);
    const maria = m.recent.find(
      (r: { studentName: string }) => r.studentName === "Maria"
    )!;
    expect(maria.lessonId).toBe("l1");
    expect(maria.submittedAt).toBeTypeOf("number");
  });
});
