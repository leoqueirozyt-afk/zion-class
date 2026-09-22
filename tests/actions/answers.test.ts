import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "../utils/test-db";
import { submitAnswers } from "@/lib/actions/answers";
import { users, lessons, questions, answers } from "@/db/schema";

async function seed(db: any) {
  const now = Date.now();
  await db.insert(users).values({
    id: "s1", name: "Aluna", email: "a@a.com", passwordHash: "x",
    role: "STUDENT", status: "ACTIVE", createdAt: now,
  });
  await db.insert(lessons).values({
    id: "l1", title: "Aula", description: "", date: "2026-09-22", isPublished: true, createdAt: now,
  });
  await db.insert(questions).values([
    { id: "q1", lessonId: "l1", questionText: "Aberta", questionType: "TEXT", position: 0 },
    {
      id: "q2", lessonId: "l1", questionText: "Escolha", questionType: "MULTIPLE_CHOICE",
      options: JSON.stringify(["A", "B"]), position: 1,
    },
  ]);
}

describe("submitAnswers", () => {
  it("inserts then updates on edit (submitted_at refreshes)", async () => {
    const db = createTestDb();
    await seed(db);
    const r1 = await submitAnswers(db, "s1", {
      lessonId: "l1",
      answers: [
        { questionId: "q1", type: "TEXT", answerText: "primeira" },
        { questionId: "q2", type: "MULTIPLE_CHOICE", optionIndex: 0 },
      ],
    });
    expect(r1.ok).toBe(true);
    await new Promise((r) => setTimeout(r, 5));
    const r2 = await submitAnswers(db, "s1", {
      lessonId: "l1",
      answers: [
        { questionId: "q1", type: "TEXT", answerText: "segunda versao" },
        { questionId: "q2", type: "MULTIPLE_CHOICE", optionIndex: 1 },
      ],
    });
    expect(r2.ok).toBe(true);
    const rows = await db.select().from(answers).where(eq(answers.studentId, "s1"));
    expect(rows).toHaveLength(2);
    expect(rows.find((r: any) => r.questionId === "q1")!.answerText).toBe("segunda versao");
    expect(rows.find((r: any) => r.questionId === "q2")!.answerText).toBe("1");
    const q1 = rows.find((r: any) => r.questionId === "q1")!;
    expect(q1.submittedAt).toBeGreaterThan(0);
  });

  it("rejects question from another lesson", async () => {
    const db = createTestDb();
    await seed(db);
    const r = await submitAnswers(db, "s1", {
      lessonId: "l1",
      answers: [{ questionId: "OUTRA", type: "TEXT", answerText: "x" }],
    });
    expect(r.ok).toBe(false);
  });
});
