import Link from "next/link";
import { Plus } from "lucide-react";
import { getDb } from "@/db";
import { getAdminMetrics } from "@/lib/queries/admin";
import { formatDateTime } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminHome() {
  const m = await getAdminMetrics(getDb());
  const stats = [
    { label: "Aulas", value: m.totalLessons },
    { label: "Publicadas", value: m.published },
    { label: "Rascunhos", value: m.drafts },
    { label: "Respostas", value: m.totalAnswers },
    { label: "Pendentes", value: m.pendingStudents },
  ];
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Visão geral</h1>
        <Button asChild className="bg-emerald-700 hover:bg-emerald-800">
          <Link href="/admin/lessons/new">
            <Plus className="mr-2 h-4 w-4" /> Nova aula
          </Link>
        </Button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs text-stone-500 font-normal">
                {s.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      {m.pendingStudents > 0 && (
        <Link
          href="/admin/students"
          className="block rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          {m.pendingStudents} aluno(s) aguardando aprovação →
        </Link>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Últimas respostas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {m.recent.length === 0 && (
            <p className="text-sm text-stone-500">Nenhuma resposta ainda.</p>
          )}
          {m.recent.map((r: { studentName: string; lessonTitle: string; lessonId: string; submittedAt: number }, i: number) => (
            <Link
              key={i}
              href={`/admin/lessons/${r.lessonId}/responses`}
              className="flex flex-wrap justify-between gap-2 text-sm border-b border-stone-100 pb-2 last:border-0 hover:bg-stone-50 rounded px-1 -mx-1"
            >
              <span>
                <strong>{r.studentName}</strong> · {r.lessonTitle}
              </span>
              <span className="text-stone-500">
                {formatDateTime(r.submittedAt)}
              </span>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
