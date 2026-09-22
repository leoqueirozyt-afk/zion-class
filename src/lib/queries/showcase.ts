import { and, eq, desc, sql } from "drizzle-orm";
import { lessons, questions, answers } from "@/db/schema";

export type ShowcaseLesson = {
  id: string;
  title: string;
  description: string;
  date: string;
  thumbnailUrl: string | null;
  videoUrl: string | null;
  questionCount: number;
  answeredCount: number;
  badge: "ANSWERED" | "PENDING" | "NONE";
};

export async function getShowcase(
  db: any,
  studentId: string
): Promise<ShowcaseLesson[]> {
  const published = await db
    .select()
    .from(lessons)
    .where(eq(lessons.isPublished, true))
    .orderBy(desc(lessons.date));

  const result: ShowcaseLesson[] = [];
  for (const lesson of published) {
    const qs = await db.select().from(questions).where(eq(questions.lessonId, lesson.id));
    let answered = 0;
    if (qs.length) {
      const rows = await db
        .select({ c: sql<number>`count(*)` })
        .from(answers)
        .innerJoin(questions, eq(answers.questionId, questions.id))
        .where(
          and(eq(questions.lessonId, lesson.id), eq(answers.studentId, studentId))
        );
      answered = Number(rows[0]?.c ?? 0);
    }
    const badge =
      qs.length === 0 ? "NONE" : answered >= qs.length ? "ANSWERED" : "PENDING";
    result.push({
      id: lesson.id,
      title: lesson.title,
      description: lesson.description,
      date: lesson.date,
      thumbnailUrl: lesson.thumbnailUrl,
      videoUrl: lesson.videoUrl,
      questionCount: qs.length,
      answeredCount: answered,
      badge,
    });
  }
  return result;
}
