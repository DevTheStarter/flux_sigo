# Fluxo — Specification

**Version 1.1 · 21 September 2026**
**Stack: Next.js on Vercel · Supabase · Resend**

This is the single source of truth for building Fluxo. It supersedes every earlier document, prototype note and chat decision. Where this document and the HTML prototype disagree, this document wins. Where this document is silent, ask before assuming.

Read it fully before writing code.

---

## 1. What Fluxo is

A multi-tenant web application for DGERT-certified Portuguese training entities. It shows the state of each training action (*ação de formação*) across the six phases of the SIGO certification process, warns about deadlines, holds the step-by-step documentation for each phase, and hands the user a ready-to-paste instruction for the phase that is due.

**Fluxo does not run the phases.** The entity runs them with its own AI assistant (Claude in Chrome), on its own computer, with its own SIGO session. Fluxo reads the entity's database, derives where each action stands, and tells people what to do next.

**Fluxo calls no LLM.** There is no Anthropic key, no model, no inference anywhere in this codebase. This is deliberate and permanent.

### 1.1 The six phases

| Phase | Name (PT) | Column label | What the entity does in SIGO |
|---|---|---|---|
| 0 | Recolha de dados | Dados | Collect student personal data from emails and contracts into the database |
| 1 | Perfis de formandos | Perfis | Check or create each student's SIGO profile |
| 2 | Curso e módulos | Curso | Check or create the course and its modules |
| 3 | Criação da ação | Ação | Create the action, submit, associate first student, activate |
| 4 | Inscrição e certificação | Certificação | Enrol all students, enter grades, issue certificates |
| 5 | Conclusão | Conclusão | Download certificate PDFs, upload to the database, conclude the action |

Phases 1 and 2 can run in parallel. Phase 3 requires both. Phase 4 requires 3. Phase 5 requires 4.

### 1.2 Users and roles

| Role | Who | What they see |
|---|---|---|
| `staff` | TheStarter | Everything an entity sees for their own TheStarter entity, plus an **Entidades** section and edit rights on documentation |
| `admin` | Entity administrator | Board, documentation, all settings, can invite users |
| `gestor` | Entity user | Board, documentation, own notification preferences |
| `leitura` | Entity read-only | Board and documentation, no settings |

Same interface for everyone. Role only adds or removes capabilities. Staff **never** sees any client entity's board, actions, or logs — see §9.

### 1.3 Out of scope for v1

No LLM calls. No chat interface. No browser automation on our side. No task ownership or assignment. No public signup. No billing or payments. No multi-language (PT-PT only).

---

## 2. Non-negotiable constraints

These decide the legal position of the product. Violating any of them changes what the contract with clients can say.

1. **Never persist operational data.** Actions and execution logs are read live from the entity's database, held in memory for the request, and never written to our database.
2. **Never read the students table.** The adapter has a field whitelist. Nothing outside it is ever requested. The students table is not on it.
3. **Never write to the entity's database.** The adapter exposes no write method.
4. **Staff has no route that returns entity board content.** Admin routes return entities, users, documentation and reported problems. Nothing else. Test this with two tenants.
5. **The SIGO password and the flows' database token never reach the server.** They live in the browser's localStorage only. Fluxo's own read-only credential is a separate token. See §8.1 and §8.4.
6. **Column position is derived, never stored.** See §4.2.
7. **Tenant isolation is enforced by row-level security**, not by application code.
8. **EU region everywhere.** Vercel Frankfurt, Supabase EU, Resend EU. Region is chosen at project creation and cannot be changed later.

---

## 3. Stack and repository

| Layer | Choice |
|---|---|
| Framework | Next.js 14+, App Router, TypeScript |
| Hosting | Vercel, region `fra1` |
| Database and auth | Supabase, EU region |
| Email | Resend, EU region |
| Scheduled jobs | Vercel Cron |
| Data source | Adapter interface; Airtable first (§7) |
| Typeface | Inter, self-hosted |

No third-party scripts loaded from external origins. No UI component library. No CSS framework. Plain CSS with variables.

```
/
├── app/
│   ├── (auth)/
│   │   ├── entrar/                 # login
│   │   ├── recuperar/              # request reset link
│   │   └── definir/[token]/        # set password from invite or reset
│   ├── (app)/
│   │   ├── quadro/                 # board
│   │   ├── documentacao/
│   │   │   └── [nome]/             # reader
│   │   ├── definicoes/             # settings, tabbed
│   │   └── entidades/              # staff only
│   └── api/
│       ├── quadro/                 # derived board for the caller's tenant
│       ├── vistas/
│       ├── notificacoes/
│       ├── problemas/              # incident reports + attachments
│       ├── documentos/
│       ├── cron/
│       │   ├── relatorio/          # weekly report
│       │   └── prazos/             # deadline notifications
│       └── admin/                  # staff only, service role
├── lib/
│   ├── dados/
│   │   ├── interface.ts            # FonteDeDados contract
│   │   ├── airtable.ts             # adapter
│   │   ├── derivar.ts              # column and state
│   │   └── prazos.ts               # deadline calculation
│   ├── docs/
│   │   ├── resolver.ts             # base + variation resolution
│   │   ├── variaveis.ts            # {{KEY}} substitution
│   │   └── markdown.ts             # md → html
│   ├── supabase/
│   ├── cifra/                      # AES-256-GCM
│   ├── email/
│   └── log/                        # header-filtering logger
├── components/
└── docs/                           # this file and the legal documents
```

---

## 4. The board

### 4.1 Layout

Six columns, one per phase, in order. Each card is one action. Cards are sorted within a column: active first, then done.

Header shows three counters, each a quick filter when clicked: **atrasadas**, **hoje**, **bloqueadas**. Atrasadas and bloqueadas turn red when above zero. Below the header: the views bar, then a search field.

Column header shows the phase label and the count of visible cards.

### 4.2 Deriving column and state

Never stored. Computed on every read.

```typescript
export function derivar(a: Acao, logs: Registo[], cfg: Prazos): Cartao {
  const meus = logs.filter(l => l.acaoId === a.id)
  const ok = (f: number) => meus.some(l => l.flow === f && l.estado === 'success')

  // column = first phase without a success log
  let col = 0
  while (col <= 5 && ok(col)) col++

  if (col > 5) {
    const ultimo = meus.filter(l => l.flow === 5 && l.estado === 'success').sort(byDataDesc)[0]
    return { col: 6, estado: 'done', concluidaHa: diasDesde(ultimo.data) }
  }

  if (diasAte(a.dataFim) > cfg.entrada) return { col, estado: 'futura', entraEm: diasAte(a.dataFim) - cfg.entrada }

  if (col === 4 && !a.temAvaliacoes) return { col, estado: 'blocked', motivo: 'Falta tabela de avaliações' }

  const ultimo = meus.filter(l => l.flow === col).sort(byDataDesc)[0]
  if (ultimo?.estado === 'error')        return { col, estado: 'error',   motivo: ultimo.detalhe }
  if (ultimo?.estado === 'missing_data') return { col, estado: 'blocked', motivo: ultimo.detalhe }

  const prazo = calcularPrazo(a, col, meus, cfg)
  const d = diasAte(prazo)
  if (d < 0)  return { col, estado: 'late',  dias: -d }
  if (d === 0) return { col, estado: 'today' }
  return { col, estado: 'ok', dias: d }
}
```

Phases 1 and 2 are parallel but occupy separate columns. A card sits in the first of the two without a success log. Showing a card twice is worse than this simplification.

### 4.3 States and appearance

| State | Meaning | Card | Counter |
|---|---|---|---|
| `ok` | Deadline in the future | Grey border, grey deadline text | — |
| `today` | Deadline is today | Black border, black bold "Hoje" | hoje |
| `late` | Deadline passed | Red border, pale red background, red text | atrasadas |
| `error` | Latest log for current phase is Error | Same as late, shows `motivo` | atrasadas |
| `blocked` | Missing Data log, or phase 4 without grades table | Dashed red border, pale red, shows `motivo` | bloqueadas |
| `done` | Phase 5 succeeded | 38% opacity, "Concluída há N dias" | — |
| `futura` | End date beyond the entry window | Dashed, 50% opacity, "Entra daqui a N dias" | — |

**Red is only for what is stuck.** `today` is urgent but not stuck, and stays black. Do not add colour anywhere else.

### 4.4 Hiding to keep the board usable

- **Done cards** show for 7 days after conclusion, then hide behind a link at the bottom of the Conclusão column: "Ver N concluídas há mais de uma semana". Clicking shows them; clicking again hides.
- **Future cards** hide behind a link at the bottom of the Dados column: "Ver N futuras". Same toggle behaviour.
- Column counts reflect what is visible.

### 4.5 Views

A view is a named list of conditions, all of which must hold (AND). Fields: `ano`, `formato`, `tipo`, `estado`, `diasSemana`. Operators: `=`, `≠`, `em` (in list).

Two views are seeded per tenant: **Todas** (no conditions, cannot be deleted) and **A precisar de atenção** (`estado em late,today,blocked,error`). Users create, edit and delete their own; views are shared within the tenant.

Deleting a view asks for confirmation and states how many conditions are lost.

Quick filters from the counters narrow the active view further (AND, not OR) and are cleared with a link.

### 4.6 Search

Text field below the views bar. Matches action name or course code, case-insensitive. Subtitle shows "N resultados para "x"" while searching, and a "limpar" link.

### 4.7 Card detail

Opens on click. Desktop: modal. Mobile: full-screen page with sticky header and ×.

Contents, in order:

1. Name, course code, type
2. **Progresso**: the six phases. Filled dot = done (with date), outlined dot = current (with deadline or state), faded = not yet
3. Table: dates, days of week, formandos (count), format, and **duração estimada** for the current phase (§4.8)
4. **Notificar** button (§10.2)
5. Action block, depending on state:
   - `ok` / `today` / `late`: **Copiar instrução do Flow N** (§4.9). If phase 4 and formandos ≥ 8, a neutral note above it warning the run will take roughly the estimated time and to use the designated computer.
   - `error`: a red note with `motivo`. If phase 5: "Repetir é seguro. Os certificados já foram emitidos no SIGO, o Flow 5 só trata dos PDFs e do Airtable." Otherwise: "Volta a correr depois de resolveres a causa. O registo de erro é atualizado, não duplicado." Copy button stays enabled.
   - `blocked`: a red note with `motivo` and "Resolve no Airtable para desbloquear este flow." Copy button **disabled**, labelled "Bloqueado".
   - `done`: button disabled, "Ação concluída".
6. If `error` or `blocked` and the entity may report (§11): **Reportar problema à TheStarter**. Otherwise a one-line hint that reporting requires the support plan.
7. Link **Abrir na fonte de dados** → `urlOrigem`.

### 4.8 Duration estimate

Only phase 4 scales with class size. Everything else is a fixed short task.

```typescript
const BASE: Record<number, [number, number]> = { 0:[3,10], 1:[3,10], 2:[3,10], 3:[3,10], 4:[5,7], 5:[3,7] }
export function estimar(fase: number, formandos: number) {
  const [min, max] = BASE[fase]
  return fase === 4 ? { min: min*formandos, max: max*formandos } : { min, max }
}
```

Shown as "5 min", "40 min a 56 min", "1h10 a 1h30".

### 4.9 Copy instruction

Copies a **short instruction**, not the full document. The document lives in Documentação. Variables (§8) are substituted at copy time, client-side.

```
Corre o Flow {fase} ({nome da fase}) para a ação de formação "{nome}".

Código do curso: {codigoCurso}
Datas: {dataInicio} a {dataFim}
Formandos: {formandos}

SIGO: {{SIGO_URL}} · utilizador {{SIGO_UTILIZADOR}}
Base de dados: {{CRM_TIPO}} · {{CRM_BASE}}

Segue as instruções de flow-{fase}.md.
```

`SIGO_PALAVRA` and `CRM_TOKEN` are **never** included in the short instruction. They are substituted only when a full document is copied from Documentação, and only client-side. After copying, the button shows "Copiado" for 1.8 s. If any variable is unset, the toast says how many are missing.

---

## 5. Deadlines

Per tenant, stored in `config_entidade.prazos` as JSON. Defaults from the SIGO documentation. All editable in Definições → Prazos.

| Key | Default | Meaning |
|---|---|---|
| `entrada` | 15 | Days before end date at which an action enters the board |
| `aviso` | 3 | Days before a deadline at which the card starts showing "Em N dias" as approaching |
| `0` | 3 | Days **before** end date |
| `1` | 1 | Days before end date |
| `2` | 1 | Days before end date |
| `3` | 21 | Days **after** end date |
| `4` | 7 | Days after phase 3 success |
| `5` | 3 | Days after phase 4 success |

Phases 4 and 5 are anchored to the success date of the previous phase, not to the end date. If that log does not exist yet, the deadline is undefined and the card shows no countdown.

**Why the entry window is anchored to the end date:** every phase deadline is. A three-month course and a two-week course have the same administrative profile, concentrated at the end. Fifteen days gives phase 0 room to chase students for missing data before phase 1 is due.

---

## 6. Database (Supabase)

Only what does not exist in the entity's own database.

```sql
create table entidades (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  nipc text,
  ativa boolean default true,
  suporte boolean default false,          -- monthly support plan
  setup_em date,                          -- 30-day inclusion counts from here
  contrato_assinado boolean default false,
  criada_em timestamptz default now()
);

create table utilizadores (
  id uuid primary key references auth.users(id) on delete cascade,
  entidade_id uuid references entidades(id) on delete cascade,
  nome text not null,
  email text unique not null,
  funcao text check (funcao in ('staff','admin','gestor','leitura')) default 'gestor',
  ultimo_acesso timestamptz,
  criado_em timestamptz default now()
);

create table convites (
  id uuid primary key default gen_random_uuid(),
  entidade_id uuid references entidades(id) on delete cascade,
  email text not null,
  funcao text not null,
  token text unique not null,
  expira_em timestamptz not null,         -- 7 days
  usado_em timestamptz
);

create table config_entidade (
  entidade_id uuid primary key references entidades(id) on delete cascade,
  fonte_tipo text default 'airtable',
  fonte_credencial text,                  -- AES-256-GCM, never returned to client
  fonte_base text,
  mapa_campos jsonb not null default '{}',-- our field name → source field id
  filtros jsonb not null default '{}',    -- e.g. {"formato":"PT","excluir_estado":"Descontinuado"}
  prazos jsonb not null default '{}',     -- §5
  variaveis jsonb not null default '{}',  -- §8, non-secret values only
  atualizado_em timestamptz default now()
);

create table vistas (
  id uuid primary key default gen_random_uuid(),
  entidade_id uuid references entidades(id) on delete cascade,
  criada_por uuid references utilizadores(id),
  nome text not null,
  condicoes jsonb not null default '[]',
  fixa boolean default false
);

create table preferencias_notificacao (
  utilizador_id uuid primary key references utilizadores(id) on delete cascade,
  eventos jsonb not null default '{"notificado":true,"prazo":true,"bloqueio":true,"concluido":false,"falha_sync":true}',
  canais jsonb not null default '{"app":true,"email":true}'
);

create table config_relatorio (
  entidade_id uuid primary key references entidades(id) on delete cascade,
  ativo boolean default true,
  dia text default 'segunda',
  hora text default '09:00',
  destinatarios text[] default '{}'       -- any email, account not required
);

create table notificacoes (
  id uuid primary key default gen_random_uuid(),
  entidade_id uuid references entidades(id) on delete cascade,
  destinatario_id uuid references utilizadores(id) on delete cascade,
  remetente_id uuid references utilizadores(id),
  tipo text not null,
  corpo text not null,
  acao_ref text,                          -- source record id, not a foreign key
  lida boolean default false,
  criada_em timestamptz default now()
);

create table problemas_reportados (
  id uuid primary key default gen_random_uuid(),
  entidade_id uuid references entidades(id) on delete cascade,
  reportado_por uuid references utilizadores(id),
  flow int not null,
  acao_ref text,
  acao_nome text,
  descricao text not null,
  estado text default 'aberto' check (estado in ('aberto','resolvido')),
  criado_em timestamptz default now()
);

create table problemas_anexos (
  id uuid primary key default gen_random_uuid(),
  problema_id uuid references problemas_reportados(id) on delete cascade,
  caminho text not null,                  -- Supabase Storage path, EU bucket
  nome text not null,
  tamanho int not null,
  apagar_em date not null                 -- criado_em + 90 days
);

create table estado_notificado (               -- §10.3
  entidade_id uuid references entidades(id) on delete cascade,
  acao_ref text not null,
  estado text not null,
  col int not null,
  atualizado_em timestamptz default now(),
  primary key (entidade_id, acao_ref)
);

create table documentos (
  id uuid primary key default gen_random_uuid(),
  nome text unique not null,              -- e.g. flow-1-perfis-formandos.md
  versao text not null,
  flow int,
  corpo text not null,                    -- HTML subset, with {{VARIAVEL}} placeholders
  publicado boolean default false,
  atualizado_em timestamptz default now()
);

create table documentos_variacao (
  id uuid primary key default gen_random_uuid(),
  documento_id uuid references documentos(id) on delete cascade,
  entidade_id uuid references entidades(id) on delete cascade,
  corpo text not null,
  nota text,                              -- one line: what differs
  versao_base text not null,              -- base version it was copied from
  atualizado_em timestamptz default now(),
  unique (documento_id, entidade_id)
);
```

There is deliberately **no** `acoes` table and **no** `registos` table. `acao_ref` fields hold the source record id as text. `estado_notificado` records what we last notified, not what the action is; it is the one place an `acao_ref` is written by a cron, and it is the minimum needed to avoid duplicate notifications on serverless.

### 6.1 Row-level security

Enabled on every table. Every policy scopes to the caller's `entidade_id` via `utilizadores`. `documentos` is readable by all authenticated users. `documentos_variacao` is readable only by users of that entity. Admin routes use the service role key and never expose it to the client.

**Test with two real tenants before launch.** Implemented is not verified.

---

## 7. Data access

### 7.1 Interface

The only place that knows about Airtable is `lib/dados/airtable.ts`. Nothing outside the adapter may import from it.

```typescript
export interface FonteDeDados {
  obterAcoes(): Promise<Acao[]>
  obterRegistos(): Promise<Registo[]>
  verificarLigacao(): Promise<EstadoLigacao>
}

export interface Acao {
  id: string
  nome: string
  codigoCurso: string
  dataInicio: string          // YYYY-MM-DD
  dataFim: string
  tipo: string
  formato: string
  diasSemana: string | null
  estado: string
  ano: number
  formandos: number           // calculated field in source
  temAvaliacoes: boolean      // calculated field in source
  urlOrigem: string | null
}

export interface Registo {
  acaoId: string
  flow: 0 | 1 | 2 | 3 | 4 | 5
  estado: 'success' | 'missing_data' | 'error'
  data: string
  detalhe: string             // free text from the source; may contain student names
}

export interface EstadoLigacao {
  ok: boolean
  ultimaLeitura: string | null
  erro: string | null
}
```

Nothing in `Acao` is personal data. `Registo.detalhe` may contain names — see §9.

### 7.2 Adapter rules, any source

- No write method. Ever.
- Field whitelist. Nothing outside it is requested.
- Per-tenant field mapping from `config_entidade.mapa_campos`; entities name columns differently.
- Returns only interface types. No source-specific object may escape the adapter. Add a lint rule.
- `verificarLigacao()` reports the students table being reachable as a **configuration warning**, not success.
- 15-minute in-memory cache per tenant. Never on disk. A restart clears it.
- Unknown `Flow` or `Status` option values are logged and treated as unknown, never silently ignored.

### 7.3 Airtable adapter

Whitelist for TheStarter's base (other entities map their own names in `mapa_campos`):

| Interface field | Airtable field | Notes |
|---|---|---|
| nome | Name | primary |
| codigoCurso | Código Curso | |
| dataInicio | Start date | |
| dataFim | End Date | |
| tipo | Tipo Formação | |
| formato | Formato | |
| diasSemana | Dias Semana | |
| estado | Estado | |
| ano | Ano | |
| formandos | Nº Formandos | **calculated, to create** |
| temAvaliacoes | Tem Avaliações | **calculated, to create** |
| Registo.acaoId | Ação de Formação | link |
| Registo.flow | Flow | select |
| Registo.estado | Status | select |
| Registo.detalhe | Details | |

Always use `fields[]` selectors on reads. The flow documentation forbids them for writes because they can blank attachment fields on a subsequent PATCH; that risk does not exist in a read-only adapter, and the selector **is** the whitelist. Comment this in the code or someone will "fix" it.

**Two calculated fields the entity must create** (once, during setup):

Nº Formandos, formula. Students are linked from nine separate fields (`Formandos`, `Formandos 2` … `Formandos 9`), so a Count field cannot be used:

```
IF({Formandos},   LEN({Formandos})   - LEN(SUBSTITUTE({Formandos},   ",","")) + 1, 0) +
IF({Formandos 2}, LEN({Formandos 2}) - LEN(SUBSTITUTE({Formandos 2}, ",","")) + 1, 0) +
… through {Formandos 9}
```

Tem Avaliações, formula: `IF({Tabela Avaliações}, 1, 0)`.

Value maps (verify option names against the live base before relying on them):

```typescript
const FLOW = {
  'Flow 0 (Data Collection)': 0, 'Flow 1 (Profile)': 1, 'Flow 2 (Course)': 2,
  'Flow 3 (Ação)': 3, 'Flow 4 (Enrollment)': 4, 'Flow 5 (PDF & Concluir)': 5,
}
const ESTADO = { 'Success': 'success', 'Missing Data': 'missing_data', 'Error': 'error' }
```

Default filters, configurable per tenant: `Estado ≠ Descontinuado`, `Formato = PT` (BR actions do not go through SIGO).

**Token limitation.** Airtable tokens cannot be scoped to specific tables within a base; access is to the whole base. The whitelist in the adapter is therefore the mechanism that keeps the students table out, and it is code, not configuration. The stronger alternative, a separate base holding only the two tables and synced from the main one, should be decided before the first external client. For TheStarter's own test, the whitelist is enough.

### 7.4 Other adapters

Google Sheets is second and is a **priority**, not a nice-to-have: many small entities run everything on shared sheets, and forcing a migration to Airtable adds cost and friction to the sale. Two sheets, one for actions and one for logs, headers mapped in `mapa_campos`. Notion third.

---

## 8. Variables and credentials

Documents contain placeholders `{{CHAVE}}`. Each entity defines its values in Definições → Credenciais. Substitution happens **client-side at copy time**. Nothing is written into documents.

### 8.1 Two different tokens

This is the point most likely to be got wrong, so it comes first.

| | Fluxo's own credential | The flows' token |
|---|---|---|
| Who uses it | The Fluxo server, to read the board | The entity's AI assistant, running the flow documents |
| Permissions | **Read only**, two tables | **Read and write**, including the students table |
| Where it lives | `config_entidade.fonte_credencial`, AES-256-GCM | Browser localStorage only, like the SIGO password |
| Is it a `{{variable}}`? | **No.** It never appears in any document. | Yes: `{{CRM_TOKEN}}` |
| Ever returned to the client? | Never | Never leaves the client |

The flows write to Airtable: they save Nº SIGO, certificate numbers, PDFs. So the token in the documents must have write permission. Fluxo's token must not. **They cannot be the same token**, and Fluxo's own credential is not a variable at all.

Consequence: the entity creates two Airtable tokens during setup. A read-only one is pasted into Ligação de dados. A read-write one is pasted into Credenciais and stays in the browser.

### 8.2 Keys

| Key | Group | Secret | Stored |
|---|---|---|---|
| `SIGO_URL` | SIGO | no | server |
| `SIGO_UTILIZADOR` | SIGO | no | server |
| `SIGO_PALAVRA` | SIGO | **yes** | **browser only** |
| `CRM_TIPO` | Base de dados | no | server |
| `CRM_BASE` | Base de dados | no | server |
| `CRM_TOKEN` | Base de dados | **yes** | **browser only** |
| `TBL_ACOES` | Base de dados | no | server |
| `TBL_FORMANDOS` | Base de dados | no | server |
| `TBL_LOGS` | Base de dados | no | server |
| `AREA_FORMACAO` | Regras fixas | no | server |
| `REGIME` | Regras fixas | no | server |

`TBL_FORMANDOS` is a variable because the **flow documents** need it: the entity's assistant reads and writes that table. Fluxo itself never does.

### 8.3 Behaviour

- Unknown placeholders are left as-is in the copied text.
- The reader shows placeholders as tags. A toggle "Ver os meus valores" reveals non-secret values inline. Secrets are never revealed, even with the toggle on.
- Secret fields are `type=password`, never repopulated after save, and changed by overwriting.
- If any value is empty, Credenciais shows a red note with the count, and copy toasts warn.
- "Testar ligação" button: checks `verificarLigacao()` and that no value is empty.

### 8.4 Browser-only secrets

`SIGO_PALAVRA` and `CRM_TOKEN` are only needed when a document or instruction is copied, which happens in the client. So they never leave the machine.

- Stored in `localStorage` under one key, JSON-encoded, try/catch-guarded.
- Loaded into memory at login. Never included in any request. Add a test that fails if either appears in a request body or header.
- Credenciais shows a pill "só neste navegador" on those rows, and one button "Apagar deste navegador" that clears both.
- Lost when the browser is cleared or the user changes computer. The UI says so.

**Consequence to state in the contract:** a breach on our side cannot expose any entity's SIGO access, nor a token with write access to its database.

### 8.5 Encryption at rest

AES-256-GCM, key from `CHAVE_CIFRA` (64 hex chars), never in the repository. Applies to `config_entidade.fonte_credencial` only; browser-only secrets are never on the server. Encrypted values are never returned to the client, not even masked; the client sees connection state only.

---

## 9. Personal data: what is true

State these exactly. They are the basis of the contract with clients.

| Claim | True? |
|---|---|
| Fluxo never touches student personal data | **No.** `Registo.detalhe` may contain names. |
| Fluxo stores student personal data | No. Read per request, shown, discarded. |
| TheStarter can see a client's student data | No. No admin route returns board content. |
| Fluxo shows student data to people who should not see it | No. It shows the entity's own log summaries to the entity's own users, who already have full access to the same base. |

`detalhe` **is read and shown** on the card. Without it a blocked card says only "Erro", which is useless. It is transient, entity-scoped, and never reaches staff.

The one path by which personal data can reach TheStarter is a problem report screenshot (§11). Treat that store accordingly.

---

## 10. Notifications

### 10.1 Events

Per user, on/off, in Definições → Notificações:

| Key | Event |
|---|---|
| `notificado` | A colleague sent me a notification from a card |
| `prazo` | An action passed its deadline |
| `bloqueio` | An action became blocked |
| `concluido` | Someone completed a phase |
| `falha_sync` | Sync with the data source failed |

Channels: in-app (bell with unread dot, panel of last 7, "Marcar lidas"), email.

### 10.2 Notify a colleague

From the card detail: pick a user in the same entity, write a message (placeholder "Podes correr o Flow N desta ação?"). Delivered per the recipient's preferences. There is no ownership, so this is a request, not an assignment.

### 10.3 Deadline cron

`/api/cron/prazos`, hourly, `CRON_SECRET` required. For each tenant, derives the board and emits `prazo`, `bloqueio` and `concluido` events for cards whose state changed since the last run.

To detect a change it needs the previous state. **This must be a table, not memory.** On Vercel every cron invocation may run on a fresh instance with no memory of the previous one; an in-memory map would re-send every notification every hour.

```sql
create table estado_notificado (
  entidade_id uuid references entidades(id) on delete cascade,
  acao_ref text not null,
  estado text not null,
  col int not null,
  atualizado_em timestamptz default now(),
  primary key (entidade_id, acao_ref)
);
```

This is state about our notifications, not about the entity's data, and does not violate §2.1. Rows for actions that no longer appear in the source are deleted on the next run.

The same limitation applies to the adapter's 15-minute cache (§7.2): on serverless it is per instance and best-effort. Correctness never depends on it; it only reduces calls to the source.

---

## 11. Problem reports

Available on cards in `error` or `blocked` when `podeReportar()` is true: staff, or entity with `suporte`, or entity within 30 days of `setup_em`.

Form: description (textarea, required), up to 5 image attachments (PNG/JPG/WEBP, ≤ 5 MB each), with thumbnails and remove buttons. A line under the attachments asks the user to blur or crop any student data before sending.

On submit: row in `problemas_reportados`, attachments to Supabase Storage (EU bucket, private), email to **people@thestarter.io** with the description and links to the attachments (not inlined). The user gets a toast and an in-app notification.

**Attachments may contain personal data despite the warning.** EU bucket, staff-only access, deleted at `apagar_em` (90 days) by a daily cron.

Staff sees open and resolved reports in Entidades → the entity's detail, with "Marcar resolvido".

---

## 12. Weekly report

`/api/cron/relatorio`, hourly. For each tenant whose `dia` and `hora` match, derive the board and send one email to every address in `destinatarios`. Recipients do not need an account.

Content, PT-PT: overdue (name, phase, days), blocked (name, reason), due this week (name, phase), concluded this week (name). No personal data. Footer: "Enviado por Fluxo · para deixares de receber, fala com o administrador da tua entidade."

Settings: on/off, day, hour, editable recipient list. A "Ver pré-visualização" button renders the email with live data. Removing a recipient asks for confirmation.

---

## 13. Documentation

### 13.1 Model: base plus variations

The **base** is TheStarter's documentation. Every entity inherits it. When an entity's SIGO process differs in a phase, staff creates a **variation** of that one file for that entity.

Resolution:

```typescript
export function documentoEfetivo(nome: string, entidadeId: string | null) {
  const base = documentos.find(d => d.nome === nome)
  const v = entidadeId && variacoes.find(x => x.documento_id === base.id && x.entidade_id === entidadeId)
  if (!v) return { ...base, origem: 'base' }
  return { ...base, corpo: v.corpo, nota: v.nota, origem: 'variacao',
           desatualizada: v.versao_base !== base.versao }
}
```

- Variations are whole-file copies, not diffs.
- **A variation stops receiving base updates for that file.** When the base moves on, `desatualizada` is true and the admin view flags it in red.
- Publishing a base document notifies only entities using the base version of that file.
- **Variables are for values that differ. Variations are for steps that differ.** If only a word changes, it is a variable.

### 13.2 Entity view

List of files with version and date. Files with a variation show "adaptado à vossa entidade". Clicking opens the reader: rendered HTML, placeholders as tags, "Ver os meus valores" toggle, "Copiar conteúdo" (with variables substituted). Search box filters by content and shows file, line and highlighted excerpt; results are clickable.

If the entity is not receiving updates (§14), a neutral note at the top says the documentation is frozen and may drift from SIGO.

### 13.3 Seed documents

The base is seeded from TheStarter's seven flow documents (`sigo-master-overview.md`, `flow-0` to `flow-5`). **They currently contain real credentials in plain text** and must be templatised before seeding: every Airtable base id, table id, token, SIGO URL, user and password becomes the matching `{{KEY}}` from §8.2. Nothing in `documentos.corpo` may be a real credential. Add a check to the seed script that fails on anything matching `app[A-Za-z0-9]{14}`, `tbl[A-Za-z0-9]{14}`, `pat[A-Za-z0-9.]{20,}`.

### 13.4 Staff view

A scope bar: **Base** and one button per active entity, each with its variation count (red if any is out of date).

**Base scope:** every file with Editar and Apagar; "Novo documento". Each row shows how many entities have a variation of it.

**Entity scope:** every file as that entity sees it. Rows marked "base" offer **Personalizar** (copies the base as a starting point). Rows marked "variação" show the one-line `nota`, offer **Editar** and **Voltar à base** (confirmation; deletes the variation).

Editor: file name, version, textarea for the HTML subset, **Carregar .md** (≤ 512 KB, converts markdown to the subset: headings, paragraphs, lists, bold, italic, code, links, tables), **Guardar rascunho**, **Publicar a todas**. Publishing opens a confirmation stating how many entities receive it and how many are excluded (no support, or variation), and asks for a one-line "o que mudou" that goes into the notification.

Deleting a base document asks for confirmation and states it disappears for every entity, including anyone mid-flow.

---

## 14. Support plan

`entidades.suporte` boolean, toggled by staff in the entity detail. Support is included for 30 days after `setup_em` regardless.

```typescript
const dentroDos30 = diasDesde(e.setup_em) <= 30
const recebeAtualizacoes = e.suporte || dentroDos30
const podeReportar = staff || recebeAtualizacoes
```

Without support, after 30 days:

- No "Reportar problema" button; a hint says it requires the plan and gives the email
- No documentation updates; the docs page shows the frozen note
- Excluded from publish counts

Entity list shows a pill per entity: "suporte", "sem suporte", or "setup · Nd" for the remaining days.

---

## 15. Entities (staff)

Route `/entidades`, staff only.

**KPIs:** active entities, users, actions tracked (sum of a `acoes_count` the adapter can report cheaply), entities with support, entities without signed contract.

**List:** name, activity dot (black active / red if last activity > 14 days / grey inactive), users, actions, source type, last activity, support pill, active pill, "sem contrato" pill when applicable.

**Detail modal:** status, users, actions, source, last activity, contract (red "Em falta" if not), setup date; a neutral note "Não tens acesso ao quadro desta entidade"; the support toggle with explanation; invite user (email, 7-day link); **Desativar acesso** / **Reativar**; **Apagar definitivamente** with a confirmation that states what is deleted (accounts, views, deadlines, credential) and what is not (actions, logs, students — they were never here). Open problem reports for the entity with "Marcar resolvido".

**Create entity:** name, NIPC, source type, first user email. Creates the entity, `config_entidade` with defaults, seeds the two views, sends the invite.

---

## 16. Authentication

No public signup. The login screen says so and tells people without access to speak to their entity's administrator.

Screens under `(auth)`: **Entrar**, **Recuperar acesso** (always responds the same, whether or not the email exists), **Verifica o teu email**, **Definir palavra-passe** (from invite or reset token; minimum 10 characters; token single-use, invites expire in 7 days, resets in 60 minutes).

Login errors do not reveal whether the email exists. After login: `staff` and entity users both land on `/quadro`.

Sessions via Supabase Auth cookies (SSR helpers). All API routes validate the session server-side. Second factor for `staff` and `admin` is not in v1; decide before launch, do not leave it undecided.

---

## 17. Settings (entity)

Tabs: **Perfil**, **Equipa**, **Notificações**, **Relatório semanal**, **Prazos**, **Credenciais**, **Ligação de dados**, **Privacidade**.

Every tab that changes data has an explicit **Guardar** button. No autosave on blur or on navigation: credentials, deadlines and recipients must not change because someone clicked away.

**Equipa:** list with role pills; invite by email. Admins only.

**Prazos:** entry window select (7/10/15/21/30/45), per-phase deadline selects, warning lead select. §5.

**Ligação de dados:** source name and last read; per table "Leitura · N registos" or "Sem acesso, por configuração"; a **Permissões da credencial** block stating write = none, students table = not requested, credential age with a renew-at-12-months hint; "Sincronizar agora"; a **Mudar de fonte** block listing Airtable (em uso), Google Sheets, Notion, Outro.

**Privacidade:** plain-language page an auditor can read: what we read (fields), what we never read, what we store and for how long, where (Frankfurt), what TheStarter sees (nothing from the board; accounts and connection state; reported problems only when sent; SIGO password never received), what happens if they leave (nothing to return). Two download buttons: contract, list of fields accessed (generate from the interface definition, do not hand-write).

---

## 18. Interface

### 18.1 Language and tone

PT-PT throughout. Entities are addressed as "vocês"/"vossa". Never "tu" in the app. Terminology: **ação de formação** (not "ação", "turma"), **base de dados** (not "base"), **assistente de Inteligência Artificial** or **assistente de IA** (not "assistente"), **DTP** (not "dossiê"). "Curso" remains correct for the SIGO Curso entity and for "código do curso".

Confirmation dialogs state consequences plainly and say when something cannot be undone.

### 18.2 Design

Black and white. Tokens, light / dark:

| Token | Light | Dark |
|---|---|---|
| `--bg` | `#ffffff` | `#0e0e0e` |
| `--fg` | `#111111` | `#f2f2f2` |
| `--muted` | `#8d8d8d` | `#777777` |
| `--soft` | `#636363` | `#a8a8a8` |
| `--line` | `#e8e8e8` | `#242424` |
| `--ls` (strong line) | `#d0d0d0` | `#3c3c3c` |
| `--hover` | `#fafafa` | `#171717` |
| `--red` | `#b4443c` | `#e08a84` |
| `--red-s` (background) | `#faf4f3` | `#1a1413` |
| `--red-b` (border) | `#e8d2cf` | `#3a2725` |

Dark theme under `prefers-color-scheme` and `[data-theme]`, choice persisted in localStorage. Red is used only for `late`, `error`, `blocked` and their counters. Inter, weights 400 and 500. Borders 0.5px. Radius: 6px cards and buttons, 8px modals, 4px pills. No shadows except dropdowns. No hover elevation or transforms; hover changes border colour to `--fg` and background to `--hover`. Take every other value from the prototype rather than inventing it.

### 18.3 Navigation

Desktop: top bar with logo (links to Quadro), **Quadro**, **Documentação**, and for staff **Entidades**; right side: sync status with tooltip ("O quadro lê a base de dados a cada 15 minutos…"; on failure, red with a "repetir" link), bell, avatar with dropdown (Perfil, Equipa, Notificações, Relatório semanal, Prazos, Ligação de dados, Mudar tema, Terminar sessão). Staff sees a small "TheStarter" tag next to the logo.

Mobile (≤ 760px): top bar is logo and bell only. Fixed bottom nav with icons: Quadro, Documentos, Perfil, plus Entidades for staff. Board becomes a single vertical list with a header per phase and full-width cards. Card detail and every modal become full-screen with a sticky header and ×; the bottom nav hides while one is open. Views tabs and settings tabs scroll horizontally.

### 18.4 Loading and empty states

Board renders immediately from cache when available; otherwise a short skeleton. Empty column: "Vazio". No search results: "Sem resultados". Do not add spinners elsewhere.

---

## 19. Security checklist

**Data**
- [ ] Adapter has no write method
- [ ] Field whitelist enforced; students table not in it
- [ ] No actions or logs written to our database anywhere
- [ ] No admin route returns entity board content — tested with two tenants

**Secrets**
- [ ] `SIGO_PALAVRA` and `CRM_TOKEN` never appear in any request — tested
- [ ] `fonte_credencial` AES-256-GCM, never returned to client
- [ ] Logger filters `authorization`, `cookie`, `x-api-key`, `fonte_credencial`
- [ ] `CHAVE_CIFRA`, `CRON_SECRET`, service role key outside the repository

**Isolation**
- [ ] RLS on every table, tested with two tenants including forged ids
- [ ] Service role only in `/api/admin` and cron routes

**Platform**
- [ ] Security headers live: HSTS, nosniff, DENY framing, strict referrer, CSP `default-src 'self'`
- [ ] No external scripts; Inter self-hosted
- [ ] EU region confirmed on Vercel, Supabase, Resend, and the attachments bucket
- [ ] Attachment purge cron runs

**Product**
- [ ] Deadlines and entry window read from tenant config, never hardcoded
- [ ] Support gating verified for reports, updates and publish counts
- [ ] Weekly report tested against a real mailbox
- [ ] Documentation variation excluded from base notifications

---

## 20. Environment variables

```bash
# Vercel
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # admin and cron routes only
CHAVE_CIFRA=                      # 64 hex chars
RESEND_API_KEY=
CRON_SECRET=
EMAIL_REPORTES=people@thestarter.io
```

---

## 21. Reference material

- **HTML prototype** (`fluxo.html`): visual and behavioural reference for every screen. Rebuild in Next.js; do not copy. Where it and this document differ, this document wins.
- **Landing page** (`fluxo-landing/`): separate static site on Cloudflare Pages, separate repository. Its "Entrar" button links to `/entrar` on the app domain once live.
- **Legal documents** (`docs/02-rgpd.md`, `06-contrato-subcontratacao.md`, `07-politica-privacidade.md`, `08-registo-tratamentos.md`): not development documents, but the Privacidade tab and the contract download must stay consistent with §9 and §8.4.
