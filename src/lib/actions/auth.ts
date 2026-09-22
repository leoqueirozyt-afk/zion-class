"use server";

import { eq } from "drizzle-orm";
import { users } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSessionToken, parseSessionToken } from "@/lib/auth/session";
import { loadFreshSession } from "@/lib/auth/session-refresh";
import {
  setSessionCookie,
  clearSessionCookie,
  getSessionCookie,
} from "@/lib/auth/cookies";
import { registerSchema, loginSchema } from "@/lib/validation/schemas";
import { getDb } from "@/db";

export type ActionState = { ok: boolean; error?: string };

export async function registerUser(
  db: any,
  input: { name: string; email: string; password: string }
) {
  const email = input.email.trim().toLowerCase();
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing.length) throw new Error("E-mail já cadastrado");
  const row = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    email,
    passwordHash: await hashPassword(input.password),
    role: "STUDENT" as const,
    status: "PENDING" as const,
    createdAt: Date.now(),
  };
  await db.insert(users).values(row);
  return row;
}

export async function authenticate(
  db: any,
  input: { email: string; password: string }
) {
  const email = input.email.trim().toLowerCase();
  const found = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const user = found[0];
  if (!user) return null;
  return (await verifyPassword(input.password, user.passwordHash)) ? user : null;
}

export async function registerAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  try {
    const user = await registerUser(getDb(), parsed.data);
    const token = await createSessionToken({
      sub: user.id,
      role: user.role,
      name: user.name,
      status: user.status,
    });
    await setSessionCookie(token);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Não foi possível criar a conta",
    };
  }
}

export async function loginAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const user = await authenticate(getDb(), parsed.data);
  if (!user) return { ok: false, error: "E-mail ou senha incorretos" };
  const token = await createSessionToken({
    sub: user.id,
    role: user.role,
    name: user.name,
    status: user.status,
  });
  await setSessionCookie(token);
  return { ok: true };
}

export async function logoutAction() {
  await clearSessionCookie();
}

export async function getCurrentSession() {
  const token = await getSessionCookie();
  if (!token) return null;
  const fresh = await loadFreshSession(getDb(), token);
  if (!fresh) return null;
  const parsed = await parseSessionToken(token);
  if (
    parsed &&
    (parsed.status !== fresh.status ||
      parsed.role !== fresh.role ||
      parsed.name !== fresh.name)
  ) {
    const next = await createSessionToken(fresh);
    await setSessionCookie(next);
  }
  return fresh;
}
