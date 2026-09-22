import { describe, it, expect } from "vitest";
import { validatePdf, MAX_PDF_BYTES } from "@/lib/materials/pdf";

function file(name: string, type: string): File {
  return new File([new Uint8Array(0)], name, { type });
}

function sizedFile(name: string, type: string, size: number): File {
  const f = new File([new Uint8Array(0)], name, { type });
  Object.defineProperty(f, "size", { value: size });
  return f;
}

describe("validatePdf", () => {
  it("accepts application/pdf mime", () => {
    expect(validatePdf(file("a.pdf", "application/pdf"))).toEqual({
      ok: true,
    });
  });

  it("accepts .pdf extension even with empty/wrong mime", () => {
    expect(validatePdf(file("a.pdf", ""))).toEqual({ ok: true });
    expect(validatePdf(file("a.PDF", "application/octet-stream"))).toEqual({
      ok: true,
    });
  });

  it("rejects non-PDF", () => {
    expect(validatePdf(file("a.png", "image/png"))).toEqual({
      ok: false,
      error: "Só é permitido enviar PDF",
    });
    expect(validatePdf(file("a.txt", "text/plain"))).toEqual({
      ok: false,
      error: "Só é permitido enviar PDF",
    });
  });

  it("rejects file over 25 MB", () => {
    const r = validatePdf(sizedFile("a.pdf", "application/pdf", MAX_PDF_BYTES + 1));
    expect(r).toEqual({
      ok: false,
      error: "PDF deve ter no máximo 25 MB",
    });
  });

  it("accepts file exactly 25 MB", () => {
    expect(
      validatePdf(sizedFile("a.pdf", "application/pdf", MAX_PDF_BYTES))
    ).toEqual({ ok: true });
  });

  it("accepts empty file (only size cap is 25 MB)", () => {
    expect(validatePdf(sizedFile("a.pdf", "application/pdf", 0))).toEqual({
      ok: true,
    });
  });
});
