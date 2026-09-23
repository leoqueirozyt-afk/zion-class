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
  const rows = await db
    .select()
    .from(lessons)
    .where(eq(lessons.id, lessonId))
    .limit(1);
  return rows.length ? rows[0] : null;
}

export async function saveAttendanceKeyword(
  db: any,
  raw: unknown
): Promise<Result> {
  const parsed = attendanceKeywordSchema.safeParse(raw);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };
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
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };
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
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };
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
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };
  const { lessonId, keyword } = parsed.data;

  const studentRows = await db
    .select()
    .from(users)
    .where(eq(users.id, studentId))
    .limit(1);
  if (!studentRows.length)
    return { ok: false, error: "Usuário não encontrado" };
  if (studentRows[0].status !== "ACTIVE")
    return { ok: false, error: "Conta não ativa." };

  const lesson = await loadLesson(db, lessonId);
  if (!lesson) return { ok: false, error: "Aula não encontrada" };
  if (!lesson.isAttendanceOpen)
    return {
      ok: false,
      error: "Palavra-chave incorreta ou chamada encerrada.",
    };
  if (
    lesson.attendanceExpiresAt != null &&
    Date.now() > lesson.attendanceExpiresAt
  )
    return {
      ok: false,
      error: "Palavra-chave incorreta ou chamada encerrada.",
    };

  const existing = await db
    .select()
    .from(attendances)
    .where(
      and(
        eq(attendances.lessonId, lessonId),
        eq(attendances.studentId, studentId)
      )
    )
    .limit(1);
  if (existing.length && existing[0].status === "PRESENT")
    return { ok: false, error: "Você já confirmou presença." };

  if (
    !lesson.attendanceKeyword ||
    !keywordsMatch(lesson.attendanceKeyword, keyword)
  )
    return {
      ok: false,
      error: "Palavra-chave incorreta ou chamada encerrada.",
    };

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
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };
  const { lessonId, studentId } = parsed.data;
  const now = Date.now();
  const existing = await db
    .select()
    .from(attendances)
    .where(
      and(
        eq(attendances.lessonId, lessonId),
        eq(attendances.studentId, studentId)
      )
    )
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
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };
  const { studentId, reason } = parsed.data;
  if (studentId === actorId)
    return { ok: false, error: "Você não pode executar essa ação em si mesmo." };

  const rows = await db
    .select()
    .from(users)
    .where(eq(users.id, studentId))
    .limit(1);
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
      return {
        ok: false,
        error: "Deve existir pelo menos um professor ativo.",
      };
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

export async function saveAttendanceKeywordAction(
  raw: unknown
): Promise<Result> {
  if (!(await requireTeacher()))
    return { ok: false, error: "Acesso restrito" };
  const r = await saveAttendanceKeyword(getDb(), raw);
  if (r.ok) revalidatePath("/admin/lessons", "layout");
  return r;
}

export async function openAttendanceAction(raw: unknown): Promise<Result> {
  if (!(await requireTeacher()))
    return { ok: false, error: "Acesso restrito" };
  const r = await openAttendance(getDb(), raw);
  if (r.ok) revalidatePath("/admin/lessons", "layout");
  return r;
}

export async function closeAttendanceAction(raw: unknown): Promise<Result> {
  if (!(await requireTeacher()))
    return { ok: false, error: "Acesso restrito" };
  const r = await closeAttendance(getDb(), raw);
  if (r.ok) revalidatePath("/admin/lessons", "layout");
  return r;
}

export async function justifyAbsenceAction(raw: unknown): Promise<Result> {
  if (!(await requireTeacher()))
    return { ok: false, error: "Acesso restrito" };
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
  if (session.status !== "ACTIVE")
    return { ok: false, error: "Acesso restrito" };
  const r = await confirmAttendance(getDb(), session.sub, raw);
  if (r.ok) revalidatePath("/dashboard", "layout");
  return r;
}
