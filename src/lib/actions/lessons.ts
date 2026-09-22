import { eq } from "drizzle-orm";
import { lessons, materials, questions } from "@/db/schema";
import { lessonSchema } from "@/lib/validation/schemas";
import { getDb } from "@/db";
import { getCurrentSession } from "@/lib/actions/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type Result = { ok: boolean; error?: string; lessonId?: string };

export async function saveLesson(
  db: any,
  rawInput: unknown,
  existingId?: string
): Promise<Result> {
  const parsed = lessonSchema.safeParse(rawInput);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };
  const data = parsed.data;
  const lessonId = existingId ?? crypto.randomUUID();

  if (existingId) {
    await db
      .update(lessons)
      .set({
        title: data.title,
        description: data.description,
        date: data.date,
        videoUrl: data.videoUrl || null,
        thumbnailUrl: data.thumbnailUrl || null,
        isPublished: data.isPublished,
      })
      .where(eq(lessons.id, existingId));
    await db.delete(materials).where(eq(materials.lessonId, existingId));
    await db.delete(questions).where(eq(questions.lessonId, existingId));
  } else {
    await db.insert(lessons).values({
      id: lessonId,
      title: data.title,
      description: data.description,
      date: data.date,
      videoUrl: data.videoUrl || null,
      thumbnailUrl: data.thumbnailUrl || null,
      isPublished: data.isPublished,
      createdAt: Date.now(),
    });
  }

  if (data.materials.length) {
    await db.insert(materials).values(
      data.materials.map((m) => ({
        id: crypto.randomUUID(),
        lessonId,
        title: m.title,
        url: m.url,
        type: m.type,
      }))
    );
  }
  if (data.questions.length) {
    await db.insert(questions).values(
      data.questions.map((q, i) => ({
        id: q.id ?? crypto.randomUUID(),
        lessonId,
        questionText: q.questionText,
        questionType: q.questionType,
        options:
          q.questionType === "MULTIPLE_CHOICE"
            ? JSON.stringify(q.options)
            : null,
        correctOptionIndex:
          q.questionType === "MULTIPLE_CHOICE" ? q.correctOptionIndex : null,
        position: i,
      }))
    );
  }
  return { ok: true, lessonId };
}

export async function deleteLesson(
  db: any,
  lessonId: string
): Promise<Result> {
  await db.delete(lessons).where(eq(lessons.id, lessonId));
  return { ok: true };
}

export async function togglePublish(
  db: any,
  lessonId: string,
  isPublished: boolean
): Promise<Result> {
  await db
    .update(lessons)
    .set({ isPublished })
    .where(eq(lessons.id, lessonId));
  return { ok: true };
}

async function requireTeacher() {
  const session = await getCurrentSession();
  if (
    !session ||
    session.role !== "TEACHER" ||
    session.status !== "ACTIVE"
  )
    return null;
  return session;
}

function parseFormInput(formData: FormData) {
  const materialsRaw = JSON.parse(String(formData.get("materialsJson") || "[]"));
  const questionsRaw = JSON.parse(String(formData.get("questionsJson") || "[]"));
  return {
    title: formData.get("title"),
    description: String(formData.get("description") || ""),
    date: formData.get("date"),
    videoUrl: String(formData.get("videoUrl") || ""),
    thumbnailUrl: String(formData.get("thumbnailUrl") || ""),
    isPublished:
      formData.get("isPublished") === "true" ||
      formData.get("isPublished") === "on",
    materials: materialsRaw,
    questions: questionsRaw,
  };
}

export async function saveLessonAction(
  lessonId: string | null,
  formData: FormData
): Promise<Result> {
  if (!(await requireTeacher()))
    return { ok: false, error: "Acesso restrito" };
  const result = await saveLesson(
    getDb(),
    parseFormInput(formData),
    lessonId ?? undefined
  );
  if (result.ok) {
    revalidatePath("/admin/lessons");
    revalidatePath("/dashboard", "layout");
  }
  return result;
}

export async function deleteLessonAction(formData: FormData) {
  if (!(await requireTeacher())) redirect("/dashboard");
  await deleteLesson(getDb(), String(formData.get("lessonId")));
  revalidatePath("/admin/lessons");
  revalidatePath("/dashboard", "layout");
}

export async function togglePublishAction(formData: FormData) {
  if (!(await requireTeacher())) redirect("/dashboard");
  const id = String(formData.get("lessonId"));
  const next = String(formData.get("publish")) === "1";
  await togglePublish(getDb(), id, next);
  revalidatePath("/admin/lessons");
  revalidatePath("/dashboard", "layout");
}
