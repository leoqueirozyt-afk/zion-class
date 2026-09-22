import { eq } from "drizzle-orm";
import { users } from "@/db/schema";
import { parseSessionToken, SessionPayload } from "./session";

export type StatusSession = Pick<SessionPayload, "role" | "status">;

export async function loadFreshSession(
  db: any,
  token: string
): Promise<SessionPayload | null> {
  const parsed = await parseSessionToken(token);
  if (!parsed) return null;
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.id, parsed.sub))
    .limit(1);
  const user = rows[0];
  if (!user) return null;
  return {
    sub: user.id,
    role: user.role,
    name: user.name,
    status: user.status,
  };
}

export function statusRedirectPath(session: StatusSession): string | null {
  if (session.status === "PENDING") return "/dashboard/pending";
  if (session.status === "SUSPENDED") return "/dashboard/suspended";
  return null;
}

export function homeRedirectPath(session: StatusSession): string {
  const statusPath = statusRedirectPath(session);
  if (statusPath) return statusPath;
  return session.role === "TEACHER" ? "/admin" : "/dashboard";
}
