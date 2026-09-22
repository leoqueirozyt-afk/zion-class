import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";

const id = () => text("id").primaryKey();
const createdAtCol = () => integer("created_at").notNull();

export const users = sqliteTable("users", {
  id: id(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["STUDENT", "TEACHER"] }).notNull().default("STUDENT"),
  status: text("status", { enum: ["PENDING", "ACTIVE", "SUSPENDED"] })
    .notNull()
    .default("PENDING"),
  createdAt: createdAtCol(),
});

export const lessons = sqliteTable("lessons", {
  id: id(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  date: text("date").notNull(),
  videoUrl: text("video_url"),
  thumbnailUrl: text("thumbnail_url"),
  isPublished: integer("is_published", { mode: "boolean" }).notNull().default(false),
  createdAt: createdAtCol(),
});

export const materials = sqliteTable("materials", {
  id: id(),
  lessonId: text("lesson_id")
    .notNull()
    .references(() => lessons.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  url: text("url").notNull(),
  type: text("type", { enum: ["PDF", "LINK", "IMAGE", "DOCUMENT"] })
    .notNull()
    .default("LINK"),
});

export const questions = sqliteTable("questions", {
  id: id(),
  lessonId: text("lesson_id")
    .notNull()
    .references(() => lessons.id, { onDelete: "cascade" }),
  questionText: text("question_text").notNull(),
  questionType: text("question_type", { enum: ["TEXT", "MULTIPLE_CHOICE"] }).notNull(),
  options: text("options"),
  correctOptionIndex: integer("correct_option_index"),
  position: integer("position").notNull().default(0),
});

export const answers = sqliteTable(
  "answers",
  {
    id: id(),
    questionId: text("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    studentId: text("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    answerText: text("answer_text").notNull(),
    submittedAt: integer("submitted_at").notNull(),
  },
  (t) => [uniqueIndex("answers_question_student_uq").on(t.questionId, t.studentId)]
);

export type User = typeof users.$inferSelect;
export type Lesson = typeof lessons.$inferSelect;
export type Material = typeof materials.$inferSelect;
export type Question = typeof questions.$inferSelect;
export type Answer = typeof answers.$inferSelect;
