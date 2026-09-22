import { getDb } from "@/db";
import { getResponsesMatrix } from "@/lib/queries/admin";
import { buildResponsesCsv } from "@/lib/utils/csv";
import { getCurrentSession } from "@/lib/actions/auth";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentSession();
  if (
    !session ||
    session.role !== "TEACHER" ||
    session.status !== "ACTIVE"
  ) {
    return new Response("Acesso restrito", { status: 403 });
  }
  const { id } = await params;
  const matrix = await getResponsesMatrix(getDb(), id);
  if (!matrix) return new Response("Não encontrada", { status: 404 });

  const csv = buildResponsesCsv({
    questions: matrix.questions.map(
      (q: { id: string; questionText: string }) => ({
        id: q.id,
        questionText: q.questionText,
      })
    ),
    rows: matrix.students
      .filter(
        (s: { cells: Record<string, string> }) =>
          Object.keys(s.cells).length > 0
      )
      .map(
        (s: {
          name: string;
          lastSubmittedAt: number | null;
          cells: Record<string, string>;
        }) => ({
          studentName: s.name,
          submittedAt: s.lastSubmittedAt ?? 0,
          cells: s.cells,
        })
      ),
  });

  const filename = `respostas-${matrix.lesson.title
    .replace(/[^\wÀ-ÿ -]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase()}.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
