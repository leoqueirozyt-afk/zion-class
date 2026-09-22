import { describe, it, expect } from "vitest";
import { createTestDb } from "../utils/test-db";
import { saveLesson, deleteLesson, togglePublish } from "@/lib/actions/lessons";
import { lessons, materials, questions } from "@/db/schema";
import type { MaterialsBucket } from "@/lib/materials/r2";

function createFakeBucket() {
  const store = new Map<string, { body: unknown; opts?: unknown }>();
  const puts: { key: string; opts?: unknown }[] = [];
  const deletes: string[] = [];
  const bucket: MaterialsBucket = {
    async put(key, value, opts) {
      store.set(key, { body: value, opts });
      puts.push({ key, opts });
    },
    async list({ prefix }) {
      return {
        objects: [...store.keys()]
          .filter((k) => k.startsWith(prefix))
          .map((key) => ({ key })),
      };
    },
    async get(key) {
      const e = store.get(key);
      if (!e) return null;
      return {
        arrayBuffer: async () =>
          (e.body instanceof ArrayBuffer
            ? e.body
            : new TextEncoder().encode(String(e.body)).buffer),
      };
    },
    async delete(keys) {
      for (const k of keys) {
        store.delete(k);
        deletes.push(k);
      }
    },
  };
  return { bucket, store, puts, deletes };
}

function pdfFile(name = "a.pdf", size = 10): File {
  const f = new File([new Uint8Array(0)], name, { type: "application/pdf" });
  Object.defineProperty(f, "size", { value: size });
  return f;
}

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

describe("saveLesson with R2 upload", () => {
  const withFile = {
    ...validInput,
    materials: [
      { title: "Apostila", url: "", type: "PDF" as const, _file: 0 },
      {
        title: "Link",
        url: "https://exemplo.com/x",
        type: "LINK" as const,
      },
    ],
  };

  it("puts pdf and stores /files url", async () => {
    const db = createTestDb();
    const { bucket, puts } = createFakeBucket();
    const r = await saveLesson(db, withFile, undefined, bucket, [pdfFile()]);
    expect(r.ok).toBe(true);
    const mats = await db.select().from(materials);
    expect(mats).toHaveLength(2);
    const pdf = mats.find((m) => m.title === "Apostila")!;
    expect(pdf.url).toMatch(
      new RegExp(`^/files/${r.lessonId}/[0-9a-f-]+\\.pdf$`)
    );
    expect(pdf.type).toBe("PDF");
    const key = pdf.url.replace(/^\/files\//, "materials/");
    expect(puts).toHaveLength(1);
    expect(puts[0].key).toBe(key);
    expect(puts[0].opts).toMatchObject({
      httpMetadata: {
        contentType: "application/pdf",
        contentDisposition: expect.stringContaining("attachment"),
      },
    });
    expect(mats.find((m) => m.title === "Link")!.url).toBe(
      "https://exemplo.com/x"
    );
  });

  it("rejects non-PDF before any put", async () => {
    const db = createTestDb();
    const { bucket, puts } = createFakeBucket();
    const r = await saveLesson(db, withFile, undefined, bucket, [
      new File([new Uint8Array(0)], "a.png", { type: "image/png" }),
    ]);
    expect(r).toEqual({ ok: false, error: "Só é permitido enviar PDF" });
    expect(puts).toHaveLength(0);
    expect(await db.select().from(lessons)).toHaveLength(0);
  });

  it("rejects file over 25 MB", async () => {
    const db = createTestDb();
    const { bucket, puts } = createFakeBucket();
    const big = pdfFile("a.pdf", 25 * 1024 * 1024 + 1);
    const r = await saveLesson(db, withFile, undefined, bucket, [big]);
    expect(r).toEqual({
      ok: false,
      error: "PDF deve ter no máximo 25 MB",
    });
    expect(puts).toHaveLength(0);
  });

  it("on edit wipes orphans but keeps referenced /files objects", async () => {
    const db = createTestDb();
    const { bucket, store } = createFakeBucket();
    const created = await saveLesson(
      db,
      { ...validInput, materials: [] },
      undefined,
      bucket
    );
    const lessonId = created.lessonId!;
    const keptKey = `materials/${lessonId}/kept.pdf`;
    const orphanKey = `materials/${lessonId}/orphan.pdf`;
    await bucket.put(keptKey, "kept");
    await bucket.put(orphanKey, "orphan");

    const upd = await saveLesson(
      db,
      {
        ...validInput,
        materials: [
          {
            title: "Mantido",
            url: "/files/" + lessonId + "/kept.pdf",
            type: "PDF" as const,
          },
          { title: "Novo", url: "", type: "PDF" as const, _file: 0 },
        ],
      },
      lessonId,
      bucket,
      [pdfFile()]
    );
    expect(upd.ok).toBe(true);
    expect(store.has(keptKey)).toBe(true);
    expect(store.has(orphanKey)).toBe(false);
    const mats = await db.select().from(materials);
    const novo = mats.find((m) => m.title === "Novo")!;
    expect(store.has(novo.url.replace(/^\/files\//, "materials/"))).toBe(
      true
    );
    const mantido = mats.find((m) => m.title === "Mantido")!;
    expect(mantido.url).toBe(`/files/${lessonId}/kept.pdf`);
  });

  it("fails when _file present but bucket missing", async () => {
    const db = createTestDb();
    const r = await saveLesson(db, withFile, undefined, undefined, [pdfFile()]);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("PDF");
  });
});

describe("deleteLesson R2 cleanup", () => {
  it("removes lesson prefix objects", async () => {
    const db = createTestDb();
    const { bucket, store } = createFakeBucket();
    const c = await saveLesson(
      db,
      { ...validInput, materials: [] },
      undefined,
      bucket
    );
    await bucket.put(`materials/${c.lessonId}/a.pdf`, "x");
    await bucket.put("materials/other/b.pdf", "y");
    await deleteLesson(db, c.lessonId!, bucket);
    expect(store.has(`materials/${c.lessonId}/a.pdf`)).toBe(false);
    expect(store.has("materials/other/b.pdf")).toBe(true);
    expect(await db.select().from(lessons)).toHaveLength(0);
  });
});
