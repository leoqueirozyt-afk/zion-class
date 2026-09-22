import { describe, it, expect } from "vitest";
import { createTestDb } from "../utils/test-db";
import { saveLesson, deleteLesson, togglePublish } from "@/lib/actions/lessons";
import { lessons, materials, questions } from "@/db/schema";

const validInput = {
  title: "Estudo #01",
  description: "Intro",
  date: "2026-09-22",
  videoUrl: "https://youtube.com/watch?v=abc",
  thumbnailUrl: "https://exemplo.com/t.jpg",
  isPublished: false,
  materials: [
    { title: "PDF", url: "https://exemplo.com/a.pdf", type: "PDF" as const },
  ],
  questions: [
    {
      questionText: "O quê?",
      questionType: "TEXT" as const,
      options: [],
      correctOptionIndex: null,
    },
    {
      questionText: "Escolha",
      questionType: "MULTIPLE_CHOICE" as const,
      options: ["A", "B"],
      correctOptionIndex: 1,
    },
  ],
};

describe("saveLesson", () => {
  it("creates lesson with materials and questions", async () => {
    const db = createTestDb();
    const r = await saveLesson(db, validInput);
    expect(r.ok).toBe(true);
    expect(r.lessonId).toBeTruthy();
    expect(await db.select().from(lessons)).toHaveLength(1);
    expect(await db.select().from(materials)).toHaveLength(1);
    expect(await db.select().from(questions)).toHaveLength(2);
  });

  it("updates and removes missing materials/questions", async () => {
    const db = createTestDb();
    const created = await saveLesson(db, validInput);
    const upd = await saveLesson(
      db,
      {
        ...validInput,
        isPublished: true,
        materials: [
          {
            title: "Slides",
            url: "https://exemplo.com/s.pdf",
            type: "DOCUMENT" as const,
          },
        ],
        questions: [
          {
            questionText: "Só uma",
            questionType: "TEXT" as const,
            options: [],
            correctOptionIndex: null,
          },
        ],
      },
      created.lessonId
    );
    expect(upd.ok).toBe(true);
    const mats = await db.select().from(materials);
    expect(mats).toHaveLength(1);
    expect(mats[0].title).toBe("Slides");
    expect(await db.select().from(questions)).toHaveLength(1);
    const les = await db.select().from(lessons);
    expect(les[0].isPublished).toBeTruthy();
  });
});

describe("deleteLesson", () => {
  it("cascades to questions", async () => {
    const db = createTestDb();
    const c = await saveLesson(db, validInput);
    await deleteLesson(db, c.lessonId!);
    expect(await db.select().from(lessons)).toHaveLength(0);
    expect(await db.select().from(questions)).toHaveLength(0);
  });
});

describe("togglePublish", () => {
  it("flips flag", async () => {
    const db = createTestDb();
    const c = await saveLesson(db, validInput);
    await togglePublish(db, c.lessonId!, true);
    const rows = await db.select().from(lessons);
    expect(rows[0].isPublished).toBeTruthy();
  });
});
