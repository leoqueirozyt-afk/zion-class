"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Loader2 } from "lucide-react";
import { submitAnswersAction } from "@/lib/actions/answers";
import { formatDateTime } from "@/lib/utils/format";
import { useRouter } from "next/navigation";

export type QuestionView = {
  id: string;
  questionText: string;
  questionType: "TEXT" | "MULTIPLE_CHOICE";
  optionsList: string[];
  myAnswer: string | null;
  mySubmittedAt: number | null;
};

export function QuestionForm({
  lessonId,
  questions,
}: {
  lessonId: string;
  questions: QuestionView[];
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(questions.map((q) => [q.id, q.myAnswer ?? ""]))
  );
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const answered =
    questions.length > 0 && questions.every((q) => q.myAnswer !== null);
  const lastAt = questions.reduce<number | null>(
    (acc, q) =>
      q.mySubmittedAt && (!acc || q.mySubmittedAt > acc)
        ? q.mySubmittedAt
        : acc,
    null
  );

  if (!questions.length) {
    return <p className="text-sm text-zinc-500">Esta aula não tem questionário.</p>;
  }

  const submit = () => {
    const payload = {
      lessonId,
      answers: questions.map((q) =>
        q.questionType === "TEXT"
          ? {
              questionId: q.id,
              type: "TEXT" as const,
              answerText: values[q.id] ?? "",
            }
          : {
              questionId: q.id,
              type: "MULTIPLE_CHOICE" as const,
              optionIndex: Number(values[q.id]),
            }
      ),
    };
    startTransition(async () => {
      const res = await submitAnswersAction(payload);
      if (res.ok) {
        toast.success("Respostas salvas!");
        router.refresh();
      } else {
        toast.error(res.error ?? "Não foi possível salvar");
      }
    });
  };

  return (
    <div className="space-y-6">
      {answered && lastAt && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-950 border border-emerald-800 px-4 py-3 text-sm text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Sua resposta foi gravada em {formatDateTime(lastAt)}
        </div>
      )}
      {questions.map((q, i) => (
        <fieldset
          key={q.id}
          className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900 p-4"
        >
          <legend className="text-sm font-medium text-zinc-100 px-1">
            {i + 1}. {q.questionText}
          </legend>
          {q.questionType === "TEXT" ? (
            <Textarea
              value={values[q.id] ?? ""}
              onChange={(e) =>
                setValues((v) => ({ ...v, [q.id]: e.target.value }))
              }
              placeholder="Escreva sua resposta…"
              className="bg-zinc-950 border-zinc-800 text-zinc-100 min-h-[120px]"
            />
          ) : (
            <div className="space-y-2">
              {q.optionsList.map((opt, idx) => (
                <label
                  key={idx}
                  className="flex items-start gap-2 text-sm text-zinc-200 cursor-pointer"
                >
                  <input
                    type="radio"
                    name={q.id}
                    className="mt-1 accent-emerald-600"
                    checked={values[q.id] === String(idx)}
                    onChange={() =>
                      setValues((v) => ({ ...v, [q.id]: String(idx) }))
                    }
                  />
                  <span>{opt}</span>
                </label>
              ))}
            </div>
          )}
        </fieldset>
      ))}
      <Button
        onClick={submit}
        disabled={pending}
        className="h-12 w-full md:w-auto bg-emerald-700 hover:bg-emerald-800"
      >
        {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {answered ? "Atualizar respostas" : "Enviar respostas"}
      </Button>
    </div>
  );
}
