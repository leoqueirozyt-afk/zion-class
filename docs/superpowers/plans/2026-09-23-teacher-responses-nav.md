# Teacher Responses Nav Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Respostas tab to the teacher menu that indexes lessons with response counts, and fix the overview card so one student·lesson appears once.

**Architecture:** Server-only Next.js routes under `/admin`; one new Drizzle aggregate query `getLessonsWithResponseCounts`; `getAdminMetrics.recent` groups by `(studentId, lessonId)` with `max(submittedAt)`; nav item reuses the existing layout map.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind, shadcn/ui, lucide-react, Drizzle ORM, Vitest + better-sqlite3 in-memory (`createTestDb`).

**Spec:** `docs/superpowers/specs/2026-09-23-teacher-responses-nav-design.md`

**Conventions:** text UUID PKs; epoch-ms ints; pt-BR hardcoded; tests under `tests/actions/**` use `createTestDb` (node project); no new D1 migrations.

---

## File Structure

```
Modify: src/lib/queries/admin.ts          — types + getLessonsWithResponseCounts + group recent
Modify: src/app/admin/layout.tsx          — nav item Respostas
Create: src/app/admin/responses/page.tsx  — index por aulas
Modify: tests/actions/responses.test.ts   — tests for new query + recent grouping
```

No UI change required on `src/app/admin/page.tsx` beyond what already maps `m.recent`.

---

### Task 1: Query — lessons with response counts (TDD)

**Files:**
- Modify: `src/lib/queries/admin.ts`
- Test: `tests/actions/responses.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/actions/responses.test.ts` (keep existing `seed` and matrix test):

```ts
import { getLessonsWithResponseCounts, getAdminMetrics } from "@/lib/queries/admin";

describe("getLessonsWithResponseCounts", () => {
  it("lists only lessons with answers, distinct students, active total", async () => {
    const db = createTestDb();
    await seed(db);
    await db.insert(lessons).values({
      id: "l-empty", title: "Sem respostas", description: "", date: "2026-01-01",
      isPublished: true, createdAt: Date.now(),
    });
    const rows = await getLessonsWithResponseCounts(db);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: "l1",
      title: "Aula",
      answeredCount: 2,
      totalActiveStudents: 2,
    });
    expect(rows[0].lastSubmittedAt).toBeTypeOf("number");
  });
});

describe("getAdminMetrics recent", () => {
  it("returns one row per student·lesson (not per question)", async () => {
    const db = createTestDb();
    await seed(db);
    const m = await getAdminMetrics(db);
    expect(m.recent).toHaveLength(2);
    const keys = m.recent.map(
      (r: { studentName: string; lessonId: string }) => `${r.studentName}:${r.lessonId}`
    );
    expect(new Set(keys).size).toBe(keys.length);
    const maria = m.recent.find((r: { studentName: string }) => r.studentName === "Maria");
    expect(maria.lessonId).toBe("l1");
    expect(maria.submittedAt).toBeTypeOf("number");
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npm test` from project root  
Expected: FAIL — `getLessonsWithResponseCounts` not exported / recent still has 3 rows for Maria·l1 (q1+q2) + João → length 3, not 2.

- [ ] **Step 3: Implement `getLessonsWithResponseCounts`**

In `src/lib/queries/admin.ts`, after `getResponsesMatrix`, add:

```ts
import { and, asc, desc, eq, sql } from "drizzle-orm";

export type LessonResponseCount = {
  id: string;
  title: string;
  date: string;
  answeredCount: number;
  totalActiveStudents: number;
  lastSubmittedAt: number | null;
};

export async function getLessonsWithResponseCounts(
  db: any
): Promise<LessonResponseCount[]> {
  const stats = await db
    .select({
      id: lessons.id,
      title: lessons.title,
      date: lessons.date,
      answeredCount: sql<number>`count(distinct ${answers.studentId})`,
      lastSubmittedAt: sql<number | null>`max(${answers.submittedAt})`,
    })
    .from(lessons)
    .innerJoin(questions, eq(questions.lessonId, lessons.id))
    .innerJoin(answers, eq(answers.questionId, questions.id))
    .groupBy(lessons.id, lessons.title, lessons.date)
    .orderBy(desc(lessons.date));

  const total = await db
    .select({ c: sql<number>`count(*)` })
    .from(users)
    .where(and(eq(users.role, "STUDENT"), eq(users.status, "ACTIVE")));
  const totalActiveStudents = Number(total[0].c);

  return stats.map((r: any) => ({
    id: r.id,
    title: r.title,
    date: r.date,
    answeredCount: Number(r.answeredCount),
    totalActiveStudents,
    lastSubmittedAt: r.lastSubmittedAt == null ? null : Number(r.lastSubmittedAt),
  }));
}
```

(Adjust the existing `import` line if `and` is missing.)

- [ ] **Step 4: Run only this describe — expect PASS**

Run: `npx vitest run tests/actions/responses.test.ts`  
Expected: PASS for `getLessonsWithResponseCounts`; FAIL still for recent grouping (Task 2).

- [ ] **Step 5: Commit**

```bash
git add src/lib/queries/admin.ts tests/actions/responses.test.ts
git commit -m "feat: getLessonsWithResponseCounts for responses index"
```

---

### Task 2: Fix `getAdminMetrics.recent` grouping (TDD)

**Files:**
- Modify: `src/lib/queries/admin.ts` (`getAdminMetrics`, recent block only)
- Test: `tests/actions/responses.test.ts` (test already added in Task 1)

- [ ] **Step 1: Confirm failing test**

Run: `npx vitest run tests/actions/responses.test.ts`  
Expected: FAIL — `expect(m.recent).toHaveLength(2)` received `3` (Maria appears for q1 and q2).

- [ ] **Step 2: Replace the `recent` query**

In `getAdminMetrics`, replace the `const recent = await db...limit(5)` block with:

```ts
  const recent = await db
    .select({
      submittedAt: sql<number>`max(${answers.submittedAt})`,
      studentId: answers.studentId,
      studentName: users.name,
      lessonId: lessons.id,
      lessonTitle: lessons.title,
    })
    .from(answers)
    .innerJoin(users, eq(answers.studentId, users.id))
    .innerJoin(questions, eq(answers.questionId, questions.id))
    .innerJoin(lessons, eq(questions.lessonId, lessons.id))
    .groupBy(answers.studentId, users.name, lessons.id, lessons.title)
    .orderBy(desc(sql<number>`max(${answers.submittedAt})`))
    .limit(5);
```

`recent` items now expose `studentId` (harmless for UI) and `submittedAt` = max per group. `src/app/admin/page.tsx` needs no change.

- [ ] **Step 3: Run file — expect PASS**

Run: `npx vitest run tests/actions/responses.test.ts`  
Expected: PASS (matrix + counts + recent).

- [ ] **Step 4: Commit**

```bash
git add src/lib/queries/admin.ts tests/actions/responses.test.ts
git commit -m "fix: group overview recent by student and lesson"
```

---

### Task 3: Nav item + `/admin/responses` index page

**Files:**
- Modify: `src/app/admin/layout.tsx`
- Create: `src/app/admin/responses/page.tsx`

- [ ] **Step 1: Add nav item**

`src/app/admin/layout.tsx` — import `MessageSquare` from `lucide-react` and insert after Aulas:

```ts
const nav = [
  { href: "/admin", label: "Visão geral", icon: LayoutDashboard },
  { href: "/admin/lessons", label: "Aulas", icon: BookOpen },
  { href: "/admin/responses", label: "Respostas", icon: MessageSquare },
  { href: "/admin/students", label: "Alunos", icon: Users },
];
```

- [ ] **Step 2: Create index page**

Create `src/app/admin/responses/page.tsx`:

```tsx
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { getDb } from "@/db";
import { getLessonsWithResponseCounts } from "@/lib/queries/admin";
import { formatDate, formatDateTime } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";

export default async function AdminResponsesIndexPage() {
  const rows = await getLessonsWithResponseCounts(getDb());

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Respostas</h1>
        <p className="text-sm text-stone-500">
          {rows.length} aula(s) com respostas
        </p>
      </div>

      {rows.length === 0 && (
        <p className="text-sm text-stone-500">Nenhuma resposta ainda.</p>
      )}

      {rows.length > 0 && (
        <div className="rounded-lg border border-stone-200 bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-stone-500 text-left">
              <tr>
                <th className="p-3 font-medium">Aula</th>
                <th className="p-3 font-medium">Data</th>
                <th className="p-3 font-medium">Responderam</th>
                <th className="p-3 font-medium">Último envio</th>
                <th className="p-3 font-medium text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr
                  key={l.id}
                  className="border-t border-stone-100 hover:bg-stone-50"
                >
                  <td className="p-3 font-medium">
                    <Link
                      href={`/admin/lessons/${l.id}/responses`}
                      className="hover:underline"
                    >
                      {l.title}
                    </Link>
                  </td>
                  <td className="p-3 whitespace-nowrap">{formatDate(l.date)}</td>
                  <td className="p-3 whitespace-nowrap">
                    {l.answeredCount} de {l.totalActiveStudents} alunos
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    {l.lastSubmittedAt
                      ? formatDateTime(l.lastSubmittedAt)
                      : "—"}
                  </td>
                  <td className="p-3 text-right">
                    <Button asChild size="sm" variant="ghost">
                      <Link
                        href={`/admin/lessons/${l.id}/responses`}
                        aria-label="Ver respostas"
                      >
                        <MessageSquare className="h-4 w-4" />
                        <span className="ml-1">Ver</span>
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`  
Expected: no errors.

- [ ] **Step 4: Full verification**

Run: `npm test && npm run lint`  
Expected: all green (72+ tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/layout.tsx src/app/admin/responses/page.tsx
git commit -m "feat: Respostas tab with lessons response index"
```

---

### Task 4: Deploy + production smoke

**Files:** none (ops only)

- [ ] **Step 1: Deploy**

Run: `npm run deploy`  
Expected: `https://zion-class.leoqueirozyt.workers.dev` deployed.

- [ ] **Step 2: Smoke with teacher JWT**

Use `zion_session` from `C:/Users/Raptor/AppData/Local/Temp/opencode/tokens.json` (field `teacher`). Run `node` script (project cwd) asserting:

| Check | Expect |
|--------|--------|
| `GET /admin` | 200; card “Últimas respostas”; **no** duplicate student name twice in that card |
| `GET /admin/responses` | 200; contains `Respostas` and `de` `alunos`; link to `/admin/lessons/seed-lesson-0001/responses` if seed has answers |
| `GET /admin/lessons/seed-lesson-0001/responses` | 200 (matriz inalterada) |

- [ ] **Step 3: Optional push**

If the user wants the remote in sync:

```bash
git push origin master
```

---

## Self-review notes

- Spec coverage: nav ✓, index page ✓, counts X de Y ✓, filter >0 via INNER JOIN ✓, recent grouped ✓, tests via `createTestDb` ✓, deploy/smoke ✓.
- No TBD/placeholders.
- Types: `LessonResponseCount` used by page; `recent` keeps `lessonId`/`submittedAt` for existing overview map.
