import { desc, eq, sql } from "drizzle-orm";
import { answers, lessons, questions, users } from "@/db/schema";

export async function getAdminMetrics(db: any) {
  const totalLessons = await db
    .select({ c: sql<number>`count(*)` })
    .from(lessons);
  const published = await db
    .select({ c: sql<number>`count(*)` })
    .from(lessons)
    .where(eq(lessons.isPublished, true));
  const drafts = await db
    .select({ c: sql<number>`count(*)` })
    .from(lessons)
    .where(eq(lessons.isPublished, false));
  const totalAnswers = await db
    .select({ c: sql<number>`count(*)` })
    .from(answers);
  const pendingStudents = await db
    .select({ c: sql<number>`count(*)` })
    .from(users)
    .where(eq(users.status, "PENDING"));

  const recent = await db
    .select({
      submittedAt: answers.submittedAt,
      studentName: users.name,
      lessonId: lessons.id,
      lessonTitle: lessons.title,
    })
    .from(answers)
    .innerJoin(users, eq(answers.studentId, users.id))
    .innerJoin(questions, eq(answers.questionId, questions.id))
    .innerJoin(lessons, eq(questions.lessonId, lessons.id))
    .orderBy(desc(answers.submittedAt))
    .limit(5);

  return {
    totalLessons: Number(totalLessons[0].c),
    published: Number(published[0].c),
    drafts: Number(drafts[0].c),
    totalAnswers: Number(totalAnswers[0].c),
    pendingStudents: Number(pendingStudents[0].c),
    recent,
  };
}
