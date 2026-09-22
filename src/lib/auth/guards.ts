import { SessionPayload } from "./session";

export type AccessDecision = { type: "allow" } | { type: "redirect"; to: string };

export function evaluateAccess(
  session: SessionPayload | null,
  pathname: string
): AccessDecision {
  const isAuthPage = pathname === "/login" || pathname === "/register";

  if (!session) {
    if (isAuthPage || pathname === "/") return { type: "allow" };
    return { type: "redirect", to: "/login" };
  }

  if (isAuthPage || pathname === "/") {
    return { type: "redirect", to: session.role === "TEACHER" ? "/admin" : "/dashboard" };
  }

  if (session.status === "PENDING") {
    if (pathname.startsWith("/dashboard/pending")) return { type: "allow" };
    return { type: "redirect", to: "/dashboard/pending" };
  }
  if (session.status === "SUSPENDED") {
    if (pathname.startsWith("/dashboard/suspended")) return { type: "allow" };
    return { type: "redirect", to: "/dashboard/suspended" };
  }

  if (pathname.startsWith("/admin") && session.role !== "TEACHER") {
    return { type: "redirect", to: "/dashboard" };
  }
  return { type: "allow" };
}
