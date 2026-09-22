import { and, eq, sql } from "drizzle-orm";
import { users } from "@/db/schema";
import { studentStatusSchema } from "@/lib/validation/schemas";
import { getDb } from "@/db";
import { getCurrentSession } from "@/lib/actions/auth";
import { revalidatePath } from "next/cache";

export type Result = { ok: boolean; error?: string };

export async function updateStudentStatus(
  db: any,
  rawInput: unknown,
  actorId: string
): Promise<Result> {
  const parsed = studentStatusSchema.safeParse(rawInput);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };
  const { userId, action } = parsed.data;

  if (userId === actorId)
    return { ok: false, error: "Você não pode executar essa ação em si mesmo." };

  const rows = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!rows.length) return { ok: false, error: "Usuário não encontrado" };
  const target = rows[0];

  if (action === "APPROVE") {
    await db
      .update(users)
      .set({ status: "ACTIVE" })
      .where(eq(users.id, userId));
  } else if (action === "SUSPEND") {
    if (target.role === "TEACHER") {
      const others = await db
        .select({ c: sql<number>`count(*)` })
        .from(users)
        .where(
          and(
            eq(users.role, "TEACHER"),
            eq(users.status, "ACTIVE"),
            sql`${users.id} != ${userId}`
          )
        );
      if (Number(others[0].c) === 0) {
        return {
          ok: false,
          error: "Deve existir pelo menos um professor ativo.",
        };
      }
    }
    await db
      .update(users)
      .set({ status: "SUSPENDED" })
      .where(eq(users.id, userId));
  } else if (action === "REACTIVATE") {
    await db
      .update(users)
      .set({ status: "ACTIVE" })
      .where(eq(users.id, userId));
  } else if (action === "PROMOTE") {
    await db
      .update(users)
      .set({ role: "TEACHER", status: "ACTIVE" })
      .where(eq(users.id, userId));
  }
  return { ok: true };
}

export async function updateStudentAction(rawInput: unknown): Promise<Result> {
  const session = await getCurrentSession();
  if (
    !session ||
    session.role !== "TEACHER" ||
    session.status !== "ACTIVE"
  ) {
    return { ok: false, error: "Acesso restrito" };
  }
  const result = await updateStudentStatus(getDb(), rawInput, session.sub);
  if (result.ok) revalidatePath("/admin/students");
  return result;
}
