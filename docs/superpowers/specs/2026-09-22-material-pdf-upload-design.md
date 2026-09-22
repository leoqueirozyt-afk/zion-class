# Zion Class — Upload de PDF nos Materiais

**Data:** 2026-09-22
**Status:** Aprovado pelo usuário (revisão: storage R2 → Workers KV, sem cartão)
**Escopo:** Permitir que o professor dê upload de PDF nos materiais da aula (além de links externos) e que o aluno baixe o arquivo automaticamente ao clicar.
**Relação com a spec original:** altera a decisão #2 ("Materiais — só links externos, sem upload") e remove "Upload de arquivos" do YAGNI (seção 9 da spec `2026-09-22-zion-class-design.md`). Demais decisões da spec original permanecem válidas.

---

## 1. Contexto e objetivos

O form de materiais (`src/components/admin/lesson-form.tsx`) só aceita URL por material, e `materials-list.tsx` abre tudo em nova aba. O professor quer subir o PDF direto na plataforma e o aluno, ao clicar em baixar, receber o arquivo já em download automático (sem preview em aba).

**Restrição de infra:** o R2 exige cartão na conta Cloudflare; o usuário não quer cartão. Storage = **Workers KV** (plano free, sem cartão).

**Objetivos:**

1. Professor seleciona um `.pdf` (máx. 25 MB) no form de materiais, além de poder continuar adicionando links externos.
2. Aluno clica no material PDF e o navegador baixa o arquivo automaticamente (`Content-Disposition: attachment`).
3. Links externos existentes e novos continuam abrindo em nova aba, como hoje.

## 2. Decisões de requisitos

| # | Tema | Decisão |
|---|------|---------|
| 1 | Fontes no form | **Upload + link** no mesmo form (toggle por linha) |
| 2 | Acesso ao arquivo | **Público** — qualquer pessoa com a URL baixa, sem login (rota pública da app) |
| 3 | Tipos de arquivo | **Só PDF** (mime `application/pdf` e/ou extensão `.pdf`) |
| 4 | Tamanho máximo | **25 MB** (teto do valor no KV) |
| 5 | Storage | **Workers KV** — namespace `zion-class-materials`, binding `MATERIALS` (sem cartão) |
| 6 | URL pública | **Rota da app** `GET /files/…` (`Content-Disposition` garantido pela rota) |
| 7 | Download do aluno | Clique → download inline automático (sem `target="_blank"` para PDFs) |
| 8 | Migração de dados | **Nenhuma** — materiais já existentes são URLs externas e permanecem válidos |

## 3. Arquitetura

### 3.1 Infra

- Namespace KV: criar via `wrangler kv namespace create MATERIALS` (plano free).
- Binding no `wrangler.jsonc` (sem `r2_buckets`):

```jsonc
"kv_namespaces": [
  { "binding": "MATERIALS", "id": "<id_do_namespace>" }
]
```

- `getMaterialsBucket()` expõe a interface `MaterialsBucket` (`put` / `get` / `list({prefix})` / `delete(keys[])`) por cima da API do KV:
  - `put(key, ArrayBuffer)` — sem `httpMetadata` (headers HTTP são da rota);
  - `get(key)` → `{ arrayBuffer() } | null`;
  - `list({ prefix })` → adapta `keys[].name` para `{ objects: [{ key }] }` (uma página basta: &lt; 1000 keys/aula);
  - `delete(keys[])` → itera `kv.delete(key)` (API do KV é 1 chave por chamada).

### 3.2 Chave e URL

- Chave KV: `materials/{lessonId}/{materialId}.pdf` (`materialId` = `crypto.randomUUID()` no insert).
- `materials.url` guarda o **caminho da rota pública**: `/files/{lessonId}/{materialId}.pdf` quando é upload; URL externa `https://…` quando é link. Regra zod do campo: ver 4.2.

### 3.3 Fluxo de upload (professor)

1. Na linha de materiais, toggle **Link | Arquivo**; no modo arquivo, `<input type="file" accept=".pdf,application/pdf">`.
2. `MaterialRow` tem `file?: File | null` e `mode?: "link" | "file"`. No submit, materiais com arquivo entram no `materialsJson` marcados com `"_file": <í>` e o `File` vai no `FormData` como `file_<í>`.
3. `saveLessonAction` (protegida por `requireTeacher` → `TEACHER`+`ACTIVE`):
   - valida PDF: `file.type === "application/pdf"` **ou** nome termina em `.pdf`;
   - valida `file.size <= 25 * 1024 * 1024` → erro `"PDF deve ter no máximo 25 MB"`;
   - `put` na KV;
   - `materials.url` = `/files/{lessonId}/{materialId}.pdf`, `type` = `"PDF"`.
4. Linha só com URL: comportamento e validação atuais (zod `url`).

### 3.4 Fluxo de download (aluno)

- Rota **pública** `GET /files/[...path]` (Route Handler):
  - `path` deve casar com regex estrita `^materials/[0-9a-f-]+/[0-9a-f-]+\.pdf$` (sem `..`, sem path traversal);
  - `get(key)` nulo → `404`;
  - ok → `Response` com `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="…"`, `Cache-Control: public, max-age=31536000, immutable`.
- Sem checagem de sessão (middleware: `pathname.startsWith("/files/")` é allow sem sessão).
- `materials-list.tsx`: se `m.type === "PDF"` → âncora **sem** `target="_blank"`; `LINK`/`IMAGE`/`DOCUMENT` → nova aba como hoje.

### 3.5 Edição/exclusão e limpeza de chaves órfãs

- `saveLesson` com `existingId` faz `delete` das linhas de `materials` e reinsere.
- Ao editar: **listar o prefixo** `materials/{lessonId}/`, apagar chaves **exceto** as referenciadas por `materials.url` = `/files/…` que serão preservadas, e gravar os uploads desta edição. Menos estado do que diff por material; arquivos mantidos sobrevivem sem re-upload.
- Excluir aula (`deleteLesson`): apagar **todo** o prefixo `materials/{lessonId}/`.

## 4. Modelo de dados e validação

### 4.1 Schema D1

**Sem migração.** Tabela `materials` inalterada:

`id` PK · `lesson_id` FK cascade · `title` · `url` · `type` (`PDF|LINK|IMAGE|DOCUMENT`)

`url` agora pode ser URL externa **ou** caminho `/files/…`.

### 4.2 Schema zod (`materialSchema`)

- O client **não envia `url`** para linha com arquivo (envia `url: ""`); a action preenche `url` = `/files/…` **após** o `put` na KV.
- Refine do `url`: **ou** URL absoluta válida (modo link), **ou** caminho iniciado em `/files/` (upload mantido na edição), **ou** string vazia **apenas** quando `"_file"` está presente.
- Campo opcional no input: `"_file"?: number` (índice no FormData); não vai para o insert.

## 5. UI

### 5.1 Form do professor (`lesson-form.tsx`)

- Linha: **Título · [Link: input URL | Arquivo: escolher PDF + nome/tamanho] · toggle Link|Arquivo · Tipo · remover**.
- Default **Link**; edição de material com `url` `/files/…` abre em modo Arquivo (“Arquivo atual — trocar PDF…”).
- `accept=".pdf,application/pdf"`; ✕ limpa o arquivo e volta ao modo link.
- Com `file` na linha: `type` trava em `PDF`.
- Uma fonte por linha: ou `url`, ou `file`. Submit sem nenhum → toast `"Informe o link ou o PDF"`.
- Submit: `file_<í>` no `FormData` + `"_file": <í>` no `materialsJson` (`buildLessonFormData` em `src/lib/admin/lesson-form-data.ts`).

### 5.2 Lista do aluno (`materials-list.tsx`)

- PDF: mesma linha, **sem** `target="_blank"`/`rel`/`ExternalLink`; ícone `FileText` e badge `PDF` permanecem.
- Demais tipos: inalterado.

## 6. Erros e feedback

| Caso | Comportamento |
|------|----------------|
| Arquivo > 25 MB | Toast `"PDF deve ter no máximo 25 MB"` |
| Arquivo não é PDF | Toast `"Só é permitido enviar PDF"` |
| Linha sem link e sem arquivo | Toast `"Informe o link ou o PDF"` (client) |
| Falha no `put` KV | Toast `"Não foi possível enviar o PDF. Tente novamente."` + `console.error` |
| Binding ausente / sem contexto CF | Mesmo erro de put (bucket `null` no upload) |
| `GET /files/…` chave inexistente/formato inválido | `404` |
| URL inválida em modo link | zod como hoje |

## 7. Testes (Vitest)

- **Unit — validação:** `validatePdf` (mime/extensão, 25 MB); `materialSchema` com URL externa, `/files/…`, `_file`; regex `/files` rejeita `..` e formatos errados.
- **Unit — form:** `buildLessonFormData` (`_file`, `file_<í>`, mantém `/files/…` sem novo arquivo).
- **Ação:** `saveLesson` com mock de `MaterialsBucket` — `put` na chave certa; rejeita >25 MB e non-PDF; `url` = `/files/…`; edição preserva keys referenciados e apaga órfãos; `deleteLesson` limpa prefixo.
- **Rota `/files`:** 200 + headers; 404 em `get` nulo; 404 em path inválido.
- **UI:** `MaterialsList` — PDF sem `target="_blank"`; LINK com `target="_blank"`.
- **Guards:** `evaluateAccess(null, "/files/…")` → allow.

Os mocks testam a interface `MaterialsBucket`, não a API crua do KV — o adapter KV é a única peça específica de plataforma.

## 8. Deploy / operação

1. `wrangler kv namespace create MATERIALS` (free, sem cartão)
2. Colocar o `id` em `kv_namespaces` no `wrangler.jsonc` (remover qualquer `r2_buckets`)
3. `npm run deploy`
4. D1: **sem migração**

## 9. Fora de escopo (YAGNI)

Upload de imagem/outros tipos · quota por aluno · antivírus · rename de arquivo existente · custom domain · administração do bucket · signed URLs · pastas por turma · R2 (exige cartão).

## 10. Critérios de aceite

1. Upload de PDF (≤25 MB, só PDF) → `materials.url` = `/files/…`, `type = PDF`, objeto na KV.
2. Links externos continuam no mesmo form (toggle por linha).
3. Aluno clica no PDF → download automático, sem nova aba.
4. Link externo abre em nova aba.
5. >25 MB ou não-PDF → toast de erro; nada gravado na KV nem no D1.
6. Editar aula não deixa chaves órfãas no prefixo da KV.
7. `/files/…` é pública e serve `Content-Disposition: attachment`.
8. `npm test` + `lint` + `typecheck` verdes.
