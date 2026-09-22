# Zion Class — Design Spec

**Data:** 2026-09-22
**Status:** Aprovado pelo usuário
**Escopo:** Plataforma de área de membros para grupo de estudos bíblicos/teológicos de igreja (aulas presenciais às terças-feiras), com níveis ALUNO e PROFESSOR, otimizada para Cloudflare.

---

## 1. Contexto e objetivos

- Gerenciar estudos semanais (terças), materiais de apoio (links externos) e questionários/dúvidas deixados pelo professor.
- Alunos respondem questionários pelo celular; professor cria aulas e acompanha respostas.
- Aula é **presencial**; vídeo do YouTube é **complementar opcional** (não é a aula em si).
- Vitrine de aulas **estilo Netflix** (hero + carrossel de thumbnails).
- Idioma da interface: **pt-BR** (hardcoded, sem lib de i18n).

## 2. Decisões de requisitos (perguntas de clarificação)

| # | Tema | Decisão |
|---|------|---------|
| 1 | Cadastro | **Híbrido:** registro aberto → `PENDING`; professor aprova/suspende (`ACTIVE`/`SUSPENDED`) |
| 2 | Materiais | **Só links externos** — sem upload, sem R2 |
| 3 | Idioma | **pt-BR** completo |
| 4 | Vídeo | **Embutido** (YouTube/Vimeo iframe) com **fallback botão** para outros domínios; sem URL → seção omitida |
| 5 | Edição de respostas | **Editável** enquanto a aula estiver publicada; `submitted_at` atualiza a cada edição (sem histórico de versões) |
| 6 | Múltipla escolha | **Só coleta** — `correct_option_index` opcional como referência visual; **sem correção automática/notas** |
| 7 | Primeiro professor | **Seed script** (`npm run db:seed` via env); registro público só cria `STUDENT` |
| 8 | Vitrine | **Estilo Netflix** com `thumbnail_url` por aula (URL externa) + hero + carrossel |
| 9 | Acento visual | **Verde esmeralda `#047857`** |

## 3. Stack e arquitetura (Abordagem A aprovada)

- **Framework:** Next.js 15 App Router + TypeScript + React.
- **UI:** Tailwind CSS + shadcn/ui + lucide-react + sonner (toasts) + react-markdown.
- **Banco:** Cloudflare **D1** + **Drizzle ORM** (drizzle-kit para migrações).
- **Auth:** JWT HS256 via `jose` em **cookie HTTP-only** (`zion_session`, `Secure`, `SameSite=Lax`); payload `{ sub, role, name }`; segredo em env do Cloudflare. Hash de senha: **scrypt (WebCrypto)** formato `scrypt$<salt>$<hash>`.
- **Deploy:** `@opennextjs/cloudflare` → Cloudflare Pages (Worker OpenNext) com binding D1.
- **Proteção de rotas:** `middleware.ts` no edge **e** revalidação de role/status em **toda** Server Action protegida (middleware sozinho não basta).
- **Mutações:** Server Actions + `revalidatePath` + `redirect`. **Leituras:** Server Components → D1 direto.
- **Validação:** zod — mesmo schema em form e Server Action.

### Camadas

```
src/
  db/            # schema Drizzle, client, migrações, seed
  lib/
    auth/        # sessão (jose), hash (scrypt), guards (role/status)
    actions/     # Server Actions (auth, lessons, materials, questions, answers, students)
    validation/  # schemas zod compartilhados
    utils/       # datas, csv, md
  app/
    (auth)/login, (auth)/register
    dashboard/   # vitrine + aula + pendente/suspensa
    admin/       # overview, lessons CRUD, responses, students
    api/         # apenas se necessário (ex.: export CSV stream) — preferir Server Action
  components/    # UI compartilhada (shadcn) + domain (LessonCard, QuestionForm…)
```

## 4. Modelo de dados (D1/Drizzle)

IDs: `text` PK = `crypto.randomUUID()`. Timestamps: `integer` epoch ms. Bool: `integer` 0/1.

### users
| coluna | tipo | notas |
|---|---|---|
| id | text PK | |
| name | text | |
| email | text unique | normalizado lowercase |
| password_hash | text | `scrypt$<salt>$<hash>` |
| role | text | `'STUDENT' \| 'TEACHER'` |
| status | text | `'PENDING' \| 'ACTIVE' \| 'SUSPENDED'` (default PENDING; seed TEACHER = ACTIVE) |
| created_at | integer | |

### lessons
| coluna | tipo | notas |
|---|---|---|
| id | text PK | |
| title | text | ex.: "Estudo #05 - Carta aos Romanos" |
| description | text | Markdown |
| date | text | `YYYY-MM-DD` (terças) |
| video_url | text null | complementar; YouTube/Vimeo embutido |
| thumbnail_url | text null | URL imagem externa; fallback gradiente |
| is_published | integer | default 0 |
| created_at | integer | |

### materials
`id` PK · `lesson_id` FK→lessons **onDelete cascade** · `title` · `url` · `type` (`PDF|LINK|IMAGE|DOCUMENT`)

### questions
`id` PK · `lesson_id` FK cascade · `question_text` · `question_type` (`TEXT|MULTIPLE_CHOICE`) · `options` (text JSON: array de strings; só MC) · `correct_option_index` (integer null — referência, sem auto-correção) · `position` (integer, ordem)

### answers
| coluna | tipo | notas |
|---|---|---|
| id | text PK | |
| question_id | FK→questions cascade | |
| student_id | FK→users | |
| answer_text | text | |
| submitted_at | integer | **atualiza a cada edição** |

- **Índice único `(question_id, student_id)`** — editar = UPDATE + novo `submitted_at`.
- **“Respondeu a aula”:** existe resposta para **todas** as perguntas da aula; aula sem perguntas → badge “Sem questionário”.

Sem tabelas de: notas, arquivos, convites, histórico de versões.

## 5. Telas e fluxos

### 5.1 Autenticação (pública)
- **`/register`:** nome, e-mail, senha → cria `STUDENT` + `PENDING` → toast + redirect `/dashboard` (tela de aguardando aprovação).
- **`/login`:** e-mail+senha → cookie de sessão → redirect por papel: `TEACHER`→`/admin`, `STUDENT`→`/dashboard` (ou `?next=`).
- Pós-login, `/login` e `/redirectam` se já houver sessão válida.

### 5.2 Área do aluno — estilo Netflix
**`/dashboard`** (exige sessão + `ACTIVE`; `PENDING`/`SUSPENDED` → tela cheia sem vazar conteúdo):
- **Hero:** última aula publicada com `thumbnail_url` + scrim; título, data, resumo, botões “Estudar” e “Vídeo complementar” (se houver).
- **Busca:** filtra em tempo real por título/descrição; com texto → lista vertical de resultados.
- **Carrossel “Todos os estudos”:** cards 16:9 com thumbnail (fallback gradiente + título); badges `✓ Respondida` / `Pendente` / `Sem questionário`; scroll-snap mobile, setas desktop. Só `is_published`.
- Row extra (“Pendentes”) só se houver ≥1 item.

**`/dashboard/lessons/[id]`:**
1. Capa/thumbnail + título + data.
2. Descrição (react-markdown, sem HTML cru).
3. **Vídeo complementar** (se `video_url`): YouTube/Vimeo → iframe 16:9; senão → botão externa `rel="noopener noreferrer"`.
4. **Materiais:** chips/cards com ícone por tipo; nova aba.
5. **Questionário:** perguntas por `position`; `TEXT`→textarea, `MC`→radio; envio em **uma** Server Action; validação (MC: opção obrigatória; TEXT: trim ≥1); estado respondido = faixa “Sua resposta foi gravada em DD/MM” (+ “atualizada em”), botão “Atualizar respostas”; toast sucesso.
6. Inexistente/não publicada → `notFound()`.

### 5.3 Painel do professor (`/admin`, TEACHER+ACTIVE)
- **Layout:** sidebar desktop / drawer ou bottom-nav mobile: Visão geral · Aulas · Alunos · Sair.
- **`/admin`:** métricas (aulas, publicadas, rascunhos, total respostas, pendentes de aprovação), últimas 5 respostas, CTA “+ Nova aula”.
- **`/admin/lessons`:** lista com busca + filtro status; ações: Editar, Publicar/Despublicar, Ver respostas, Excluir (dialog).
- **`/admin/lessons/new` · `/[id]/edit`** (form em seções, **1 Server Action transacional** — upsert aula → sync materiais/perguntas removendo ausentes):
  1. Aula: título, data (default próxima terça), descrição MD + preview, switch publicado, `thumbnail_url`, `video_url`.
  2. Materiais: linhas dinâmicas título/tipo/URL + validação URL.
  3. Perguntas: linhas dinâmicas texto/tipo; MC → editor de opções + radio “resposta correta” opcional; ordenação ↑↓.
- **`/admin/lessons/[id]/responses`:** header “X de Y alunos”; **filtro por nome**; **matriz** alunos×perguntas; clique na célula → sheet com resposta completa + timestamp; badge ✓ discreto se bate com `correct_option_index`; **export CSV** UTF-8 BOM, delimitador `;` (`Aluno;Pergunta;Resposta;Enviada em`); empty state.
- **`/admin/students`:** tabela nome/e-mail/papel/status; filtro status + busca; Aprovar, Suspender, Reativar, Promover a TEACHER (dialog); **não** suspender/destituir a si mesmo; sempre ≥1 TEACHER ACTIVE.

### 5.4 Erros e feedback
- Erros de validação → toast vermelho + campos; sucesso → toast verde.
- Erro DB → toast genérico “Não foi possível salvar. Tente novamente.” + `console.error`.
- 403 em action admin → redirect `/dashboard` + toast “Acesso restrito”.
- Sem sessão → `/login?next=…`; aluno em `/admin` → `/dashboard`.
- Thumbnail com erro → `onError` → placeholder gradiente.

## 6. UX/UI

- **Direção:** neutra/acolhedora — fundo claro (`stone`/`zinc` 50) no app do aluno/admin; vitrine **dark** (`zinc-950`) estilo Netflix; acento **esmeralda `#047857`**; `rounded-xl`; sombras suaves.
- **Login/Cadastro:** cartão centralizado, gradiente sutil, logo Zion Class, erros inline + toast.
- **Telas PENDING/SUSPENDED:** ícone + explicação + “Sair”, sem conteúdo.
- **A11y:** labels reais, contraste AA, `aria-label` nas setas do carrossel, foco visível, dialog com foco trap.
- **Mobile-first:** cards empilhados, hero compacto, scroll-snap, alvos de toque ≥44px.

## 7. Testes (Vitest)

- **Unitários:** hash/verify scrypt, create/parse session, guards (role/status), schemas zod, formatação de datas, geração de CSV.
- **Integração (D1 local/better-sqlite3):** register→PENDING; aprovar→ACTIVE; submit→edit answer (`submitted_at` muda); publicar/esconder aula da vitrine; sync material/pergunta na save transacional.
- **UI:** `QuestionForm` (TEXT/MC) com Testing Library.
- **Fora do 1º ciclo:** E2E (Playwright), CI (posso adicionar GH Actions depois).

## 8. Seed

`npm run db:seed` — 1 professor (`TEACHER`+`ACTIVE`) via `SEED_TEACHER_EMAIL`/`SEED_TEACHER_PASSWORD` + 2–3 aulas de exemplo publicadas com materiais e perguntas.

## 9. Fora de escopo (YAGNI)

Upload de arquivos/R2 · notificações/e-mail · notas/grading automático · histórico de versões de resposta · convite por código · i18n multi-idioma · chat/comentários · multi-igreja · app nativo.

## 10. Critérios de aceite (resumo)

1. Registro cria PENDING; professor aprova em `/admin/students`.
2. Aluno ACTIVE vê vitrine Netflix publicada; busca funciona; badges de resposta corretos.
3. Responder/editar questionário grava `submitted_at` atual e mostra faixa de data.
4. Professor cria/edita/exclui aula com materiais e perguntas em 1 save; rascunho invisível ao aluno.
5. `/admin` bloqueia STUDENT (middleware + action); aluno não vaza conteúdo com PENDING/SUSPENDED.
6. Export CSV abre corretamente no Excel pt-BR.
7. Deployável via `@opennextjs/cloudflare` com binding D1.
