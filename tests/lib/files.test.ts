import { describe, it, expect } from "vitest";
import { serveMaterialFile } from "@/lib/materials/files";
import type { MaterialsBucket } from "@/lib/materials/r2";

const VALID_ID = "225d7178-291d-4b98-b078-90168549cd29";
const VALID_MAT = "0f0f0f0f-1111-2222-3333-444455556666";
const VALID_PATH = ["materials", VALID_ID, `${VALID_MAT}.pdf`];

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
  it("returns 200 with attachment headers", async () => {
    const key = `materials/${VALID_ID}/${VALID_MAT}.pdf`;
    const res = await serveMaterialFile(bucketWith(key), VALID_PATH);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toContain("attachment");
    expect(res.headers.get("Cache-Control")).toContain("immutable");
    const buf = new Uint8Array(await res.arrayBuffer());
    expect([...buf]).toEqual([1, 2, 3]);
  });

  it("returns 404 when object missing", async () => {
    const res = await serveMaterialFile(bucketWith(null), VALID_PATH);
    expect(res.status).toBe(404);
  });

  it("returns 404 on invalid path shapes", async () => {
    const b = bucketWith("x");
    expect((await serveMaterialFile(b, ["materials", "..", "a.pdf"])).status).toBe(404);
    expect((await serveMaterialFile(b, ["materials", "x"])).status).toBe(404);
    expect(
      (await serveMaterialFile(b, ["materials", VALID_ID, "a.png"])).status
    ).toBe(404);
    expect(
      (await serveMaterialFile(b, ["other", VALID_ID, `${VALID_MAT}.pdf`])).status
    ).toBe(404);
    expect(
      (await serveMaterialFile(b, ["materials", "not-a-uuid", `${VALID_MAT}.pdf`])).status
    ).toBe(404);
    expect((await serveMaterialFile(b, [])).status).toBe(404);
  });
});
