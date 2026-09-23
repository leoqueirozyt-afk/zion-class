# Design: Aba Respostas no menu do professor

## Contexto

O painel do professor (`/admin`) não tem acesso dedicado às respostas dos alunos:

1. O menu lateral/cabeçalho (`src/app/admin/layout.tsx`) só lista Visão geral, Aulas e Alunos — não existe aba **Respostas**.
2. O card “Últimas respostas” em `/admin` (`getAdminMetrics.recent` em `src/lib/queries/admin.ts`) ordena as linhas brutas da tabela `answers` e pega as 5 mais recentes. Cada resposta é uma linha por pergunta, então um aluno que respondeu 5 perguntas da mesma aula aparece **5× com o mesmo nome**.
3. Já existe matriz por aula em `/admin/lessons/[id]/responses` (com CSV), mas não há um índice acessível pelo menu organizado por aulas.

## Objetivos

- Item **Respostas** no menu do professor.
- Ao clicar, ver **índice de aulas com contagem de respostas**; clicar na aula abre a matriz existente.
- Overview sem nome duplicado: **1 linha por aluno·aula**.

## Fora de escopo

- Filtros/CSV novos na matriz ou no export.
- Mudanças de schema D1.
- Fluxos do aluno.

## Design

### 1. Navegação

Em `src/app/admin/layout.tsx`, inserir no array `nav` (entre Aulas e Alunos):

- `href: "/admin/responses"`
- `label: "Respostas"`
- `icon: MessageSquare` (lucide-react)

Mesmo item renderiza na sidebar desktop e no header mobile (map atual).

### 2. Rota `/admin/responses`

Server Component em `src/app/admin/responses/page.tsx`.

- Título: “Respostas”.
- Tabela: **Aula | Data | Responderam | Último envio | ação**.
  - **Responderam**: `X de Y alunos` — Y = total de usuários `role=STUDENT` e `status=ACTIVE`; X = distintos com ≥1 resposta na aula.
  - **Último envio**: `max(answers.submittedAt)` da aula (formatado com `formatDateTime`).
  - **Ação**: link “Ver” (ou linha inteira clicável) → `/admin/lessons/{id}/responses`.
- Ordenação: `lessons.date` desc.
- Filtro: só aulas com **contagem de respostas > 0**.
- Empty state: “Nenhuma resposta ainda.”
- Sem paginação (volume atual: poucas aulas).

### 3. Query `getLessonsWithResponseCounts(db)` em `src/lib/queries/admin.ts`

- Busca aulas com: id, title, date.
- Contagem de answers por aula via join `answers → questions` agrupando por `lessonId` (uma query agregada, **sem N+1**).
- Último `submittedAt` por aula na mesma agregação (ou query separada agregada).
- Total de alunos ACTIVE uma query.
- Une em JS e filtra `answerCount > 0`.
- Retorna tipo exportado, ex.: `LessonResponseCount[]`.

### 4. Fix do card “Últimas respostas”

Em `getAdminMetrics`, o `recent` passa a:

- Agrupar por `(studentId, lessonId)` (SQL `GROUP BY` ou redução em JS).
- Ordenar por `max(submittedAt)` desc.
- Limitar 5 grupos.
- Manter campos usados pela UI: `studentName`, `lessonTitle`, `lessonId`, `submittedAt` (agora = máx. do grupo).
- Link do card continua apontando para `/admin/lessons/{lessonId}/responses`.

### 5. UI do overview

`src/app/admin/page.tsx` — card “Últimas respostas” permanece; cada item é 1 aluno·aula (sem duplicata). Sem mudança de layout além do dado corrigido.

## Testes

- Query/agrupamento: teste de unidade para a lógica de `recent` agrupado e para `getLessonsWithResponseCounts` (mesmo padrão dos testes de query existentes — mock ou fixture drizzle; se não houver harness de DB, extrair funções puras de redução e testar).
- Componente/página: cobrir que a nav inclui “Respostas” e que a página de índice renderiza aulas com contagem (se viável com o setup jsdom atual).
- Regressão manual pós-deploy: menu → Respostas → matriz; overview sem nome 5×.

## Critérios de aceite

- [ ] Menu do professor tem “Respostas” (desktop e mobile).
- [ ] `/admin/responses` lista só aulas com ≥1 resposta, com `X de Y alunos` e link p/ matriz.
- [ ] Matriz `/admin/lessons/[id]/responses` inalterada e acessível a partir do índice.
- [ ] “Últimas respostas” no overview: no máximo 1 linha por aluno·aula.
- [ ] `npm test`, `npm run lint`, `npm run typecheck` verdes.
- [ ] Deploy + smoke 200 nas rotas novas/editadas.

## Riscos

- **Contagem “Y alunos”**: se a regra de alunos elegíveis mudar (ex.: incluir PENDING), ajustar o filtro numa única query.
- **Aulas seed sem resposta**: somem do índice (comportamento desejado).
