import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { lessons, materials, questions } from "@/db/schema";
import {
  LessonForm,
  type LessonFormValues,
} from "@/components/admin/lesson-form";

export default async function EditLessonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();

  const lessonRows = await db
    .select()
    .from(lessons)
    .where(eq(lessons.id, id))
    .limit(1);
  if (!lessonRows.length) notFound();
  const lesson = lessonRows[0];

  const mats = await db
    .select()
    .from(materials)
    .where(eq(materials.lessonId, id));
  const qs = await db
    .select()
    .from(questions)
    .where(eq(questions.lessonId, id))
    .orderBy(asc(questions.position));

  const initial: LessonFormValues = {
    title: lesson.title,
    description: lesson.description,
    date: lesson.date,
    videoUrl: lesson.videoUrl ?? "",
    thumbnailUrl: lesson.thumbnailUrl ?? "",
    isPublished: lesson.isPublished,
    materials: mats.map((m) => ({
      title: m.title,
      url: m.url,
      type: m.type,
      mode: m.url.startsWith("/files/") ? ("file" as const) : ("link" as const),
    })),
    questions: qs.map((q) => ({
      questionText: q.questionText,
      questionType: q.questionType,
      options: q.options ? (JSON.parse(q.options) as string[]) : [],
      correctOptionIndex: q.correctOptionIndex,
    })),
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Editar aula</h1>
      <LessonForm lessonId={id} initial={initial} />
    </div>
  );
}
