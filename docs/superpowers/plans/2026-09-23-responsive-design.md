# Responsive Mobile-First UI Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every Zion Class screen usable at 360px Mobile-First with Tailwind: fixed headers with working logout, hamburger Sheet for admin mobile nav, cards instead of tables on mobile, ≥44px touch targets, no horizontal overflow — without regressing desktop sidebar/grids.

**Architecture:** Shared shell components (`MobileNav` with Radix Sheet, `ResponsiveTable` card/table switch) used by admin + tables; targeted class updates on auth, dashboard, forms, and pending/suspended. Desktop (`md:`) keeps existing sidebar and layouts.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind v4, shadcn/ui (`sheet`, `dialog`, `table`, `button`, `input`, `badge`), lucide-react, Vitest + jsdom + Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-23-responsive-design.md`

**Conventions:** pt-BR UI strings; `logoutAction` from `@/lib/actions/auth`; client components `"use client"`; TDD RED→GREEN for shell components; frequent commits; run `npm run lint && npm run typecheck && npm run test` before each commit when code changes.

---

## File Structure

```
Create: src/components/shell/mobile-nav.tsx       — hamburger + Sheet nav (admin mobile)
Create: src/components/shell/responsive-table.tsx — cards md:hidden + table hidden md:block
Create: tests/components/mobile-nav.test.tsx
Create: tests/components/responsive-table.test.tsx
Modify: src/app/layout.tsx                        — overflow-x-hidden on body
Modify: src/app/admin/layout.tsx                  — mobile header uses MobileNav; drop inline links
Modify: src/app/dashboard/layout.tsx              — h-11 touch targets on Sair/Início
Modify: src/app/(auth)/login/page.tsx             — max-w-md wrapper
Modify: src/app/(auth)/register/page.tsx          — max-w-md wrapper
Modify: src/components/auth/auth-form.tsx         — p-4 sm:p-6, submit h-12 w-full
Modify: src/app/dashboard/pending/page.tsx        — px-4, CTA h-11
Modify: src/app/dashboard/suspended/page.tsx      — px-4, CTA h-11
Modify: src/components/dashboard/attendance-confirm.tsx — flex-col gap-3 md:flex-row, h-12
Modify: src/components/dashboard/question-form.tsx     — submit h-12 w-full md:w-auto
Modify: src/components/admin/attendance-panel.tsx      — controls stack; table → ResponsiveTable
Modify: src/components/admin/students-table.tsx        — table → ResponsiveTable
Modify: src/components/admin/responses-table.tsx       — matrix → card list + table (ResponsiveTable pattern)
Modify: src/app/admin/lessons/page.tsx                 — lessons list → ResponsiveTable
Modify: src/app/admin/responses/page.tsx               — index list → ResponsiveTable
Modify: src/components/admin/lesson-form.tsx           — h-12 inputs, footer buttons full-width mobile
Modify: src/app/dashboard/lessons/[id]/page.tsx        — minor typography if needed (optional)
```

---

### Task 1: Global overflow guard

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Add `overflow-x-hidden` to body**

In `src/app/layout.tsx` change body className:

```tsx
<body className="min-h-full flex flex-col overflow-x-hidden bg-stone-50 text-stone-900">
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "fix: block horizontal overflow on root body"
```

---

### Task 2: ResponsiveTable — RED

**Files:**
- Create: `src/components/shell/responsive-table.tsx` (stub after test)
- Test: `tests/components/responsive-table.test.tsx`

- [ ] **Step 1: Write failing test**

Create `tests/components/responsive-table.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ResponsiveTable } from "@/components/shell/responsive-table";

type Row = { id: string; name: string };

const columns = [
  { key: "name", header: "Nome" },
  { key: "actions", header: "Ações" },
];

const rows: Row[] = [{ id: "1", name: "Ana" }];

describe("ResponsiveTable", () => {
  it("renders mobile cards with renderMobile", () => {
    render(
      <ResponsiveTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        renderMobile={(r) => <div data-testid="mobile-card">{r.name}</div>}
      />
    );
    expect(screen.getByTestId("mobile-card")).toHaveTextContent("Ana");
  });

  it("renders desktop table headers and cell values", () => {
    render(
      <ResponsiveTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        renderMobile={(r) => <div>{r.name}</div>}
      />
    );
    expect(screen.getByText("Nome")).toBeInTheDocument();
    expect(screen.getAllByText("Ana").length).toBeGreaterThanOrEqual(1);
  });

  it("shows emptyState when rows empty", () => {
    render(
      <ResponsiveTable
        columns={columns}
        rows={[]}
        rowKey={(r) => r.id}
        renderMobile={() => null}
        emptyState={<p>Nenhum registro.</p>}
      />
    );
    expect(screen.getByText("Nenhum registro.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/components/responsive-table.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Commit test only**

```bash
git add tests/components/responsive-table.test.tsx
git commit -m "test: add ResponsiveTable failing tests"
```

---

### Task 3: ResponsiveTable — GREEN

**Files:**
- Create: `src/components/shell/responsive-table.tsx`

- [ ] **Step 1: Implement component**

```tsx
import * as React from "react";

export type ResponsiveTableColumn = {
  key: string;
  header: string;
  className?: string;
};

export function ResponsiveTable<T>({
  columns,
  rows,
  rowKey,
  renderMobile,
  emptyState,
  className,
}: {
  columns: ResponsiveTableColumn[];
  rows: T[];
  rowKey: (row: T) => string;
  renderMobile: (row: T) => React.ReactNode;
  emptyState?: React.ReactNode;
  className?: string;
}) {
  const empty = rows.length === 0;

  return (
    <div className={className}>
      <ul
        data-testid="responsive-mobile-list"
        className="md:hidden space-y-3"
      >
        {empty
          ? emptyState
          : rows.map((row) => (
              <li key={rowKey(row)} className="rounded-lg border border-stone-200 bg-white p-3">
                {renderMobile(row)}
              </li>
            ))}
      </ul>

      <div
        data-testid="responsive-desktop-table"
        className="hidden md:block overflow-x-auto rounded-lg border border-stone-200 bg-white"
      >
        {empty ? (
          emptyState
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-stone-500 text-left">
              <tr>
                {columns.map((c) => (
                  <th key={c.key} className={`p-3 font-medium ${c.className ?? ""}`}>
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={rowKey(row)} className="border-t border-stone-100">
                  <td className="p-3">{renderMobile(row)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
```

**Important design note:** This generic shell puts the **same** `renderMobile` content only in cards; desktop table cells are **not** filled by `renderMobile` alone for multi-column data. For multi-column desktop rows, callers pass a second renderer OR we extend API:

Revised API (use this — multi-column desktop):

```tsx
export function ResponsiveTable<T>({
  columns,
  rows,
  rowKey,
  renderMobile,
  renderDesktopRow,
  emptyState,
  className,
}: {
  columns: ResponsiveTableColumn[];
  rows: T[];
  rowKey: (row: T) => string;
  renderMobile: (row: T) => React.ReactNode;
  renderDesktopRow: (row: T) => React.ReactNode; // <tr> fragment of <td>s
  emptyState?: React.ReactNode;
  className?: string;
}) {
  const empty = rows.length === 0;
  return (
    <div className={className}>
      <ul data-testid="responsive-mobile-list" className="md:hidden space-y-3">
        {empty
          ? emptyState
          : rows.map((row) => (
              <li
                key={rowKey(row)}
                className="rounded-lg border border-stone-200 bg-white p-3"
              >
                {renderMobile(row)}
              </li>
            ))}
      </ul>
      <div
        data-testid="responsive-desktop-table"
        className="hidden md:block overflow-x-auto rounded-lg border border-stone-200 bg-white"
      >
        {empty ? (
          emptyState
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-stone-500 text-left">
              <tr>
                {columns.map((c) => (
                  <th
                    key={c.key}
                    className={`p-3 font-medium ${c.className ?? ""}`}
                  >
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={rowKey(row)} className="border-t border-stone-100">
                  {renderDesktopRow(row)}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
```

**Update Task 2 test** to include `renderDesktopRow={(r) => <td className="p-3">{r.name}</td>}` on each `ResponsiveTable` usage (and keep `renderMobile`).

- [ ] **Step 2: Run tests**

Run: `npm run test -- tests/components/responsive-table.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 3: Commit**

```bash
git add src/components/shell/responsive-table.tsx tests/components/responsive-table.test.tsx
git commit -m "feat: add ResponsiveTable shell (cards mobile / table desktop)"
```

---

### Task 4: MobileNav — RED

**Files:**
- Create: `tests/components/mobile-nav.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MobileNav } from "@/components/shell/mobile-nav";

const links = [
  { href: "/admin", label: "Visão geral" },
  { href: "/admin/lessons", label: "Aulas" },
];

describe("MobileNav", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("hamburger opens sheet with links and Sair", async () => {
    const user = userEvent.setup();
    render(<MobileNav links={links} user={{ name: "Ana" }} />);
    const trigger = screen.getByRole("button", { name: /abrir menu/i });
    await user.click(trigger);
    await waitFor(() => {
      expect(screen.getByText("Visão geral")).toBeInTheDocument();
      expect(screen.getByText("Aulas")).toBeInTheDocument();
      expect(screen.getByText("Sair")).toBeInTheDocument();
      expect(screen.getByText("Ana")).toBeInTheDocument();
    });
  });

  it("does not render hamburger inside md (uses md:hidden wrapper)", () => {
    const { container } = render(<MobileNav links={links} />);
    const wrapper = container.firstElementChild;
    expect(wrapper?.className).toContain("md:hidden");
  });

  it("hides Sair when showLogout=false", async () => {
    const user = userEvent.setup();
    render(<MobileNav links={links} showLogout={false} />);
    await user.click(screen.getByRole("button", { name: /abrir menu/i }));
    await waitFor(() => {
      expect(screen.queryByText("Sair")).not.toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/components/mobile-nav.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Commit test**

```bash
git add tests/components/mobile-nav.test.tsx
git commit -m "test: add MobileNav failing tests"
```

---

### Task 5: MobileNav — GREEN

**Files:**
- Create: `src/components/shell/mobile-nav.tsx`

- [ ] **Step 1: Implement component**

```tsx
"use client";

import Link from "next/link";
import { Menu, LogOut } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { logoutAction } from "@/lib/actions/auth";

export type NavItem = {
  href: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
};

export function MobileNav({
  links,
  user,
  showLogout = true,
  title = "Menu",
}: {
  links: NavItem[];
  user?: { name?: string; role?: string };
  showLogout?: boolean;
  title?: string;
}) {
  return (
    <div className="md:hidden">
      <Sheet>
        <SheetTrigger asChild>
          <button
            type="button"
            aria-label="Abrir menu"
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-stone-700 hover:bg-stone-100"
          >
            <Menu className="h-5 w-5" />
          </button>
        </SheetTrigger>
        <SheetContent side="right" className="w-3/4 sm:max-w-sm">
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
          </SheetHeader>
          <nav className="flex flex-col gap-1 px-4">
            {links.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex h-12 items-center gap-2 rounded-lg px-3 text-sm text-stone-700 hover:bg-stone-100"
              >
                {item.icon && <item.icon className="h-4 w-4" />}
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-auto border-t border-stone-200 p-4 space-y-3">
            {user?.name && (
              <p className="text-sm text-stone-600 truncate">
                {user.name}
                {user.role ? ` · ${user.role}` : ""}
              </p>
            )}
            {showLogout && (
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="flex h-12 w-full items-center gap-2 rounded-lg px-3 text-sm text-stone-700 hover:bg-stone-100"
                >
                  <LogOut className="h-4 w-4" /> Sair
                </button>
              </form>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
```

- [ ] **Step 2: Run tests**

Run: `npm run test -- tests/components/mobile-nav.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 3: Run full suite + typecheck**

Run: `npm run test && npm run typecheck`
Expected: all green

- [ ] **Step 4: Commit**

```bash
git add src/components/shell/mobile-nav.tsx tests/components/mobile-nav.test.tsx
git commit -m "feat: add MobileNav hamburger sheet with logout"
```

---

### Task 6: Admin layout — mobile header fix

**Files:**
- Modify: `src/app/admin/layout.tsx`

- [ ] **Step 1: Replace broken mobile header**

Keep sidebar as-is. Replace the `md:hidden` header block with logo + `MobileNav`.

Full file after edit:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  Users,
  MessageSquare,
  LogOut,
} from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { getCurrentSession, logoutAction } from "@/lib/actions/auth";
import { MobileNav, type NavItem } from "@/components/shell/mobile-nav";

const nav: NavItem[] = [
  { href: "/admin", label: "Visão geral", icon: LayoutDashboard },
  { href: "/admin/lessons", label: "Aulas", icon: BookOpen },
  { href: "/admin/responses", label: "Respostas", icon: MessageSquare },
  { href: "/admin/students", label: "Alunos", icon: Users },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.role !== "TEACHER") redirect("/dashboard");
  if (session.status === "SUSPENDED") redirect("/dashboard/suspended");
  if (session.status !== "ACTIVE") redirect("/dashboard/pending");

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <div className="flex min-h-screen">
        <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-stone-200 bg-white p-4 gap-1">
          <Link
            href="/admin"
            className="flex items-center gap-2 font-semibold mb-6 px-2"
          >
            <Logo className="w-8 h-8 rounded-lg" />
            Zion Admin
          </Link>
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-stone-700 hover:bg-stone-100"
            >
              {item.icon && <item.icon className="h-4 w-4" />} {item.label}
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
            <Link href="/admin" className="flex items-center gap-2 font-semibold">
              <Logo className="w-7 h-7 rounded-lg" />
              Zion Admin
            </Link>
            <MobileNav links={nav} user={{ name: session.name }} title="Menu admin" />
          </header>
          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-6xl w-full mx-auto">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npm run typecheck && npm run lint`
Expected: green

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/layout.tsx
git commit -m "fix: admin mobile header hamburger + logout"
```

---

### Task 7: Dashboard student header touch targets

**Files:**
- Modify: `src/app/dashboard/layout.tsx`

- [ ] **Step 1: Bump link/button hit areas to h-11**

Change nav buttons/links:

```tsx
<nav className="flex items-center gap-2 sm:gap-4 text-sm text-zinc-400">
  <Link
    href="/dashboard"
    className="inline-flex h-11 items-center px-2 hover:text-zinc-100"
  >
    Início
  </Link>
  <form action={logoutAction}>
    <button
      className="inline-flex h-11 items-center px-2 hover:text-zinc-100"
      type="submit"
    >
      Sair
    </button>
  </form>
  <span className="w-8 h-8 rounded-full bg-zinc-800 grid place-items-center text-xs text-zinc-300">
    {session.name.slice(0, 1).toUpperCase()}
  </span>
</nav>
```

- [ ] **Step 2: Verify + commit**

Run: `npm run typecheck`
Expected: green

```bash
git add src/app/dashboard/layout.tsx
git commit -m "fix: dashboard header touch targets h-11"
```

---

### Task 8: Auth pages + form

**Files:**
- Modify: `src/app/(auth)/login/page.tsx`
- Modify: `src/app/(auth)/register/page.tsx`
- Modify: `src/components/auth/auth-form.tsx`

- [ ] **Step 1: Login wrapper**

Change inner wrapper class from `w-full max-w-sm space-y-6` to:

```tsx
<div className="w-full max-w-md space-y-6">
```

And main:

```tsx
<main className="min-h-screen flex items-center justify-center bg-stone-50 px-4 py-6">
```

- [ ] **Step 2: Register wrapper**

Same two class changes as login (`max-w-md`, `px-4 py-6`).

- [ ] **Step 3: AuthForm card + submit**

Card className:

```tsx
className="space-y-4 bg-white border border-stone-200 rounded-xl p-4 sm:p-6 shadow-sm"
```

Submit Button:

```tsx
<Button
  className="w-full h-12 bg-emerald-700 hover:bg-emerald-800"
  disabled={pending}
>
```

- [ ] **Step 4: Swap link targets**

Login page link: wrap swap link in larger hit area (optional minimal):

```tsx
<p className="text-center text-sm text-stone-500">
  Novo por aqui?{" "}
  <Link
    href="/register"
    className="inline-flex min-h-11 items-center text-emerald-700 font-medium"
  >
    Criar conta
  </Link>
</p>
```

Register page: same with `/login` / `Entrar`.

- [ ] **Step 5: Verify + commit**

Run: `npm run typecheck && npm run lint`
Expected: green

```bash
git add "src/app/(auth)/login/page.tsx" "src/app/(auth)/register/page.tsx" src/components/auth/auth-form.tsx
git commit -m "fix: responsive auth forms full-width h-12"
```

---

### Task 9: AttendanceConfirm (student) responsive

**Files:**
- Modify: `src/components/dashboard/attendance-confirm.tsx`

- [ ] **Step 1: Stack controls**

Replace the `flex flex-wrap gap-2` block:

```tsx
<div className="flex flex-col gap-3 md:flex-row md:items-center">
  <Input
    value={keyword}
    onChange={(e) => setKeyword(e.target.value)}
    placeholder="Ex: ALIANÇA"
    className="h-12 w-full md:max-w-xs bg-zinc-900 border-zinc-700 text-zinc-50"
    aria-label="Palavra-chave da presença"
    disabled={pending}
  />
  <Button
    disabled={pending || !keyword.trim()}
    onClick={/* keep existing handler */}
    className="h-12 w-full md:w-auto bg-emerald-700 hover:bg-emerald-800"
  >
    {pending ? "Confirmando…" : "Confirmar Presença"}
  </Button>
</div>
```

- [ ] **Step 2: Verify + commit**

Run: `npm run typecheck`
Expected: green

```bash
git add src/components/dashboard/attendance-confirm.tsx
git commit -m "fix: attendance confirm stack mobile column"
```

---

### Task 10: QuestionForm submit responsive

**Files:**
- Modify: `src/components/dashboard/question-form.tsx`

- [ ] **Step 1: Textarea min-height + submit size**

Textarea className: append `min-h-[120px]` (replace `min-h-[96px]`).

Button:

```tsx
<Button
  onClick={submit}
  disabled={pending}
  className="h-12 w-full md:w-auto bg-emerald-700 hover:bg-emerald-800"
>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/question-form.tsx
git commit -m "fix: question form submit full-width mobile"
```

---

### Task 11: AttendancePanel (teacher) controls + table

**Files:**
- Modify: `src/components/admin/attendance-panel.tsx`

- [ ] **Step 1: Controls row → column stack**

Replace `flex flex-wrap items-end gap-2` with:

```tsx
<div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
```

Keyword input: `className="h-12 w-full"` on the `Input`.

Button group `flex gap-2` → `flex flex-col gap-2 sm:flex-row` and each Button `className="h-12 w-full sm:w-auto ..."` (keep existing color classes).

- [ ] **Step 2: Replace bottom table with ResponsiveTable**

Import:

```tsx
import { ResponsiveTable } from "@/components/shell/responsive-table";
```

Replace the `div.rounded-lg...table` block with:

```tsx
<ResponsiveTable
  columns={[
    { key: "aluno", header: "Aluno" },
    { key: "status", header: "Status" },
    { key: "confirmado", header: "Confirmado" },
    { key: "acoes", header: "Ações", className: "text-right" },
  ]}
  rows={view.rows}
  rowKey={(r) => r.id}
  emptyState={
    <p className="p-8 text-center text-stone-500">Nenhum aluno cadastrado.</p>
  }
  renderMobile={(r) => (
    <div className="space-y-2">
      <div>
        <div className="font-medium">{r.name}</div>
        <div className="text-xs text-stone-500">{r.email}</div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {r.userStatus === "SUSPENDED" ? (
          <Badge className="bg-red-100 text-red-700">Suspenso</Badge>
        ) : r.status ? (
          <Badge className={statusBadge[r.status].cls}>
            {statusBadge[r.status].label}
          </Badge>
        ) : (
          <span className="text-stone-400">—</span>
        )}
        <span className="text-stone-500">
          {r.confirmedAt ? formatDateTime(r.confirmedAt) : "—"}
        </span>
      </div>
      <div className="flex flex-wrap gap-1">
        {r.status === "ABSENT" && (
          <Button
            size="sm"
            variant="ghost"
            className="h-11"
            disabled={pending}
            onClick={() =>
              run(
                () =>
                  justifyAbsenceAction({
                    lessonId: view.lesson.id,
                    studentId: r.id,
                  }),
                "Falta justificada"
              )
            }
          >
            Justificar
          </Button>
        )}
        {r.userStatus !== "SUSPENDED" && (
          <Button
            size="sm"
            variant="ghost"
            className="h-11 text-red-600"
            disabled={pending}
            onClick={() => {
              if (
                !window.confirm(
                  `Suspender ${r.name}? Motivo: faltas à chamada.`
                )
              )
                return;
              run(
                () =>
                  suspendStudentAction({
                    studentId: r.id,
                    reason: "Faltas à chamada",
                  }),
                "Aluno suspenso"
              );
            }}
          >
            Suspender
          </Button>
        )}
      </div>
    </div>
  )}
  renderDesktopRow={(r) => (
    <>
      <td className="p-3">
        <div className="font-medium">{r.name}</div>
        <div className="text-xs text-stone-500">{r.email}</div>
      </td>
      <td className="p-3">
        {r.userStatus === "SUSPENDED" ? (
          <Badge className="bg-red-100 text-red-700">Suspenso</Badge>
        ) : r.status ? (
          <Badge className={statusBadge[r.status].cls}>
            {statusBadge[r.status].label}
          </Badge>
        ) : (
          <span className="text-stone-400">—</span>
        )}
      </td>
      <td className="p-3 whitespace-nowrap">
        {r.confirmedAt ? formatDateTime(r.confirmedAt) : "—"}
      </td>
      <td className="p-3 text-right whitespace-nowrap">
        {r.status === "ABSENT" && (
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() =>
              run(
                () =>
                  justifyAbsenceAction({
                    lessonId: view.lesson.id,
                    studentId: r.id,
                  }),
                "Falta justificada"
              )
            }
          >
            Justificar
          </Button>
        )}
        {r.userStatus !== "SUSPENDED" && (
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            className="text-red-600"
            onClick={() => {
              if (
                !window.confirm(
                  `Suspender ${r.name}? Motivo: faltas à chamada.`
                )
              )
                return;
              run(
                () =>
                  suspendStudentAction({
                    studentId: r.id,
                    reason: "Faltas à chamada",
                  }),
                "Aluno suspenso"
              );
            }}
          >
            Suspender
          </Button>
        )}
      </td>
    </>
  )}
/>
```

- [ ] **Step 3: Typecheck + commit**

Run: `npm run typecheck`
Expected: green

```bash
git add src/components/admin/attendance-panel.tsx
git commit -m "feat: attendance panel responsive controls + cards"
```

---

### Task 12: StudentsTable → ResponsiveTable

**Files:**
- Modify: `src/components/admin/students-table.tsx`

- [ ] **Step 1: Replace table markup**

Import `ResponsiveTable`. Keep filters. Replace the `div.rounded-lg...table` with ResponsiveTable:

- columns: Nome, E-mail, Função, Status, Criado em, Ações
- `rowKey={(u) => u.id}`
- empty: `Nenhum usuário encontrado.`
- `renderMobile`: card with name, email, role Badge, status Badge, date, action buttons `h-11 flex-wrap gap-1` (reuse existing action buttons JSX)
- `renderDesktopRow`: existing `<td>` sequence unchanged

- [ ] **Step 2: Filter select height**

`className="h-9 rounded-md..."` → `h-11` on the status select for touch.

- [ ] **Step 3: Typecheck + commit**

Run: `npm run typecheck`
Expected: green

```bash
git add src/components/admin/students-table.tsx
git commit -m "feat: students table cards on mobile"
```

---

### Task 13: ResponsesTable matrix → cards + table

**Files:**
- Modify: `src/components/admin/responses-table.tsx`

- [ ] **Step 1: Mobile card list + desktop table**

Wrap existing filter Input. Structure:

```tsx
<div className="space-y-4">
  <Input /* unchanged */ />
  {/* Mobile: stacked cards per student */}
  <ul className="md:hidden space-y-3">
    {rows.map((s: S) => (
      <li key={s.id} className="rounded-lg border border-stone-200 bg-white p-3 space-y-2">
        <p className="font-medium">{s.name}</p>
        <ul className="space-y-2">
          {matrix.questions.map((q: Q) => {
            const raw = s.cells[q.id];
            const isCorrect =
              q.questionType === "MULTIPLE_CHOICE" &&
              q.correctOptionIndex !== null &&
              raw !== undefined &&
              Number(raw) === q.correctOptionIndex;
            const display =
              raw === undefined
                ? "—"
                : q.questionType === "MULTIPLE_CHOICE" &&
                    q.optionsList[Number(raw)] !== undefined
                  ? q.optionsList[Number(raw)]
                  : raw;
            return (
              <li key={q.id} className="text-sm">
                <p className="text-xs text-stone-500 line-clamp-2">
                  {q.questionText}
                </p>
                <button
                  type="button"
                  onClick={() => setOpen({ student: s.name, question: q.id })}
                  className="mt-0.5 text-left w-full min-h-11 rounded px-1 text-stone-800 hover:bg-stone-50"
                >
                  <span className="line-clamp-2">{display}</span>
                  {isCorrect && (
                    <span className="ml-1 text-emerald-600">✓</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </li>
    ))}
    {!rows.length && (
      <li className="p-8 text-center text-stone-500">Nenhum aluno encontrado.</li>
    )}
  </ul>
  {/* Desktop: existing table with hidden md:block wrapper */}
  <div className="hidden md:block rounded-lg border border-stone-200 bg-white overflow-x-auto">
    {/* existing <table> JSX unchanged */}
  </div>
  {/* existing modal unchanged; ensure modal panel: max-w-lg w-[92vw] sm:w-full */}
</div>
```

Modal panel class: `bg-white rounded-xl max-w-lg w-[92vw] sm:w-full p-6 space-y-3` and close button `min-h-11`.

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/responses-table.tsx
git commit -m "feat: response matrix cards on mobile"
```

---

### Task 14: Admin lessons list → ResponsiveTable

**Files:**
- Modify: `src/app/admin/lessons/page.tsx`

- [ ] **Step 1: Replace list table**

Import `ResponsiveTable`. Keep header/filters. Replace list `div.rounded-lg...table` with:

- columns: Data, Título, Status, Perguntas, Respostas, Ações
- rows: `withCounts`
- `rowKey={(l) => l.id}`
- empty: `Nenhuma aula encontrada.`
- `renderMobile`: card with date, title, publish Badge, counts, `flex flex-wrap gap-1` actions (Editar, Respostas, Chamada, Publicar/Despublicar form, Dialog Excluir) — each Button `h-11`
- `renderDesktopRow`: existing `<td>` cells unchanged

- [ ] **Step 2: DialogContent width**

On delete Dialog: `<DialogContent className="w-[92vw] max-w-md sm:max-w-sm">` (override default if needed; default already `max-w-[calc(100%-2rem)]` — leave if fine).

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/lessons/page.tsx
git commit -m "feat: lessons list cards on mobile"
```

---

### Task 15: Admin responses index → ResponsiveTable

**Files:**
- Modify: `src/app/admin/responses/page.tsx`

- [ ] **Step 1: Replace table**

Import `ResponsiveTable`. Replace table block:

- columns: Aula, Data, Responderam, Último envio, Ação
- rows: `rows` (lesson counts)
- card: title link, date, answered counts, last submit, Ver button `h-11`
- desktop: existing cells

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/responses/page.tsx
git commit -m "feat: responses index cards on mobile"
```

---

### Task 16: LessonForm footer + input heights

**Files:**
- Modify: `src/components/admin/lesson-form.tsx`

- [ ] **Step 1: Footer actions**

Replace:

```tsx
<div className="flex flex-wrap gap-2">
```

with:

```tsx
<div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
```

Each Button: add `className="h-12 w-full sm:w-auto ..."` (preserve emerald on primary).

- [ ] **Step 2: Inputs h-12**

Add `className="h-12"` to main title/date/thumbnail/video Inputs (Input base is `h-8`; bump critical fields). Textarea description: `className="min-h-[160px]"` via `rows={6}` already — leave.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/lesson-form.tsx
git commit -m "fix: lesson form touch targets and footer stack"
```

---

### Task 17: Pending / Suspended pages

**Files:**
- Modify: `src/app/dashboard/pending/page.tsx`
- Modify: `src/app/dashboard/suspended/page.tsx`

- [ ] **Step 1: Both pages**

main: `min-h-screen grid place-items-center px-4 py-6 text-center bg-stone-50`
inner: keep `max-w-md space-y-4`
Sair Button: `className="h-12 w-full sm:w-auto"` + variant outline

- [ ] **Step 2: Commit**

```bash
git add src/app/dashboard/pending/page.tsx src/app/dashboard/suspended/page.tsx
git commit -m "fix: pending/suspended full-width CTA"
```

---

### Task 18: Showcase search + hero touch (light sweep)

**Files:**
- Modify: `src/components/dashboard/showcase.tsx`

- [ ] **Step 1: Search input height**

Search Input: `className="h-12 max-w-sm w-full bg-zinc-900 border-zinc-800 text-zinc-100"`

Grid already `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4` for filtered results — leave hero as-is.

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/showcase.tsx
git commit -m "fix: showcase search h-12"
```

---

### Task 19: Final verification

**Files:** none (commands only)

- [ ] **Step 1: Full quality gate**

Run: `npm run lint && npm run typecheck && npm run test`
Expected: all green (existing 89+ tests + new shell tests)

- [ ] **Step 2: Optional local smoke (manual checklist)**

- 360px: `/login` no h-scroll; `/dashboard` header has Início+Sair; `/admin` opens Sheet with 4 links + Sair; tables show cards
- ≥768px: admin sidebar intact; lessons grid intact

- [ ] **Step 3: Final commit if any fixups**

```bash
git add -A
git commit -m "chore: responsive refactor verification fixups"
```

---

## Self-Review notes (writer)

- Spec Seção 1 → Tasks 4–6 (MobileNav + admin layout); ResponsiveTable → Tasks 2–3
- Spec Seção 2 → Task 8
- Spec Seção 3 → Tasks 1, 7, 9, 10, 17, 18
- Spec Seção 4 → Tasks 11–15 (4 tables: attendance, students, responses matrix, lessons list + responses index)
- Spec Seção 5 → Tasks 11, 16
- Spec aceite 6 → Task 19
- `renderDesktopRow` required for multi-column desktop — documented in Task 3
- Admin responses index is a 5th table-like list (spec table row for `/admin/responses` matrix covers matrix; index list included for consistency with Seção 4 “Respostas”)
