import { and, eq, inArray } from "drizzle-orm";
import { answers, questions, lessons } from "@/db/schema";
import { saveAnswersSchema } from "@/lib/validation/schemas";
import { getDb } from "@/db";
import { getCurrentSession } from "@/lib/actions/auth";
import { revalidatePath } from "next/cache";

export type Result = { ok: boolean; error?: string };

export async function submitAnswers(
  db: any,
  studentId: string,
  input: unknown
): Promise<Result> {
  const parsed = saveAnswersSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { lessonId, answers: items } = parsed.data;

  const lessonRows = await db
    .select()
    .from(lessons)
    .where(eq(lessons.id, lessonId))
    .limit(1);
  if (!lessonRows.length) return { ok: false, error: "Aula não encontrada" };

  const questionIds = items.map((i) => i.questionId);
  const validQs = await db
    .select()
    .from(questions)
    .where(and(eq(questions.lessonId, lessonId), inArray(questions.id, questionIds)));
  if (validQs.length !== questionIds.length)
    return { ok: false, error: "Pergunta inválida" };

  const now = Date.now();
  for (const item of items) {
    const text =
      item.type === "TEXT" ? item.answerText : String(item.optionIndex);
    const existing = await db
      .select()
      .from(answers)
      .where(
        and(
          eq(answers.questionId, item.questionId),
          eq(answers.studentId, studentId)
        )
      )
      .limit(1);
    if (existing.length) {
      await db
        .update(answers)
        .set({ answerText: text, submittedAt: now })
        .where(eq(answers.id, existing[0].id));
    } else {
      await db.insert(answers).values({
        id: crypto.randomUUID(),
        questionId: item.questionId,
        studentId,
        answerText: text,
        submittedAt: now,
      });
    }
  }
  return { ok: true };
}

export async function submitAnswersAction(input: unknown): Promise<Result> {
  const session = await getCurrentSession();
  if (!session) return { ok: false, error: "Sessão expirada" };
  if (session.status !== "ACTIVE") return { ok: false, error: "Acesso restrito" };
  const result = await submitAnswers(getDb(), session.sub, input);
  if (result.ok) revalidatePath("/dashboard", "layout");
  return result;
}
