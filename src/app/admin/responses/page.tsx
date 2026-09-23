import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { getDb } from "@/db";
import { getLessonsWithResponseCounts } from "@/lib/queries/admin";
import { formatDate, formatDateTime } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";

export default async function AdminResponsesIndexPage() {
  const rows = await getLessonsWithResponseCounts(getDb());

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Respostas</h1>
        <p className="text-sm text-stone-500">
          {rows.length} aula(s) com respostas
        </p>
      </div>

      {rows.length === 0 && (
        <p className="text-sm text-stone-500">Nenhuma resposta ainda.</p>
      )}

      {rows.length > 0 && (
        <div className="rounded-lg border border-stone-200 bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-stone-500 text-left">
              <tr>
                <th className="p-3 font-medium">Aula</th>
                <th className="p-3 font-medium">Data</th>
                <th className="p-3 font-medium">Responderam</th>
                <th className="p-3 font-medium">Último envio</th>
                <th className="p-3 font-medium text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr
                  key={l.id}
                  className="border-t border-stone-100 hover:bg-stone-50"
                >
                  <td className="p-3 font-medium">
                    <Link
                      href={`/admin/lessons/${l.id}/responses`}
                      className="hover:underline"
                    >
                      {l.title}
                    </Link>
                  </td>
                  <td className="p-3 whitespace-nowrap">{formatDate(l.date)}</td>
                  <td className="p-3 whitespace-nowrap">
                    {l.answeredCount} de {l.totalActiveStudents} alunos
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    {l.lastSubmittedAt
                      ? formatDateTime(l.lastSubmittedAt)
                      : "—"}
                  </td>
                  <td className="p-3 text-right">
                    <Button asChild size="sm" variant="ghost">
                      <Link
                        href={`/admin/lessons/${l.id}/responses`}
                        aria-label="Ver respostas"
                      >
                        <MessageSquare className="h-4 w-4" />
                        <span className="ml-1">Ver</span>
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
