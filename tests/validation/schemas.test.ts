import { describe, it, expect } from "vitest";
import {
  registerSchema,
  lessonSchema,
  saveAnswersSchema,
} from "@/lib/validation/schemas";

describe("schemas", () => {
  it("register accepts valid and lowercases email", () => {
    const r = registerSchema.safeParse({
      name: "Maria Silva",
      email: "A@B.Com",
      password: "123456",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe("a@b.com");
  });
  it("register rejects short password", () => {
    expect(
      registerSchema.safeParse({ name: "Maria", email: "a@b.com", password: "123" }).success
    ).toBe(false);
  });
  it("lesson requires YYYY-MM-DD date", () => {
    expect(
      lessonSchema.safeParse({ title: "Aula", date: "2026-09-22", description: "" }).success
    ).toBe(true);
    expect(
      lessonSchema.safeParse({ title: "Aula", date: "22/09/2026", description: "" }).success
    ).toBe(false);
  });
  it("saveAnswers rejects empty text and null optionIndex", () => {
    expect(
      saveAnswersSchema.safeParse({
        lessonId: "l1",
        answers: [
          { questionId: "q1", type: "TEXT", answerText: "  " },
          { questionId: "q2", type: "MULTIPLE_CHOICE", optionIndex: null },
        ],
      }).success
    ).toBe(false);
  });
  it("saveAnswers accepts valid", () => {
    expect(
      saveAnswersSchema.safeParse({
        lessonId: "l1",
        answers: [
          { questionId: "q1", type: "TEXT", answerText: "ok" },
          { questionId: "q2", type: "MULTIPLE_CHOICE", optionIndex: 1 },
        ],
      }).success
    ).toBe(true);
  });
});
