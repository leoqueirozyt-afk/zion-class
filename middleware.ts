import { NextRequest, NextResponse } from "next/server";
import { parseSessionToken } from "@/lib/auth/session";
import { evaluateAccess } from "@/lib/auth/guards";
import { SESSION_COOKIE } from "@/lib/auth/session-cookie";

export async function middleware(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await parseSessionToken(token) : null;
  const decision = evaluateAccess(session, req.nextUrl.pathname);

  if (decision.type === "redirect") {
    const url = req.nextUrl.clone();
    url.pathname = decision.to;
    url.search = "";
    if (!token && decision.to === "/login") {
      url.search = `?next=${encodeURIComponent(req.nextUrl.pathname)}`;
    }
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
