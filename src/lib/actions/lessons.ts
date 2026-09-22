"use server";

import { eq } from "drizzle-orm";
import { lessons, materials, questions } from "@/db/schema";
import { lessonSchema } from "@/lib/validation/schemas";
import { getDb } from "@/db";
import { getCurrentSession } from "@/lib/actions/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { validatePdf } from "@/lib/materials/pdf";
import {
  getMaterialsBucket,
  materialKeyFromUrl,
  wipeLessonPrefix,
  type MaterialsBucket,
} from "@/lib/materials/r2";

export type Result = { ok: boolean; error?: string; lessonId?: string };

export async function saveLesson(
  db: any,
  rawInput: unknown,
  existingId?: string,
  bucket?: MaterialsBucket | null,
  files?: File[] | null
): Promise<Result> {
  const parsed = lessonSchema.safeParse(rawInput);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };
  const data = parsed.data;
  const lessonId = existingId ?? crypto.randomUUID();

  type FinalMaterial = {
    id: string;
    title: string;
    url: string;
    type: "PDF" | "LINK" | "IMAGE" | "DOCUMENT";
  };
  const finals: FinalMaterial[] = [];
  const uploads: { key: string; file: File }[] = [];

  for (const m of data.materials) {
    if (m._file !== undefined) {
      const file = files?.[m._file];
      if (!file) return { ok: false, error: "Informe o link ou o PDF" };
      const check = validatePdf(file);
      if (!check.ok) return check;
      if (!bucket)
        return {
          ok: false,
          error: "Não foi possível enviar o PDF. Tente novamente.",
        };
      const materialId = crypto.randomUUID();
      const key = `materials/${lessonId}/${materialId}.pdf`;
      uploads.push({ key, file });
      finals.push({
        id: materialId,
        title: m.title,
        url: `/files/${lessonId}/${materialId}.pdf`,
        type: "PDF",
      });
    } else {
      finals.push({
        id: crypto.randomUUID(),
        title: m.title,
        url: m.url,
        type: m.type,
      });
    }
  }

  if (existingId && bucket) {
    const keep = new Set(
      finals
        .filter((f) => f.url.startsWith("/files/"))
        .map((f) => materialKeyFromUrl(f.url))
    );
    await wipeLessonPrefix(bucket, lessonId, keep);
  }

  for (const u of uploads) {
    try {
      await bucket!.put(u.key, await u.file.arrayBuffer(), {
        httpMetadata: {
          contentType: "application/pdf",
          contentDisposition: 'attachment; filename="material.pdf"',
        },
      });
    } catch (e) {
      console.error("R2 put failed", e);
      return {
        ok: false,
        error: "Não foi possível enviar o PDF. Tente novamente.",
      };
    }
  }

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

  if (finals.length) {
    await db.insert(materials).values(
      finals.map((m) => ({
        id: m.id,
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
  lessonId: string,
  bucket?: MaterialsBucket | null
): Promise<Result> {
  if (bucket) await wipeLessonPrefix(bucket, lessonId);
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
  const files: File[] = [];
  for (const m of materialsRaw as { _file?: number }[]) {
    if (m && typeof m._file === "number") {
      const f = formData.get(`file_${m._file}`);
      if (f instanceof File) files[m._file] = f;
    }
  }
  return {
    input: {
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
    },
    files,
  };
}

export async function saveLessonAction(
  lessonId: string | null,
  formData: FormData
): Promise<Result> {
  if (!(await requireTeacher()))
    return { ok: false, error: "Acesso restrito" };
  const { input, files } = parseFormInput(formData);
  let bucket: MaterialsBucket | null = null;
  try {
    bucket = getMaterialsBucket();
  } catch {
    bucket = null;
  }
  const result = await saveLesson(
    getDb(),
    input,
    lessonId ?? undefined,
    bucket,
    files
  );
  if (result.ok) {
    revalidatePath("/admin/lessons");
    revalidatePath("/dashboard", "layout");
  }
  return result;
}

export async function deleteLessonAction(formData: FormData) {
  if (!(await requireTeacher())) redirect("/dashboard");
  let bucket: MaterialsBucket | null = null;
  try {
    bucket = getMaterialsBucket();
  } catch {
    bucket = null;
  }
  await deleteLesson(getDb(), String(formData.get("lessonId")), bucket);
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
