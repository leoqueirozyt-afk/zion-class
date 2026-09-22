import { eq } from "drizzle-orm";
import { lessons, materials, questions, answers } from "@/db/schema";

export async function getLessonForStudent(
  db: any,
  lessonId: string,
  studentId: string
) {
  const l = await db.select().from(lessons).where(eq(lessons.id, lessonId)).limit(1);
  if (!l.length || !l[0].isPublished) return null;
  const mats = await db
    .select()
    .from(materials)
    .where(eq(materials.lessonId, lessonId));
  const qs = await db
    .select()
    .from(questions)
    .where(eq(questions.lessonId, lessonId));
  qs.sort((a: any, b: any) => a.position - b.position);
  const myAnswers = await db
    .select()
    .from(answers)
    .where(eq(answers.studentId, studentId));
  const byQ = new Map<string, any>(myAnswers.map((a: any) => [a.questionId, a]));
  return {
    lesson: l[0],
    materials: mats,
    questions: qs.map((q: any) => {
      const a: any = byQ.get(q.id);
      return {
        ...q,
        optionsList: q.options ? (JSON.parse(q.options) as string[]) : [],
        myAnswer: a ? a.answerText : null,
        mySubmittedAt: a ? a.submittedAt : null,
      };
    }),
  };
}
