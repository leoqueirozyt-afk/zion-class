"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatDateTime } from "@/lib/utils/format";
import type { AttendanceView } from "@/lib/queries/admin";
import {
  saveAttendanceKeywordAction,
  openAttendanceAction,
  closeAttendanceAction,
  justifyAbsenceAction,
  suspendStudentAction,
} from "@/lib/actions/attendance";

const statusBadge: Record<
  string,
  { label: string; cls: string }
> = {
  PRESENT: { label: "Presente", cls: "bg-emerald-100 text-emerald-800" },
  ABSENT: { label: "Ausente", cls: "bg-red-100 text-red-700" },
  JUSTIFIED: { label: "Justificada", cls: "bg-amber-100 text-amber-800" },
};

export function AttendancePanel({ view }: { view: AttendanceView }) {
  const [keyword, setKeyword] = useState(view.lesson.attendanceKeyword ?? "");
  const [duration, setDuration] = useState(30);
  const [pending, start] = useTransition();
  const router = useRouter();

  const run = (
    fn: () => Promise<{ ok: boolean; error?: string }>,
    okMsg: string
  ) => {
    start(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(okMsg);
        router.refresh();
      } else {
        toast.error(res.error ?? "Não foi possível executar a ação");
      }
    });
  };

  const open = view.lesson.isAttendanceOpen;
  const expired = view.lesson.expired;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-medium">{view.lesson.title}</p>
            <p className="text-sm text-stone-500">
              {formatDate(view.lesson.date)}
            </p>
          </div>
          <Badge className={open ? "bg-emerald-700" : "bg-stone-400"}>
            {open
              ? `Chamada aberta${
                  view.lesson.attendanceExpiresAt
                    ? ` · expira ${formatDateTime(view.lesson.attendanceExpiresAt)}`
                    : ""
                }${expired ? " (expirada)" : ""}`
              : "Chamada fechada"}
          </Badge>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1.5 flex-1 min-w-[200px]">
            <label
              htmlFor="kw"
              className="text-sm font-medium text-stone-700"
            >
              Palavra-Chave da Aula
            </label>
            <Input
              id="kw"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Ex: ALIANÇA"
              disabled={pending}
            />
          </div>
          {!open && (
            <div className="space-y-1.5 w-28">
              <label htmlFor="dur" className="text-sm font-medium text-stone-700">
                Minutos
              </label>
              <Input
                id="dur"
                type="number"
                min={1}
                max={240}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                disabled={pending}
              />
            </div>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={pending || !keyword.trim()}
              onClick={() =>
                run(
                  () =>
                    saveAttendanceKeywordAction({
                      lessonId: view.lesson.id,
                      keyword,
                    }),
                  "Palavra-chave salva"
                )
              }
            >
              Salvar
            </Button>
            {open ? (
              <Button
                disabled={pending}
                className="bg-red-700 hover:bg-red-800"
                onClick={() =>
                  run(
                    () =>
                      closeAttendanceAction({ lessonId: view.lesson.id }),
                    "Chamada fechada"
                  )
                }
              >
                Fechar Chamada
              </Button>
            ) : (
              <Button
                disabled={pending || !keyword.trim()}
                className="bg-emerald-700 hover:bg-emerald-800"
                onClick={() =>
                  run(
                    () =>
                      openAttendanceAction({
                        lessonId: view.lesson.id,
                        keyword,
                        durationMinutes: duration,
                      }),
                    "Chamada aberta"
                  )
                }
              >
                Abrir Chamada
              </Button>
            )}
          </div>
        </div>

        <p className="text-sm text-stone-600">
          <strong>
            {view.presentCount} de {view.totalActive}
          </strong>{" "}
          alunos confirmaram
        </p>
      </div>

      <div className="rounded-lg border border-stone-200 bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-stone-500 text-left">
            <tr>
              <th className="p-3 font-medium">Aluno</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium">Confirmado</th>
              <th className="p-3 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {view.rows.map((r) => (
              <tr key={r.id} className="border-t border-stone-100">
                <td className="p-3">
                  <div className="font-medium">{r.name}</div>
                  <div className="text-xs text-stone-500">{r.email}</div>
                </td>
                <td className="p-3">
                  {r.userStatus === "SUSPENDED" ? (
                    <Badge className="bg-red-100 text-red-700">Suspenso</Badge>
                  ) : r.status ? (
                    <Badge className={statusBadge[r.status].cls}>
                      {statusBadge[r.status].label}
                    </Badge>
                  ) : (
                    <span className="text-stone-400">—</span>
                  )}
                </td>
                <td className="p-3 whitespace-nowrap">
                  {r.confirmedAt ? formatDateTime(r.confirmedAt) : "—"}
                </td>
                <td className="p-3 text-right whitespace-nowrap">
                  {r.status === "ABSENT" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() =>
                        run(
                          () =>
                            justifyAbsenceAction({
                              lessonId: view.lesson.id,
                              studentId: r.id,
                            }),
                          "Falta justificada"
                        )
                      }
                    >
                      Justificar
                    </Button>
                  )}
                  {r.userStatus !== "SUSPENDED" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      className="text-red-600"
                      onClick={() => {
                        if (
                          !window.confirm(
                            `Suspender ${r.name}? Motivo: faltas à chamada.`
                          )
                        )
                          return;
                        run(
                          () =>
                            suspendStudentAction({
                              studentId: r.id,
                              reason: "Faltas à chamada",
                            }),
                          "Aluno suspenso"
                        );
                      }}
                    >
                      Suspender
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {!view.rows.length && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-stone-500">
                  Nenhum aluno cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
