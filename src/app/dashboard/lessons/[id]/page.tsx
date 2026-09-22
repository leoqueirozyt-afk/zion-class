import { notFound, redirect } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { getDb } from "@/db";
import { getCurrentSession } from "@/lib/actions/auth";
import { statusRedirectPath } from "@/lib/auth/session-refresh";
import { getLessonForStudent } from "@/lib/queries/lesson";
import { formatDate } from "@/lib/utils/format";
import { VideoEmbed } from "@/components/dashboard/video-embed";
import { MaterialsList } from "@/components/dashboard/materials-list";
import { QuestionForm } from "@/components/dashboard/question-form";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  const away = statusRedirectPath(session);
  if (away) redirect(away);

  const data = await getLessonForStudent(getDb(), id, session.sub);
  if (!data) notFound();
  const { lesson, materials, questions } = data;

  return (
    <article className="space-y-10 py-6 max-w-3xl mx-auto">
      {lesson.thumbnailUrl && (
        <div className="rounded-2xl overflow-hidden aspect-[3/1] bg-zinc-900">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lesson.thumbnailUrl}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
      )}
      <header className="space-y-2">
        <p className="text-xs text-emerald-500">{formatDate(lesson.date)}</p>
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-50">
          {lesson.title}
        </h1>
      </header>

      <section className="prose prose-invert prose-sm max-w-none [&_a]:text-emerald-400">
        <ReactMarkdown>{lesson.description}</ReactMarkdown>
      </section>

      {lesson.videoUrl && (
        <section id="video" className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-100">
            Vídeo complementar
          </h2>
          <VideoEmbed url={lesson.videoUrl} />
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-zinc-100">
          Materiais de apoio
        </h2>
        <MaterialsList materials={materials} />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-zinc-100">
          Questionário / Dúvidas
        </h2>
        <QuestionForm lessonId={lesson.id} questions={questions} />
      </section>
    </article>
  );
}
