# Zion Class — Upload de PDF nos Materiais

**Data:** 2026-09-22
**Status:** Aprovado pelo usuário (design conversacional)
**Escopo:** Permitir que o professor dê upload de PDF nos materiais da aula (além de links externos) e que o aluno baixe o arquivo automaticamente ao clicar.
**Relação com a spec original:** altera a decisão #2 ("Materiais — só links externos, sem upload, sem R2") e remove "Upload de arquivos/R2" do YAGNI (seção 9 da spec `2026-09-22-zion-class-design.md`). Demais decisões da spec original permanecem válidas.

---

## 1. Contexto e objetivos

Hoje o form de materiais (`src/components/admin/lesson-form.tsx`) só aceita URL por material, e `materials-list.tsx` abre tudo em nova aba. O professor quer subir o PDF direto na plataforma e o aluno, ao clicar em baixar, receber o arquivo já em download automático (sem preview em aba).

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
| 4 | Tamanho máximo | **25 MB** |
| 5 | Storage | **Cloudflare R2** (bucket `zion-class-materials`) |
| 6 | URL pública | **Rota da app** `GET /files/…` (não depende de custom domain do R2; `Content-Disposition` garantido) |
| 7 | Download do aluno | Clique → download inline automático (sem `target="_blank"` para PDFs) |
| 8 | Migração de dados | **Nenhuma** — materiais já existentes são URLs externas e permanecem válidos |

## 3. Arquitetura

### 3.1 Infra

- Bucket R2: `zion-class-materials` (criado via `wrangler r2 bucket create`).
- Binding no `wrangler.jsonc`:

```jsonc
"r2_buckets": [
  { "binding": "MATERIALS", "bucket_name": "zion-class-materials" }
]
```

### 3.2 Chave e URL

- Chave R2: `materials/{lessonId}/{materialId}.pdf` (`materialId` = `crypto.randomUUID()` já usado no insert).
- `materials.url` guarda o **caminho da rota pública**: `/files/{lessonId}/{materialId}.pdf` quando é upload; URL externa `https://…` quando é link. Regra zod do campo: ver 4.2.
- Gravação no R2:

```ts
await env.MATERIALS.put(key, file.stream(), {
  httpMetadata: {
    contentType: "application/pdf",
    contentDisposition: 'attachment; filename="material.pdf"',
  },
});
```

### 3.3 Fluxo de upload (professor)

1. Na linha de materiais, toggle **Link | Arquivo**; no modo arquivo, `<input type="file" accept=".pdf,application/pdf">`.
2. `MaterialRow` ganha `file?: File | null`. No submit, materiais com arquivo entram no `materialsJson` marcados com `"_file": <í>` e o `File` vai no `FormData` como `file_<í>`.
3. `saveLessonAction` (já protegida por `requireTeacher` → `TEACHER`+`ACTIVE`):
   - valida PDF: `file.type === "application/pdf"` **ou** nome termina em `.pdf` (defesa em camadas);
   - valida `file.size <= 25 * 1024 * 1024` → erro `"PDF deve ter no máximo 25 MB"`;
   - `put` no R2 com metadata de `Content-Type`/`Content-Disposition`;
   - `materials.url` = `/files/{lessonId}/{materialId}.pdf`, `type` = `"PDF"`.
4. Linha só com URL: comportamento e validação atuais (zod `url`).

### 3.4 Fluxo de download (aluno)

- Rota **pública** `GET /files/[...path]` (Route Handler):
  - `path` deve casar com regex estrita `^materials/[0-9a-f-]+/[0-9a-f-]+\.pdf$` (sem `..`, sem path traversal);
  - `MATERIALS.get(key)` nulo → `404`;
  - ok → `Response` com `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="…"`, `Cache-Control: public, max-age=31536000, immutable`.
- Sem checagem de sessão (decisão #2).
- `materials-list.tsx`: se `m.type === "PDF"` → âncora **sem** `target="_blank"` (download automático); `LINK`/`IMAGE`/`DOCUMENT` → nova aba como hoje.

### 3.5 Edição/exclusão e limpeza de objetos órfãos

- `saveLesson` com `existingId` já faz `delete` das linhas de `materials` e reinsere.
- **Decisão:** ao editar, **apagar todo o prefixo** `materials/{lessonId}/` no R2 (`list({ prefix })` + `remove()`) e **regravar** os arquivos dos materiais com upload nesta edição. Menos estado a rastrear do que diff por material.
- Excluir aula (`deleteLesson`): apagar também o prefixo `materials/{lessonId}/`.

## 4. Modelo de dados e validação

### 4.1 Schema D1

**Sem migração.** Tabela `materials` inalterada:

`id` PK · `lesson_id` FK cascade · `title` · `url` · `type` (`PDF|LINK|IMAGE|DOCUMENT`)

`url` agora pode ser URL externa **ou** caminho `/files/…`.

### 4.2 Schema zod (`materialSchema`)

- O client **não envia `url`** para linha com arquivo (envia `url: ""`); a action preenche `url` = `/files/…` **após** o `put` no R2.
- Regra do campo `url` no input do `lessonSchema` (refine): **ou** `z.string().url()` válida (modo link), **ou** string vazia **apenas** quando `"_file"` está presente. Após a action processar, o valor gravado em D1 é sempre URL externa ou caminho `/files/…` (nunca vazio).
- Novo campo opcional no input: `"_file"?: number` (índice no FormData), removido antes do insert.

## 5. UI

### 5.1 Form do professor (`lesson-form.tsx`)

- Linha de material: **Título · [modo Link: input URL | modo Arquivo: input file + nome/tamanho] · Tipo · remover**.
- Toggle discreto (dois botões pequenos ou `Link`/`Arquivo`) controla o modo da linha; default **Link** (botão “Adicionar” cria linha em link).
- Modo arquivo: `accept=".pdf,application/pdf"`; mostrar nome e tamanho do arquivo selecionado; ✕ para voltar ao modo link.
- Ao houver `file` na linha: `type` força `PDF` (select travado enquanto houver arquivo).
- Uma fonte por linha: ou `url`, ou `file` — nunca ambos. Submit sem nenhum dos dois → toast `"Informe o link ou o PDF"`.
- Submit: se houver `file`, anexa no `FormData` (`file_<í>`) e marca `"_file": <í>` no `materialsJson`.

### 5.2 Lista do aluno (`materials-list.tsx`)

- PDF: manter o visual atual da linha, **somente** removendo `target="_blank"`/`rel` (e o `ExternalLink`) para que o clique dispare download inline; ícone `FileText` e badge `PDF` permanecem.
- Demais tipos: inalterado.

## 6. Erros e feedback

| Caso | Comportamento |
|------|----------------|
| Arquivo > 25 MB | Toast erro `"PDF deve ter no máximo 25 MB"` (validação na action) |
| Arquivo não é PDF | Toast erro `"Só é permitido enviar PDF"` |
| Linha sem link e sem arquivo | Toast erro `"Informe o link ou o PDF"` (client, no submit) |
| Falha no `put` R2 | Toast `"Não foi possível enviar o PDF. Tente novamente."` + `console.error` (padrão da spec 5.4) |
| `GET /files/…` chave inexistente/formato inválido | `404` (sem stack) |
| URL inválida em modo link | zod como hoje |

## 7. Testes (Vitest)

- **Unit — validação:** helper de validação de PDF (mime/extensão, 25 MB); `materialSchema` com `url` externa, com `/files/…`, com `_file`; regex da rota `/files` rejeita `..` e formatos errados.
- **Unit — form logic:** montagem do `FormData` + `materialsJson` com marcador `_file`; toggle de modo em `MaterialRow`.
- **Ação:** `saveLesson` com R2 mock — `put` chamado com chave `materials/{lessonId}/{materialId}.pdf` e headers certos; rejeita >25 MB e non-PDF; `url` = `/files/…`; update apaga prefixo e regrava; `deleteLesson` remove prefixo.
- **Rota `/files`:** handler com R2 fake → 200 + `Content-Type`/`Content-Disposition`/`Cache-Control`; 404 em `get()` nulo; 404 em path inválido.
- **UI:** `MaterialsList` — PDF sem `target="_blank"`; LINK com `target="_blank"`.

## 8. Deploy / operação

1. `wrangler r2 bucket create zion-class-materials`
2. Adicionar binding `MATERIALS` em `wrangler.jsonc`
3. `npm run deploy` (OpenNext build + deploy worker)
4. D1: **sem migração**

## 9. Fora de escopo (YAGNI)

Upload de imagem/outros tipos · quota/armazenamento por aluno · antivírus/scanning · rename manual de arquivo já existente · custom domain do R2 · listagem/administração de objetos do bucket · signed URLs com expiração (acesso é público por decisão) · pastas por turma.

## 10. Critérios de aceite

1. Professor adiciona material com upload de PDF (≤25 MB, só PDF) e salva a aula — `materials.url` = `/files/…`, `type = PDF`.
2. Professor ainda pode adicionar links externos no mesmo form (toggle por linha).
3. Aluno clica no material PDF → download automático inicia, sem abrir nova aba.
4. Link externo continua abrindo em nova aba.
5. Upload >25 MB ou não-PDF → toast de erro, nada é gravado no R2 nem no D1.
6. Editar aula não deixa objetos órfãos no R2 (prefixo limpo e regravado).
7. Rota `/files/…` é pública (sem login) e serve `Content-Disposition: attachment`.
8. Testes novos verdes + `lint`/`typecheck` verdes.
