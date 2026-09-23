"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, ArrowUp, ArrowDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { saveLessonAction } from "@/lib/actions/lessons";
import {
  buildLessonFormData,
  type LessonFormValues,
  type MaterialRow,
  type QuestionRow,
} from "@/lib/admin/lesson-form-data";

export type { LessonFormValues, MaterialRow, QuestionRow };

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function LessonForm({
  lessonId,
  initial,
}: {
  lessonId: string | null;
  initial: LessonFormValues;
}) {
  const [v, setV] = useState(initial);
  const [pending, start] = useTransition();
  const router = useRouter();
  const fileInputs = useRef<Record<number, HTMLInputElement | null>>({});
  const set = <K extends keyof LessonFormValues>(
    k: K,
    value: LessonFormValues[K]
  ) => setV((s) => ({ ...s, [k]: value }));

  const patchMaterial = (i: number, patch: Partial<MaterialRow>) => {
    const rows = [...v.materials];
    rows[i] = { ...rows[i], ...patch };
    set("materials", rows);
  };

  const submit = (publish?: boolean) => {
    for (const m of v.materials) {
      if (!m.file && !m.url) {
        toast.error("Informe o link ou o PDF");
        return;
      }
    }
    const fd = buildLessonFormData(v, publish);
    start(async () => {
      const res = await saveLessonAction(lessonId, fd);
      if (res.ok) {
        toast.success("Aula salva!");
        router.push("/admin/lessons");
        router.refresh();
      } else toast.error(res.error ?? "Não foi possível salvar");
    });
  };

  const moveQuestion = (i: number, dir: -1 | 1) => {
    const qs = [...v.questions];
    const j = i + dir;
    if (j < 0 || j >= qs.length) return;
    [qs[i], qs[j]] = [qs[j], qs[i]];
    set("questions", qs);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="rounded-xl border border-stone-200 bg-white p-6 space-y-4">
        <h2 className="font-semibold">Aula</h2>
        <div className="space-y-1.5">
          <Label htmlFor="title">Título</Label>
          <Input
            id="title"
            value={v.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Estudo #05 - Carta aos Romanos"
            className="h-12"
          />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="date">Data (terça)</Label>
            <Input
              id="date"
              type="date"
              value={v.date}
              onChange={(e) => set("date", e.target.value)}
              className="h-12"
            />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer pb-2">
            <Switch
              checked={v.isPublished}
              onCheckedChange={(c) => set("isPublished", c)}
            />
            Publicada
          </label>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="description">Descrição (Markdown)</Label>
          <Textarea
            id="description"
            rows={6}
            value={v.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="thumbnailUrl">URL da imagem (thumbnail)</Label>
            <Input
              id="thumbnailUrl"
              value={v.thumbnailUrl}
              onChange={(e) => set("thumbnailUrl", e.target.value)}
              placeholder="https://…"
              className="h-12"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="videoUrl">URL do vídeo complementar</Label>
            <Input
              id="videoUrl"
              value={v.videoUrl}
              onChange={(e) => set("videoUrl", e.target.value)}
              placeholder="https://youtube.com/…"
              className="h-12"
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Materiais</h2>
          <Button
            size="sm"
            variant="outline"
            type="button"
            onClick={() =>
              set("materials", [
                ...v.materials,
                { title: "", url: "", type: "LINK", mode: "link" },
              ])
            }
          >
            <Plus className="mr-1 h-4 w-4" /> Adicionar
          </Button>
        </div>
        {v.materials.length === 0 && (
          <p className="text-sm text-stone-500">Nenhum material.</p>
        )}
        {v.materials.map((m, i) => {
          const fileMode = m.mode === "file" || !!m.file;
          return (
            <div
              key={i}
              className="grid sm:grid-cols-[1fr_2fr_auto_auto_auto] gap-2 items-end"
            >
              <Input
                placeholder="Título"
                value={m.title}
                onChange={(e) => patchMaterial(i, { title: e.target.value })}
              />
              {fileMode ? (
                <div className="flex items-center gap-2 min-h-9 rounded-md border border-stone-300 px-2">
                  {m.file ? (
                    <>
                      <span className="text-sm text-stone-700 truncate flex-1">
                        {m.file.name} ({formatBytes(m.file.size)})
                      </span>
                      <button
                        type="button"
                        className="text-stone-500 hover:text-red-600 text-sm"
                        aria-label="Remover arquivo"
                        onClick={() =>
                          patchMaterial(i, { file: null, mode: "link", url: "" })
                        }
                      >
                        ✕
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="text-sm text-emerald-700 hover:underline"
                        onClick={() => fileInputs.current[i]?.click()}
                      >
                        {m.url.startsWith("/files/")
                          ? "Arquivo atual — trocar PDF…"
                          : "Escolher PDF…"}
                      </button>
                      <input
                        ref={(el) => {
                          fileInputs.current[i] = el;
                        }}
                        type="file"
                        accept=".pdf,application/pdf"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0] ?? null;
                          if (f) patchMaterial(i, { file: f, type: "PDF" });
                        }}
                      />
                    </>
                  )}
                </div>
              ) : (
                <Input
                  placeholder="https://…"
                  value={m.url}
                  onChange={(e) => patchMaterial(i, { url: e.target.value })}
                />
              )}
              <div className="flex rounded-md border border-stone-300 overflow-hidden h-9 self-end">
                <button
                  type="button"
                  className={`px-2 text-xs ${!fileMode ? "bg-emerald-700 text-white" : "bg-white text-stone-600"}`}
                  onClick={() =>
                    patchMaterial(i, { mode: "link", file: null })
                  }
                >
                  Link
                </button>
                <button
                  type="button"
                  className={`px-2 text-xs ${fileMode ? "bg-emerald-700 text-white" : "bg-white text-stone-600"}`}
                  onClick={() => patchMaterial(i, { mode: "file", url: m.url.startsWith("/files/") ? m.url : "" })}
                >
                  Arquivo
                </button>
              </div>
              <select
                className="h-9 rounded-md border border-stone-300 px-2 text-sm bg-white disabled:bg-stone-100"
                value={m.file ? "PDF" : m.type}
                disabled={!!m.file}
                onChange={(e) => {
                  patchMaterial(i, {
                    type: e.target.value as MaterialRow["type"],
                  });
                }}
              >
                {(["PDF", "LINK", "IMAGE", "DOCUMENT"] as const).map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
              <Button
                size="icon"
                variant="ghost"
                type="button"
                onClick={() =>
                  set("materials", v.materials.filter((_, j) => j !== i))
                }
                aria-label="Remover material"
              >
                <Trash2 className="h-4 w-4 text-red-600" />
              </Button>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Perguntas</h2>
          <Button
            size="sm"
            variant="outline"
            type="button"
            onClick={() =>
              set("questions", [
                ...v.questions,
                {
                  questionText: "",
                  questionType: "TEXT",
                  options: [],
                  correctOptionIndex: null,
                },
              ])
            }
          >
            <Plus className="mr-1 h-4 w-4" /> Adicionar
          </Button>
        </div>
        {v.questions.length === 0 && (
          <p className="text-sm text-stone-500">Nenhuma pergunta.</p>
        )}
        {v.questions.map((q, i) => (
          <div key={i} className="rounded-lg border border-stone-200 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-stone-500">Pergunta {i + 1}</span>
              <div className="flex gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  type="button"
                  onClick={() => moveQuestion(i, -1)}
                  aria-label="Mover para cima"
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  type="button"
                  onClick={() => moveQuestion(i, 1)}
                  aria-label="Mover para baixo"
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  type="button"
                  onClick={() =>
                    set("questions", v.questions.filter((_, j) => j !== i))
                  }
                  aria-label="Remover pergunta"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <Textarea
              placeholder="Texto da pergunta"
              value={q.questionText}
              onChange={(e) => {
                const rows = [...v.questions];
                rows[i] = { ...q, questionText: e.target.value };
                set("questions", rows);
              }}
            />
            <select
              className="h-9 rounded-md border border-stone-300 px-2 text-sm bg-white"
              value={q.questionType}
              onChange={(e) => {
                const rows = [...v.questions];
                rows[i] = {
                  ...q,
                  questionType: e.target.value as QuestionRow["questionType"],
                };
                set("questions", rows);
              }}
            >
              <option value="TEXT">Resposta aberta</option>
              <option value="MULTIPLE_CHOICE">Múltipla escolha</option>
            </select>
            {q.questionType === "MULTIPLE_CHOICE" && (
              <div className="space-y-2">
                {q.options.map((opt, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`correct-${i}`}
                      className="accent-emerald-600"
                      checked={q.correctOptionIndex === oi}
                      onChange={() => {
                        const rows = [...v.questions];
                        rows[i] = { ...q, correctOptionIndex: oi };
                        set("questions", rows);
                      }}
                      aria-label={`Marcar opção ${oi + 1} como correta`}
                    />
                    <Input
                      placeholder={`Opção ${oi + 1}`}
                      value={opt}
                      onChange={(e) => {
                        const rows = [...v.questions];
                        const opts = [...q.options];
                        opts[oi] = e.target.value;
                        rows[i] = { ...q, options: opts };
                        set("questions", rows);
                      }}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      type="button"
                      aria-label="Remover opção"
                      onClick={() => {
                        const rows = [...v.questions];
                        const opts = q.options.filter((_, j) => j !== oi);
                        rows[i] = {
                          ...q,
                          options: opts,
                          correctOptionIndex:
                            q.correctOptionIndex === oi
                              ? null
                              : q.correctOptionIndex !== null &&
                                  q.correctOptionIndex > oi
                                ? q.correctOptionIndex - 1
                                : q.correctOptionIndex,
                        };
                        set("questions", rows);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  onClick={() => {
                    const rows = [...v.questions];
                    rows[i] = { ...q, options: [...q.options, ""] };
                    set("questions", rows);
                  }}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> Opção
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button
          type="button"
          onClick={() => submit()}
          disabled={pending}
          className="h-12 w-full sm:w-auto bg-emerald-700 hover:bg-emerald-800"
        >
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar
        </Button>
        <Button
          type="button"
          onClick={() => submit(true)}
          disabled={pending}
          variant="outline"
          className="h-12 w-full sm:w-auto"
        >
          Salvar e publicar
        </Button>
      </div>
    </div>
  );
}
