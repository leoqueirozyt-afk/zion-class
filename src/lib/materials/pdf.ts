export const MAX_PDF_BYTES = 25 * 1024 * 1024;

export type PdfValidation = { ok: true } | { ok: false; error: string };

export function validatePdf(file: File): PdfValidation {
  const isPdf =
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) return { ok: false, error: "Só é permitido enviar PDF" };
  if (file.size > MAX_PDF_BYTES)
    return { ok: false, error: "PDF deve ter no máximo 25 MB" };
  return { ok: true };
}
