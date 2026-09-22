import { cookies } from "next/headers";

export const SESSION_COOKIE = "zion_session";

export async function setSessionCookie(token: string) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function getSessionCookie(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}
