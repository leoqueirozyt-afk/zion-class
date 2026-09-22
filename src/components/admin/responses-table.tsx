"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/utils/format";

export type Matrix = NonNullable<
  Awaited<ReturnType<typeof import("@/lib/queries/admin").getResponsesMatrix>>
>;

type Q = Matrix["questions"][number];
type S = Matrix["students"][number];

export function ResponsesTable({ matrix }: { matrix: Matrix }) {
  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState<{ student: string; question: string } | null>(
    null
  );

  const rows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return matrix.students;
    return matrix.students.filter((s: S) => s.name.toLowerCase().includes(q));
  }, [filter, matrix.students]);

  const opened = open
    ? {
        studentName: open.student,
        question: matrix.questions.find((q: Q) => q.id === open.question)!,
        cell: matrix.students.find((s: S) => s.name === open.student)?.cells[
          open.question
        ],
        at:
          matrix.students.find((s: S) => s.name === open.student)
            ?.lastSubmittedAt ?? null,
      }
    : null;

  return (
    <div className="space-y-4">
      <Input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filtrar por nome do aluno…"
        className="max-w-sm"
        aria-label="Filtrar por nome do aluno"
      />
      <div className="rounded-lg border border-stone-200 bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-left text-stone-500">
            <tr>
              <th className="p-3 font-medium sticky left-0 bg-stone-50">
                Aluno
              </th>
              {matrix.questions.map((q) => (
                <th
                  key={q.id}
                  className="p-3 font-medium min-w-[160px]"
                  title={q.questionText}
                >
                  <span className="line-clamp-2">{q.questionText}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((s: S) => (
              <tr key={s.id} className="border-t border-stone-100">
                <td className="p-3 font-medium sticky left-0 bg-white">
                  {s.name}
                </td>
                {matrix.questions.map((q: Q) => {
                  const raw = s.cells[q.id];
                  const isCorrect =
                    q.questionType === "MULTIPLE_CHOICE" &&
                    q.correctOptionIndex !== null &&
                    raw !== undefined &&
                    Number(raw) === q.correctOptionIndex;
                  const display =
                    raw === undefined
                      ? "—"
                      : q.questionType === "MULTIPLE_CHOICE" &&
                          q.optionsList[Number(raw)] !== undefined
                        ? q.optionsList[Number(raw)]
                        : raw;
                  return (
                    <td key={q.id} className="p-3 align-top">
                      <button
                        type="button"
                        onClick={() =>
                          setOpen({ student: s.name, question: q.id })
                        }
                        className="text-left hover:bg-stone-50 rounded px-1 -mx-1 max-w-[200px] line-clamp-2"
                      >
                        {display}
                        {isCorrect && (
                          <span className="ml-1 text-emerald-600">✓</span>
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td
                  colSpan={matrix.questions.length + 1}
                  className="p-8 text-center text-stone-500"
                >
                  Nenhum aluno encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {opened && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(null)}
        >
          <div
            className="bg-white rounded-xl max-w-lg w-full p-6 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold">{opened.studentName}</h3>
            <p className="text-sm text-stone-600">
              {opened.question.questionText}
            </p>
            <p className="text-sm whitespace-pre-wrap bg-stone-50 rounded-lg p-3">
              {opened.cell === undefined ? "(sem resposta)" : opened.cell}
            </p>
            {opened.at && (
              <p className="text-xs text-stone-500">
                Enviada em {formatDateTime(opened.at)}
              </p>
            )}
            <button
              className="text-sm text-emerald-700 font-medium"
              onClick={() => setOpen(null)}
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
