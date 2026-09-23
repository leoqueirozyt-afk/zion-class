# Keyword Attendance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Teacher-defined keyword attendance per lesson: professor opens/closes chamada with expiry, student confirms presence, table with Present/Absent/Justified + manual suspend.

**Architecture:** Drizzle columns on `lessons` + new `attendances` table + `users.suspension_reason`; dedicated `attendance.ts` server actions with `db` first; teacher route `/admin/lessons/[id]/attendance`; student confirm block on lesson page; reuse existing `users.status` suspension and `/dashboard/suspended`.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind, shadcn/ui, lucide-react, sonner, Drizzle ORM + D1, zod, Vitest + better-sqlite3 (`createTestDb`).

**Spec:** `docs/superpowers/specs/2026-09-23-attendance-keyword-design.md`

**Conventions:** text UUID PKs; epoch-ms integers; bool 0/1 in SQLite; pt-BR; actions take `db` first (production wrappers call `getDb()`); TDD RED→GREEN; frequent commits.

---

## File Structure

```
Modify: src/db/schema.ts                         — lessons columns, attendances, users.suspension_reason
Modify: tests/utils/test-db.ts                   — DDL for new columns/table
Create: src/db/migrations/0001_*.sql (via db:generate)
Modify: src/lib/validation/schemas.ts            — keyword/duration/justify/suspend schemas
Create: src/lib/attendance/keyword.ts            — normalizeKeyword pure helper
Create: src/lib/actions/attendance.ts            — core + wrappers
Create: tests/actions/attendance.test.ts         — TDD suite
Modify: src/lib/queries/lesson.ts                — return myAttendance + open flag for student
Create: src/app/admin/lessons/[id]/attendance/page.tsx
Create: src/components/admin/attendance-panel.tsx
Modify: src/app/admin/lessons/page.tsx           — “Chamada” link
Create: src/components/dashboard/attendance-confirm.tsx
Modify: src/app/dashboard/lessons/[id]/page.tsx   — render confirm block / badge
```

---

### Task 1: Schema + test-db + migration

**Files:**
- Modify: `src/db/schema.ts`
- Modify: `tests/utils/test-db.ts`
- Create: `src/db/migrations/0001_*.sql` via `npm run db:generate`

- [ ] **Step 1: Update `src/db/schema.ts`**

Add `attendances` table and extend `lessons` / `users`:

```ts
export const attendances = sqliteTable(
  "attendances",
  {
    id: id(),
    lessonId: text("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    studentId: text("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["PRESENT", "ABSENT", "JUSTIFIED"] }).notNull(),
    confirmedAt: integer("confirmed_at"),
  },
  (t) => [uniqueIndex("attendances_lesson_student_uq").on(t.lessonId, t.studentId)]
);
```

On `lessons` after `isPublished`:

```ts
  attendanceKeyword: text("attendance_keyword"),
  isAttendanceOpen: integer("is_attendance_open", { mode: "boolean" }).notNull().default(false),
  attendanceExpiresAt: integer("attendance_expires_at"),
```

On `users` after `status`:

```ts
  suspensionReason: text("suspension_reason"),
```

Export type: `export type Attendance = typeof attendances.$inferSelect;`

- [ ] **Step 2: Update `tests/utils/test-db.ts` DDL**

In `users` CREATE: add `suspension_reason TEXT`.
In `lessons` CREATE: add `attendance_keyword TEXT, is_attendance_open INTEGER NOT NULL DEFAULT 0, attendance_expires_at INTEGER`.
After answers table, add:

```sql
CREATE TABLE attendances (id TEXT PRIMARY KEY, lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE, student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, status TEXT NOT NULL, confirmed_at INTEGER);
CREATE UNIQUE INDEX attendances_lesson_student_uq ON attendances(lesson_id, student_id);
```

- [ ] **Step 3: Generate + apply migration**

Run: `npm run db:generate`  
Expected: new `src/db/migrations/0001_*.sql`

Run: `npm run db:migrate:local`  
Expected: applying 0001 OK

Run: `npm run db:migrate:remote`  
Expected: applying 0001 OK (prod D1)

- [ ] **Step 4: Full suite still green**

Run: `npm test`  
Expected: PASS (schema change alone must not break tests)

- [ ] **Step 5: Commit**

```bash
git add src/db/schema.ts tests/utils/test-db.ts src/db/migrations
git commit -m "feat: attendance schema columns and attendances table"
```

---

### Task 2: Keyword helper + validation schemas (TDD)

**Files:**
- Create: `src/lib/attendance/keyword.ts`
- Modify: `src/lib/validation/schemas.ts`
- Test: `tests/lib/keyword.test.ts` (new) + extend `tests/validation/schemas.test.ts` if present

- [ ] **Step 1: Failing test `tests/lib/keyword.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { normalizeKeyword, keywordsMatch } from "@/lib/attendance/keyword";

describe("normalizeKeyword", () => {
  it("trims and lowercases", () => {
    expect(normalizeKeyword("  Graça ")).toBe("graça");
    expect(normalizeKeyword("GRAÇA")).toBe("graça");
    expect(normalizeKeyword("MONTE SIÃO")).toBe("monte sião");
  });
  it("collapses internal whitespace", () => {
    expect(normalizeKeyword("  ALIANÇA  ")).toBe("aliança");
    expect(normalizeKeyword("MONTE   SIÃO")).toBe("monte sião");
  });
});

describe("keywordsMatch", () => {
  it("matches case/trim variants", () => {
    expect(keywordsMatch("GRAÇA", " graça ")).toBe(true);
    expect(keywordsMatch("Graça", "GRAÇA")).toBe(true);
    expect(keywordsMatch("GRAÇA", "perdão")).toBe(false);
  });
});
```

- [ ] **Step 2: Run — FAIL**

Run: `npx vitest run tests/lib/keyword.test.ts`  
Expected: FAIL module not found

- [ ] **Step 3: Implement `src/lib/attendance/keyword.ts`**

```ts
export function normalizeKeyword(raw: string): string {
  return raw.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();
}

export function keywordsMatch(stored: string, submitted: string): boolean {
  if (!stored) return false;
  return normalizeKeyword(stored) === normalizeKeyword(submitted);
}
```

- [ ] **Step 4: PASS keyword tests**

Run: `npx vitest run tests/lib/keyword.test.ts`  
Expected: PASS

- [ ] **Step 5: Validation schemas — append to `src/lib/validation/schemas.ts`**

```ts
export const attendanceKeywordSchema = z.object({
  lessonId: z.string().min(1),
  keyword: z.string().trim().min(1, "Informe a palavra-chave"),
});

export const openAttendanceSchema = z.object({
  lessonId: z.string().min(1),
  keyword: z.string().trim().min(1, "Informe a palavra-chave"),
  durationMinutes: z.coerce.number().int().min(1).max(240),
});

export const closeAttendanceSchema = z.object({
  lessonId: z.string().min(1),
});

export const justifyAttendanceSchema = z.object({
  lessonId: z.string().min(1),
  studentId: z.string().min(1),
});

export const suspendFromLessonSchema = z.object({
  studentId: z.string().min(1),
  reason: z.string().trim().max(200).default("Faltas à chamada"),
});

export const confirmAttendanceSchema = z.object({
  lessonId: z.string().min(1),
  keyword: z.string().trim().min(1, "Digite a palavra-chave"),
});
```

- [ ] **Step 6: Full test + commit**

Run: `npm test && npm run lint`  
Expected: PASS

```bash
git add src/lib/attendance/keyword.ts tests/lib/keyword.test.ts src/lib/validation/schemas.ts
git commit -m "feat: keyword normalize helper and attendance validation schemas"
```

---

### Task 3: Core attendance actions (TDD)

**Files:**
- Create: `src/lib/actions/attendance.ts`
- Test: `tests/actions/attendance.test.ts`

- [ ] **Step 1: Failing tests `tests/actions/attendance.test.ts`**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb } from "../utils/test-db";
import {
  saveAttendanceKeyword,
  openAttendance,
  closeAttendance,
  confirmAttendance,
  justifyAbsence,
  suspendStudentFromLesson,
} from "@/lib/actions/attendance";
import { users, lessons, questions, answers, attendances } from "@/db/schema";

async function seed(db: any) {
  const now = Date.now();
  await db.insert(users).values([
    { id: "t1", name: "Prof", email: "p@x.com", passwordHash: "x", role: "TEACHER", status: "ACTIVE", createdAt: now },
    { id: "s1", name: "Maria", email: "m@x.com", passwordHash: "x", role: "STUDENT", status: "ACTIVE", createdAt: now },
    { id: "s2", name: "João", email: "j@x.com", passwordHash: "x", role: "STUDENT", status: "ACTIVE", createdAt: now },
    { id: "s3", name: "Zé", email: "z@x.com", passwordHash: "x", role: "STUDENT", status: "SUSPENDED", createdAt: now, suspensionReason: "faltas" },
  ]);
  await db.insert(lessons).values({
    id: "l1", title: "Aula", description: "", date: "2026-09-22",
    isPublished: true, createdAt: now,
  });
}

let db: any;
beforeEach(async () => {
  db = createTestDb();
  await seed(db);
});

describe("saveAttendanceKeyword", () => {
  it("saves keyword", async () => {
    const r = await saveAttendanceKeyword(db, { lessonId: "l1", keyword: " Graça " });
    expect(r.ok).toBe(true);
    const rows = await db.select().from(lessons);
    expect(rows[0].attendanceKeyword).toBe("Graça");
  });
});

describe("openAttendance", () => {
  it("requires keyword and sets expiry", async () => {
    const bad = await openAttendance(db, { lessonId: "l1", keyword: "", durationMinutes: 30 });
    expect(bad.ok).toBe(false);
    const ok = await openAttendance(db, { lessonId: "l1", keyword: "GRAÇA", durationMinutes: 30 });
    expect(ok.ok).toBe(true);
    const rows = await db.select().from(lessons);
    expect(rows[0].isAttendanceOpen).toBe(true);
    expect(rows[0].attendanceExpiresAt).toBeGreaterThan(Date.now());
    expect(rows[0].attendanceKeyword).toBe("GRAÇA");
  });
});

describe("confirmAttendance", () => {
  it("rejects when closed", async () => {
    const r = await confirmAttendance(db, "s1", { lessonId: "l1", keyword: "GRAÇA" });
    expect(r.ok).toBe(false);
  });
  it("accepts normalized keyword when open", async () => {
    await openAttendance(db, { lessonId: "l1", keyword: "Graça", durationMinutes: 30 });
    const r = await confirmAttendance(db, "s1", { lessonId: "l1", keyword: "  GRAÇA " });
    expect(r.ok).toBe(true);
    const rows = await db.select().from(attendances);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("PRESENT");
    expect(rows[0].confirmedAt).toBeTypeOf("number");
  });
  it("rejects wrong keyword", async () => {
    await openAttendance(db, { lessonId: "l1", keyword: "GRAÇA", durationMinutes: 30 });
    const r = await confirmAttendance(db, "s1", { lessonId: "l1", keyword: "perdao" });
    expect(r.ok).toBe(false);
  });
  it("rejects duplicate PRESENT", async () => {
    await openAttendance(db, { lessonId: "l1", keyword: "GRAÇA", durationMinutes: 30 });
    await confirmAttendance(db, "s1", { lessonId: "l1", keyword: "GRAÇA" });
    const r = await confirmAttendance(db, "s1", { lessonId: "l1", keyword: "GRAÇA" });
    expect(r.ok).toBe(false);
  });
  it("rejects suspended student", async () => {
    await openAttendance(db, { lessonId: "l1", keyword: "GRAÇA", durationMinutes: 30 });
    const r = await confirmAttendance(db, "s3", { lessonId: "l1", keyword: "GRAÇA" });
    expect(r.ok).toBe(false);
  });
  it("rejects when expired", async () => {
    await openAttendance(db, { lessonId: "l1", keyword: "GRAÇA", durationMinutes: 30 });
    await db.update(lessons).set({ attendanceExpiresAt: Date.now() - 1 }).where();
    const r = await confirmAttendance(db, "s1", { lessonId: "l1", keyword: "GRAÇA" });
    expect(r.ok).toBe(false);
  });
});

describe("closeAttendance", () => {
  it("closes and marks ABSENT for ACTIVE without row", async () => {
    await openAttendance(db, { lessonId: "l1", keyword: "GRAÇA", durationMinutes: 30 });
    await confirmAttendance(db, "s1", { lessonId: "l1", keyword: "GRAÇA" });
    const r = await closeAttendance(db, { lessonId: "l1" });
    expect(r.ok).toBe(true);
    const rows = await db.select().from(attendances);
    const byStudent = Object.fromEntries(rows.map((a: any) => [a.studentId, a.status]));
    expect(byStudent.s1).toBe("PRESENT");
    expect(byStudent.s2).toBe("ABSENT");
    expect(byStudent.s3).toBeUndefined();
    const lessonsRow = await db.select().from(lessons);
    expect(lessonsRow[0].isAttendanceOpen).toBe(false);
  });
});

describe("justifyAbsence", () => {
  it("sets JUSTIFIED", async () => {
    await openAttendance(db, { lessonId: "l1", keyword: "GRAÇA", durationMinutes: 30 });
    await closeAttendance(db, { lessonId: "l1" });
    const r = await justifyAbsence(db, { lessonId: "l1", studentId: "s2" });
    expect(r.ok).toBe(true);
    const rows = await db.select().from(attendances).where();
    const j = rows.find((a: any) => a.studentId === "s2");
    expect(j.status).toBe("JUSTIFIED");
  });
});

describe("suspendStudentFromLesson", () => {
  it("suspends student with reason", async () => {
    const r = await suspendStudentFromLesson(db, "t1", { studentId: "s1", reason: "Faltas" });
    expect(r.ok).toBe(true);
    const u = await db.select().from(users).where();
    const s1 = u.find((x: any) => x.id === "s1");
    expect(s1.status).toBe("SUSPENDED");
    expect(s1.suspensionReason).toBe("Faltas");
  });
  it("blocks suspending last active teacher", async () => {
    const r = await suspendStudentFromLesson(db, "t1", { studentId: "t1", reason: "x" });
    expect(r.ok).toBe(false);
  });
});
```

Note: if drizzle `.where()` without condition errors in this version, use `.where(eq(lessons.id, "l1"))` etc. with imported `eq`.

- [ ] **Step 2: Run — FAIL**

Run: `npx vitest run tests/actions/attendance.test.ts`  
Expected: FAIL module not found / function not defined

- [ ] **Step 3: Implement `src/lib/actions/attendance.ts`**

```ts
"use server";

import { and, eq, sql } from "drizzle-orm";
import { attendances, lessons, users } from "@/db/schema";
import {
  attendanceKeywordSchema,
  openAttendanceSchema,
  closeAttendanceSchema,
  justifyAttendanceSchema,
  suspendFromLessonSchema,
  confirmAttendanceSchema,
} from "@/lib/validation/schemas";
import { keywordsMatch } from "@/lib/attendance/keyword";
import { getDb } from "@/db";
import { getCurrentSession } from "@/lib/actions/auth";
import { revalidatePath } from "next/cache";

export type Result = { ok: boolean; error?: string };

async function loadLesson(db: any, lessonId: string) {
  const rows = await db.select().from(lessons).where(eq(lessons.id, lessonId)).limit(1);
  return rows.length ? rows[0] : null;
}

export async function saveAttendanceKeyword(db: any, raw: unknown): Promise<Result> {
  const parsed = attendanceKeywordSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const lesson = await loadLesson(db, parsed.data.lessonId);
  if (!lesson) return { ok: false, error: "Aula não encontrada" };
  await db
    .update(lessons)
    .set({ attendanceKeyword: parsed.data.keyword.trim() })
    .where(eq(lessons.id, parsed.data.lessonId));
  return { ok: true };
}

export async function openAttendance(db: any, raw: unknown): Promise<Result> {
  const parsed = openAttendanceSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const lesson = await loadLesson(db, parsed.data.lessonId);
  if (!lesson) return { ok: false, error: "Aula não encontrada" };
  const keyword = parsed.data.keyword.trim();
  if (!keyword) return { ok: false, error: "Informe a palavra-chave" };
  const expiresAt = Date.now() + parsed.data.durationMinutes * 60_000;
  await db
    .update(lessons)
    .set({
      attendanceKeyword: keyword,
      isAttendanceOpen: true,
      attendanceExpiresAt: expiresAt,
    })
    .where(eq(lessons.id, parsed.data.lessonId));
  return { ok: true };
}

export async function closeAttendance(db: any, raw: unknown): Promise<Result> {
  const parsed = closeAttendanceSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const lesson = await loadLesson(db, parsed.data.lessonId);
  if (!lesson) return { ok: false, error: "Aula não encontrada" };

  await db
    .update(lessons)
    .set({ isAttendanceOpen: false })
    .where(eq(lessons.id, parsed.data.lessonId));

  const actives = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.status, "ACTIVE"));
  const existing = await db
    .select()
    .from(attendances)
    .where(eq(attendances.lessonId, parsed.data.lessonId));
  const have = new Set(existing.map((a: any) => a.studentId));
  const toInsert = actives
    .filter((u: any) => !have.has(u.id))
    .map((u: any) => ({
      id: crypto.randomUUID(),
      lessonId: parsed.data.lessonId,
      studentId: u.id,
      status: "ABSENT" as const,
      confirmedAt: null,
    }));
  if (toInsert.length) await db.insert(attendances).values(toInsert);
  return { ok: true };
}

export async function confirmAttendance(
  db: any,
  studentId: string,
  raw: unknown
): Promise<Result> {
  const parsed = confirmAttendanceSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { lessonId, keyword } = parsed.data;

  const studentRows = await db
    .select()
    .from(users)
    .where(eq(users.id, studentId))
    .limit(1);
  if (!studentRows.length) return { ok: false, error: "Usuário não encontrado" };
  if (studentRows[0].status !== "ACTIVE")
    return { ok: false, error: "Conta não ativa." };

  const lesson = await loadLesson(db, lessonId);
  if (!lesson) return { ok: false, error: "Aula não encontrada" };
  if (!lesson.isAttendanceOpen)
    return { ok: false, error: "Palavra-chave incorreta ou chamada encerrada." };
  if (lesson.attendanceExpiresAt != null && Date.now() > lesson.attendanceExpiresAt)
    return { ok: false, error: "Palavra-chave incorreta ou chamada encerrada." };

  const existing = await db
    .select()
    .from(attendances)
    .where(and(eq(attendances.lessonId, lessonId), eq(attendances.studentId, studentId)))
    .limit(1);
  if (existing.length && existing[0].status === "PRESENT")
    return { ok: false, error: "Você já confirmou presença." };

  if (!lesson.attendanceKeyword || !keywordsMatch(lesson.attendanceKeyword, keyword))
    return { ok: false, error: "Palavra-chave incorreta ou chamada encerrada." };

  const now = Date.now();
  if (existing.length) {
    await db
      .update(attendances)
      .set({ status: "PRESENT", confirmedAt: now })
      .where(eq(attendances.id, existing[0].id));
  } else {
    await db.insert(attendances).values({
      id: crypto.randomUUID(),
      lessonId,
      studentId,
      status: "PRESENT",
      confirmedAt: now,
    });
  }
  return { ok: true };
}

export async function justifyAbsence(db: any, raw: unknown): Promise<Result> {
  const parsed = justifyAttendanceSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { lessonId, studentId } = parsed.data;
  const now = Date.now();
  const existing = await db
    .select()
    .from(attendances)
    .where(and(eq(attendances.lessonId, lessonId), eq(attendances.studentId, studentId)))
    .limit(1);
  if (existing.length) {
    await db
      .update(attendances)
      .set({ status: "JUSTIFIED", confirmedAt: existing[0].confirmedAt ?? now })
      .where(eq(attendances.id, existing[0].id));
  } else {
    await db.insert(attendances).values({
      id: crypto.randomUUID(),
      lessonId,
      studentId,
      status: "JUSTIFIED",
      confirmedAt: now,
    });
  }
  return { ok: true };
}

export async function suspendStudentFromLesson(
  db: any,
  actorId: string,
  raw: unknown
): Promise<Result> {
  const parsed = suspendFromLessonSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { studentId, reason } = parsed.data;
  if (studentId === actorId)
    return { ok: false, error: "Você não pode executar essa ação em si mesmo." };

  const rows = await db.select().from(users).where(eq(users.id, studentId)).limit(1);
  if (!rows.length) return { ok: false, error: "Usuário não encontrado" };
  const target = rows[0];

  if (target.role === "TEACHER") {
    const others = await db
      .select({ c: sql<number>`count(*)` })
      .from(users)
      .where(
        and(
          eq(users.role, "TEACHER"),
          eq(users.status, "ACTIVE"),
          sql`${users.id} != ${studentId}`
        )
      );
    if (Number(others[0].c) === 0)
      return { ok: false, error: "Deve existir pelo menos um professor ativo." };
  }

  await db
    .update(users)
    .set({ status: "SUSPENDED", suspensionReason: reason })
    .where(eq(users.id, studentId));
  return { ok: true };
}

async function requireTeacher() {
  const session = await getCurrentSession();
  if (!session || session.role !== "TEACHER" || session.status !== "ACTIVE")
    return null;
  return session;
}

export async function saveAttendanceKeywordAction(raw: unknown): Promise<Result> {
  if (!(await requireTeacher())) return { ok: false, error: "Acesso restrito" };
  const r = await saveAttendanceKeyword(getDb(), raw);
  if (r.ok) revalidatePath("/admin/lessons", "layout");
  return r;
}

export async function openAttendanceAction(raw: unknown): Promise<Result> {
  if (!(await requireTeacher())) return { ok: false, error: "Acesso restrito" };
  const r = await openAttendance(getDb(), raw);
  if (r.ok) revalidatePath("/admin/lessons", "layout");
  return r;
}

export async function closeAttendanceAction(raw: unknown): Promise<Result> {
  if (!(await requireTeacher())) return { ok: false, error: "Acesso restrito" };
  const r = await closeAttendance(getDb(), raw);
  if (r.ok) revalidatePath("/admin/lessons", "layout");
  return r;
}

export async function justifyAbsenceAction(raw: unknown): Promise<Result> {
  if (!(await requireTeacher())) return { ok: false, error: "Acesso restrito" };
  const r = await justifyAbsence(getDb(), raw);
  if (r.ok) revalidatePath("/admin/lessons", "layout");
  return r;
}

export async function suspendStudentAction(raw: unknown): Promise<Result> {
  const session = await requireTeacher();
  if (!session) return { ok: false, error: "Acesso restrito" };
  const r = await suspendStudentFromLesson(getDb(), session.sub, raw);
  if (r.ok) revalidatePath("/admin/lessons", "layout");
  return r;
}

export async function confirmAttendanceAction(raw: unknown): Promise<Result> {
  const session = await getCurrentSession();
  if (!session) return { ok: false, error: "Sessão expirada" };
  if (session.status !== "ACTIVE") return { ok: false, error: "Acesso restrito" };
  const r = await confirmAttendance(getDb(), session.sub, raw);
  if (r.ok) revalidatePath("/dashboard", "layout");
  return r;
}
```

- [ ] **Step 4: Run — PASS**

Run: `npx vitest run tests/actions/attendance.test.ts`  
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/attendance.ts tests/actions/attendance.test.ts
git commit -m "feat: attendance actions open close confirm justify suspend"
```

---

### Task 4: Teacher UI — attendance route + panel + list link

**Files:**
- Create: `src/app/admin/lessons/[id]/attendance/page.tsx`
- Create: `src/components/admin/attendance-panel.tsx`
- Modify: `src/app/admin/lessons/page.tsx` (add Chamada link)

- [ ] **Step 1: Query helper for panel data** — extend `src/lib/queries/admin.ts` with:

```ts
export type AttendanceRow = {
  id: string;
  name: string;
  email: string;
  status: "PRESENT" | "ABSENT" | "JUSTIFIED" | null;
  confirmedAt: number | null;
  userStatus: "PENDING" | "ACTIVE" | "SUSPENDED";
};

export type AttendanceView = {
  lesson: {
    id: string;
    title: string;
    date: string;
    attendanceKeyword: string | null;
    isAttendanceOpen: boolean;
    attendanceExpiresAt: number | null;
  };
  rows: AttendanceRow[];
  totalActive: number;
  presentCount: number;
};

export async function getAttendanceView(db: any, lessonId: string): Promise<AttendanceView | null> {
  const lessonRows = await db.select().from(lessons).where(eq(lessons.id, lessonId)).limit(1);
  if (!lessonRows.length) return null;
  const lesson = lessonRows[0];
  const students = await db
    .select()
    .from(users)
    .where(eq(users.role, "STUDENT"))
    .orderBy(asc(users.name));
  const att = await db.select().from(attendances).where(eq(attendances.lessonId, lessonId));
  const by = new Map(att.map((a: any) => [a.studentId, a]));
  const rows = students.map((s: any) => {
    const a = by.get(s.id);
    return {
      id: s.id,
      name: s.name,
      email: s.email,
      status: a?.status ?? null,
      confirmedAt: a?.confirmedAt ?? null,
      userStatus: s.status,
    };
  });
  return {
    lesson: {
      id: lesson.id,
      title: lesson.title,
      date: lesson.date,
      attendanceKeyword: lesson.attendanceKeyword,
      isAttendanceOpen: lesson.isAttendanceOpen,
      attendanceExpiresAt: lesson.attendanceExpiresAt,
    },
    rows,
    totalActive: students.filter((s: any) => s.status === "ACTIVE").length,
    presentCount: rows.filter((r) => r.status === "PRESENT").length,
  };
}
```

Import `attendances` and `asc` as needed in `admin.ts`.

- [ ] **Step 2: Page `src/app/admin/lessons/[id]/attendance/page.tsx`**

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { getAttendanceView } from "@/lib/queries/admin";
import { AttendancePanel } from "@/components/admin/attendance-panel";

export default async function AttendancePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const view = await getAttendanceView(getDb(), id);
  if (!view) notFound();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Chamada</h1>
          <p className="text-sm text-stone-500">{view.lesson.title}</p>
        </div>
        <Link href={`/admin/lessons/${id}/edit`} className="text-sm underline">
          Editar aula
        </Link>
      </div>
      <AttendancePanel view={view} />
    </div>
  );
}
```

- [ ] **Step 3: Client `src/components/admin/attendance-panel.tsx`**

"use client" component: local state for keyword + durationMinutes; buttons call `saveAttendanceKeywordAction` / `openAttendanceAction` / `closeAttendanceAction` / `justifyAbsenceAction` / `suspendStudentAction` with sonner toasts + `router.refresh()`; show badge open/closed + expiry `formatDateTime`; counter `{presentCount} de {totalActive}`; table status badges (Presente emerald / Ausente red / Justificada amber / Suspenso if userStatus SUSPENDED). Pattern-match `students-table.tsx` (`useTransition`, toast, refresh).

- [ ] **Step 4: Link on lessons list**

In `src/app/admin/lessons/page.tsx` after Respostas button, import `ClipboardList` (or `CalendarCheck`) from lucide-react and add:

```tsx
<Button asChild size="sm" variant="ghost">
  <Link
    href={`/admin/lessons/${l.id}/attendance`}
    aria-label="Chamada"
    title="Abrir chamada da aula"
  >
    <ClipboardList className="h-4 w-4" />
    <span className="ml-1 hidden sm:inline">Chamada</span>
  </Link>
</Button>
```

- [ ] **Step 5: Typecheck + tests**

Run: `npm run typecheck && npm test && npm run lint`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/lessons src/components/admin/attendance-panel.tsx src/lib/queries/admin.ts
git commit -m "feat: teacher attendance panel route"
```

---

### Task 5: Student UI — confirm block on lesson page

**Files:**
- Modify: `src/lib/queries/lesson.ts`
- Create: `src/components/dashboard/attendance-confirm.tsx`
- Modify: `src/app/dashboard/lessons/[id]/page.tsx`

- [ ] **Step 1: Extend `getLessonForStudent`**

After loading lesson, also select attendance for `(lessonId, studentId)` and return:

```ts
  const att = await db
    .select()
    .from(attendances)
    .where(and(eq(attendances.lessonId, lessonId), eq(attendances.studentId, studentId)))
    .limit(1);
  // ...
  return {
    lesson: l[0],
    materials: mats,
    questions: ...,
    myAttendance: att[0] ?? null,
  };
```

Import `attendances`, `and` from drizzle/schema.

- [ ] **Step 2: Client `src/components/dashboard/attendance-confirm.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { confirmAttendanceAction } from "@/lib/actions/attendance";
import { formatDateTime } from "@/lib/utils/format";

export function AttendanceConfirm({
  lessonId,
  open,
}: {
  lessonId: string;
  open: boolean;
}) {
  const [keyword, setKeyword] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  if (!open) return null;
  return (
    <section className="rounded-xl border border-emerald-500/40 bg-emerald-950/40 p-4 space-y-3">
      <h2 className="font-semibold text-emerald-100">Confirmar Presença na Aula</h2>
      <p className="text-sm text-emerald-200/80">
        Digite a palavra-chave informada pelo professor:
      </p>
      <div className="flex flex-wrap gap-2">
        <Input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="Ex: ALIANÇA"
          className="max-w-xs bg-zinc-900 border-zinc-700 text-zinc-50"
          aria-label="Palavra-chave da presença"
        />
        <Button
          disabled={pending || !keyword.trim()}
          onClick={() =>
            start(async () => {
              const res = await confirmAttendanceAction({ lessonId, keyword });
              if (res.ok) {
                toast.success("Presença confirmada!");
                setKeyword("");
                router.refresh();
              } else {
                toast.error(res.error ?? "Palavra-chave incorreta ou chamada encerrada.");
              }
            })
          }
          className="bg-emerald-700 hover:bg-emerald-800"
        >
          {pending ? "Confirmando…" : "Confirmar Presença"}
        </Button>
      </div>
    </section>
  );
}

export function AttendanceBadge({ confirmedAt }: { confirmedAt: number }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-emerald-900/80 px-3 py-1 text-xs text-emerald-200">
      ✓ Presença Confirmada em {formatDateTime(confirmedAt)}
    </span>
  );
}
```

- [ ] **Step 3: Render on lesson page**

In `src/app/dashboard/lessons/[id]/page.tsx` after header (or before description), destructure `myAttendance`:

```tsx
{myAttendance?.status === "PRESENT" && myAttendance.confirmedAt != null ? (
  <AttendanceBadge confirmedAt={myAttendance.confirmedAt} />
) : (
  <AttendanceConfirm lessonId={lesson.id} open={lesson.isAttendanceOpen} />
)}
```

Import the new components.

- [ ] **Step 4: Typecheck + tests**

Run: `npm run typecheck && npm test && npm run lint`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/queries/lesson.ts src/components/dashboard/attendance-confirm.tsx src/app/dashboard/lessons/[id]/page.tsx
git commit -m "feat: student attendance confirm block and badge"
```

---

### Task 6: Full verification + deploy + smoke

**Files:** ops only

- [ ] **Step 1: Full suite**

Run: `npm test && npm run lint && npm run typecheck`  
Expected: all green

- [ ] **Step 2: Deploy**

Run: `npm run deploy`  
Expected: version on `zion-class.leoqueirozyt.workers.dev`

- [ ] **Step 3: Smoke (teacher + student JWTs from tokens.json)**

| Check | Expect |
|--------|--------|
| `GET /admin/lessons` | 200; contains “Chamada” |
| `GET /admin/lessons/{id}/attendance` | 200 |
| Open chamada via action or UI; student `GET /dashboard/lessons/{id}` | 200; confirm block when open |
| Wrong keyword | toast error message |
| Correct keyword | badge “Presença Confirmada” |
| Suspended student any `/dashboard/*` | redirect `/dashboard/suspended` |

- [ ] **Step 4: Optional push**

```bash
git push origin master
```

---

## Self-review notes

- Spec coverage: schema ✓, normalize ✓, open/close/expiry ✓, confirm rules ✓, ABSENT on close ✓, justify ✓, suspend manual + reason ✓, teacher route ✓, student block ✓, suspended reuse ✓, tests ✓, deploy ✓.
- No TBDs; types `AttendanceView` / `AttendanceRow` consistent Task 4–5; action names match wrappers used in UI.
- Migration path: `db:generate` + local + remote before relying on new columns in deploy.
