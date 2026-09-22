import { SignJWT, jwtVerify } from "jose";

export type SessionPayload = {
  sub: string;
  role: "STUDENT" | "TEACHER";
  name: string;
  status: "PENDING" | "ACTIVE" | "SUSPENDED";
};

function getSecret(): Uint8Array | null {
  const s = process.env.SESSION_SECRET;
  return s ? new TextEncoder().encode(s) : null;
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  const secret = getSecret();
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function parseSessionToken(
  token: string
): Promise<SessionPayload | null> {
  const secret = getSecret();
  if (!secret) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    const { sub, role, name, status } = payload as Record<string, unknown>;
    if (typeof sub !== "string" || typeof name !== "string") return null;
    if (role !== "STUDENT" && role !== "TEACHER") return null;
    if (status !== "PENDING" && status !== "ACTIVE" && status !== "SUSPENDED")
      return null;
    return { sub, role, name, status };
  } catch {
    return null;
  }
}
