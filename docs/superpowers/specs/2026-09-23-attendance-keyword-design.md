# Design: Presença por palavra-chave (chamada)

## Contexto

A plataforma precisa de módulo de chamada em que o **professor define livremente uma palavra-chave por aula** (ex.: "GRAÇA", "MONTE SIÃO") e o **aluno digita a palavra** na área de membro para confirmar presença na terça. Hoje não existe tabela de presenças nem fluxo de chamada.

Decisões acordadas no brainstorm:

- Reusar `users.status` (`PENDING|ACTIVE|SUSPENDED`) para suspensão; **não** criar `is_suspended`; só adicionar `suspension_reason` opcional.
- `attendance_expires_at` = prazo em minutos definido pelo professor ao **abrir** a chamada.
- Suspensão “por faltas” é **manual** pelo professor na tabela da aula.
- Ausentes: ao **fechar** a chamada, grava `ABSENT` para alunos ACTIVE sem linha; professor pode **justificar** depois.
- UI do professor em rota dedicada **`/admin/lessons/[id]/attendance`** (mockup aprovado).
- Abordagem: schema + **actions dedicadas** em `attendance.ts` + páginas client para form/toast.

## Objetivos

- Professor cadastra palavra-chave, abre/fecha chamada com expiração, vê contador e tabela (Presente/Ausente/Justificada), justifica falta e suspende aluno.
- Aluno confirma presença com a palavra; badge permanente se OK; toast amigável se errar/chamada encerrada.
- Conta suspensa continua caindo em `/dashboard/suspended` (fluxo existente).

## Fora de escopo

- Suspensão automática após N faltas.
- Relatório histórico de frequência além da tabela por aula.
- WebSockets/polling agressivo (basta `router.refresh` após action).
- Alterar guards de sessão/pending (já existem).

## Design

### 1. Schema Drizzle / migração `0001`

**`lessons`**
| Coluna | Tipo | Notes |
|--------|------|--------|
| `attendance_keyword` | text nullable | palavra do professor |
| `is_attendance_open` | integer bool default 0 | |
| `attendance_expires_at` | integer nullable | epoch-ms |

**`attendances`** (nova)
| Coluna | Tipo |
|--------|------|
| `id` | text PK (UUID) |
| `lesson_id` | text FK → lessons.id cascade |
| `student_id` | text FK → users.id cascade |
| `status` | text enum `PRESENT \| ABSENT \| JUSTIFIED` |
| `confirmed_at` | integer nullable (epoch-ms) |

Unique: `(lesson_id, student_id)`.

**`users`**
- `suspension_reason` text nullable.

Atualizar `tests/utils/test-db.ts` (DDL) e rodar migração local/remote quando for implementar.

### 2. Normalização e validação (confirm)

Função pura (testável): `normalizeKeyword(s) = s.trim().toLowerCase()` com normalização Unicode (`normalize("NFC")` ou equivalente estável). Comparar aluno vs `lessons.attendance_keyword` **após** normalizar as duas.

`confirmAttendance` rejeita quando qualquer uma falhar:
1. aula existe; `is_attendance_open === true`
2. `attendance_expires_at` não expirou (`Date.now() <= expires_at`)
3. não há linha `PRESENT` do aluno nesta aula
4. `users.status === "ACTIVE"` (não suspensa nem pending)

Mensagem única: `"Palavra-chave incorreta ou chamada encerrada."` (ou de status: `"Conta não ativa."` / `"Você já confirmou presença."` quando couber — mas a de palavra/chamada é a principal pedida).

### 3. Actions — `src/lib/actions/attendance.ts`

Padrão do repo: função core com `db` primeiro + wrapper com sessão TEACHER/STUDENT + `revalidatePath`.

| Action | Quem | Efeito |
|--------|------|--------|
| `saveAttendanceKeyword` | TEACHER | grava keyword (trim); não mexe em open |
| `openAttendance` | TEACHER | exige keyword não vazia + `durationMinutes` (int ≥1); set open=true, expires_at=now+min |
| `closeAttendance` | TEACHER | open=false; para cada ACTIVE sem linha → insert `ABSENT` |
| `justifyAbsence` | TEACHER | upsert status=`JUSTIFIED`, confirmed_at=now se null |
| `suspendStudentFromLesson` | TEACHER | `users.status=SUSPENDED` + `suspension_reason` (input livre/“Faltas à chamada”); manter guarda “último professor ativo” |
| `confirmAttendance` | STUDENT | validações §2 → upsert `PRESENT` |

`Result` = `{ ok, error? }` como em `students.ts`.

### 4. UI

**Professor — `/admin/lessons/[id]/attendance`** (Server + client `AttendancePanel`)
- Header: título, data, badge aberta/fechada + expiração
- Input palavra-chave + botão Salvar; toggle Abrir (com minutos) / Fechar
- Contador `X de Y alunos confirmaram`
- Tabela: aluno · status · horário · Justificar (se ABSENT) · Suspender
- Link “Chamada” na listagem `/admin/lessons` (junto a Respostas)

**Aluno — `/dashboard/lessons/[id]`**
- Se open e não PRESENT: card destaque “Confirmar Presença na Aula” + input + botão → `confirmAttendance` + toast
- Se PRESENT: badge verde “Presença Confirmada em {data/hora}”
- Se fechada: sem card de envio (badge se já confirmou)

**Suspensão:** sem nova rota; `statusRedirectPath` já manda para `/dashboard/suspended`. Opcional: mostrar `suspension_reason` se a sessão/session-refresh expuser — se não, texto genérico atual basta (YAGNI: só expor se trivial no mesmo cycle).

### 5. Testes

- `tests/actions/attendance.test.ts` + seed mínimo em `createTestDb`:
  - normalização (`" Graça "` vs `"GRAÇA"`)
  - porta fechada / expirada
  - duplicata PRESENT
  - aluno não ACTIVE
  - open exige keyword; close gera ABSENT
  - justify e suspend (incl. último professor)
- Validação de input nos schemas zod em `validation/schemas.ts` (durationMinutes, keyword min 1)
- `npm test`, `lint`, `typecheck` verdes

## Critérios de aceite

- [ ] Migração aplicada; schema + test-db coerentes
- [ ] Professor abre/fecha chamada com prazo; keyword normalizada
- [ ] Aluno confirma; badge permanente; toast de erro amigável
- [ ] Tabela com Presente/Ausente/Justificada + justificar + suspender
- [ ] Suspensa → `/dashboard/suspended`
- [ ] Testes/lint/typecheck verdes; deploy + smoke

## Riscos

- **Colação/acentos:** normalização Unicode explícita nos testes (GRAÇA/graça).
- **Expiração vs fechar:** checagem no confirm usa `expires_at` mesmo se professor esquecer de fechar; close materializa ABSENT.
- **Migração D1:** ordem apply local/remote no plano de implementação.
