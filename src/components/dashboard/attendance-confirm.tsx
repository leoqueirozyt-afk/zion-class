"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { confirmAttendanceAction } from "@/lib/actions/attendance";
import { formatDateTime } from "@/lib/utils/format";

export function AttendanceConfirm({
  lessonId,
  open,
}: {
  lessonId: string;
  open: boolean;
}) {
  const [keyword, setKeyword] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  if (!open) return null;
  return (
    <section className="rounded-xl border border-emerald-500/40 bg-emerald-950/40 p-4 space-y-3">
      <h2 className="font-semibold text-emerald-100">
        Confirmar Presença na Aula
      </h2>
      <p className="text-sm text-emerald-200/80">
        Digite a palavra-chave informada pelo professor:
      </p>
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <Input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="Ex: ALIANÇA"
          className="h-12 w-full md:max-w-xs bg-zinc-900 border-zinc-700 text-zinc-50"
          aria-label="Palavra-chave da presença"
          disabled={pending}
        />
        <Button
          disabled={pending || !keyword.trim()}
          onClick={() =>
            start(async () => {
              const res = await confirmAttendanceAction({ lessonId, keyword });
              if (res.ok) {
                toast.success("Presença confirmada!");
                setKeyword("");
                router.refresh();
              } else {
                toast.error(
                  res.error ?? "Palavra-chave incorreta ou chamada encerrada."
                );
              }
            })
          }
          className="h-12 w-full md:w-auto bg-emerald-700 hover:bg-emerald-800"
        >
          {pending ? "Confirmando…" : "Confirmar Presença"}
        </Button>
      </div>
    </section>
  );
}

export function AttendanceBadge({ confirmedAt }: { confirmedAt: number }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-emerald-900/80 px-3 py-1 text-xs text-emerald-200">
      ✓ Presença Confirmada em {formatDateTime(confirmedAt)}
    </span>
  );
}
