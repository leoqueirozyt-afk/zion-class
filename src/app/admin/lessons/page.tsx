import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { Plus, Pencil, MessageSquare, ClipboardList, Trash2 } from "lucide-react";
import { getDb } from "@/db";
import { lessons, questions, answers } from "@/db/schema";
import { formatDate } from "@/lib/utils/format";
import { deleteLessonAction, togglePublishAction } from "@/lib/actions/lessons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default async function AdminLessonsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q = "", status = "all" } = await searchParams;
  const db = getDb();

  let where: ReturnType<typeof eq> | undefined;
  if (status === "published") where = eq(lessons.isPublished, true);
  if (status === "draft") where = eq(lessons.isPublished, false);

  let rows = await db
    .select()
    .from(lessons)
    .where(where)
    .orderBy(desc(lessons.date));
  if (q) {
    const needle = q.toLowerCase();
    rows = rows.filter((l) => l.title.toLowerCase().includes(needle));
  }

  const withCounts = await Promise.all(
    rows.map(async (l) => {
      const qCount = await db
        .select({ c: sql<number>`count(*)` })
        .from(questions)
        .where(eq(questions.lessonId, l.id));
      const aCount = await db
        .select({ c: sql<number>`count(*)` })
        .from(answers)
        .innerJoin(questions, eq(answers.questionId, questions.id))
        .where(eq(questions.lessonId, l.id));
      return {
        ...l,
        qCount: Number(qCount[0].c),
        aCount: Number(aCount[0].c),
      };
    })
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Aulas</h1>
        <Button asChild className="bg-emerald-700 hover:bg-emerald-800">
          <Link href="/admin/lessons/new">
            <Plus className="mr-2 h-4 w-4" /> Nova aula
          </Link>
        </Button>
      </div>

      <form className="flex flex-wrap gap-2" method="get">
        <Input
          name="q"
          defaultValue={q}
          placeholder="Buscar por título…"
          className="max-w-xs"
        />
        <select
          name="status"
          defaultValue={status}
          className="h-9 rounded-md border border-stone-300 bg-white px-2 text-sm"
        >
          <option value="all">Todos</option>
          <option value="published">Publicadas</option>
          <option value="draft">Rascunhos</option>
        </select>
        <Button type="submit" variant="outline">
          Filtrar
        </Button>
      </form>

      <div className="rounded-lg border border-stone-200 bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-stone-500 text-left">
            <tr>
              <th className="p-3 font-medium">Data</th>
              <th className="p-3 font-medium">Título</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium">Perguntas</th>
              <th className="p-3 font-medium">Respostas</th>
              <th className="p-3 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {withCounts.map((l) => (
              <tr key={l.id} className="border-t border-stone-100">
                <td className="p-3 whitespace-nowrap">{formatDate(l.date)}</td>
                <td className="p-3 font-medium">{l.title}</td>
                <td className="p-3">
                  <Badge
                    variant={l.isPublished ? "default" : "secondary"}
                    className={l.isPublished ? "bg-emerald-700" : ""}
                  >
                    {l.isPublished ? "Publicada" : "Rascunho"}
                  </Badge>
                </td>
                <td className="p-3">{l.qCount}</td>
                <td className="p-3">{l.aCount}</td>
                <td className="p-3">
                  <div className="flex justify-end items-center gap-1">
                    <Button asChild size="sm" variant="ghost">
                      <Link
                        href={`/admin/lessons/${l.id}/edit`}
                        aria-label="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="ghost">
                      <Link
                        href={`/admin/lessons/${l.id}/responses`}
                        aria-label="Ver respostas"
                        title="Ver respostas dos alunos"
                      >
                        <MessageSquare className="h-4 w-4" />
                        <span className="ml-1 hidden sm:inline">Respostas</span>
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="ghost">
                      <Link
                        href={`/admin/lessons/${l.id}/attendance`}
                        aria-label="Chamada"
                        title="Abrir chamada da aula"
                      >
                        <ClipboardList className="h-4 w-4" />
                        <span className="ml-1 hidden sm:inline">Chamada</span>
                      </Link>
                    </Button>
                    <form action={togglePublishAction}>
                      <input type="hidden" name="lessonId" value={l.id} />
                      <input
                        type="hidden"
                        name="publish"
                        value={l.isPublished ? "0" : "1"}
                      />
                      <Button size="sm" variant="ghost" type="submit">
                        {l.isPublished ? "Despublicar" : "Publicar"}
                      </Button>
                    </form>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600"
                          aria-label="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Excluir aula?</DialogTitle>
                          <DialogDescription>
                            “{l.title}” e todos os materiais, perguntas e
                            respostas serão removidos.
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                          <form action={deleteLessonAction}>
                            <input
                              type="hidden"
                              name="lessonId"
                              value={l.id}
                            />
                            <Button type="submit" variant="destructive">
                              Excluir
                            </Button>
                          </form>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </td>
              </tr>
            ))}
            {!withCounts.length && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-stone-500">
                  Nenhuma aula encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
