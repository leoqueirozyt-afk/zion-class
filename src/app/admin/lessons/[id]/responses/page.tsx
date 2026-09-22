import Link from "next/link";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { getDb } from "@/db";
import { getResponsesMatrix } from "@/lib/queries/admin";
import { formatDate } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { ResponsesTable } from "@/components/admin/responses-table";

export default async function ResponsesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const matrix = await getResponsesMatrix(getDb(), id);
  if (!matrix) notFound();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{matrix.lesson.title}</h1>
          <p className="text-sm text-stone-500">
            {formatDate(matrix.lesson.date)} · {matrix.answeredCount} de{" "}
            {matrix.totalStudents} alunos responderam
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <a href={`/admin/lessons/${id}/responses/export`}>
              <Download className="mr-2 h-4 w-4" /> Exportar CSV
            </a>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/admin/lessons/${id}/edit`}>Editar aula</Link>
          </Button>
        </div>
      </div>
      <ResponsesTable matrix={matrix} />
    </div>
  );
}
