import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { getDb } from "@/db";
import { getLessonsWithResponseCounts } from "@/lib/queries/admin";
import { formatDate, formatDateTime } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { ResponsiveTable } from "@/components/shell/responsive-table";

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

      <ResponsiveTable
        columns={[
          { key: "aula", header: "Aula" },
          { key: "data", header: "Data" },
          { key: "responderam", header: "Responderam" },
          { key: "ultimo", header: "Último envio" },
          { key: "acao", header: "Ação", className: "text-right" },
        ]}
        rows={rows}
        rowKey={(l) => l.id}
        emptyState={
          <p className="p-8 text-center text-stone-500">
            Nenhuma resposta ainda.
          </p>
        }
        renderMobile={(l) => (
          <div className="space-y-2">
            <div>
              <Link
                href={`/admin/lessons/${l.id}/responses`}
                className="font-medium hover:underline"
              >
                {l.title}
              </Link>
              <p className="text-xs text-stone-500">{formatDate(l.date)}</p>
            </div>
            <div className="text-sm text-stone-600">
              {l.answeredCount} de {l.totalActiveStudents} alunos ·{" "}
              {l.lastSubmittedAt ? formatDateTime(l.lastSubmittedAt) : "—"}
            </div>
            <Button asChild size="sm" variant="ghost" className="h-11">
              <Link
                href={`/admin/lessons/${l.id}/responses`}
                aria-label="Ver respostas"
              >
                <MessageSquare className="h-4 w-4" /> Ver
              </Link>
            </Button>
          </div>
        )}
        renderDesktopRow={(l) => (
          <>
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
              {l.lastSubmittedAt ? formatDateTime(l.lastSubmittedAt) : "—"}
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
          </>
        )}
      />
    </div>
  );
}
