import { SessionPayload } from "./session";

export type AccessDecision = { type: "allow" } | { type: "redirect"; to: string };

export function evaluateAccess(
  session: SessionPayload | null,
  pathname: string
): AccessDecision {
  const isAuthPage = pathname === "/login" || pathname === "/register";

  if (!session) {
    if (isAuthPage || pathname === "/" || pathname.startsWith("/files/"))
      return { type: "allow" };
    return { type: "redirect", to: "/login" };
  }

  if (isAuthPage || pathname === "/") {
    return { type: "redirect", to: session.role === "TEACHER" ? "/admin" : "/dashboard" };
  }

  // status (PENDING/SUSPENDED) is enforced in RSC with a fresh DB session —
  // JWT status can be stale after approval/suspension and middleware cannot
  // safely rewrite cookies during render.
  if (pathname.startsWith("/admin") && session.role !== "TEACHER") {
    return { type: "redirect", to: "/dashboard" };
  }
  return { type: "allow" };
}
