import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import fg from "fast-glob";
import fs from "node:fs";
import { users, lessons, materials, questions } from "./schema";
import { hashPassword } from "../lib/auth/password";

const email = process.env.SEED_TEACHER_EMAIL || "professor@igreja.com";
const password = process.env.SEED_TEACHER_PASSWORD || "Troque@123";

async function findLocalD1(): Promise<string> {
  const matches = await fg(
    ".wrangler/state/v3/d1/**/*D1DatabaseObject/*.sqlite"
  );
  if (!matches.length) {
    console.error(
      "Nenhum D1 local encontrado. Rode `npm run db:migrate:local` antes."
    );
    process.exit(1);
  }
  matches.sort(
    (a, b) => (fs.statSync(b).mtimeMs || 0) - (fs.statSync(a).mtimeMs || 0)
  );
  return matches[0];
}

async function main() {
  const file = await findLocalD1();
  console.log("DB local:", file);
  const sqlite = new Database(file);
  const db = drizzle(sqlite);

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()));
  if (existing.length) {
    console.log("Professor já existe:", email);
  } else {
    await db.insert(users).values({
      id: crypto.randomUUID(),
      name: "Professor",
      email: email.toLowerCase(),
      passwordHash: await hashPassword(password),
      role: "TEACHER",
      status: "ACTIVE",
      createdAt: Date.now(),
    });
    console.log("Professor criado:", email);
  }

  const lessonCount = await db.select().from(lessons);
  if (lessonCount.length === 0) {
    const now = Date.now();
    const demo = [
      { n: 1, title: "Estudo #01 — Introdução ao grupo", date: "2026-09-08", thumb: "" },
      { n: 2, title: "Estudo #02 — O Bom Samaritano", date: "2026-09-15", thumb: "" },
      { n: 3, title: "Estudo #03 — Carta aos Romanos", date: "2026-09-22", thumb: "" },
    ];
    for (const d of demo) {
      const lessonId = crypto.randomUUID();
      await db.insert(lessons).values({
        id: lessonId,
        title: d.title,
        description: `Descrição do estudo #${d.n} da terça.`,
        date: d.date,
        videoUrl:
          d.n === 3 ? "https://www.youtube.com/watch?v=dQw4w9WgXcQ" : null,
        thumbnailUrl: d.thumb || null,
        isPublished: true,
        createdAt: now,
      });
      await db.insert(materials).values({
        id: crypto.randomUUID(),
        lessonId,
        title: "PDF de apoio",
        url: "https://example.com/apoio.pdf",
        type: "PDF",
      });
      await db.insert(questions).values([
        {
          id: crypto.randomUUID(),
          lessonId,
          questionText: "Qual o principal ensinamento deste estudo?",
          questionType: "TEXT",
          position: 0,
        },
        {
          id: crypto.randomUUID(),
          lessonId,
          questionText: "Como aplicar o conteúdo na prática?",
          questionType: "MULTIPLE_CHOICE",
          options: JSON.stringify([
            "Leitura diária",
            "Grupo pequeno",
            "Oração",
            "Todas acima",
          ]),
          correctOptionIndex: 3,
          position: 1,
        },
      ]);
    }
    console.log("3 aulas demo criadas.");
  }
  console.log("Seed concluído.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
