import { describe, it, expect } from "vitest";
import { buildResponsesCsv } from "@/lib/utils/csv";

describe("csv", () => {
  it("builds BOM + semicolon csv", () => {
    const csv = buildResponsesCsv({
      questions: [{ id: "q1", questionText: "O que é fé?" }],
      rows: [
        {
          studentName: "Maria",
          submittedAt: Date.UTC(2026, 8, 22, 20, 0),
          cells: { q1: "Confiança em Deus" },
        },
      ],
    });
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("Aluno;Pergunta;Resposta;Enviada em");
    expect(csv).toContain("Maria;O que é fé?;Confiança em Deus;");
  });
  it("escapes semicolons and quotes", () => {
    const csv = buildResponsesCsv({
      questions: [{ id: "q1", questionText: "Pergunta; com ponto" }],
      rows: [{ studentName: 'Ana "A"', submittedAt: 0, cells: { q1: "linha1\nlinha2" } }],
    });
    expect(csv).toContain('"Ana ""A"""');
    expect(csv).toContain('"Pergunta; com ponto"');
    expect(csv).toContain('"linha1\nlinha2"');
  });
});
