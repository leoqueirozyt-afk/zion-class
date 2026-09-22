import { describe, it, expect } from "vitest";
import { buildLessonFormData } from "@/lib/admin/lesson-form-data";
import type { LessonFormValues } from "@/lib/admin/lesson-form-data";

const base: LessonFormValues = {
  title: "Aula",
  description: "",
  date: "2026-09-22",
  videoUrl: "",
  thumbnailUrl: "",
  isPublished: false,
  materials: [],
  questions: [],
};

describe("buildLessonFormData", () => {
  it("serializes plain fields", () => {
    const fd = buildLessonFormData(base, true);
    expect(fd.get("title")).toBe("Aula");
    expect(fd.get("isPublished")).toBe("true");
    expect(fd.get("materialsJson")).toBe("[]");
  });

  it("marks file rows with _file index and attaches File", async () => {
    const file = new File([new Uint8Array(0)], "a.pdf", {
      type: "application/pdf",
    });
    const fd = buildLessonFormData(
      {
        ...base,
        materials: [
          { title: "Link", url: "https://exemplo.com", type: "LINK" },
          { title: "PDF", url: "", type: "PDF", file },
          { title: "PDF2", url: "", type: "PDF", file },
        ],
      },
      false
    );
    const mats = JSON.parse(String(fd.get("materialsJson")));
    expect(mats).toHaveLength(3);
    expect(mats[0]._file).toBeUndefined();
    expect(mats[1]._file).toBe(0);
    expect(mats[2]._file).toBe(1);
    expect(mats[1].url).toBe("");
    expect(fd.get("file_0")).toBe(file);
    expect(fd.get("file_1")).toBe(file);
    expect(fd.get("file_2")).toBeNull();
  });

  it("keeps /files url when no new file selected", () => {
    const fd = buildLessonFormData(
      {
        ...base,
        materials: [
          {
            title: "Atual",
            url: "/files/l1/m1.pdf",
            type: "PDF",
            mode: "file",
          },
        ],
      },
      false
    );
    const mats = JSON.parse(String(fd.get("materialsJson")));
    expect(mats[0].url).toBe("/files/l1/m1.pdf");
    expect(mats[0]._file).toBeUndefined();
  });
});
