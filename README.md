# Zion Class 📖

**Uma "sala de aula virtual" para o grupo de estudos bíblicos da igreja.**

As aulas são **presenciais** (sempre às terças). Aqui a gente só guarda tudo organizadinho: o que vamos estudar, links de apoio e as dúvidas/respostas de cada aluno — para ninguém perder nada.

---

## Para uma criança: do que se trata?

Imagine uma **prateleira de vídeos estilo Netflix**, mas no lugar de filmes tem **nossos estudos da Bíblia**:

1. **Você entra** com seu e-mail e senha (como no jogo do tablet).
2. **Um professor** te dá "boas-vindas" antes de você ver as aulas (é só clique nele uma vez).
3. Na **vitrine**, tem um anúncio grande da aula mais nova e uma fileirinha de cartões com fotos — cada cartão é um estudo.
4. Dentro da aula tem:
   - a **descrição** do que vamos ver na terça;
   - um **vídeo complementar** do YouTube (só quando existe — a aula em si é presencial!);
   - **links de apoio** (PDF, slides, etc.);
   - um **questionário** para você mandar suas respostas ou dúvidas para o professor.
5. Se você respondeu tudo, o cartão ganha um **✓ Respondida** de orgulho. Deu para editar depois? Pode — o sistema só anota a data da última versão.

E o **professor** tem um painel escondido (só ele consegue entrar):

- cria aula, cola link do vídeo e dos materiais, escreve as perguntas;
- vê **quem respondeu o quê**, numa tabela bem grande, e pode **baixar tudo em Excel**;
- **aprova** quem acabou de se cadastrar e suspende quem precisar.

---

## Como ele funciona por "dentro" (arquitetura — explicação simples)

Se a aplicação fosse uma **casa**, ficaria assim:

| Parte da casa | O que é no Zion Class | Em português de gente |
|---|---|---|
| 🚪 **Portão com chaveiro** | Login e cadastro | Só quem tem senha entra. A senha é guardada **cozida** (nem o computador lê ela direito). |
| 📋 **Caderninho do porteiro** | Cookie de sessão (JWT HTTP-only) | Depois do login, o navegador guarda um "crachá" invisível que prova quem você é. |
| 🚧 **Segurança do corredor** | `middleware.ts` | Um vigia na porta: aluno não entra na sala `/admin`, e visitante sem crachá volta pro portão. |
| 🛋️ **Sala dos alunos** | `/dashboard` | A vitrine Netflix + páginas das aulas + questionários. |
| 🧑‍🏫 **Sala do professor** | `/admin` | Cria aulas, lê respostas, aprova alunos. |
| 🗄️ **Armário de gavetas** | Cloudflare **D1** (banco) | Cada gaveta é uma tabela: `users`, `lessons`, `materials`, `questions`, `answers`. |
| 📐 **Fichário que desenha as gavetas** | Drizzle ORM | Um "modo fácil" de falar com o armário sem decorar endereços. |
| ☁️ **A casa em si (na nuvem)** | Cloudflare Pages + OpenNext | O site mora na nuvem da Cloudflare — rápido para todo mundo, inclusive pelo celular. |
| 🍪 **Receita dos biscoitos** | Server Actions + zod | Quando você clica em "salvar", o servidor confere se está tudo certinho antes de guardar. |

### O caminho de uma resposta (passo a passo)

```
Aluno responde o questionário
        ↓
Navegador manda para o servidor (Server Action)
        ↓
O vigia confere: tem crachá? é ACTIVE? é da rota certa?
        ↓
zod confere o formato da resposta
        ↓
Drizzle escreve na gaveta "answers" (1 por pergunta por aluno)
        ↓
"Respostas salvas!" 🎉 + data na tela
```

### Quem é quem

- **Aluno (`STUDENT`)**: vê vitrine, aulas publicadas e responde questionários.
- **Professor (`TEACHER`)**: faz tudo do aluno **mais** o painel `/admin`.
- **Status**: `PENDING` (esperando aprovação) → `ACTIVE` (pode tudo) → `SUSPENDED` (suspenso).

---

## Stack (as "peças de LEGO" do projeto)

- **Next.js 15** (App Router) + **TypeScript** — a casa e as salas
- **Tailwind CSS + shadcn/ui + lucide-react** — pintura, móveis e ícones
- **Cloudflare D1 + Drizzle ORM** — armário (gavetas)
- **JWT (jose) em cookie HTTP-only + scrypt** — chaveiro e crachá
- **sonner** — mensagens de "deu certo / deu errado"
- **Vitest** — os testes (baterias do robô)

---

## Comandos básicos

```bash
npm install
npm run dev          # ambiente local
npm run db:generate  # gerar migração
npm run db:migrate   # aplicar no D1
npm run db:seed      # cria o 1º professor + aulas de exemplo
npm run lint         # checagem de estilo
npm run typecheck    # checagem de tipos
npm test             # testes
```

Deploy: `@opennextjs/cloudflare` → Cloudflare Pages com binding D1.

---

## Estrutura de pastas

```
src/
  db/            # gavetas (schema) + seed
  lib/auth/      # chaveiro e crachá
  lib/actions/   # o que acontece quando você clica nos botões
  lib/validation/# regras do que é uma resposta válida
  app/(auth)/    # login e cadastro
  app/dashboard/ # sala dos alunos (vitrine)
  app/admin/     # sala do professor
  components/    # móveis reutilizáveis
docs/superpowers/specs/  # o "projeto de arquitetura" completo
```

---

## Documentação de design

O spec completo (todas as decisões):  
[`docs/superpowers/specs/2026-09-22-zion-class-design.md`](docs/superpowers/specs/2026-09-22-zion-class-design.md)
