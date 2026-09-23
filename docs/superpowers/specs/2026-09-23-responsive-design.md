# Design: Refatoração 100% Mobile-First Responsiva (Tailwind)

**Data:** 2026-09-23
**Status:** Aprovado em brainstorming (seções 1–5) — aguardando revisão do arquivo
**Contexto:** Zion Class — Next.js 16 App Router + TS + Tailwind v4 + shadcn/ui. Feature de presença por palavra-chave já entregue e em produção (`e3e67e6`). Esta spec cobre apenas a refatoração de UI responsiva.

## Objetivo

Toda a interface (auth, dashboard do aluno, painel do admin/professor, formulários e tabelas) deve funcionar bem em mobile-first, seguindo o fluxo de execução por planos superpowers. Critérios:

- Headers/navegação críticos utilizáveis em telas pequenas
- Formulários e CTAs com touch targets ≥ 44px (`h-11`/`h-12`)
- Tabelas admin viram cards empilhados no mobile
- Sem overflow horizontal; tipografia e modais adaptados por breakpoint
- Desktop (≥768px) preserva o layout atual (sidebar admin, grids)

## Decisões de produto (brainstorming)

| Tema | Decisão |
|------|---------|
| Tabelas admin | **4/4** → cards no mobile (`md:hidden`), tabela no desktop (`hidden md:table`) |
| Header aluno mobile | `Sair` **visível direto no header**, sem hambúrguer |
| Admin desktop | **Manter sidebar** existente; consertar só o mobile (hambúrguer + `Sair`) |
| Abordagem de código | **A — componentes de shell compartilhados** (`MobileNav`, `ResponsiveTable`) |
| Botões de submit auth | **Full-width sempre** (mobile e desktop) |

## Escopo por rota

- **Auth:** `(auth)/login`, `(auth)/register`
- **Aluno:** `dashboard/layout`, `dashboard` (lista + grid), `dashboard/lessons/[id]`, `dashboard/pending`, `dashboard/suspended`
- **Admin:** `admin/layout` (mobile), `admin/lessons`, `admin/lessons/new|edit`, `admin/lessons/[id]/attendance`, `admin/lessons/[id]/responses`, `admin/responses`, `admin/students`
- **Global:** `src/app/layout.tsx` (overflow, tipografia base)

**Fora do escopo:** mudanças de backend/Drizzle, UX de `confirm()` de exclusão, troca de biblioteca de UI, dark mode.

---

## Seção 1 — Shell compartilhado (aprovada)

### `src/components/shell/mobile-nav.tsx` (novo)

- **Props:**
  ```ts
  type NavItem = { href: string; label: string; icon?: LucideIcon }
  type MobileNavProps = {
    links: NavItem[]
    user?: { name?: string; role?: string }
    showLogout?: boolean // default true
    triggerSide?: 'left' | 'right' // hambúrguer position; default 'right'
    logo?: React.ReactNode // logo compacta opcional à esquerda
  }
  ```
- **Mobile (`md:hidden`):** logo (se prop) à esquerda + botão hambúrguer `h-11 w-11` (Menu icon) → `<Sheet side="right">` com:
  - links empilhados `h-12` cada (com ícone opcional)
  - identificação do usuário (`user.name` / role) se houver
  - `Sair` no fim (`showLogout !== false`), usa `logoutAction` (`src/lib/actions/auth.ts`) via `<form action={logoutAction}>` — mesmo padrão dos layouts
- **Desktop (`hidden md:flex`):** não renderiza trigger nem Sheet; o pai decide links inline ou sidebar
- Usa `src/components/ui/sheet.tsx` (existente) + lucide `Menu`, `LogOut`
- Acessibilidade: trigger com `aria-label="Abrir menu"`, focus trap do Sheet

### `src/components/shell/responsive-table.tsx` (novo)

- **Props:**
  ```ts
  type ResponsiveTableProps<T> = {
    columns: { key: string; header: string; className?: string }[]
    rows: T[]
    rowKey: (row: T) => string
    renderMobile: (row: T) => React.ReactNode // card
    emptyState?: React.ReactNode
    desktopClassName?: string
  }
  ```
- **Mobile:** `<ul className="md:hidden space-y-3">` — cada item é o card de `renderMobile`
- **Desktop:** `<div className="hidden md:block overflow-x-auto">` + `<table className="w-full">` com `columns`/`rows`
- Shell não conhece domínio: ações/badges ficam em `renderMobile` e nas cells
- Vazio: renderiza `emptyState` (mensagem atual da rota) nos dois modos

### `dashboard/layout.tsx` (refatorar)

- Mobile: logo compacta + `Início` + `Sair` **visíveis** (`h-11`), sem Sheet (decisão Q2)
- Desktop: mantém padrão atual (`h-14`, `max-w-6xl`, avatar/nav inline)
- Preferência: extrair para variante “inline” do shell (ex.: `InlineHeader`) ou markup local com as classes — manter consistência visual

### `admin/layout.tsx`

- **Desktop (`md+`):** sidebar inalterada (`hidden md:flex w-56`, 4 links, logout `mt-auto`)
- **Mobile (`md:hidden`):** header `sticky top-0` com logo compacta à esquerda + `MobileNav` (hambúrguer à direita) contendo:
  - Início (`/admin`), Aulas, Alunos, Respostas (labels/paths iguais aos da sidebar)
  - **`Sair` obrigatório** (fecha bug atual: sem logout no mobile)
- Remove os 4 links inline que estouram hoje

---

## Seção 2 — Auth (aprovada)

- Wrapper da página: `min-h-dvh flex items-center justify-center` + `w-full px-4 py-6`; desktop `max-w-md mx-auto`
- Card: `w-full p-4 sm:p-6` (sem `max-w-sm` fixo)
- Inputs: `h-12 text-base` (evita zoom iOS)
- Botão submit: **`w-full h-12` sempre** (mobile e desktop)
- Link alternar login↔register: `min-h-11 py-2` (área de toque)
- Toast/erros: inalterados (sonner top-center)

---

## Seção 3 — Dashboard do aluno (aprovada)

### `/dashboard`

- Grid de cards de aula: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`
- Bloco de chamada: `flex flex-col gap-3 md:flex-row md:items-center`
- Input keyword: `h-12 w-full`; botão confirmar: `h-12 w-full md:w-auto`
- Badge presença: inalterada (flex-wrap ok)

### `/dashboard/lessons/[id]`

- Bloco presença: mesmo `flex-col gap-3 md:flex-row`
- Vídeo/materiais/embed: `w-full`, `aspect-video`; sem `min-w` com overflow
- Form pergunta: textarea `min-h-[120px]`; botão `h-12 w-full md:w-auto`

### Sweep global

- `overflow-x-hidden` em `body` (root layout) ou `main` root
- Touch targets ≥ `h-11` em ações
- Tipografia: corpo `text-base md:text-lg`; títulos `text-xl md:text-2xl` onde não seguem o ramp
- Modais/Sheets: conteúdo `w-[92vw]` + `max-w-lg` / `max-w-md` mobile
- `pending` / `suspended`: centralizadas, `px-4`, CTA full-width

---

## Seção 4 — Admin: 4 tabelas → cards (aprovada)

Todas usam `ResponsiveTable`.

| Rota | Card mobile | Ações no card |
|------|-------------|---------------|
| `admin/lessons/[id]/attendance` | Aluno, Status badge (PRESENT/ABSENT/PENDING), Hora (se houver) | — |
| `admin/lessons/[id]/responses`, `admin/responses` | Aluno, Trecho/pergunta (truncate 2 linhas), Resposta (truncate), Data | Ver / Aprovar-reprovar (como hoje) |
| `admin/students` | Nome, Email, Papel, Status | Aprovar / Suspender / Editar (`h-11`, wrap) |
| `admin/lessons` (lista) | Título, Data, badges (respostas/chamada) | Editar / Respostas / Chamada / Excluir (`flex-wrap gap-2`) |

- Badges: componente `Badge` existente, cor por status
- Desktop: mesmas colunas atuais
- Empty states: mensagem atual dentro do shell
- Excluir aula: mantém `Dialog` de confirmação atual (só largura mobile `w-[92vw] max-w-md`); `window.confirm` de promover aluno em `students-table` permanece

---

## Seção 5 — Formulários e painel professor (aprovada)

### `lesson-form` (`admin/lessons/new|edit`)

- Campos: `grid grid-cols-1 md:grid-cols-2 gap-4` onde fizer sentido (data+duração lado a lado no desktop)
- Inputs `h-12`; textarea `min-h-[160px]`; labels `text-sm md:text-base`
- Ações: `flex flex-col-reverse gap-3 sm:flex-row sm:justify-end`; botões full-width no mobile

### `attendance-panel` (corpo de `admin/lessons/[id]/attendance`)

- Input palavra-chave + Abrir/Fechar: `flex-col gap-3 md:flex-row`
- Input `h-12 w-full`; botões `h-12 w-full md:w-auto`
- Resultado abaixo: cards via `ResponsiveTable` (Seção 4)

### Diálogos e ações

- `Dialog`/`AlertDialog`: `w-[92vw] max-w-md` mobile
- Botões em card: min `h-11`, `flex-wrap` (não espremer ícone+texto)

### Sweep final

- Todos os `page.tsx` sob `dashboard/` e `admin/`: headings, voltar, `flex-wrap`
- CTAs full-width em landing `page.tsx` se aplicável

---

## Breakpoints (Tailwind v4 padrão)

- Mobile base: `<768px` (`md:hidden` / `md:table` etc.)
- Desktop: `≥768px` (`md:`)
- Grid aluno usa também `lg:grid-cols-3` (≥1024px)

## Fora de escopo

- Backend, schema, server actions de negócio
- Substituir `Dialog` de excluir aula / `window.confirm` por novo componente de confirmação
- Dark mode, i18n, animações novas além das do shadcn
- Sidebar recolhível / header horizontal desktop (opções B/C do brainstorm — não escolhidas)

## Critérios de aceite

1. Em viewport 360×640: nenhum overflow horizontal em nenhuma rota; `Sair` alcançável no admin (via Sheet) e no aluno (header); hambúrguer abre com 4 links + logout
2. Em ≥768px: sidebar admin e grids batem com o layout atual (sem regressão visual grosseira)
3. As 4 tabelas admin mostram cards no mobile e tabela no desktop (toggle por `md:`)
4. Todos os botões de submit/ação primários ≥ 44px de altura
5. Login/register full-width, sem corte em 360px
6. `npm run lint` + `npm run typecheck` + `npm run test` verdes; testes novos jsdom em `tests/components/` para `MobileNav` e `ResponsiveTable` (abertura do Sheet, render card vs table)
7. Smoke manual/Playwright opcional em dev nas rotas principais

## Riscos

- SSR/hidratação do Sheet (shadcn já resolve com Radix)
- Duplicação de markup se alguma rota não migrar para o shell → varredura no plano
- `overflow-x-hidden` pode mascarar bug real → usar como safety net, não paliativo

## Próximo passo

Após revisão/commit desta spec: invocar **writing-plans** para gerar o plano de execução (`docs/superpowers/plans/2026-09-23-responsive-design.md`).
