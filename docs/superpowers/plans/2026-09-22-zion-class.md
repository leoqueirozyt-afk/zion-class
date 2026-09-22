# Zion Class Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full Zion Class members platform (auth + Netflix-style student area + teacher admin) deployable to Cloudflare Pages with D1.

**Architecture:** Next.js 15 App Router on OpenNext/Cloudflare; Drizzle ORM over D1; JWT sessions in HTTP-only cookies (`jose`, claim `status` included for edge checks); Server Actions for mutations; `middleware.ts` + per-action guards for STUDENT/TEACHER/PENDING/ACTIVE/SUSPENDED.

**Tech Stack:** Next.js 15, TypeScript, Tailwind, shadcn/ui, lucide-react, sonner, react-markdown, zod, Drizzle ORM, Cloudflare D1 + wrangler, @opennextjs/cloudflare, jose, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-22-zion-class-design.md`

**Conventions:** text UUID PKs; epoch-ms integers; bool = 0/1; email lowercase; pt-BR hardcoded; accent `#047857`; actions under test take `db` as first arg (production wrappers call `getDb()`).

---

## File Structure

```
wrangler.jsonc / open-next.config.ts / drizzle.config.ts / vitest.config.ts
src/db/schema.ts, index.ts, migrations/, seed.ts
src/lib/auth/{password,session,cookies,guards}.ts
src/lib/validation/schemas.ts
src/lib/actions/{auth,answers,lessons,students}.ts
src/lib/queries/{showcase,lesson,admin}.ts
src/lib/utils/{format,csv}.ts
middleware.ts
src/app/layout.tsx, page.tsx
src/app/(auth)/{login,register}/page.tsx
src/app/dashboard/{layout,page,pending/page,suspended/page}.tsx
src/app/dashboard/lessons/[id]/page.tsx
src/app/admin/{layout,page}.tsx
src/app/admin/lessons/{page,new/page,[id]/edit/page}.tsx
src/app/admin/lessons/[id]/responses/{page.tsx,export/route.ts}
src/app/admin/students/page.tsx
src/components/auth/auth-form.tsx
src/components/dashboard/{showcase,lesson-card,question-form,video-embed,materials-list}.tsx
src/components/admin/{lesson-form,responses-table,students-table}.tsx
tests/lib/*, tests/validation/*, tests/actions/*, tests/components/*, tests/utils/test-db.ts
```

---

### Task 1: Scaffold

**Files:** scaffold via CLI; `vitest.config.ts`; `tests/setup-jsdom.ts`; `tests/lib/smoke.test.ts`; `package.json`

- [ ] **Step 1:** `npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --turbopack --yes`
- [ ] **Step 2:** `npm i drizzle-orm jose zod react-markdown sonner lucide-react @opennextjs/cloudflare wrangler drizzle-kit` and `npm i -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @types/node tsx better-sqlite3 @types/better-sqlite3`
- [ ] **Step 3:** `npx shadcn@latest init -y -b neutral` then `npx shadcn@latest add button input label card badge dialog sheet switch textarea table tabs select skeleton radio-group separator dropdown-menu avatar`
- [ ] **Step 4:** Replace `package.json` scripts with:

```json
{
  "dev": "opennextjs-cloudflare dev",
  "build": "opennextjs-cloudflare build",
  "preview": "opennextjs-cloudflare build && opennextjs-cloudflare preview",
  "deploy": "opennextjs-cloudflare build && opennextjs-cloudflare deploy",
  "lint": "next lint",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "test:watch": "vitest",
  "db:generate": "drizzle-kit generate",
  "db:migrate:local": "wrangler d1 migrations apply zion_class --local",
  "db:migrate:remote": "wrangler d1 migrations apply zion_class --remote",
  "db:seed": "tsx src/db/seed.ts"
}
```

- [ ] **Step 5:** Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    globals: true,
    projects: [
      {
        test: {
          name: "node",
          environment: "node",
          include: ["tests/lib/**/*.test.ts", "tests/validation/**/*.test.ts", "tests/actions/**/*.test.ts", "tests/utils/**/*.test.ts"],
        },
      },
      {
        plugins: [react()],
        test: {
          name: "jsdom",
          environment: "jsdom",
          include: ["tests/components/**/*.test.tsx"],
          setupFiles: ["tests/setup-jsdom.ts"],
        },
      },
    ],
  },
});
```

- [ ] **Step 6:** `tests/setup-jsdom.ts` = `import "@testing-library/jest-dom/vitest";`
  `tests/lib/smoke.test.ts`:

```ts
import { describe, it, expect } from "vitest";
describe("smoke", () => { it("runs", () => { expect(1 + 1).toBe(2); }); });
```

- [ ] **Step 7:** `npm test && npm run lint && npm run typecheck` — all pass.
- [ ] **Step 8:** `git add -A && git commit -m "chore: scaffold Next.js, Tailwind, shadcn, Vitest"`

---

### Task 2: Schema + D1 + Drizzle

**Files:** `src/db/schema.ts`, `src/db/index.ts`, `drizzle.config.ts`, `wrangler.jsonc`, `open-next.config.ts`, `.dev.vars.example`

- [ ] **Step 1:** `src/db/schema.ts`:

```ts
import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";

const id = () => text("id").primaryKey();
const createdAtCol = () => integer("created_at").notNull();

export const users = sqliteTable("users", {
  id: id(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["STUDENT", "TEACHER"] }).notNull().default("STUDENT"),
  status: text("status", { enum: ["PENDING", "ACTIVE", "SUSPENDED"] }).notNull().default("PENDING"),
  createdAt: createdAtCol(),
});

export const lessons = sqliteTable("lessons", {
  id: id(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  date: text("date").notNull(),
  videoUrl: text("video_url"),
  thumbnailUrl: text("thumbnail_url"),
  isPublished: integer("is_published", { mode: "boolean" }).notNull().default(false),
  createdAt: createdAtCol(),
});

export const materials = sqliteTable("materials", {
  id: id(),
  lessonId: text("lesson_id").notNull().references(() => lessons.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  url: text("url").notNull(),
  type: text("type", { enum: ["PDF", "LINK", "IMAGE", "DOCUMENT"] }).notNull().default("LINK"),
});

export const questions = sqliteTable("questions", {
  id: id(),
  lessonId: text("lesson_id").notNull().references(() => lessons.id, { onDelete: "cascade" }),
  questionText: text("question_text").notNull(),
  questionType: text("question_type", { enum: ["TEXT", "MULTIPLE_CHOICE"] }).notNull(),
  options: text("options"),
  correctOptionIndex: integer("correct_option_index"),
  position: integer("position").notNull().default(0),
});

export const answers = sqliteTable("answers", {
  id: id(),
  questionId: text("question_id").notNull().references(() => questions.id, { onDelete: "cascade" }),
  studentId: text("student_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  answerText: text("answer_text").notNull(),
  submittedAt: integer("submitted_at").notNull(),
}, (t) => [uniqueIndex("answers_question_student_uq").on(t.questionId, t.studentId)]);

export type User = typeof users.$inferSelect;
export type Lesson = typeof lessons.$inferSelect;
export type Material = typeof materials.$inferSelect;
export type Question = typeof questions.$inferSelect;
export type Answer = typeof answers.$inferSelect;
```

- [ ] **Step 2:** `wrangler.jsonc`:

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "zion-class",
  "main": ".open-next/worker.js",
  "compatibility_date": "2026-09-01",
  "compatibility_flags": ["nodejs_compat"],
  "assets": { "directory": ".open-next/assets", "binding": "ASSETS" },
  "d1_databases": [
    { "binding": "DB", "database_name": "zion_class", "database_id": "local-zion-class", "migrations_dir": "src/db/migrations" }
  ]
}
```

For production run `npx wrangler d1 create zion_class` and paste real `database_id`.

- [ ] **Step 3:** `drizzle.config.ts`:

```ts
import { defineConfig } from "drizzle-kit";
export default defineConfig({ schema: "./src/db/schema.ts", out: "./src/db/migrations", dialect: "sqlite" });
```

- [ ] **Step 4:** `open-next.config.ts`:

```ts
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
export default defineCloudflareConfig();
```

- [ ] **Step 5:** `src/db/index.ts`:

```ts
import { drizzle } from "drizzle-orm/d1";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import * as schema from "./schema";

export function getDb() {
  const { env } = getCloudflareContext<{ DB: D1Database }>();
  return drizzle(env.DB, { schema });
}
export type Db = ReturnType<typeof getDb>;
```

- [ ] **Step 6:** `.dev.vars.example`:

```
SESSION_SECRET=change-me-to-a-long-random-string
SEED_TEACHER_EMAIL=professor@igreja.com
SEED_TEACHER_PASSWORD=Troque@123
```

Append `.dev.vars` to `.gitignore`.

- [ ] **Step 7:** `npm run db:generate && npm run db:migrate:local` — SQL appears in `src/db/migrations/`, wrangler applies it.
- [ ] **Step 8:** `npm run typecheck` then `git add -A && git commit -m "feat: drizzle schema, D1 migrations, wrangler config"`

---

### Task 3: Password hashing (TDD)

**Files:** `tests/lib/password.test.ts`, `src/lib/auth/password.ts`

- [ ] **Step 1:** Failing test:

```ts
import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("password", () => {
  it("hashes and verifies", async () => {
    const h = await hashPassword("Minha@Senha1");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("Minha@Senha1", h)).toBe(true);
  });
  it("rejects wrong password", async () => {
    const h = await hashPassword("Minha@Senha1");
    expect(await verifyPassword("outra", h)).toBe(false);
  });
  it("rejects malformed hash", async () => {
    expect(await verifyPassword("x", "invalido")).toBe(false);
  });
});
```

- [ ] **Step 2:** `npx vitest run tests/lib/password.test.ts` — FAIL (module not found).
- [ ] **Step 3:** `src/lib/auth/password.ts`:

```ts
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const KEYLEN = 64;

function scryptAsync(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEYLEN, (err, derived) => (err ? reject(err) : resolve(derived)));
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = Buffer.from(parts[1], "hex");
  const expected = Buffer.from(parts[2], "hex");
  if (expected.length !== KEYLEN) return false;
  const actual = await scryptAsync(password, salt);
  return timingSafeEqual(actual, expected);
}
```

- [ ] **Step 4:** Re-run test — PASS.
- [ ] **Step 5:** `git add -A && git commit -m "feat: scrypt password hashing"`

---

### Task 4: JWT session (TDD)

**Files:** `tests/lib/session.test.ts`, `src/lib/auth/session.ts`

- [ ] **Step 1:** Failing test:

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { createSessionToken, parseSessionToken } from "@/lib/auth/session";

beforeAll(() => { process.env.SESSION_SECRET = "test-secret-of-at-least-32-characters!!"; });

describe("session", () => {
  it("creates and parses a token", async () => {
    const token = await createSessionToken({ sub: "u1", role: "TEACHER", name: "Ana", status: "ACTIVE" });
    const payload = await parseSessionToken(token);
    expect(payload).toMatchObject({ sub: "u1", role: "TEACHER", name: "Ana", status: "ACTIVE" });
  });
  it("returns null for garbage", async () => {
    expect(await parseSessionToken("abc.def.ghi")).toBeNull();
  });
  it("returns null when secret missing", async () => {
    const secret = process.env.SESSION_SECRET;
    delete process.env.SESSION_SECRET;
    const token = await createSessionToken({ sub: "u1", role: "STUDENT", name: "Bia", status: "ACTIVE" });
    expect(await parseSessionToken(token)).toBeNull();
    process.env.SESSION_SECRET = secret;
  });
  it("rejects token without status claim", async () => {
    const { SignJWT } = await import("jose");
    const secret = new TextEncoder().encode(process.env.SESSION_SECRET!);
    const token = await new SignJWT({ sub: "u1", role: "STUDENT", name: "X" })
      .setProtectedHeader({ alg: "HS256" }).setExpirationTime("7d").sign(secret);
    expect(await parseSessionToken(token)).toBeNull();
  });
});
```

- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** `src/lib/auth/session.ts`:

```ts
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

export async function parseSessionToken(token: string): Promise<SessionPayload | null> {
  const secret = getSecret();
  if (!secret) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    const { sub, role, name, status } = payload as Record<string, unknown>;
    if (typeof sub !== "string" || typeof name !== "string") return null;
    if (role !== "STUDENT" && role !== "TEACHER") return null;
    if (status !== "PENDING" && status !== "ACTIVE" && status !== "SUSPENDED") return null;
    return { sub, role, name, status };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4:** Run — PASS.
- [ ] **Step 5:** `git add -A && git commit -m "feat: JWT session with status claim"`

---

### Task 5: Guards + middleware (TDD)

**Files:** `tests/lib/guards.test.ts`, `src/lib/auth/guards.ts`, `src/lib/auth/cookies.ts`, `middleware.ts`

- [ ] **Step 1:** Failing test:

```ts
import { describe, it, expect } from "vitest";
import { evaluateAccess } from "@/lib/auth/guards";
import type { SessionPayload } from "@/lib/auth/session";

const s = (over: Partial<SessionPayload> = {}): SessionPayload => ({
  sub: "1", role: "STUDENT", name: "A", status: "ACTIVE", ...over,
});

describe("evaluateAccess", () => {
  it("allows public auth pages without session", () => {
    expect(evaluateAccess(null, "/login")).toEqual({ type: "allow" });
    expect(evaluateAccess(null, "/register")).toEqual({ type: "allow" });
    expect(evaluateAccess(null, "/")).toEqual({ type: "allow" });
  });
  it("redirects protected without session to login", () => {
    expect(evaluateAccess(null, "/dashboard")).toEqual({ type: "redirect", to: "/login" });
    expect(evaluateAccess(null, "/admin")).toEqual({ type: "redirect", to: "/login" });
  });
  it("pending student sees only pending page", () => {
    expect(evaluateAccess(s({ status: "PENDING" }), "/dashboard")).toEqual({ type: "redirect", to: "/dashboard/pending" });
    expect(evaluateAccess(s({ status: "PENDING" }), "/dashboard/pending")).toEqual({ type: "allow" });
  });
  it("suspended sees only suspended page", () => {
    expect(evaluateAccess(s({ status: "SUSPENDED" }), "/dashboard/x")).toEqual({ type: "redirect", to: "/dashboard/suspended" });
    expect(evaluateAccess(s({ status: "SUSPENDED" }), "/dashboard/suspended")).toEqual({ type: "allow" });
  });
  it("student blocked from admin", () => {
    expect(evaluateAccess(s(), "/admin")).toEqual({ type: "redirect", to: "/dashboard" });
  });
  it("teacher active allowed on admin", () => {
    expect(evaluateAccess(s({ role: "TEACHER" }), "/admin")).toEqual({ type: "allow" });
  });
  it("teacher pending blocked from admin", () => {
    expect(evaluateAccess(s({ role: "TEACHER", status: "PENDING" }), "/admin")).toEqual({ type: "redirect", to: "/dashboard/pending" });
  });
  it("logged in redirected away from auth pages", () => {
    expect(evaluateAccess(s(), "/login")).toEqual({ type: "redirect", to: "/dashboard" });
    expect(evaluateAccess(s({ role: "TEACHER" }), "/login")).toEqual({ type: "redirect", to: "/admin" });
    expect(evaluateAccess(s(), "/register")).toEqual({ type: "redirect", to: "/dashboard" });
  });
});
```

- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** `src/lib/auth/guards.ts`:

```ts
import { SessionPayload } from "./session";

export type AccessDecision = { type: "allow" } | { type: "redirect"; to: string };

export function evaluateAccess(session: SessionPayload | null, pathname: string): AccessDecision {
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
```

- [ ] **Step 4:** `src/lib/auth/cookies.ts`:

```ts
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
```

- [ ] **Step 5:** `middleware.ts` (project root):

```ts
import { NextRequest, NextResponse } from "next/server";
import { parseSessionToken } from "@/lib/auth/session";
import { evaluateAccess } from "@/lib/auth/guards";
import { SESSION_COOKIE } from "@/lib/auth/cookies";

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
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
```

- [ ] **Step 6:** `npx vitest run tests/lib/guards.test.ts tests/lib/session.test.ts` — PASS; `npm run typecheck`.
- [ ] **Step 7:** `git add -A && git commit -m "feat: access guards and middleware"`

---

### Task 6: Zod schemas (TDD)

**Files:** `tests/validation/schemas.test.ts`, `src/lib/validation/schemas.ts`

- [ ] **Step 1:** Failing test:

```ts
import { describe, it, expect } from "vitest";
import { registerSchema, loginSchema, lessonSchema, saveAnswersSchema } from "@/lib/validation/schemas";

describe("schemas", () => {
  it("register accepts valid and lowercases email", () => {
    const r = registerSchema.safeParse({ name: "Maria Silva", email: "A@B.Com", password: "123456" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe("a@b.com");
  });
  it("register rejects short password", () => {
    expect(registerSchema.safeParse({ name: "Maria", email: "a@b.com", password: "123" }).success).toBe(false);
  });
  it("lesson requires YYYY-MM-DD date", () => {
    expect(lessonSchema.safeParse({ title: "Aula", date: "2026-09-22", description: "" }).success).toBe(true);
    expect(lessonSchema.safeParse({ title: "Aula", date: "22/09/2026", description: "" }).success).toBe(false);
  });
  it("saveAnswers rejects empty text and null optionIndex", () => {
    expect(saveAnswersSchema.safeParse({
      lessonId: "l1",
      answers: [
        { questionId: "q1", type: "TEXT", answerText: "  " },
        { questionId: "q2", type: "MULTIPLE_CHOICE", optionIndex: null },
      ],
    }).success).toBe(false);
  });
  it("saveAnswers accepts valid", () => {
    expect(saveAnswersSchema.safeParse({
      lessonId: "l1",
      answers: [
        { questionId: "q1", type: "TEXT", answerText: "ok" },
        { questionId: "q2", type: "MULTIPLE_CHOICE", optionIndex: 1 },
      ],
    }).success).toBe(true);
  });
});
```

- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** `src/lib/validation/schemas.ts`:

```ts
import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(3, "Informe seu nome completo"),
  email: z.string().trim().toLowerCase().email("E-mail inválido"),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("E-mail inválido"),
  password: z.string().min(1, "Informe a senha"),
});

export const materialSchema = z.object({
  title: z.string().trim().min(1, "Título obrigatório"),
  url: z.string().trim().url("URL inválida"),
  type: z.enum(["PDF", "LINK", "IMAGE", "DOCUMENT"]),
});

export const questionInputSchema = z
  .object({
    id: z.string().optional(),
    questionText: z.string().trim().min(1, "Texto da pergunta obrigatório"),
    questionType: z.enum(["TEXT", "MULTIPLE_CHOICE"]),
    options: z.array(z.string().trim().min(1)).default([]),
    correctOptionIndex: z.number().int().nullable().default(null),
  })
  .refine((q) => q.questionType === "TEXT" || q.options.length >= 2, {
    message: "Múltipla escolha precisa de pelo menos 2 opções",
    path: ["options"],
  })
  .refine(
    (q) =>
      q.questionType === "TEXT" ||
      q.correctOptionIndex === null ||
      (q.correctOptionIndex >= 0 && q.correctOptionIndex < q.options.length),
    { message: "Índice da resposta correta inválido", path: ["correctOptionIndex"] }
  );

export const lessonSchema = z.object({
  title: z.string().trim().min(1, "Título obrigatório"),
  description: z.string().default(""),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  videoUrl: z.string().trim().default(""),
  thumbnailUrl: z.string().trim().default(""),
  isPublished: z.boolean().default(false),
  materials: z.array(materialSchema).default([]),
  questions: z.array(questionInputSchema).default([]),
});

export type LessonInput = z.infer<typeof lessonSchema>;

export const saveAnswersSchema = z.object({
  lessonId: z.string().min(1),
  answers: z
    .array(
      z.discriminatedUnion("type", [
        z.object({
          questionId: z.string().min(1),
          type: z.literal("TEXT"),
          answerText: z.string().trim().min(1, "Resposta não pode ficar vazia"),
        }),
        z.object({
          questionId: z.string().min(1),
          type: z.literal("MULTIPLE_CHOICE"),
          optionIndex: z.number().int().min(0),
        }),
      ])
    )
    .min(1),
});

export const studentStatusSchema = z.object({
  userId: z.string().min(1),
  action: z.enum(["APPROVE", "SUSPEND", "REACTIVATE", "PROMOTE"]),
});
```

- [ ] **Step 4:** Run — PASS; `git add -A && git commit -m "feat: zod validation schemas"`

---

### Task 7: Format utils + CSV (TDD)

**Files:** `tests/lib/format.test.ts`, `tests/lib/csv.test.ts`, `src/lib/utils/format.ts`, `src/lib/utils/csv.ts`

- [ ] **Step 1:** `tests/lib/format.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { formatDate, formatDateTime, nextTuesdayISO } from "@/lib/utils/format";

describe("format", () => {
  it("formats YYYY-MM-DD to DD/MM/YYYY", () => {
    expect(formatDate("2026-09-22")).toBe("22/09/2026");
  });
  it("formats datetime day", () => {
    expect(formatDateTime(Date.UTC(2026, 8, 22, 19, 30))).toMatch(/22\/09\/2026/);
  });
  it("next tuesday", () => {
    expect(nextTuesdayISO("2026-09-17")).toBe("2026-09-22");
    expect(nextTuesdayISO("2026-09-22")).toBe("2026-09-29");
  });
});
```

- [ ] **Step 2:** `tests/lib/csv.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildResponsesCsv } from "@/lib/utils/csv";

describe("csv", () => {
  it("builds BOM + semicolon csv", () => {
    const csv = buildResponsesCsv({
      questions: [{ id: "q1", questionText: "O que é fé?" }],
      rows: [{ studentName: "Maria", submittedAt: Date.UTC(2026, 8, 22, 20, 0), cells: { q1: "Confiança em Deus" } }],
    });
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("Aluno;Pergunta;Resposta;Enviada em");
    expect(csv).toContain("Maria;O que é fé?;Confiança em Deus;");
  });
  it("escapes semicolons and quotes", () => {
    const csv = buildResponsesCsv({
      questions: [{ id: "q1", questionText: "Pergunta; com ponto" }],
      rows: [{ studentName: 'Ana "A"', submittedAt: 0, cells: { q1: "linha1\nlinha2" } }],
    });
    expect(csv).toContain('"Ana ""A"""');
    expect(csv).toContain('"Pergunta; com ponto"');
    expect(csv).toContain('"linha1\nlinha2"');
  });
});
```

- [ ] **Step 3:** Run both — FAIL.
- [ ] **Step 4:** `src/lib/utils/format.ts`:

```ts
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function formatDateTime(epochMs: number): string {
  const dt = new Date(epochMs);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

export function nextTuesdayISO(fromISO: string = new Date().toISOString().slice(0, 10)): string {
  const d = new Date(`${fromISO}T12:00:00Z`);
  const day = d.getUTCDay();
  let delta = (2 - day + 7) % 7;
  if (delta === 0) delta = 7;
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
```

- [ ] **Step 5:** `src/lib/utils/csv.ts`:

```ts
type CsvInput = {
  questions: { id: string; questionText: string }[];
  rows: { studentName: string; submittedAt: number; cells: Record<string, string> }[];
};

function esc(v: string): string {
  if (/[;\n\r"]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function formatShort(epochMs: number): string {
  const dt = new Date(epochMs);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

export function buildResponsesCsv(input: CsvInput): string {
  const lines: string[] = ["Aluno;Pergunta;Resposta;Enviada em"];
  for (const row of input.rows) {
    const when = formatShort(row.submittedAt);
    for (const q of input.questions) {
      lines.push([esc(row.studentName), esc(q.questionText), esc(row.cells[q.id] ?? ""), when].join(";"));
    }
  }
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}
```

- [ ] **Step 6:** Run — PASS; `git add -A && git commit -m "feat: date format and CSV export utils"`

---

### Task 8: Test DB helper + auth actions (TDD) + login/register UI

**Files:** `tests/utils/test-db.ts`, `tests/actions/auth.test.ts`, `src/lib/actions/auth.ts`, `src/components/auth/auth-form.tsx`, `src/app/(auth)/login/page.tsx`, `src/app/(auth)/register/page.tsx`

- [ ] **Step 1:** Create `tests/utils/test-db.ts`:

```ts
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "@/db/schema";

export function createTestDb() {
  const sqlite = new Database(":memory:");
  sqlite.exec(`
    CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'STUDENT', status TEXT NOT NULL DEFAULT 'PENDING', created_at INTEGER NOT NULL);
    CREATE TABLE lessons (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', date TEXT NOT NULL, video_url TEXT, thumbnail_url TEXT, is_published INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);
    CREATE TABLE materials (id TEXT PRIMARY KEY, lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE, title TEXT NOT NULL, url TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'LINK');
    CREATE TABLE questions (id TEXT PRIMARY KEY, lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE, question_text TEXT NOT NULL, question_type TEXT NOT NULL, options TEXT, correct_option_index INTEGER, position INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE answers (id TEXT PRIMARY KEY, question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE, student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, answer_text TEXT NOT NULL, submitted_at INTEGER NOT NULL);
    CREATE UNIQUE INDEX answers_question_student_uq ON answers(question_id, student_id);
  `);
  return drizzle(sqlite, { schema });
}
```

- [ ] **Step 2:** Failing `tests/actions/auth.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createTestDb } from "../utils/test-db";
import { registerUser, authenticate } from "@/lib/actions/auth";

describe("auth actions", () => {
  it("registers STUDENT PENDING", async () => {
    const db = createTestDb();
    const user = await registerUser(db, { name: "Maria Silva", email: "maria@x.com", password: "123456" });
    expect(user.role).toBe("STUDENT");
    expect(user.status).toBe("PENDING");
  });
  it("rejects duplicate email case-insensitive", async () => {
    const db = createTestDb();
    await registerUser(db, { name: "Maria", email: "maria@x.com", password: "123456" });
    await expect(registerUser(db, { name: "Outra", email: "MARIA@X.COM", password: "123456" })).rejects.toThrow();
  });
  it("authenticates correct / rejects wrong password", async () => {
    const db = createTestDb();
    await registerUser(db, { name: "Maria Silva", email: "maria@x.com", password: "123456" });
    const ok = await authenticate(db, { email: "maria@x.com", password: "123456" });
    expect(ok?.email).toBe("maria@x.com");
    expect(await authenticate(db, { email: "maria@x.com", password: "errada" })).toBeNull();
  });
});
```

- [ ] **Step 3:** Run — FAIL.
- [ ] **Step 4:** `src/lib/actions/auth.ts`:

```ts
import { eq } from "drizzle-orm";
import { users } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSessionToken, parseSessionToken } from "@/lib/auth/session";
import { setSessionCookie, clearSessionCookie, getSessionCookie } from "@/lib/auth/cookies";
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

export async function authenticate(db: any, input: { email: string; password: string }) {
  const email = input.email.trim().toLowerCase();
  const found = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const user = found[0];
  if (!user) return null;
  return (await verifyPassword(input.password, user.passwordHash)) ? user : null;
}

export async function registerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  try {
    const user = await registerUser(getDb(), parsed.data);
    const token = await createSessionToken({
      sub: user.id, role: user.role, name: user.name, status: user.status,
    });
    await setSessionCookie(token);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Não foi possível criar a conta" };
  }
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const user = await authenticate(getDb(), parsed.data);
  if (!user) return { ok: false, error: "E-mail ou senha incorretos" };
  const token = await createSessionToken({
    sub: user.id, role: user.role, name: user.name, status: user.status,
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
  return parseSessionToken(token);
}
```

- [ ] **Step 5:** Run — PASS.
- [ ] **Step 6:** `src/components/auth/auth-form.tsx`:

```tsx
"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import type { ActionState } from "@/lib/actions/auth";

export function AuthForm({
  action,
  mode,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  mode: "login" | "register";
}) {
  const [state, formAction, pending] = useActionState(action, { ok: false });
  const router = useRouter();
  const params = useSearchParams();
  const submitted = useRef(false);

  useEffect(() => {
    if (state.ok && submitted.current) {
      toast.success(mode === "login" ? "Bem-vindo de volta!" : "Conta criada!");
      router.replace(params.get("next") || "/");
      router.refresh();
    }
    if (state.error) {
      toast.error(state.error);
      submitted.current = false;
    }
  }, [state, router, params, mode]);

  return (
    <form
      action={formAction}
      className="space-y-4 bg-white border border-stone-200 rounded-xl p-6 shadow-sm"
      onSubmit={() => { submitted.current = true; }}
    >
      {mode === "register" && (
        <div className="space-y-1.5">
          <Label htmlFor="name">Nome completo</Label>
          <Input id="name" name="name" required placeholder="Maria Silva" autoComplete="name" />
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" required placeholder="voce@exemplo.com" autoComplete="email" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Senha</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={mode === "register" ? 6 : 1}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
        />
      </div>
      <Button className="w-full bg-emerald-700 hover:bg-emerald-800" disabled={pending}>
        {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {mode === "login" ? "Entrar" : "Criar conta"}
      </Button>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
```

- [ ] **Step 7:** `src/app/(auth)/login/page.tsx`:

```tsx
import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { loginAction } from "@/lib/actions/auth";

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-stone-50 p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-xl bg-emerald-700 text-white grid place-items-center font-bold text-lg">Z</div>
          <h1 className="text-2xl font-semibold text-stone-900">Zion Class</h1>
          <p className="text-sm text-stone-500">Área de estudos · Grupo bíblico semanal</p>
        </div>
        <AuthForm action={loginAction} mode="login" />
        <p className="text-center text-sm text-stone-500">
          Novo por aqui?{" "}
          <Link href="/register" className="text-emerald-700 font-medium">Criar conta</Link>
        </p>
      </div>
    </main>
  );
}
```

- [ ] **Step 8:** `src/app/(auth)/register/page.tsx` — same shell with `mode="register"`, `action={registerAction}`, footer link: `Já tenho conta? Entrar` → `/login`.
- [ ] **Step 9:** `npm test && npm run lint && npm run typecheck`; `git add -A && git commit -m "feat: auth actions, login and register pages"`

---

### Task 9: Root layout, home redirect, pending/suspended

**Files:** `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/dashboard/pending/page.tsx`, `src/app/dashboard/suspended/page.tsx`

- [ ] **Step 1:** Update `src/app/layout.tsx`: `lang="pt-BR"`, metadata `{ title: "Zion Class", description: "Área de estudos do grupo bíblico" }`, body `bg-stone-50 text-stone-900 antialiased`, add `<Toaster richColors position="top-center" />` from `sonner`.
- [ ] **Step 2:** `src/app/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/actions/auth";

export default async function Home() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.status === "PENDING") redirect("/dashboard/pending");
  if (session.status === "SUSPENDED") redirect("/dashboard/suspended");
  redirect(session.role === "TEACHER" ? "/admin" : "/dashboard");
}
```

- [ ] **Step 3:** `src/app/dashboard/pending/page.tsx`:

```tsx
import { Clock } from "lucide-react";
import { logoutAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";

export default function PendingPage() {
  return (
    <main className="min-h-screen grid place-items-center p-6 text-center bg-stone-50">
      <div className="max-w-md space-y-4">
        <Clock className="mx-auto h-12 w-12 text-amber-600" />
        <h1 className="text-xl font-semibold">Aguardando aprovação</h1>
        <p className="text-stone-600 text-sm">
          Sua conta foi criada. Assim que o professor aprovar, você terá acesso aos estudos.
        </p>
        <form action={logoutAction}>
          <Button variant="outline" type="submit">Sair</Button>
        </form>
      </div>
    </main>
  );
}
```

- [ ] **Step 4:** `src/app/dashboard/suspended/page.tsx` — same pattern with `Ban` icon and text `Conta suspensa — fale com o professor da turma.`
- [ ] **Step 5:** `npm run lint && npm run typecheck`; `git add -A && git commit -m "feat: root redirects and pending/suspended screens"`

---

### Task 10: Netflix showcase + lesson cards

**Files:** `src/lib/queries/showcase.ts`, `src/app/dashboard/layout.tsx`, `src/app/dashboard/page.tsx`, `src/components/dashboard/showcase.tsx`, `src/components/dashboard/lesson-card.tsx`

- [ ] **Step 1:** `src/lib/queries/showcase.ts`:

```ts
import { and, eq, desc, sql } from "drizzle-orm";
import { lessons, questions, answers } from "@/db/schema";

export type ShowcaseLesson = {
  id: string;
  title: string;
  description: string;
  date: string;
  thumbnailUrl: string | null;
  videoUrl: string | null;
  questionCount: number;
  answeredCount: number;
  badge: "ANSWERED" | "PENDING" | "NONE";
};

export async function getShowcase(db: any, studentId: string): Promise<ShowcaseLesson[]> {
  const published = await db
    .select()
    .from(lessons)
    .where(eq(lessons.isPublished, true))
    .orderBy(desc(lessons.date));

  const result: ShowcaseLesson[] = [];
  for (const lesson of published) {
    const qs = await db.select().from(questions).where(eq(questions.lessonId, lesson.id));
    let answered = 0;
    if (qs.length) {
      const rows = await db
        .select({ c: sql<number>`count(*)` })
        .from(answers)
        .innerJoin(questions, eq(answers.questionId, questions.id))
        .where(and(eq(questions.lessonId, lesson.id), eq(answers.studentId, studentId)));
      answered = Number(rows[0]?.c ?? 0);
    }
    const badge =
      qs.length === 0 ? "NONE" : answered >= qs.length ? "ANSWERED" : "PENDING";
    result.push({
      id: lesson.id,
      title: lesson.title,
      description: lesson.description,
      date: lesson.date,
      thumbnailUrl: lesson.thumbnailUrl,
      videoUrl: lesson.videoUrl,
      questionCount: qs.length,
      answeredCount: answered,
      badge,
    });
  }
  return result;
}
```

- [ ] **Step 2:** `src/app/dashboard/layout.tsx`:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession, logoutAction } from "@/lib/actions/auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.status === "PENDING") redirect("/dashboard/pending");
  if (session.status === "SUSPENDED") redirect("/dashboard/suspended");

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-40 bg-zinc-950/90 backdrop-blur border-b border-zinc-800">
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
            <span className="w-7 h-7 rounded-lg bg-emerald-700 grid place-items-center text-sm text-white">Z</span>
            Zion Class
          </Link>
          <nav className="flex items-center gap-4 text-sm text-zinc-400">
            <Link href="/dashboard" className="hover:text-zinc-100">Início</Link>
            <form action={logoutAction}>
              <button className="hover:text-zinc-100" type="submit">Sair</button>
            </form>
            <span className="w-8 h-8 rounded-full bg-zinc-800 grid place-items-center text-xs text-zinc-300">
              {session.name.slice(0, 1).toUpperCase()}
            </span>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-16">{children}</main>
    </div>
  );
}
```

- [ ] **Step 3:** `src/app/dashboard/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { getCurrentSession } from "@/lib/actions/auth";
import { getShowcase } from "@/lib/queries/showcase";
import { Showcase } from "@/components/dashboard/showcase";

export default async function DashboardPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  const lessons = await getShowcase(getDb(), session.sub);
  return <Showcase lessons={lessons} />;
}
```

- [ ] **Step 4:** `src/components/dashboard/lesson-card.tsx`:

```tsx
import Link from "next/link";
import { formatDate } from "@/lib/utils/format";
import type { ShowcaseLesson } from "@/lib/queries/showcase";
import { Badge } from "@/components/ui/badge";

const badgeMap = {
  ANSWERED: { label: "✓ Respondida", className: "bg-emerald-700 text-white" },
  PENDING: { label: "Pendente", className: "bg-amber-600 text-white" },
  NONE: { label: "Sem questionário", className: "bg-zinc-700 text-zinc-200" },
} as const;

export function LessonCard({ lesson }: { lesson: ShowcaseLesson }) {
  const b = badgeMap[lesson.badge];
  return (
    <Link
      href={`/dashboard/lessons/${lesson.id}`}
      className="group block w-44 sm:w-52 shrink-0 snap-start rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
    >
      <div className="relative aspect-video rounded-xl overflow-hidden bg-gradient-to-br from-zinc-700 to-zinc-900 transition group-hover:scale-[1.03] group-hover:ring-2 group-hover:ring-emerald-600">
        {lesson.thumbnailUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={lesson.thumbnailUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        <span className="absolute top-2 right-2">
          <Badge className={b.className + " text-[10px]"}>{b.label}</Badge>
        </span>
        <div className="absolute bottom-2 left-2 right-2 text-xs text-zinc-200 line-clamp-2 font-medium">
          {lesson.title}
        </div>
      </div>
      <p className="mt-1.5 text-[11px] text-zinc-500">{formatDate(lesson.date)}</p>
    </Link>
  );
}
```

- [ ] **Step 5:** `src/components/dashboard/showcase.tsx`:

```tsx
"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Search, Play, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LessonCard } from "./lesson-card";
import { formatDate } from "@/lib/utils/format";
import type { ShowcaseLesson } from "@/lib/queries/showcase";

export function Showcase({ lessons }: { lessons: ShowcaseLesson[] }) {
  const [query, setQuery] = useState("");
  const rowRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return lessons;
    return lessons.filter(
      (l) => l.title.toLowerCase().includes(q) || l.description.toLowerCase().includes(q)
    );
  }, [query, lessons]);

  const searching = query.trim().length > 0;
  const hero = !searching ? lessons[0] : undefined;
  const rowLessons = !searching ? lessons : filtered;


  if (!lessons.length) {
    return (
      <div className="py-24 text-center text-zinc-500">
        <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-zinc-900 grid place-items-center">📖</div>
        <p>Nenhum estudo publicado ainda. Volte na terça!</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pt-4">
      {hero && (
        <section className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-emerald-950 via-zinc-900 to-zinc-950 min-h-[280px]">
          {hero.thumbnailUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={hero.thumbnailUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover opacity-40"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/95 via-zinc-950/70 to-transparent" />
          <div className="relative p-6 sm:p-10 max-w-xl space-y-3">
            <p className="text-[11px] tracking-widest text-emerald-400">
              AULA MAIS RECENTE · {formatDate(hero.date)}
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold text-white">{hero.title}</h2>
            <p className="text-sm text-zinc-300 line-clamp-2">{hero.description}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button asChild className="bg-emerald-700 hover:bg-emerald-800 text-white">
                <Link href={`/dashboard/lessons/${hero.id}`}>
                  <Play className="mr-2 h-4 w-4" /> Estudar
                </Link>
              </Button>
              {hero.videoUrl && (
                <Button
                  asChild
                  variant="secondary"
                  className="bg-white/15 text-white hover:bg-white/25 backdrop-blur"
                >
                  <Link href={`/dashboard/lessons/${hero.id}#video`}>Vídeo complementar</Link>
                </Button>
              )}
            </div>
          </div>
        </section>
      )}

      <div className="relative">
        <div className="flex items-center gap-2 mb-4">
          <Search className="h-4 w-4 text-zinc-500" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar estudo…"
            className="max-w-sm bg-zinc-900 border-zinc-800 text-zinc-100"
            aria-label="Buscar estudo"
          />
        </div>

        {searching ? (
          filtered.length ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((l) => <WideCard key={l.id} lesson={l} />)}
            </div>
          ) : (
            <p className="text-zinc-500 text-sm py-8">Nenhum estudo encontrado.</p>
          )
        ) : (
          <div className="relative group/row">
            <h3 className="text-sm font-medium text-zinc-300 mb-3">Todos os estudos</h3>
            <button
              aria-label="Anterior"
              onClick={() => rowRef.current?.scrollBy({ left: -240, behavior: "smooth" })}
              className="hidden md:grid absolute left-0 top-1/2 z-10 w-9 h-9 -translate-y-1/2 place-items-center rounded-full bg-black/60 text-white opacity-0 group-hover/row:opacity-100 transition"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div ref={rowRef} className="flex gap-3 overflow-x-auto pb-2 snap-x scroll-smooth">
              {rowLessons.map((l) => (
                <LessonCard key={l.id} lesson={l} />
              ))}
            </div>
            <button
              aria-label="Próximo"
              onClick={() => rowRef.current?.scrollBy({ left: 240, behavior: "smooth" })}
              className="hidden md:grid absolute right-0 top-1/2 z-10 w-9 h-9 -translate-y-1/2 place-items-center rounded-full bg-black/60 text-white opacity-0 group-hover/row:opacity-100 transition"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function WideCard({ lesson }: { lesson: ShowcaseLesson }) {
  return (
    <Link
      href={`/dashboard/lessons/${lesson.id}`}
      className="block rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900 hover:border-emerald-700 transition"
    >
      <div className="aspect-video bg-gradient-to-br from-zinc-700 to-zinc-900 relative">
        {lesson.thumbnailUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={lesson.thumbnailUrl}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        )}
      </div>
      <div className="p-3">
        <p className="text-sm font-medium text-zinc-100 line-clamp-1">{lesson.title}</p>
        <p className="text-xs text-zinc-500 mt-1">{formatDate(lesson.date)}</p>
      </div>
    </Link>
  );
}
```

- [ ] **Step 6:** `npm run lint && npm run typecheck`; `git add -A && git commit -m "feat: Netflix-style showcase with search and badges"`

---

### Task 11: Lesson page + question form + submitAnswers (TDD)

**Files:** `tests/actions/answers.test.ts`, `src/lib/actions/answers.ts`, `src/lib/queries/lesson.ts`, `src/components/dashboard/{video-embed,materials-list,question-form}.tsx`, `src/app/dashboard/lessons/[id]/page.tsx`

- [ ] **Step 1:** Failing `tests/actions/answers.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "../utils/test-db";
import { submitAnswers } from "@/lib/actions/answers";
import { users, lessons, questions, answers } from "@/db/schema";

async function seed(db: any) {
  const now = Date.now();
  await db.insert(users).values({
    id: "s1", name: "Aluna", email: "a@a.com", passwordHash: "x",
    role: "STUDENT", status: "ACTIVE", createdAt: now,
  });
  await db.insert(lessons).values({
    id: "l1", title: "Aula", description: "", date: "2026-09-22", isPublished: true, createdAt: now,
  });
  await db.insert(questions).values([
    { id: "q1", lessonId: "l1", questionText: "Aberta", questionType: "TEXT", position: 0 },
    {
      id: "q2", lessonId: "l1", questionText: "Escolha", questionType: "MULTIPLE_CHOICE",
      options: JSON.stringify(["A", "B"]), position: 1,
    },
  ]);
}

describe("submitAnswers", () => {
  it("inserts then updates on edit (submitted_at refreshes)", async () => {
    const db = createTestDb();
    await seed(db);
    const r1 = await submitAnswers(db, "s1", {
      lessonId: "l1",
      answers: [
        { questionId: "q1", type: "TEXT", answerText: "primeira" },
        { questionId: "q2", type: "MULTIPLE_CHOICE", optionIndex: 0 },
      ],
    });
    expect(r1.ok).toBe(true);
    await new Promise((r) => setTimeout(r, 5));
    const r2 = await submitAnswers(db, "s1", {
      lessonId: "l1",
      answers: [
        { questionId: "q1", type: "TEXT", answerText: "segunda versao" },
        { questionId: "q2", type: "MULTIPLE_CHOICE", optionIndex: 1 },
      ],
    });
    expect(r2.ok).toBe(true);
    const rows = await db.select().from(answers).where(eq(answers.studentId, "s1"));
    expect(rows).toHaveLength(2);
    expect(rows.find((r: any) => r.questionId === "q1")!.answerText).toBe("segunda versao");
    expect(rows.find((r: any) => r.questionId === "q2")!.answerText).toBe("1");
  });

  it("rejects question from another lesson", async () => {
    const db = createTestDb();
    await seed(db);
    const r = await submitAnswers(db, "s1", {
      lessonId: "l1",
      answers: [{ questionId: "OUTRA", type: "TEXT", answerText: "x" }],
    });
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** `src/lib/actions/answers.ts`:

```ts
import { and, eq, inArray } from "drizzle-orm";
import { answers, questions, lessons } from "@/db/schema";
import { saveAnswersSchema } from "@/lib/validation/schemas";
import { getDb } from "@/db";
import { getCurrentSession } from "@/lib/actions/auth";
import { revalidatePath } from "next/cache";

export type Result = { ok: boolean; error?: string };

export async function submitAnswers(db: any, studentId: string, input: unknown): Promise<Result> {
  const parsed = saveAnswersSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { lessonId, answers: items } = parsed.data;

  const lessonRows = await db.select().from(lessons).where(eq(lessons.id, lessonId)).limit(1);
  if (!lessonRows.length) return { ok: false, error: "Aula não encontrada" };

  const questionIds = items.map((i) => i.questionId);
  const validQs = await db
    .select()
    .from(questions)
    .where(and(eq(questions.lessonId, lessonId), inArray(questions.id, questionIds)));
  if (validQs.length !== questionIds.length) return { ok: false, error: "Pergunta inválida" };

  const now = Date.now();
  for (const item of items) {
    const text = item.type === "TEXT" ? item.answerText : String(item.optionIndex);
    const existing = await db
      .select()
      .from(answers)
      .where(and(eq(answers.questionId, item.questionId), eq(answers.studentId, studentId)))
      .limit(1);
    if (existing.length) {
      await db
        .update(answers)
        .set({ answerText: text, submittedAt: now })
        .where(eq(answers.id, existing[0].id));
    } else {
      await db.insert(answers).values({
        id: crypto.randomUUID(),
        questionId: item.questionId,
        studentId,
        answerText: text,
        submittedAt: now,
      });
    }
  }
  return { ok: true };
}

export async function submitAnswersAction(input: unknown): Promise<Result> {
  const session = await getCurrentSession();
  if (!session) return { ok: false, error: "Sessão expirada" };
  if (session.status !== "ACTIVE") return { ok: false, error: "Acesso restrito" };
  const result = await submitAnswers(getDb(), session.sub, input);
  if (result.ok) revalidatePath("/dashboard", "layout");
  return result;
}
```

- [ ] **Step 4:** Run — PASS.
- [ ] **Step 5:** `src/lib/queries/lesson.ts`:

```ts
import { eq } from "drizzle-orm";
import { lessons, materials, questions, answers } from "@/db/schema";

export async function getLessonForStudent(db: any, lessonId: string, studentId: string) {
  const l = await db.select().from(lessons).where(eq(lessons.id, lessonId)).limit(1);
  if (!l.length || !l[0].isPublished) return null;
  const mats = await db.select().from(materials).where(eq(materials.lessonId, lessonId));
  const qs = await db.select().from(questions).where(eq(questions.lessonId, lessonId));
  qs.sort((a, b) => a.position - b.position);
  const myAnswers = await db.select().from(answers).where(eq(answers.studentId, studentId));
  const byQ = new Map(myAnswers.map((a: any) => [a.questionId, a]));
  return {
    lesson: l[0],
    materials: mats,
    questions: qs.map((q: any) => {
      const a = byQ.get(q.id);
      return {
        ...q,
        optionsList: q.options ? (JSON.parse(q.options) as string[]) : [],
        myAnswer: a ? a.answerText : null,
        mySubmittedAt: a ? a.submittedAt : null,
      };
    }),
  };
}
```

- [ ] **Step 6:** `src/components/dashboard/video-embed.tsx`:

```tsx
"use client";
import { Youtube } from "lucide-react";
import { Button } from "@/components/ui/button";

function toEmbed(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace("www.", "");
    if (host === "youtube.com" || host === "m.youtube.com") {
      const v = u.searchParams.get("v");
      if (v) return `https://www.youtube.com/embed/${v}`;
      if (u.pathname.startsWith("/shorts/")) return `https://www.youtube.com/embed${u.pathname.replace("/shorts/", "/")}`;
      if (u.pathname.startsWith("/embed/")) return url;
    }
    if (host === "youtu.be") return `https://www.youtube.com/embed${u.pathname}`;
    if (host === "vimeo.com" || host === "player.vimeo.com") {
      const id = u.pathname.split("/").filter(Boolean).pop();
      return id && /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : null;
    }
  } catch {
    return null;
  }
  return null;
}

export function VideoEmbed({ url }: { url: string }) {
  const embed = toEmbed(url);
  if (!embed) {
    return (
      <Button asChild variant="outline">
        <a href={url} target="_blank" rel="noopener noreferrer">
          <Youtube className="mr-2 h-4 w-4" /> Assistir vídeo complementar
        </a>
      </Button>
    );
  }
  return (
    <div className="aspect-video rounded-xl overflow-hidden border border-zinc-800">
      <iframe
        src={embed}
        className="w-full h-full"
        allowFullScreen
        title="Vídeo complementar"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope"
      />
    </div>
  );
}
```

- [ ] **Step 7:** `src/components/dashboard/materials-list.tsx`:

```tsx
import { FileText, Link2, Image, File, ExternalLink } from "lucide-react";
import type { Material } from "@/db/schema";

const icons = { PDF: FileText, LINK: Link2, IMAGE: Image, DOCUMENT: File } as const;

export function MaterialsList({ materials }: { materials: Material[] }) {
  if (!materials.length) return <p className="text-sm text-zinc-500">Sem materiais no momento.</p>;
  return (
    <ul className="space-y-2">
      {materials.map((m) => {
        const Icon = icons[m.type] ?? Link2;
        return (
          <li key={m.id}>
            <a
              href={m.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 hover:border-emerald-700 transition"
            >
              <Icon className="h-4 w-4 text-emerald-500 shrink-0" />
              <span className="text-sm text-zinc-100 flex-1 truncate">{m.title}</span>
              <span className="text-[10px] uppercase text-zinc-500">{m.type}</span>
              <ExternalLink className="h-3.5 w-3.5 text-zinc-600" />
            </a>
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] **Step 8:** `src/components/dashboard/question-form.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Loader2 } from "lucide-react";
import { submitAnswersAction } from "@/lib/actions/answers";
import { formatDateTime } from "@/lib/utils/format";
import { useRouter } from "next/navigation";

export type QuestionView = {
  id: string;
  questionText: string;
  questionType: "TEXT" | "MULTIPLE_CHOICE";
  optionsList: string[];
  myAnswer: string | null;
  mySubmittedAt: number | null;
};

export function QuestionForm({ lessonId, questions }: { lessonId: string; questions: QuestionView[] }) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(questions.map((q) => [q.id, q.myAnswer ?? ""]))
  );
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const answered = questions.length > 0 && questions.every((q) => q.myAnswer !== null);
  const lastAt = questions.reduce<number | null>(
    (acc, q) => (q.mySubmittedAt && (!acc || q.mySubmittedAt > acc) ? q.mySubmittedAt : acc),
    null
  );

  if (!questions.length) {
    return <p className="text-sm text-zinc-500">Esta aula não tem questionário.</p>;
  }

  const submit = () => {
    const payload = {
      lessonId,
      answers: questions.map((q) =>
        q.questionType === "TEXT"
          ? { questionId: q.id, type: "TEXT" as const, answerText: values[q.id] ?? "" }
          : { questionId: q.id, type: "MULTIPLE_CHOICE" as const, optionIndex: Number(values[q.id]) }
      ),
    };
    startTransition(async () => {
      const res = await submitAnswersAction(payload);
      if (res.ok) {
        toast.success("Respostas salvas!");
        router.refresh();
      } else {
        toast.error(res.error ?? "Não foi possível salvar");
      }
    });
  };

  return (
    <div className="space-y-6">
      {answered && lastAt && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-950 border border-emerald-800 px-4 py-3 text-sm text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Sua resposta foi gravada em {formatDateTime(lastAt)}
        </div>
      )}
      {questions.map((q, i) => (
        <fieldset key={q.id} className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <legend className="text-sm font-medium text-zinc-100 px-1">
            {i + 1}. {q.questionText}
          </legend>
          {q.questionType === "TEXT" ? (
            <Textarea
              value={values[q.id] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [q.id]: e.target.value }))}
              placeholder="Escreva sua resposta…"
              className="bg-zinc-950 border-zinc-800 text-zinc-100 min-h-[96px]"
            />
          ) : (
            <div className="space-y-2">
              {q.optionsList.map((opt, idx) => (
                <label key={idx} className="flex items-start gap-2 text-sm text-zinc-200 cursor-pointer">
                  <input
                    type="radio"
                    name={q.id}
                    className="mt-1 accent-emerald-600"
                    checked={values[q.id] === String(idx)}
                    onChange={() => setValues((v) => ({ ...v, [q.id]: String(idx) }))}
                  />
                  <span>{opt}</span>
                </label>
              ))}
            </div>
          )}
        </fieldset>
      ))}
      <Button onClick={submit} disabled={pending} className="bg-emerald-700 hover:bg-emerald-800">
        {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {answered ? "Atualizar respostas" : "Enviar respostas"}
      </Button>
    </div>
  );
}
```

- [ ] **Step 9:** `src/app/dashboard/lessons/[id]/page.tsx`:

```tsx
import { notFound, redirect } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { getDb } from "@/db";
import { getCurrentSession } from "@/lib/actions/auth";
import { getLessonForStudent } from "@/lib/queries/lesson";
import { formatDate } from "@/lib/utils/format";
import { VideoEmbed } from "@/components/dashboard/video-embed";
import { MaterialsList } from "@/components/dashboard/materials-list";
import { QuestionForm } from "@/components/dashboard/question-form";

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.status === "PENDING") redirect("/dashboard/pending");
  if (session.status === "SUSPENDED") redirect("/dashboard/suspended");

  const data = await getLessonForStudent(getDb(), id, session.sub);
  if (!data) notFound();
  const { lesson, materials, questions } = data;

  return (
    <article className="space-y-10 py-6 max-w-3xl mx-auto">
      {lesson.thumbnailUrl && (
        <div className="rounded-2xl overflow-hidden aspect-[3/1] bg-zinc-900">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lesson.thumbnailUrl}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        </div>
      )}
      <header className="space-y-2">
        <p className="text-xs text-emerald-500">{formatDate(lesson.date)}</p>
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-50">{lesson.title}</h1>
      </header>

      <section className="prose prose-invert prose-sm max-w-none [&_a]:text-emerald-400">
        <ReactMarkdown>{lesson.description}</ReactMarkdown>
      </section>

      {lesson.videoUrl && (
        <section id="video" className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-100">Vídeo complementar</h2>
          <VideoEmbed url={lesson.videoUrl} />
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-zinc-100">Materiais de apoio</h2>
        <MaterialsList materials={materials} />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-zinc-100">Questionário / Dúvidas</h2>
        <QuestionForm lessonId={lesson.id} questions={questions} />
      </section>
    </article>
  );
}
```

- [ ] **Step 10:** `npm test && npm run lint && npm run typecheck`; `git add -A && git commit -m "feat: lesson page with materials, video, question form"`

---

### Task 12: Admin shell + overview

**Files:** `src/lib/queries/admin.ts`, `src/app/admin/layout.tsx`, `src/app/admin/page.tsx`

- [ ] **Step 1:** `src/lib/queries/admin.ts`:

```ts
import { desc, eq, sql } from "drizzle-orm";
import { answers, lessons, questions, users } from "@/db/schema";

export async function getAdminMetrics(db: any) {
  const totalLessons = await db.select({ c: sql<number>`count(*)` }).from(lessons);
  const published = await db.select({ c: sql<number>`count(*)` }).from(lessons).where(eq(lessons.isPublished, true));
  const drafts = await db.select({ c: sql<number>`count(*)` }).from(lessons).where(eq(lessons.isPublished, false));
  const totalAnswers = await db.select({ c: sql<number>`count(*)` }).from(answers);
  const pendingStudents = await db.select({ c: sql<number>`count(*)` }).from(users).where(eq(users.status, "PENDING"));

  const recent = await db
    .select({
      submittedAt: answers.submittedAt,
      studentName: users.name,
      lessonId: lessons.id,
      lessonTitle: lessons.title,
    })
    .from(answers)
    .innerJoin(users, eq(answers.studentId, users.id))
    .innerJoin(questions, eq(answers.questionId, questions.id))
    .innerJoin(lessons, eq(questions.lessonId, lessons.id))
    .orderBy(desc(answers.submittedAt))
    .limit(5);

  return {
    totalLessons: Number(totalLessons[0].c),
    published: Number(published[0].c),
    drafts: Number(drafts[0].c),
    totalAnswers: Number(totalAnswers[0].c),
    pendingStudents: Number(pendingStudents[0].c),
    recent,
  };
}
```

- [ ] **Step 2:** `src/app/admin/layout.tsx`:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { LayoutDashboard, BookOpen, Users, LogOut } from "lucide-react";
import { getCurrentSession, logoutAction } from "@/lib/actions/auth";

const nav = [
  { href: "/admin", label: "Visão geral", icon: LayoutDashboard },
  { href: "/admin/lessons", label: "Aulas", icon: BookOpen },
  { href: "/admin/students", label: "Alunos", icon: Users },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.role !== "TEACHER") redirect("/dashboard");
  if (session.status !== "ACTIVE") redirect("/dashboard/pending");

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <div className="flex min-h-screen">
        <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-stone-200 bg-white p-4 gap-1">
          <Link href="/admin" className="flex items-center gap-2 font-semibold mb-6 px-2">
            <span className="w-8 h-8 rounded-lg bg-emerald-700 text-white grid place-items-center text-sm">Z</span>
            Zion Admin
          </Link>
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-stone-700 hover:bg-stone-100"
            >
              <item.icon className="h-4 w-4" /> {item.label}
            </Link>
          ))}
          <form action={logoutAction} className="mt-auto">
            <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-stone-500 hover:bg-stone-100">
              <LogOut className="h-4 w-4" /> Sair
            </button>
          </form>
        </aside>
        <div className="flex-1 flex flex-col min-w-0">
          <header className="md:hidden sticky top-0 z-30 flex items-center justify-between border-b border-stone-200 bg-white px-4 h-14">
            <Link href="/admin" className="font-semibold">Zion Admin</Link>
            <nav className="flex gap-3 text-sm">
              {nav.map((i) => (
                <Link key={i.href} href={i.href}>{i.label}</Link>
              ))}
            </nav>
          </header>
          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-6xl w-full mx-auto">{children}</main>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3:** `src/app/admin/page.tsx`:

```tsx
import Link from "next/link";
import { Plus } from "lucide-react";
import { getDb } from "@/db";
import { getAdminMetrics } from "@/lib/queries/admin";
import { formatDateTime } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminHome() {
  const m = await getAdminMetrics(getDb());
  const stats = [
    { label: "Aulas", value: m.totalLessons },
    { label: "Publicadas", value: m.published },
    { label: "Rascunhos", value: m.drafts },
    { label: "Respostas", value: m.totalAnswers },
    { label: "Pendentes", value: m.pendingStudents },
  ];
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Visão geral</h1>
        <Button asChild className="bg-emerald-700 hover:bg-emerald-800">
          <Link href="/admin/lessons/new">
            <Plus className="mr-2 h-4 w-4" /> Nova aula
          </Link>
        </Button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs text-stone-500 font-normal">{s.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      {m.pendingStudents > 0 && (
        <Link
          href="/admin/students"
          className="block rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          {m.pendingStudents} aluno(s) aguardando aprovação →
        </Link>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Últimas respostas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {m.recent.length === 0 && (
            <p className="text-sm text-stone-500">Nenhuma resposta ainda.</p>
          )}
          {m.recent.map((r, i) => (
            <div
              key={i}
              className="flex flex-wrap justify-between gap-2 text-sm border-b border-stone-100 pb-2 last:border-0"
            >
              <span>
                <strong>{r.studentName}</strong> · {r.lessonTitle}
              </span>
              <span className="text-stone-500">{formatDateTime(r.submittedAt)}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 4:** `npm run typecheck`; `git add -A && git commit -m "feat: admin shell and overview metrics"`

---

### Task 13: Lesson CRUD actions + admin lessons list (TDD)

**Files:** `tests/actions/lessons.test.ts`, `src/lib/actions/lessons.ts`, `src/app/admin/lessons/page.tsx`

- [ ] **Step 1:** Failing `tests/actions/lessons.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createTestDb } from "../utils/test-db";
import { saveLesson, deleteLesson, togglePublish } from "@/lib/actions/lessons";
import { lessons, materials, questions } from "@/db/schema";

const validInput = {
  title: "Estudo #01",
  description: "Intro",
  date: "2026-09-22",
  videoUrl: "https://youtube.com/watch?v=abc",
  thumbnailUrl: "https://exemplo.com/t.jpg",
  isPublished: false,
  materials: [{ title: "PDF", url: "https://exemplo.com/a.pdf", type: "PDF" as const }],
  questions: [
    { questionText: "O quê?", questionType: "TEXT" as const, options: [], correctOptionIndex: null },
    { questionText: "Escolha", questionType: "MULTIPLE_CHOICE" as const, options: ["A", "B"], correctOptionIndex: 1 },
  ],
};

describe("saveLesson", () => {
  it("creates lesson with materials and questions", async () => {
    const db = createTestDb();
    const r = await saveLesson(db, validInput);
    expect(r.ok).toBe(true);
    expect(r.lessonId).toBeTruthy();
    expect(await db.select().from(lessons)).toHaveLength(1);
    expect(await db.select().from(materials)).toHaveLength(1);
    expect(await db.select().from(questions)).toHaveLength(2);
  });

  it("updates and removes missing materials/questions", async () => {
    const db = createTestDb();
    const created = await saveLesson(db, validInput);
    const upd = await saveLesson(
      db,
      {
        ...validInput,
        isPublished: true,
        materials: [{ title: "Slides", url: "https://exemplo.com/s.pdf", type: "DOCUMENT" as const }],
        questions: [{ questionText: "Só uma", questionType: "TEXT" as const, options: [], correctOptionIndex: null }],
      },
      created.lessonId
    );
    expect(upd.ok).toBe(true);
    const mats = await db.select().from(materials);
    expect(mats).toHaveLength(1);
    expect(mats[0].title).toBe("Slides");
    expect(await db.select().from(questions)).toHaveLength(1);
    const les = await db.select().from(lessons);
    expect(les[0].isPublished).toBeTruthy();
  });
});

describe("deleteLesson", () => {
  it("cascades to questions", async () => {
    const db = createTestDb();
    const c = await saveLesson(db, validInput);
    await deleteLesson(db, c.lessonId!);
    expect(await db.select().from(lessons)).toHaveLength(0);
    expect(await db.select().from(questions)).toHaveLength(0);
  });
});

describe("togglePublish", () => {
  it("flips flag", async () => {
    const db = createTestDb();
    const c = await saveLesson(db, validInput);
    await togglePublish(db, c.lessonId!, true);
    const rows = await db.select().from(lessons);
    expect(rows[0].isPublished).toBeTruthy();
  });
});
```

- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** `src/lib/actions/lessons.ts`:

```ts
import { eq } from "drizzle-orm";
import { lessons, materials, questions } from "@/db/schema";
import { lessonSchema } from "@/lib/validation/schemas";
import { getDb } from "@/db";
import { getCurrentSession } from "@/lib/actions/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type Result = { ok: boolean; error?: string; lessonId?: string };

export async function saveLesson(db: any, rawInput: unknown, existingId?: string): Promise<Result> {
  const parsed = lessonSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const data = parsed.data;
  const lessonId = existingId ?? crypto.randomUUID();

  if (existingId) {
    await db
      .update(lessons)
      .set({
        title: data.title,
        description: data.description,
        date: data.date,
        videoUrl: data.videoUrl || null,
        thumbnailUrl: data.thumbnailUrl || null,
        isPublished: data.isPublished,
      })
      .where(eq(lessons.id, existingId));
    await db.delete(materials).where(eq(materials.lessonId, existingId));
    await db.delete(questions).where(eq(questions.lessonId, existingId));
  } else {
    await db.insert(lessons).values({
      id: lessonId,
      title: data.title,
      description: data.description,
      date: data.date,
      videoUrl: data.videoUrl || null,
      thumbnailUrl: data.thumbnailUrl || null,
      isPublished: data.isPublished,
      createdAt: Date.now(),
    });
  }

  if (data.materials.length) {
    await db.insert(materials).values(
      data.materials.map((m) => ({
        id: crypto.randomUUID(),
        lessonId,
        title: m.title,
        url: m.url,
        type: m.type,
      }))
    );
  }
  if (data.questions.length) {
    await db.insert(questions).values(
      data.questions.map((q, i) => ({
        id: q.id ?? crypto.randomUUID(),
        lessonId,
        questionText: q.questionText,
        questionType: q.questionType,
        options: q.questionType === "MULTIPLE_CHOICE" ? JSON.stringify(q.options) : null,
        correctOptionIndex: q.questionType === "MULTIPLE_CHOICE" ? q.correctOptionIndex : null,
        position: i,
      }))
    );
  }
  return { ok: true, lessonId };
}

export async function deleteLesson(db: any, lessonId: string): Promise<Result> {
  await db.delete(lessons).where(eq(lessons.id, lessonId));
  return { ok: true };
}

export async function togglePublish(db: any, lessonId: string, isPublished: boolean): Promise<Result> {
  await db.update(lessons).set({ isPublished }).where(eq(lessons.id, lessonId));
  return { ok: true };
}

async function requireTeacher() {
  const session = await getCurrentSession();
  if (!session || session.role !== "TEACHER" || session.status !== "ACTIVE") return null;
  return session;
}

function parseFormInput(formData: FormData) {
  const materialsRaw = JSON.parse(String(formData.get("materialsJson") || "[]"));
  const questionsRaw = JSON.parse(String(formData.get("questionsJson") || "[]"));
  return {
    title: formData.get("title"),
    description: String(formData.get("description") || ""),
    date: formData.get("date"),
    videoUrl: String(formData.get("videoUrl") || ""),
    thumbnailUrl: String(formData.get("thumbnailUrl") || ""),
    isPublished: formData.get("isPublished") === "true" || formData.get("isPublished") === "on",
    materials: materialsRaw,
    questions: questionsRaw,
  };
}

export async function saveLessonAction(lessonId: string | null, formData: FormData): Promise<Result> {
  if (!(await requireTeacher())) return { ok: false, error: "Acesso restrito" };
  const result = await saveLesson(getDb(), parseFormInput(formData), lessonId ?? undefined);
  if (result.ok) {
    revalidatePath("/admin/lessons");
    revalidatePath("/dashboard", "layout");
  }
  return result;
}

export async function deleteLessonAction(formData: FormData) {
  if (!(await requireTeacher())) redirect("/dashboard");
  await deleteLesson(getDb(), String(formData.get("lessonId")));
  revalidatePath("/admin/lessons");
  revalidatePath("/dashboard", "layout");
}

export async function togglePublishAction(formData: FormData) {
  if (!(await requireTeacher())) redirect("/dashboard");
  const id = String(formData.get("lessonId"));
  const next = String(formData.get("publish")) === "1";
  await togglePublish(getDb(), id, next);
  revalidatePath("/admin/lessons");
  revalidatePath("/dashboard", "layout");
}
```

- [ ] **Step 4:** Run — PASS.
- [ ] **Step 5:** `src/app/admin/lessons/page.tsx` (search `?q=`, filter `?status=`):

```tsx
import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { Plus, Pencil, MessageSquare, Trash2 } from "lucide-react";
import { getDb } from "@/db";
import { lessons, questions, answers } from "@/db/schema";
import { formatDate } from "@/lib/utils/format";
import { deleteLessonAction, togglePublishAction } from "@/lib/actions/lessons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default async function AdminLessonsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q = "", status = "all" } = await searchParams;
  const db = getDb();

  let where = undefined as ReturnType<typeof eq> | undefined;
  if (status === "published") where = eq(lessons.isPublished, true);
  if (status === "draft") where = eq(lessons.isPublished, false);

  let rows = await db.select().from(lessons).where(where).orderBy(desc(lessons.date));
  if (q) {
    const needle = q.toLowerCase();
    rows = rows.filter((l) => l.title.toLowerCase().includes(needle));
  }

  const withCounts = await Promise.all(
    rows.map(async (l) => {
      const qCount = await db
        .select({ c: sql<number>`count(*)` })
        .from(questions)
        .where(eq(questions.lessonId, l.id));
      const aCount = await db
        .select({ c: sql<number>`count(*)` })
        .from(answers)
        .innerJoin(questions, eq(answers.questionId, questions.id))
        .where(eq(questions.lessonId, l.id));
      return { ...l, qCount: Number(qCount[0].c), aCount: Number(aCount[0].c) };
    })
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Aulas</h1>
        <Button asChild className="bg-emerald-700 hover:bg-emerald-800">
          <Link href="/admin/lessons/new">
            <Plus className="mr-2 h-4 w-4" /> Nova aula
          </Link>
        </Button>
      </div>

      <form className="flex flex-wrap gap-2" method="get">
        <Input name="q" defaultValue={q} placeholder="Buscar por título…" className="max-w-xs" />
        <select
          name="status"
          defaultValue={status}
          className="h-9 rounded-md border border-stone-300 bg-white px-2 text-sm"
        >
          <option value="all">Todos</option>
          <option value="published">Publicadas</option>
          <option value="draft">Rascunhos</option>
        </select>
        <Button type="submit" variant="outline">Filtrar</Button>
      </form>

      <div className="rounded-lg border border-stone-200 bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-stone-500 text-left">
            <tr>
              <th className="p-3 font-medium">Data</th>
              <th className="p-3 font-medium">Título</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium">Perguntas</th>
              <th className="p-3 font-medium">Respostas</th>
              <th className="p-3 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {withCounts.map((l) => (
              <tr key={l.id} className="border-t border-stone-100">
                <td className="p-3 whitespace-nowrap">{formatDate(l.date)}</td>
                <td className="p-3 font-medium">{l.title}</td>
                <td className="p-3">
                  <Badge variant={l.isPublished ? "default" : "secondary"} className={l.isPublished ? "bg-emerald-700" : ""}>
                    {l.isPublished ? "Publicada" : "Rascunho"}
                  </Badge>
                </td>
                <td className="p-3">{l.qCount}</td>
                <td className="p-3">{l.aCount}</td>
                <td className="p-3">
                  <div className="flex justify-end items-center gap-1">
                    <Button asChild size="sm" variant="ghost">
                      <Link href={`/admin/lessons/${l.id}/edit`} aria-label="Editar">
                        <Pencil className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="ghost">
                      <Link href={`/admin/lessons/${l.id}/responses`} aria-label="Respostas">
                        <MessageSquare className="h-4 w-4" />
                      </Link>
                    </Button>
                    <form action={togglePublishAction}>
                      <input type="hidden" name="lessonId" value={l.id} />
                      <input type="hidden" name="publish" value={l.isPublished ? "0" : "1"} />
                      <Button size="sm" variant="ghost" type="submit">
                        {l.isPublished ? "Despublicar" : "Publicar"}
                      </Button>
                    </form>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="ghost" className="text-red-600" aria-label="Excluir">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Excluir aula?</DialogTitle>
                          <DialogDescription>
                            “{l.title}” e todos os materiais, perguntas e respostas serão removidos.
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                          <form action={deleteLessonAction}>
                            <input type="hidden" name="lessonId" value={l.id} />
                            <Button type="submit" variant="destructive">Excluir</Button>
                          </form>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </td>
              </tr>
            ))}
            {!withCounts.length && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-stone-500">
                  Nenhuma aula encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 6:** `npm test && npm run lint && npm run typecheck`; `git add -A && git commit -m "feat: lesson CRUD actions and admin lessons list"`

---

### Task 14: Dynamic lesson form + new/edit pages

**Files:** `src/components/admin/lesson-form.tsx`, `src/app/admin/lessons/new/page.tsx`, `src/app/admin/lessons/[id]/edit/page.tsx`

- [ ] **Step 1:** `src/components/admin/lesson-form.tsx` (client) — full file:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, ArrowUp, ArrowDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { saveLessonAction } from "@/lib/actions/lessons";

export type MaterialRow = { title: string; url: string; type: "PDF" | "LINK" | "IMAGE" | "DOCUMENT" };
export type QuestionRow = {
  questionText: string;
  questionType: "TEXT" | "MULTIPLE_CHOICE";
  options: string[];
  correctOptionIndex: number | null;
};
export type LessonFormValues = {
  title: string;
  description: string;
  date: string;
  videoUrl: string;
  thumbnailUrl: string;
  isPublished: boolean;
  materials: MaterialRow[];
  questions: QuestionRow[];
};

export function LessonForm({ lessonId, initial }: { lessonId: string | null; initial: LessonFormValues }) {
  const [v, setV] = useState(initial);
  const [pending, start] = useTransition();
  const router = useRouter();
  const set = <K extends keyof LessonFormValues>(k: K, value: LessonFormValues[K]) =>
    setV((s) => ({ ...s, [k]: value }));

  const submit = (publish?: boolean) => {
    const fd = new FormData();
    fd.set("title", v.title);
    fd.set("description", v.description);
    fd.set("date", v.date);
    fd.set("videoUrl", v.videoUrl);
    fd.set("thumbnailUrl", v.thumbnailUrl);
    fd.set("isPublished", String(publish ?? v.isPublished));
    fd.set("materialsJson", JSON.stringify(v.materials));
    fd.set("questionsJson", JSON.stringify(v.questions));
    start(async () => {
      const res = await saveLessonAction(lessonId, fd);
      if (res.ok) {
        toast.success("Aula salva!");
        router.push("/admin/lessons");
        router.refresh();
      } else toast.error(res.error ?? "Não foi possível salvar");
    });
  };

  const moveQuestion = (i: number, dir: -1 | 1) => {
    const qs = [...v.questions];
    const j = i + dir;
    if (j < 0 || j >= qs.length) return;
    [qs[i], qs[j]] = [qs[j], qs[i]];
    set("questions", qs);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="rounded-xl border border-stone-200 bg-white p-6 space-y-4">
        <h2 className="font-semibold">Aula</h2>
        <div className="space-y-1.5">
          <Label htmlFor="title">Título</Label>
          <Input id="title" value={v.title} onChange={(e) => set("title", e.target.value)} placeholder="Estudo #05 - Carta aos Romanos" />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="date">Data (terça)</Label>
            <Input id="date" type="date" value={v.date} onChange={(e) => set("date", e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer pb-2">
            <Switch checked={v.isPublished} onCheckedChange={(c) => set("isPublished", c)} />
            Publicada
          </label>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="description">Descrição (Markdown)</Label>
          <Textarea id="description" rows={6} value={v.description} onChange={(e) => set("description", e.target.value)} />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="thumbnailUrl">URL da imagem (thumbnail)</Label>
            <Input id="thumbnailUrl" value={v.thumbnailUrl} onChange={(e) => set("thumbnailUrl", e.target.value)} placeholder="https://…" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="videoUrl">URL do vídeo complementar</Label>
            <Input id="videoUrl" value={v.videoUrl} onChange={(e) => set("videoUrl", e.target.value)} placeholder="https://youtube.com/…" />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Materiais</h2>
          <Button
            size="sm"
            variant="outline"
            type="button"
            onClick={() => set("materials", [...v.materials, { title: "", url: "", type: "LINK" }])}
          >
            <Plus className="mr-1 h-4 w-4" /> Adicionar
          </Button>
        </div>
        {v.materials.length === 0 && <p className="text-sm text-stone-500">Nenhum material.</p>}
        {v.materials.map((m, i) => (
          <div key={i} className="grid sm:grid-cols-[1fr_2fr_auto_auto] gap-2 items-end">
            <Input
              placeholder="Título"
              value={m.title}
              onChange={(e) => {
                const rows = [...v.materials];
                rows[i] = { ...m, title: e.target.value };
                set("materials", rows);
              }}
            />
            <Input
              placeholder="https://…"
              value={m.url}
              onChange={(e) => {
                const rows = [...v.materials];
                rows[i] = { ...m, url: e.target.value };
                set("materials", rows);
              }}
            />
            <select
              className="h-9 rounded-md border border-stone-300 px-2 text-sm bg-white"
              value={m.type}
              onChange={(e) => {
                const rows = [...v.materials];
                rows[i] = { ...m, type: e.target.value as MaterialRow["type"] };
                set("materials", rows);
              }}
            >
              {(["PDF", "LINK", "IMAGE", "DOCUMENT"] as const).map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <Button
              size="icon"
              variant="ghost"
              type="button"
              onClick={() => set("materials", v.materials.filter((_, j) => j !== i))}
              aria-label="Remover material"
            >
              <Trash2 className="h-4 w-4 text-red-600" />
            </Button>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Perguntas</h2>
          <Button
            size="sm"
            variant="outline"
            type="button"
            onClick={() =>
              set("questions", [...v.questions, { questionText: "", questionType: "TEXT", options: [], correctOptionIndex: null }])
            }
          >
            <Plus className="mr-1 h-4 w-4" /> Adicionar
          </Button>
        </div>
        {v.questions.length === 0 && <p className="text-sm text-stone-500">Nenhuma pergunta.</p>}
        {v.questions.map((q, i) => (
          <div key={i} className="rounded-lg border border-stone-200 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-stone-500">Pergunta {i + 1}</span>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" type="button" onClick={() => moveQuestion(i, -1)} aria-label="Mover para cima">
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" type="button" onClick={() => moveQuestion(i, 1)} aria-label="Mover para baixo">
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  type="button"
                  onClick={() => set("questions", v.questions.filter((_, j) => j !== i))}
                  aria-label="Remover pergunta"
                >
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              </div>
            </div>
            <Textarea
              placeholder="Texto da pergunta"
              value={q.questionText}
              onChange={(e) => {
                const rows = [...v.questions];
                rows[i] = { ...q, questionText: e.target.value };
                set("questions", rows);
              }}
            />
            <select
              className="h-9 rounded-md border border-stone-300 px-2 text-sm bg-white"
              value={q.questionType}
              onChange={(e) => {
                const rows = [...v.questions];
                rows[i] = { ...q, questionType: e.target.value as QuestionRow["questionType"] };
                set("questions", rows);
              }}
            >
              <option value="TEXT">Resposta aberta</option>
              <option value="MULTIPLE_CHOICE">Múltipla escolha</option>
            </select>
            {q.questionType === "MULTIPLE_CHOICE" && (
              <div className="space-y-2">
                {q.options.map((opt, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`correct-${i}`}
                      className="accent-emerald-600"
                      checked={q.correctOptionIndex === oi}
                      onChange={() => {
                        const rows = [...v.questions];
                        rows[i] = { ...q, correctOptionIndex: oi };
                        set("questions", rows);
                      }}
                      aria-label={`Marcar opção ${oi + 1} como correta`}
                    />
                    <Input
                      placeholder={`Opção ${oi + 1}`}
                      value={opt}
                      onChange={(e) => {
                        const rows = [...v.questions];
                        const opts = [...q.options];
                        opts[oi] = e.target.value;
                        rows[i] = { ...q, options: opts };
                        set("questions", rows);
                      }}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      type="button"
                      aria-label="Remover opção"
                      onClick={() => {
                        const rows = [...v.questions];
                        const opts = q.options.filter((_, j) => j !== oi);
                        rows[i] = {
                          ...q,
                          options: opts,
                          correctOptionIndex:
                            q.correctOptionIndex === oi
                              ? null
                              : q.correctOptionIndex !== null && q.correctOptionIndex > oi
                                ? q.correctOptionIndex - 1
                                : q.correctOptionIndex,
                        };
                        set("questions", rows);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  onClick={() => {
                    const rows = [...v.questions];
                    rows[i] = { ...q, options: [...q.options, ""] };
                    set("questions", rows);
                  }}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> Opção
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => submit()} disabled={pending} className="bg-emerald-700 hover:bg-emerald-800">
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar
        </Button>
        <Button type="button" onClick={() => submit(true)} disabled={pending} variant="outline">
          Salvar e publicar
        </Button>
      </div>
    </div>
  );
}
```

Imports for this file: `useState, useTransition` from react; `useRouter` from next/navigation; `toast` from sonner; shadcn `Button, Input, Label, Textarea, Switch`; icons `Plus, Trash2, ArrowUp, ArrowDown, Loader2`; `saveLessonAction` from `@/lib/actions/lessons`.


- [ ] **Step 2:** `src/app/admin/lessons/new/page.tsx`:

```tsx
import { nextTuesdayISO } from "@/lib/utils/format";
import { LessonForm, LessonFormValues } from "@/components/admin/lesson-form";

const empty: LessonFormValues = {
  title: "",
  description: "",
  date: nextTuesdayISO(),
  videoUrl: "",
  thumbnailUrl: "",
  isPublished: false,
  materials: [],
  questions: [],
};

export default function NewLessonPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Nova aula</h1>
      <LessonForm lessonId={null} initial={empty} />
    </div>
  );
}
```

- [ ] **Step 3:** `src/app/admin/lessons/[id]/edit/page.tsx`: load lesson by id (404 if missing), map materials/questions rows to `LessonFormValues` (parse `options` JSON), render header `Editar aula` + `<LessonForm lessonId={id} initial={...} />`.
- [ ] **Step 4:** `npm run lint && npm run typecheck`; `git add -A && git commit -m "feat: lesson form with dynamic materials and questions"`

---

### Task 15: Responses matrix + CSV export (TDD)

**Files:** `tests/actions/responses.test.ts`, `src/lib/queries/admin.ts` (extend), `src/app/admin/lessons/[id]/responses/page.tsx`, `src/app/admin/lessons/[id]/responses/export/route.ts`, `src/components/admin/responses-table.tsx`

- [ ] **Step 1:** Failing `tests/actions/responses.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createTestDb } from "../utils/test-db";
import { getResponsesMatrix } from "@/lib/queries/admin";
import { users, lessons, questions, answers } from "@/db/schema";

async function seed(db: any) {
  const now = Date.now();
  await db.insert(users).values([
    { id: "t1", name: "Prof", email: "p@x.com", passwordHash: "x", role: "TEACHER", status: "ACTIVE", createdAt: now },
    { id: "s1", name: "Maria", email: "m@x.com", passwordHash: "x", role: "STUDENT", status: "ACTIVE", createdAt: now },
    { id: "s2", name: "João", email: "j@x.com", passwordHash: "x", role: "STUDENT", status: "ACTIVE", createdAt: now },
  ]);
  await db.insert(lessons).values({ id: "l1", title: "Aula", description: "", date: "2026-09-22", isPublished: true, createdAt: now });
  await db.insert(questions).values([
    { id: "q1", lessonId: "l1", questionText: "P1", questionType: "TEXT", position: 0 },
    { id: "q2", lessonId: "l1", questionText: "P2", questionType: "MULTIPLE_CHOICE", options: JSON.stringify(["A", "B"]), correctOptionIndex: 1, position: 1 },
  ]);
  await db.insert(answers).values([
    { id: "a1", questionId: "q1", studentId: "s1", answerText: "resp maria", submittedAt: now },
    { id: "a2", questionId: "q2", studentId: "s1", answerText: "1", submittedAt: now },
    { id: "a3", questionId: "q1", studentId: "s2", answerText: "resp joao", submittedAt: now },
  ]);
}

describe("getResponsesMatrix", () => {
  it("builds students x questions with progress", async () => {
    const db = createTestDb();
    await seed(db);
    const m = await getResponsesMatrix(db, "l1");
    expect(m.lesson.title).toBe("Aula");
    expect(m.questions).toHaveLength(2);
    expect(m.students.map((s) => s.name).sort()).toEqual(["João", "Maria"]);
    const maria = m.students.find((s) => s.name === "Maria")!;
    expect(maria.cells["q1"]).toBe("resp maria");
    expect(maria.cells["q2"]).toBe("1");
    const joao = m.students.find((s) => s.name === "João")!;
    expect(joao.cells["q1"]).toBe("resp joao");
    expect(joao.cells["q2"]).toBeUndefined();
    expect(m.answeredCount).toBe(1); // student with ALL answers
    expect(m.totalStudents).toBe(2);
  });
});
```

**Clarify `answeredCount`:** count students who answered **every** question of the lesson.

- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Append to `src/lib/queries/admin.ts`:

```ts
import { asc } from "drizzle-orm";

export async function getResponsesMatrix(db: any, lessonId: string) {
  const lessonRows = await db.select().from(lessons).where(eq(lessons.id, lessonId)).limit(1);
  if (!lessonRows.length) return null;
  const lesson = lessonRows[0];

  const qs = await db
    .select()
    .from(questions)
    .where(eq(questions.lessonId, lessonId))
    .orderBy(asc(questions.position));

  const students = await db
    .select()
    .from(users)
    .where(eq(users.role, "STUDENT"))
    .orderBy(asc(users.name));

  const ans = await db
    .select()
    .from(answers)
    .innerJoin(questions, eq(answers.questionId, questions.id))
    .where(eq(questions.lessonId, lessonId));

  const byStudent = new Map<string, { cells: Record<string, string>; maxAt: number }>();
  for (const row of ans) {
    const a = row.answers;
    const entry = byStudent.get(a.studentId) ?? { cells: {}, maxAt: 0 };
    entry.cells[a.questionId] = a.answerText;
    entry.maxAt = Math.max(entry.maxAt, a.submittedAt);
    byStudent.set(a.studentId, entry);
  }

  const rows = students.map((s: any) => {
    const entry = byStudent.get(s.id);
    return {
      id: s.id,
      name: s.name,
      email: s.email,
      cells: entry?.cells ?? {},
      lastSubmittedAt: entry?.maxAt ?? null,
    };
  });

  const answeredCount = rows.filter((r) => qs.every((q: any) => r.cells[q.id] !== undefined)).length;

  return {
    lesson,
    questions: qs.map((q: any) => ({
      id: q.id,
      questionText: q.questionText,
      questionType: q.questionType,
      optionsList: q.options ? (JSON.parse(q.options) as string[]) : [],
      correctOptionIndex: q.correctOptionIndex,
    })),
    students: rows,
    totalStudents: students.length,
    answeredCount,
  };
}
```

(Also ensure `asc` import added at top of file with existing imports.)

- [ ] **Step 4:** Run — PASS.
- [ ] **Step 5:** `src/components/admin/responses-table.tsx` (client):

```tsx
"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/utils/format";

export type Matrix = NonNullable<Awaited<ReturnType<typeof import("@/lib/queries/admin").getResponsesMatrix>>>;

export function ResponsesTable({ matrix }: { matrix: Matrix }) {
  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState<{ student: string; question: string } | null>(null);

  const rows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return matrix.students;
    return matrix.students.filter((s) => s.name.toLowerCase().includes(q));
  }, [filter, matrix.students]);

  const opened = open
    ? {
        studentName: open.student,
        question: matrix.questions.find((q) => q.id === open.question)!,
        cell: matrix.students.find((s) => s.name === open.student)?.cells[open.question],
        at: matrix.students.find((s) => s.name === open.student)?.lastSubmittedAt ?? null,
      }
    : null;

  return (
    <div className="space-y-4">
      <Input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filtrar por nome do aluno…"
        className="max-w-sm"
        aria-label="Filtrar por nome do aluno"
      />
      <div className="rounded-lg border border-stone-200 bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-left text-stone-500">
            <tr>
              <th className="p-3 font-medium sticky left-0 bg-stone-50">Aluno</th>
              {matrix.questions.map((q) => (
                <th key={q.id} className="p-3 font-medium min-w-[160px]" title={q.questionText}>
                  <span className="line-clamp-2">{q.questionText}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className="border-t border-stone-100">
                <td className="p-3 font-medium sticky left-0 bg-white">{s.name}</td>
                {matrix.questions.map((q) => {
                  const raw = s.cells[q.id];
                  const isCorrect =
                    q.questionType === "MULTIPLE_CHOICE" &&
                    q.correctOptionIndex !== null &&
                    raw !== undefined &&
                    Number(raw) === q.correctOptionIndex;
                  const display =
                    raw === undefined
                      ? "—"
                      : q.questionType === "MULTIPLE_CHOICE" && q.optionsList[Number(raw)] !== undefined
                        ? q.optionsList[Number(raw)]
                        : raw;
                  return (
                    <td key={q.id} className="p-3 align-top">
                      <button
                        type="button"
                        onClick={() => setOpen({ student: s.name, question: q.id })}
                        className="text-left hover:bg-stone-50 rounded px-1 -mx-1 max-w-[200px] line-clamp-2"
                      >
                        {display}
                        {isCorrect && <span className="ml-1 text-emerald-600">✓</span>}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={matrix.questions.length + 1} className="p-8 text-center text-stone-500">
                  Nenhum aluno encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {opened && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(null)}
        >
          <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold">{opened.studentName}</h3>
            <p className="text-sm text-stone-600">{opened.question.questionText}</p>
            <p className="text-sm whitespace-pre-wrap bg-stone-50 rounded-lg p-3">
              {opened.cell === undefined ? "(sem resposta)" : opened.cell}
            </p>
            {opened.at && (
              <p className="text-xs text-stone-500">Enviada em {formatDateTime(opened.at)}</p>
            )}
            <button className="text-sm text-emerald-700 font-medium" onClick={() => setOpen(null)}>
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6:** `src/app/admin/lessons/[id]/responses/page.tsx`:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { getDb } from "@/db";
import { getResponsesMatrix } from "@/lib/queries/admin";
import { formatDate } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { ResponsesTable } from "@/components/admin/responses-table";

export default async function ResponsesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const matrix = await getResponsesMatrix(getDb(), id);
  if (!matrix) notFound();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{matrix.lesson.title}</h1>
          <p className="text-sm text-stone-500">
            {formatDate(matrix.lesson.date)} · {matrix.answeredCount} de {matrix.totalStudents} alunos responderam
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <a href={`/admin/lessons/${id}/responses/export`}>
              <Download className="mr-2 h-4 w-4" /> Exportar CSV
            </a>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/admin/lessons/${id}/edit`}>Editar aula</Link>
          </Button>
        </div>
      </div>
      <ResponsesTable matrix={matrix} />
    </div>
  );
}
```

- [ ] **Step 7:** `src/app/admin/lessons/[id]/responses/export/route.ts`:

```ts
import { getDb } from "@/db";
import { getResponsesMatrix } from "@/lib/queries/admin";
import { buildResponsesCsv } from "@/lib/utils/csv";
import { getCurrentSession } from "@/lib/actions/auth";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentSession();
  if (!session || session.role !== "TEACHER" || session.status !== "ACTIVE") {
    return new Response("Acesso restrito", { status: 403 });
  }
  const { id } = await params;
  const matrix = await getResponsesMatrix(getDb(), id);
  if (!matrix) return new Response("Não encontrada", { status: 404 });

  const csv = buildResponsesCsv({
    questions: matrix.questions.map((q) => ({ id: q.id, questionText: q.questionText })),
    rows: matrix.students
      .filter((s) => Object.keys(s.cells).length > 0)
      .map((s) => ({
        studentName: s.name,
        submittedAt: s.lastSubmittedAt ?? 0,
        cells: s.cells,
      })),
  });

  const filename = `respostas-${matrix.lesson.title.replace(/[^\wÀ-ÿ -]/g, "").trim().replace(/\s+/g, "-").toLowerCase()}.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
```

- [ ] **Step 8:** `npm test && npm run lint && npm run typecheck`; `git add -A && git commit -m "feat: responses matrix with CSV export"`

---

### Task 16: Student management (TDD)

**Files:** `tests/actions/students.test.ts`, `src/lib/actions/students.ts`, `src/app/admin/students/page.tsx`, `src/components/admin/students-table.tsx`

- [ ] **Step 1:** Failing `tests/actions/students.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "../utils/test-db";
import { updateStudentStatus } from "@/lib/actions/students";
import { users } from "@/db/schema";

async function seed(db: any) {
  const now = Date.now();
  await db.insert(users).values([
    { id: "t1", name: "Prof", email: "p@x.com", passwordHash: "x", role: "TEACHER", status: "ACTIVE", createdAt: now },
    { id: "s1", name: "Maria", email: "m@x.com", passwordHash: "x", role: "STUDENT", status: "PENDING", createdAt: now },
    { id: "s2", name: "João", email: "j@x.com", passwordHash: "x", role: "STUDENT", status: "ACTIVE", createdAt: now },
  ]);
}

describe("updateStudentStatus", () => {
  it("approves PENDING → ACTIVE", async () => {
    const db = createTestDb();
    await seed(db);
    const r = await updateStudentStatus(db, { userId: "s1", action: "APPROVE" }, "t1");
    expect(r.ok).toBe(true);
    const rows = await db.select().from(users).where(eq(users.id, "s1"));
    expect(rows[0].status).toBe("ACTIVE");
  });
  it("suspends and reactivates", async () => {
    const db = createTestDb();
    await seed(db);
    await updateStudentStatus(db, { userId: "s2", action: "SUSPEND" }, "t1");
    let rows = await db.select().from(users).where(eq(users.id, "s2"));
    expect(rows[0].status).toBe("SUSPENDED");
    await updateStudentStatus(db, { userId: "s2", action: "REACTIVATE" }, "t1");
    rows = await db.select().from(users).where(eq(users.id, "s2"));
    expect(rows[0].status).toBe("ACTIVE");
  });
  it("promotes to TEACHER", async () => {
    const db = createTestDb();
    await seed(db);
    const r = await updateStudentStatus(db, { userId: "s2", action: "PROMOTE" }, "t1");
    expect(r.ok).toBe(true);
    const rows = await db.select().from(users).where(eq(users.id, "s2"));
    expect(rows[0].role).toBe("TEACHER");
  });
  it("cannot act on self", async () => {
    const db = createTestDb();
    await seed(db);
    const r = await updateStudentStatus(db, { userId: "t1", action: "SUSPEND" }, "t1");
    expect(r.ok).toBe(false);
  });
  it("cannot suspend the last active teacher (non-self actor)", async () => {
    const db = createTestDb();
    const now = Date.now();
    await db.insert(users).values([
      { id: "t1", name: "P", email: "p@x.com", passwordHash: "x", role: "TEACHER", status: "ACTIVE", createdAt: now },
      { id: "s8", name: "Other", email: "o@x.com", passwordHash: "x", role: "TEACHER", status: "PENDING", createdAt: now },
    ]);
    // actor s8 ≠ t1, but t1 is the only ACTIVE teacher → block
    const r = await updateStudentStatus(db, { userId: "t1", action: "SUSPEND" }, "s8");
    expect(r.ok).toBe(false);
  });
  it("allows suspending one of two active teachers", async () => {
    const db = createTestDb();
    const now = Date.now();
    await db.insert(users).values([
      { id: "t1", name: "P1", email: "p1@x.com", passwordHash: "x", role: "TEACHER", status: "ACTIVE", createdAt: now },
      { id: "t2", name: "P2", email: "p2@x.com", passwordHash: "x", role: "TEACHER", status: "ACTIVE", createdAt: now },
    ]);
    const r = await updateStudentStatus(db, { userId: "t2", action: "SUSPEND" }, "t1");
    expect(r.ok).toBe(true);
  });
});
```

- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** `src/lib/actions/students.ts`:

```ts
import { and, eq, sql } from "drizzle-orm";
import { users } from "@/db/schema";
import { studentStatusSchema } from "@/lib/validation/schemas";
import { getDb } from "@/db";
import { getCurrentSession } from "@/lib/actions/auth";
import { revalidatePath } from "next/cache";

export type Result = { ok: boolean; error?: string };

export async function updateStudentStatus(db: any, rawInput: unknown, actorId: string): Promise<Result> {
  const parsed = studentStatusSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { userId, action } = parsed.data;

  if (userId === actorId) return { ok: false, error: "Você não pode executar essa ação em si mesmo." };

  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!rows.length) return { ok: false, error: "Usuário não encontrado" };
  const target = rows[0];

  if (action === "APPROVE") {
    await db.update(users).set({ status: "ACTIVE" }).where(eq(users.id, userId));
  } else if (action === "SUSPEND") {
    if (target.role === "TEACHER") {
      const others = await db
        .select({ c: sql<number>`count(*)` })
        .from(users)
        .where(and(eq(users.role, "TEACHER"), eq(users.status, "ACTIVE"), sql`${users.id} != ${userId}`));
      if (Number(others[0].c) === 0) {
        return { ok: false, error: "Deve existir pelo menos um professor ativo." };
      }
    }
    await db.update(users).set({ status: "SUSPENDED" }).where(eq(users.id, userId));
  } else if (action === "REACTIVATE") {
    await db.update(users).set({ status: "ACTIVE" }).where(eq(users.id, userId));
  } else if (action === "PROMOTE") {
    await db.update(users).set({ role: "TEACHER", status: "ACTIVE" }).where(eq(users.id, userId));
  }
  return { ok: true };
}

export async function updateStudentAction(rawInput: unknown): Promise<Result> {
  const session = await getCurrentSession();
  if (!session || session.role !== "TEACHER" || session.status !== "ACTIVE") {
    return { ok: false, error: "Acesso restrito" };
  }
  const result = await updateStudentStatus(getDb(), rawInput, session.sub);
  if (result.ok) revalidatePath("/admin/students");
  return result;
}
```

- [ ] **Step 4:** Run — PASS.
- [ ] **Step 5:** `src/app/admin/students/page.tsx`: server page loads all users ordered by name, passes to `<UsersTable users={...} />`. `src/components/admin/students-table.tsx` (client):
  - Filter select by status (Todos/Pendentes/Ativos/Suspensos) + text search by name.
  - Row: name, email, role badge, status badge, created date formatted.
  - Actions call `updateStudentAction({ userId, action })` in `useTransition`; success → `toast.success` + `router.refresh()`; error → `toast.error`.
  - PROMOTE wrapped in confirm dialog (`window.confirm("Promover a professor?")` acceptable for v1 or shadcn Dialog).

- [ ] **Step 6:** `npm test && npm run lint && npm run typecheck`; `git add -A && git commit -m "feat: student approve/suspend/promote admin"`

---

### Task 17: Seed script + final verification

**Files:** `src/db/seed.ts`

- [ ] **Step 0:** `npm i -D fast-glob` (used by seed).
- [ ] **Step 1:** `src/db/seed.ts`:

```ts
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import fg from "fast-glob";
import fs from "node:fs";
import { users, lessons, materials, questions } from "./schema";
import { hashPassword } from "../lib/auth/password";

const email = process.env.SEED_TEACHER_EMAIL || "professor@igreja.com";
const password = process.env.SEED_TEACHER_PASSWORD || "Troque@123";

async function findLocalD1(): Promise<string> {
  const matches = await fg(".wrangler/state/v3/d1/**/*D1DatabaseObject/*.sqlite");
  if (!matches.length) {
    console.error("Nenhum D1 local encontrado. Rode `npm run db:migrate:local` antes.");
    process.exit(1);
  }
  matches.sort((a, b) => (fs.statSync(b).mtimeMs || 0) - (fs.statSync(a).mtimeMs || 0));
  return matches[0];
}

async function main() {
  const file = findLocalD1();
  console.log("DB local:", file);
  const sqlite = new Database(file);
  const db = drizzle(sqlite);

  const existing = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
  if (existing.length) {
    console.log("Professor já existe:", email);
  } else {
    await db.insert(users).values({
      id: crypto.randomUUID(),
      name: "Professor",
      email: email.toLowerCase(),
      passwordHash: await hashPassword(password),
      role: "TEACHER",
      status: "ACTIVE",
      createdAt: Date.now(),
    });
    console.log("Professor criado:", email);
  }

  const lessonCount = await db.select().from(lessons);
  if (lessonCount.length === 0) {
    const now = Date.now();
    const demo = [
      { n: 1, title: "Estudo #01 — Introdução ao grupo", date: "2026-09-08", thumb: "" },
      { n: 2, title: "Estudo #02 — O Bom Samaritano", date: "2026-09-15", thumb: "" },
      { n: 3, title: "Estudo #03 — Carta aos Romanos", date: "2026-09-22", thumb: "" },
    ];
    for (const d of demo) {
      const lessonId = crypto.randomUUID();
      await db.insert(lessons).values({
        id: lessonId,
        title: d.title,
        description: `Descrição do estudo #${d.n} da terça.`,
        date: d.date,
        videoUrl: d.n === 3 ? "https://www.youtube.com/watch?v=dQw4w9WgXcQ" : null,
        thumbnailUrl: d.thumb || null,
        isPublished: true,
        createdAt: now,
      });
      await db.insert(materials).values({
        id: crypto.randomUUID(),
        lessonId,
        title: "PDF de apoio",
        url: "https://example.com/apoio.pdf",
        type: "PDF",
      });
      await db.insert(questions).values([
        {
          id: crypto.randomUUID(),
          lessonId,
          questionText: "Qual o principal ensinamento deste estudo?",
          questionType: "TEXT",
          position: 0,
        },
        {
          id: crypto.randomUUID(),
          lessonId,
          questionText: "Como aplicar o conteúdo na prática?",
          questionType: "MULTIPLE_CHOICE",
          options: JSON.stringify(["Leitura diária", "Grupo pequeno", "Oração", "Todas acima"]),
          correctOptionIndex: 3,
          position: 1,
        },
      ]);
    }
    console.log("3 aulas demo criadas.");
  }
  console.log("Seed concluído.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2:** Manual verification (local):

```bash
npm run db:migrate:local
npm run db:seed
npm run dev
```

Checklist in browser:
- `/register` creates account → pending screen.
- Seed teacher login → `/admin` metrics visible.
- Approve student in `/admin/students` → student sees showcase.
- Create lesson with material + questions → publish → appears on `/dashboard`.
- Answer questionnaire → badge `✓ Respondida`; edit → new timestamp.
- Responses matrix + CSV download.
- Student cannot open `/admin` (redirect).

- [ ] **Step 3:** Full gate:

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

All must pass.

- [ ] **Step 4:** `git add -A && git commit -m "feat: seed script and final verification"`

---

## Production deploy checklist (post-plan)

1. `npx wrangler login`
2. `npx wrangler d1 create zion_class` → update `database_id` in `wrangler.jsonc`
3. Set secrets: `SESSION_SECRET`, `SEED_TEACHER_EMAIL`, `SEED_TEACHER_PASSWORD` via `npx wrangler secret put SESSION_SECRET`
4. `npm run db:migrate:remote` then run seed against remote D1 (or insert teacher SQL via `wrangler d1 execute --remote`)
5. Cloudflare Pages: build `npm run build`, output via OpenNext worker; or `npm run deploy`
6. Configure custom domain + force HTTPS (default)

---

## Spec coverage map

| Spec section | Tasks |
|---|---|
| Auth register/login/cookies/JWT | 3, 4, 5, 8, 9 |
| Middleware + action guards (admin/student/status) | 5, 12, 13, 15, 16 |
| Schema users/lessons/materials/questions/answers | 2 |
| Netflix showcase + search + badges + thumbnail | 10 |
| Lesson page: MD, video embed/fallback, materials, questionnaire, edit answers | 11 |
| Admin overview metrics | 12 |
| Admin lessons CRUD + publish + materials/questions form | 13, 14 |
| Responses matrix + filter + sheet + CSV | 15 |
| Students approve/suspend/promote + self/last-teacher rules | 16 |
| Seed teacher + demo lessons | 17 |
| pt-BR UX, toasts, empty states | 8–16 (toasts everywhere) |
| Tests Vitest unit/integration | Tasks 3–8, 11, 13, 15, 16 |
| Cloudflare deploy | Task 2 + checklist |

