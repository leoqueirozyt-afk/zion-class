import { describe, it, expect } from "vitest";
import { serveMaterialFile } from "@/lib/materials/files";
import type { MaterialsBucket } from "@/lib/materials/r2";

const LESSON_ID = "seed-lesson-0001";
const MAT_ID = "0f0f0f0f-1111-2222-3333-444455556666";
const VALID_PATH = [LESSON_ID, `${MAT_ID}.pdf`];
const VALID_KEY = `materials/${LESSON_ID}/${MAT_ID}.pdf`;

function bucketWith(key: string | null): MaterialsBucket {
  return {
    async put() {},
    async list() {
      return { objects: [] };
    },
    async delete() {},
    async get(k: string) {
      if (k !== key) return null;
      return {
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
        httpMetadata: { contentType: "application/pdf" },
      };
    },
  };
}

describe("serveMaterialFile", () => {
  it("maps real /files/{lessonId}/{file}.pdf path to materials key", async () => {
    const res = await serveMaterialFile(bucketWith(VALID_KEY), VALID_PATH);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toContain("attachment");
    expect(res.headers.get("Content-Disposition")).toContain(`${MAT_ID}.pdf`);
    expect(res.headers.get("Cache-Control")).toContain("immutable");
    const buf = new Uint8Array(await res.arrayBuffer());
    expect([...buf]).toEqual([1, 2, 3]);
  });

  it("returns 404 when object missing", async () => {
    const res = await serveMaterialFile(bucketWith(null), VALID_PATH);
    expect(res.status).toBe(404);
  });

  it("returns 404 on invalid path shapes", async () => {
    const b = bucketWith(VALID_KEY);
    expect((await serveMaterialFile(b, ["..", `${MAT_ID}.pdf`])).status).toBe(404);
    expect((await serveMaterialFile(b, [LESSON_ID, "..pdf"])).status).toBe(404);
    expect((await serveMaterialFile(b, [LESSON_ID, "a.png"])).status).toBe(404);
    expect(
      (await serveMaterialFile(b, [LESSON_ID, "a b.pdf"])).status
    ).toBe(404);
    expect(
      (await serveMaterialFile(b, ["materials", LESSON_ID, `${MAT_ID}.pdf`]))
        .status
    ).toBe(404);
    expect((await serveMaterialFile(b, [])).status).toBe(404);
    expect((await serveMaterialFile(b, [LESSON_ID])).status).toBe(404);
  });
});
