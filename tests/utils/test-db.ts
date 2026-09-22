import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "@/db/schema";

export function createTestDb() {
  const sqlite = new Database(":memory:");
  sqlite.exec(`
    CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'STUDENT', status TEXT NOT NULL DEFAULT 'PENDING', created_at INTEGER NOT NULL);
    CREATE TABLE lessons (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', date TEXT NOT NULL, video_url TEXT, thumbnail_url TEXT, is_published INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);
    CREATE TABLE materials (id TEXT PRIMARY KEY, lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE, title TEXT NOT NULL, url TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'LINK');
    CREATE TABLE questions (id TEXT PRIMARY KEY, lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE, question_text TEXT NOT NULL, question_type TEXT NOT NULL, options TEXT, correct_option_index INTEGER, position INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE answers (id TEXT PRIMARY KEY, question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE, student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, answer_text TEXT NOT NULL, submitted_at INTEGER NOT NULL);
    CREATE UNIQUE INDEX answers_question_student_uq ON answers(question_id, student_id);
  `);
  return drizzle(sqlite, { schema });
}
