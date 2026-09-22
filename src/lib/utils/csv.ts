type CsvInput = {
  questions: { id: string; questionText: string }[];
  rows: { studentName: string; submittedAt: number; cells: Record<string, string> }[];
};

function esc(v: string): string {
  if (/[;\n\r"]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function formatShort(epochMs: number): string {
  const dt = new Date(epochMs);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

export function buildResponsesCsv(input: CsvInput): string {
  const lines: string[] = ["Aluno;Pergunta;Resposta;Enviada em"];
  for (const row of input.rows) {
    const when = formatShort(row.submittedAt);
    for (const q of input.questions) {
      lines.push(
        [esc(row.studentName), esc(q.questionText), esc(row.cells[q.id] ?? ""), when].join(";")
      );
    }
  }
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}
