import { asc, desc, eq, sql } from "drizzle-orm";
import { answers, lessons, questions, users } from "@/db/schema";

export type ResponseQuestion = {
  id: string;
  questionText: string;
  questionType: "TEXT" | "MULTIPLE_CHOICE";
  optionsList: string[];
  correctOptionIndex: number | null;
};
export type ResponseStudent = {
  id: string;
  name: string;
  email: string;
  cells: Record<string, string>;
  lastSubmittedAt: number | null;
};
export type ResponsesMatrix = {
  lesson: {
    id: string;
    title: string;
    date: string;
    description: string;
  };
  questions: ResponseQuestion[];
  students: ResponseStudent[];
  totalStudents: number;
  answeredCount: number;
};

export async function getResponsesMatrix(
  db: any,
  lessonId: string
): Promise<ResponsesMatrix | null> {
  const lessonRows = await db
    .select()
    .from(lessons)
    .where(eq(lessons.id, lessonId))
    .limit(1);
  if (!lessonRows.length) return null;
  const lesson = lessonRows[0];

  const qs = await db
    .select()
    .from(questions)
    .where(eq(questions.lessonId, lessonId))
    .orderBy(asc(questions.position));

  const students = await db
    .select()
    .from(users)
    .where(eq(users.role, "STUDENT"))
    .orderBy(asc(users.name));

  const ans = await db
    .select()
    .from(answers)
    .innerJoin(questions, eq(answers.questionId, questions.id))
    .where(eq(questions.lessonId, lessonId));

  const byStudent = new Map<
    string,
    { cells: Record<string, string>; maxAt: number }
  >();
  for (const row of ans) {
    const a = row.answers;
    const entry = byStudent.get(a.studentId) ?? { cells: {}, maxAt: 0 };
    entry.cells[a.questionId] = a.answerText;
    entry.maxAt = Math.max(entry.maxAt, a.submittedAt);
    byStudent.set(a.studentId, entry);
  }

  const rows = students.map((s: any) => {
    const entry = byStudent.get(s.id);
    return {
      id: s.id,
      name: s.name,
      email: s.email,
      cells: entry?.cells ?? {},
      lastSubmittedAt: entry?.maxAt ?? null,
    };
  });

  const answeredCount = rows.filter((r: ResponseStudent) =>
    qs.every((q: { id: string }) => r.cells[q.id] !== undefined)
  ).length;

  return {
    lesson,
    questions: qs.map((q: any) => ({
      id: q.id,
      questionText: q.questionText,
      questionType: q.questionType,
      optionsList: q.options ? (JSON.parse(q.options) as string[]) : [],
      correctOptionIndex: q.correctOptionIndex,
    })),
    students: rows,
    totalStudents: students.length,
    answeredCount,
  };
}

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
