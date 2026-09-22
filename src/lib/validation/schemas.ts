import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(3, "Informe seu nome completo"),
  email: z.string().trim().toLowerCase().email("E-mail inválido"),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("E-mail inválido"),
  password: z.string().min(1, "Informe a senha"),
});

export const materialSchema = z
  .object({
    title: z.string().trim().min(1, "Título obrigatório"),
    url: z.string().trim(),
    type: z.enum(["PDF", "LINK", "IMAGE", "DOCUMENT"]),
    _file: z.number().int().optional(),
  })
  .refine((m) => m._file !== undefined || m.url !== "", {
    message: "Informe o link ou o PDF",
    path: ["url"],
  })
  .refine(
    (m) =>
      m._file !== undefined ||
      m.url.startsWith("/files/") ||
      z.string().url().safeParse(m.url).success,
    { message: "URL inválida", path: ["url"] }
  );

export const questionInputSchema = z
  .object({
    id: z.string().optional(),
    questionText: z.string().trim().min(1, "Texto da pergunta obrigatório"),
    questionType: z.enum(["TEXT", "MULTIPLE_CHOICE"]),
    options: z.array(z.string().trim().min(1)).default([]),
    correctOptionIndex: z.number().int().nullable().default(null),
  })
  .refine((q) => q.questionType === "TEXT" || q.options.length >= 2, {
    message: "Múltipla escolha precisa de pelo menos 2 opções",
    path: ["options"],
  })
  .refine(
    (q) =>
      q.questionType === "TEXT" ||
      q.correctOptionIndex === null ||
      (q.correctOptionIndex >= 0 && q.correctOptionIndex < q.options.length),
    { message: "Índice da resposta correta inválido", path: ["correctOptionIndex"] }
  );

export const lessonSchema = z.object({
  title: z.string().trim().min(1, "Título obrigatório"),
  description: z.string().default(""),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  videoUrl: z.string().trim().default(""),
  thumbnailUrl: z.string().trim().default(""),
  isPublished: z.boolean().default(false),
  materials: z.array(materialSchema).default([]),
  questions: z.array(questionInputSchema).default([]),
});

export type LessonInput = z.infer<typeof lessonSchema>;

export const saveAnswersSchema = z.object({
  lessonId: z.string().min(1),
  answers: z
    .array(
      z.discriminatedUnion("type", [
        z.object({
          questionId: z.string().min(1),
          type: z.literal("TEXT"),
          answerText: z.string().trim().min(1, "Resposta não pode ficar vazia"),
        }),
        z.object({
          questionId: z.string().min(1),
          type: z.literal("MULTIPLE_CHOICE"),
          optionIndex: z.number().int().min(0),
        }),
      ])
    )
    .min(1),
});

export const studentStatusSchema = z.object({
  userId: z.string().min(1),
  action: z.enum(["APPROVE", "SUSPEND", "REACTIVATE", "PROMOTE"]),
});
