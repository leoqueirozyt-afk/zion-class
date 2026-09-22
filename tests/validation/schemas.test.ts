import { describe, it, expect } from "vitest";
import {
  registerSchema,
  lessonSchema,
  materialSchema,
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
  it("material accepts external url", () => {
    expect(
      materialSchema.safeParse({
        title: "Slides",
        url: "https://exemplo.com/a.pdf",
        type: "PDF",
      }).success
    ).toBe(true);
  });
  it("material accepts /files path (kept upload)", () => {
    expect(
      materialSchema.safeParse({
        title: "Apostila",
        url: "/files/abc/def.pdf",
        type: "PDF",
      }).success
    ).toBe(true);
  });
  it("material accepts empty url only with _file", () => {
    expect(
      materialSchema.safeParse({
        title: "Apostila",
        url: "",
        type: "PDF",
        _file: 0,
      }).success
    ).toBe(true);
    expect(
      materialSchema.safeParse({
        title: "Apostila",
        url: "",
        type: "PDF",
      }).success
    ).toBe(false);
  });
  it("material rejects invalid url without _file", () => {
    expect(
      materialSchema.safeParse({
        title: "Apostila",
        url: "not-a-url",
        type: "PDF",
        _file: 1,
      }).success
    ).toBe(true);
    expect(
      materialSchema.safeParse({
        title: "Apostila",
        url: "not-a-url",
        type: "LINK",
      }).success
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
