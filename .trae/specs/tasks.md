# Fluxo - Implementation Plan

## Task 1: Scaffold Next.js 14 + TypeScript + estrutura base
- **Status**: `pending`
- **Priority**: high
- **Depends On**: None
- **Description**:
  - Inicializar projeto Next.js 14 App Router TypeScript com ESLint.
  - Criar estrutura de pastas: app/(auth), app/(app)/quadro, app/(app)/documentacao, app/(app)/definicoes, app/(app)/entidades, app/api.
  - Criar lib/: dados/, docs/, supabase/, cifra/, email/, log/.
  - Criar components/.
  - Instalar dependências mínimas: @supabase/ssr, @supabase/supabase-js, resend. Sem UI libs, sem CSS framework.
  - Root layout: <Inter self-hosted>, variáveis CSS em :root + dark tokens sob prefers-color-scheme e [data-theme="dark"]. Radius 6px; sem sombras exceto dropdowns; sem elevação/hover lift.
  - next.config.js: security headers (HSTS, nosniff, DENY framing, strict referrer, CSP default-src 'self').
  - Criar ficheiro .env.example com as 7 variáveis da spec §20.
  - Criar tsconfig com paths @/* → ./*.
- **Acceptance Criteria Addressed**: AC-34, NFR-6, NFR-8, NFR-11
- **Test Requirements**:
  - `rule` TR-1.1: `npx tsc --noEmit` sem erros.
  - `rule` TR-1.2: `npx next build` decorre sem erros.
  - `rule` TR-1.3: `curl -I http://localhost:3000` devolve HSTS, X-Content-Type-Options, X-Frame-Options DENY, Referrer-Policy strict-origin, CSP default-src 'self'.
  - `rule` TR-1.4: Estrutura de pastas existe: `ls app lib components` com as subpastas base.
- **Notes**: Sem prettier, sem tailwind, sem shadcn. CSS modules ou global.css puro.

## Task 2: Supabase schema + RLS policies + Storage + tabela obrigatória estado_notificacoes + seed 7 documentos convertidos
- **Status**: `pending`
- **Priority**: high
- **Depends On**: 1
- **Description**:
  - Criar `supabase/migrations/` com uma migration SQL contendo TODO o schema §6 (12 tabelas + constraints + checks).
  - **Adicionar tabela obrigatória `estado_notificacoes`**: PK composta (entidade_id uuid FK entidades.id, acao_ref text); colunas: estado_anterior text, col_anterior int, atualizado_em timestamptz default now(). RLS scoped a entidade_id. Serve para deduplicar notificações entre cold starts na Vercel.
  - Adicionar RLS enable em TODAS as tabelas + policies por entidade_id via utilizadores.
  - Tabelas `documentos`: readable por todos os auth.users autenticados.
  - `documentos_variacao`: readable só pela própria entidade.
  - Storage: script de criação de bucket `problemas-anexos` (EU, private) + policies staff-only R/W.
  - Seed: 2 vistas por tenant (Todas, A precisar de atenção) via trigger após insert em entidades (no create entidade → insert 2 vistas seeded).
  - **Seed documentos base (7)**: Inserir na tabela `documentos` os 7 MDs de flow (flow-0 a flow-5 + índice/se existir) **antes** submeter a uma etapa de conversão para placeholders {{VARIÁVEIS}}**. Os MDs originais têm credenciais reais que devem ser substituídas por {{SIGO_URL}}, {{SIGO_UTILIZADOR}}, {{CRM_TIPO}}, {{CRM_BASE}}, {{CRM_TOKEN}}, {{TBL_ACOES}}, {{TBL_FORMANDOS}}, {{TBL_LOGS}}, {{AREA_FORMACAO}}, {{REGIME}}. Variantes concretas em falta o seed.
  - Criar `lib/supabase/server.ts` (SSR cookie helpers admin+anon), `lib/supabase/client.ts` (browser), middleware.ts que valida sessão em /(app).
  - Criar `lib/supabase/service.ts` (service role key — só importado em /api/admin e /api/cron).
- **Acceptance Criteria Addressed**: AC-19, AC-35, NFR-1, AC-22**
- **Test Requirements**:
  - `rule` TR-2.1: Aplicar migration e `SELECT tablename FROM pg_tables WHERE schemaname='public'` devolve 13 tabelas (incluindo estado_notificacoes.
  - `rule` TR-2.2: `SELECT policyname, tablename FROM pg_policies WHERE schemaname='public'` tem pelo menos 1 policy por tabela (13+ policies.
  - `rule` TR-2.3: Teste RLS manual: 2 utilizadores de tenants diferentes com anon key; query cross em `estado_notificacoes retorna 0 linhas.
  - `rule` TR-2.4: `SELECT count(*) FROM documentos` >= 7` após seed.
  - `rule` TR-2.5: Seed documentos não contém credenciais literais como "sk-" ou URLs reais de bases concretas (grep por padrões).
- **Notes**: Supabase local CLI (supabase start) se disponível; senão migration SQL aplicável via dashboard SQL editor. **Antes de aplicar a migration, confirma que estás de acordo com a criação de tabelas e seed de documentos na BD** (não destrutivo, é só criação e não existiam antes)**.

## Task 3: Infra: cifra AES-256-GCM + logger header-filtering + email resend
- **Status**: `pending`
- **Priority**: high
- **Depends On**: 1
- **Description**:
  - `lib/cifra/index.ts`: `encriptar(plaintext, key): string` e `decriptar(ciphertext, key): string` com AES-256-GCM, nonce 12 bytes, tag concatenado, key derivada de CHAVE_CIFRA (64 hex).
  - `lib/log/index.ts`: `logReq(req, meta)` e `logInfo/Error` que filtra valores de headers/corpos: authorization, cookie, x-api-key, fonte_credencial, CRM_TOKEN substituídos por `[FILTERED]`.
  - `lib/email/index.ts`: wrapper `enviarEmail({to, subject, html})` via Resend EU endpoint. Fail-safe em ambiente dev.
  - Validação: `CHAVE_CIFRA` length 64 hex; throw se inválido em boot.
- **Acceptance Criteria Addressed**: AC-18, AC-33, NFR-3, NFR-4, NFR-5**
- **Test Requirements**:
  - `rule` TR-3.1: roundtrip encriptar → decriptar com mesma key devolve o original; key diferente retorna erro de autenticidade.
  - `rule` TR-3.2: `logReq` com header `Authorization: Bearer sk-abc123` e body `{"fonte_credencial":"x"}` → output não contém "sk-abc123" nem "x".
  - `rule` TR-3.3: Logger NÃO filtra campos inofensivos (ex: nome, email do destinatário aparecem intactos).

## Task 4: Domínio core: interface + derivar + prazos + estimar (TDD)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: 1
- **Description**:
  - `lib/dados/interface.ts`: exportar interfaces FonteDeDados, Acao, Registo, EstadoLigacao exatamente como a spec §7.1.
  - `lib/dados/derivar.ts`: função `derivar(a, logs, cfg): Cartao` linha a linha da spec §4.2. Exportar também tipo Cartao.
  - `lib/dados/prazos.ts`: `calcularPrazo(a, fase, meus, cfg): string | undefined` implementando regras §5 (0/1/2 antes dataFim, 3 depois dataFim, 4 depois fase3_success, 5 depois fase4_success).
  - `lib/dados/prazos.ts`: defaults `PRAZOS_DEFAULTS` com valores da spec.
  - `lib/dados/derivar.ts`: função `estimar(fase, formandos)` da spec §4.8.
  - Adicionar runtime de teste (vitest ou jest minimal). Escrever testes unitários para todos os ramos de `derivar`, `calcularPrazo`, `estimar`.
- **Acceptance Criteria Addressed**: AC-3, AC-8
- **Test Requirements**:
  - `rule` TR-4.1: Unit test de 12 casos de derivar (vide AC-3) todos passam.
  - `rule` TR-4.2: `estimar(4,8)={min:40,max:56}`; `estimar(0,8)={min:3,max:10}`.
  - `rule` TR-4.3: Prazo fase 4 quando não há log fase3_success retorna undefined.

## Task 5: Adaptador Airtable com whitelist + cache + mapa_campos
- **Status**: `pending`
- **Priority**: high
- **Depends On**: 4
- **Description**:
  - `lib/dados/airtable.ts`: classe AirtableAdapter implements FonteDeDados.
  - Construtor recebe { baseId, token, mapaCampos, filtros }.
  - `obterAcoes`: fetch tabela ações com `fields[]` whitelist (apenas os mapeados + defaults TheStarter). Aplicar filtros padrão (Estado≠Descontinuado, Formato=PT se config). Mapear valores usando mapa_campos. Retorna só `Acao`.
  - `obterRegistos`: fetch tabela logs com fields whitelist. Mapear FLOW e ESTADO via value maps da spec §7.3. Retorna só `Registo`.
  - `verificarLigacao`: testa acesso às 2 tabelas. Tenta tabela Formandos: se acessível, adiciona aviso (não é erro). Retorna EstadoLigacao com ultimaLeitura.
  - Cache 15min em memória Map por tenant key. Limpa com restart. TTL por entrada.
  - Comentar no código a obrigatoriedade de `fields[]` por causa da whitelist: "não remover — esta é a whitelist real, não há risco de PATCH aqui".
  - Erros de Flow/Estado desconhecidos: log warning + registo ignorado.
- **Acceptance Criteria Addressed**: AC-10, AC-11, AC-12, AC-13, AC-14
- **Test Requirements**:
  - `rule` TR-5.1: Code inspection: grep por ".update\|.create\|.delete\|.patch\|replace" em airtable.ts retorna vazio.
  - `rule` TR-5.2: grep por imports de airtable.ts fora de lib/dados/ é vazio.
  - `rule` TR-5.3: Chamadas fetch incluem `fields` query parameter com whitelist.
  - `rubric` TR-5.4: Cobertura de testes unitários (mock fetch). Dimensão cobertura de ramos; escala 1-5; 1=sem testes, 3=mapeamento e filtros, 5=todos os ramos incluindo value maps, cache e erros; threshold >= 4. Evidence: coverage report.

## Task 6: Docs: variáveis + markdown + resolver base/variação
- **Status**: `pending`
- **Priority**: high
- **Depends On**: 1
- **Description**:
  - `lib/docs/variaveis.ts`: `substituir(texto: string, vars: Record<string,string>, opcoes: { omitirSegredos: boolean, segredos: string[] } ): {texto: string, faltam: number}`. Segredos (SIGO_PALAVRA sempre; opcionalmente outros) são omitidos do texto se `omitirSegredos=true`. Placeholders desconhecidos ficam como estão. Conta quantas chaves esperadas não foram substituídas (faltam).
  - `lib/docs/markdown.ts`: `mdParaHtml(md)` converte markdown → subset HTML (headings h1-h6, paragraphs, ul/ol, bold, italic, code inline+block, links, tables). Sem extensões. HTML sanitizado básico.
  - `lib/docs/resolver.ts`: `documentoEfetivo(nome, entidadeId, documentos, variacoes)` exatamente como spec §13.1. Retorna {origem, desatualizada, nota, corpo, versao_base?}.
- **Acceptance Criteria Addressed**: AC-15, AC-16
- **Test Requirements**:
  - `rule` TR-6.1: `substituir("Olá {{NOME}}, pw={{SIGO_PALAVRA}}, crm={{CRM_TOKEN}}", {NOME:"Ana",SIGO_PALAVRA:"secreta",CRM_TOKEN:"pat"}, {omitirSegredos:true, segredos:["SIGO_PALAVRA"]} )` retorna "Olá Ana, pw={{SIGO_PALAVRA}}, crm=pat" e faltam=0.
  - `rule` TR-6.2: documentoEfetivo retorna correto para base, variação atual, variação desatualizada.
  - `rule` TR-6.3: mdParaHtml renderiza table, link, bold.

## Task 7: Auth: (auth) routes + Supabase SSR cookies + convites
- **Status**: `pending`
- **Priority**: high
- **Depends On**: 2, 3
- **Description**:
  - `app/(auth)/entrar/page.tsx`: formulário email/password. Login errors não revelam se email existe.
  - `app/(auth)/recuperar/page.tsx`: pedido de reset link; sempre responde o mesmo (se email existe ou não).
  - `app/(auth)/definir/[token]/page.tsx`: define password a partir de invite token ou reset. Token single-use; validação comprimento ≥10.
  - Tabela `convites` já incluída na Task 2. Implementar endpoint `/api/admin/convites` usar tabela própria com token unique, expira_em 7 dias, usado_em. Então: API staff cria convite → grava → envia email com link `/definir/[token]` → página lê token, valida expiração e usado, cria user via Supabase Auth admin API, marca usado_em.
  - `middleware.ts`: rotas (app) protegidas; refresh session cookie SSR; rotas /api/admin exigem role=staff via JWT app_metadata ou tabela utilizadores.
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `rule` TR-7.1: E2E manual: convite → email link → definir password (9 char falha, 10 char passa) → login → sessão.
  - `rule` TR-7.2: Login com email inexistente vs password errada devolve a mesma mensagem genérica.
  - `rule` TR-7.3: Token de convite usado 2ª vez retorna erro.

## Task 8: App shell: layout, navegação, topbar, tema, mobile nav
- **Status**: `pending`
- **Priority**: high
- **Depends On**: 1, 7
- **Description**:
  - `app/(app)/layout.tsx`: Top bar desktop com links Quadro, Documentação, Entidades (staff-only); sync status direito, bell, avatar dropdown. Tag "TheStarter" staff.
  - Bottom nav mobile ≤760px: ícones Quadro, Documentos, Perfil (+Entidades staff). Bottom nav esconde quando detalhe/modal aberto.
  - Tema: hook `useTema` lê localStorage e `prefers-color-scheme`. Toggle no menu de avatar. Atributo `[data-theme]` no `<html>`. Dark tokens: --border:#242424, --fg:#F2F2F2, --bg:#0F0F0F.
  - Componentes base: `Button`, `Card`, `Badge`, `Pill`, `Modal`, `Tabs` — puro CSS. Sem bibliotecas. Raio de 6px em cards/buttons/modals. Sem sombras exceto dropdowns. Sem elevação em hover lift. Transições de cor apenas quando protótipo o tiver.
  - Variáveis de cor global: `--bg`, `--fg`, `--muted`, `--red` (#b4443c light / #e08a84 dark), `--red-pale`, `--border` (#EDEDED light / #242424 dark). Borders 0.5px.
  - Tipografia: Inter self-hosted via `@font-face`. 2 weights. Minúsculas labels, sentence case corpo.
- **Acceptance Criteria Addressed**: AC-27, AC-28, AC-29, NFR-8, NFR-9
- **Test Requirements**:
  - `rule` TR-8.1: Desktop 1280px mostra top bar todos os items. Mobile 375px mostra só logo + bell topo + nav inferior.
  - `rule` TR-8.2: Toggle tema grava em localStorage e sobrevive a refresh. Dark mode ativa os tokens --border:#242424.
  - `rule` TR-8.3: Nenhum overflow-x horizontal em mobile em todas as telas base (quadro vazio, settings, docs list).
  - `rule` TR-8.4: Raio CSS é 6px (inspetor confirma border-radius:6px). Sem transform:translateY em :hover (sem elevação).
  - `rubric` TR-8.5: Fidelidade visual geral. Escala 1-5; 1 = tokens/sombreados errados; 3 = layout correto, detalhes divergem; 5 = tokens CSS batem com spec, spacing, radius 6px, borders 0.5px, sem sombras todos corretos; threshold >= 4. Evidence: screenshot.

## Task 9: API core: /api/quadro + /api/vistas + /api/problemas + /api/notificacoes + **NOVO /api/credenciais/copia**
- **Status**: `pending`
- **Priority**: high
- **Depends On**: 4, 5, 2, 7
- **Description**:
  - `app/api/quadro/route.ts` (GET): valida sessão → obtem entidade_id → vai a config_entidade buscar prazos/mapa_campos/fonte_credencial (decriptar CRM_TOKEN do config.fonte_credencial E do variaveis.CRM_TOKEN cifrado) → instancia adaptador → obterAcoes + obterRegistos → para cada ação `derivar()` → filtros/vistas/pesquisa query params → retorna {cartoes: Cartao[], contadores:{atrasadas,hoje,bloqueadas}}. NÃO grava em BD lado servidor.
  - Cache 15min por entidade em memória Map (adaptador já trata).
  - `app/api/vistas/route.ts`: GET listar vistas do tenant, POST criar, PATCH atualizar, DELETE apagar (exceto fixa=true). Seed garantido se a lista vier vazia via trigger Task 2.
  - `app/api/notificacoes/route.ts`: GET unread count e lista últimas 7, POST marcar lidas.
  - **NOVO `app/api/credenciais/copia/route.ts`** (GET, sessão obrigatória): lê entidade_id, vai a config_entidade.variaveis e config_entidade.fonte_credencial. **Devolve JSON com**: SIGO_URL, SIGO_UTILIZADOR, CRM_TIPO, CRM_BASE, CRM_TOKEN (ambos desencriptados a partir dos campos cifrados), TBL_ACOES, TBL_LOGS, TBL_FORMANDOS, AREA_FORMACAO, REGIME. **NÃO devolve SIGO_PALAVRA (não está lá)**. É o ÚNICO endpoint que devolve CRM_TOKEN desencriptado; todos os outros endpoints de settings devolvem null/não-incluem.
  - `app/api/problemas/route.ts`: POST submeter problema (verifica podeReportar: staff || suporte=true || diasDesde(setup_em)<=30). Valida 5 anexos max 5MB png/jpg/webp. Upload para Supabase Storage bucket EU `problemas-anexos` paths = `{entidade_id}/{problema_id}/{uuid}.ext`. Grava linha `problemas_reportados` e `problemas_anexos` com `apagar_em = now+90d`. Envia email para EMAIL_REPORTES com links. Cria notificação in-app para o reportador.
  - `app/api/admin/...` só acessível com service_role via server-side e utilizador staff (verificado). NÃO expor service role ao cliente.
- **Acceptance Criteria Addressed**: AC-2, AC-7, AC-16, AC-18, AC-20, AC-24, AC-25**
- **Test Requirements**:
  - `rule` TR-9.1: GET /api/quadro retorna 6 colunas (via agrupamento dos cartoes.col) no response JSON.
  - `rule` TR-9.2: Staff curl para /api/quadro sem entidade_id própria retorna vazio ou erro; staff não obtém dados de outros tenants mesmo que passe entidade_id manualmente.
  - `rule` TR-9.3: POST /api/problemas sem direito retorna 403.
  - `rule` TR-9.4: Anexo uploadado devolve apagar_em correto e bucket região EU (verificar dashboard).
  - `rule` TR-9.5: GET /api/credenciais/copia response JSON contém CRM_TOKEN e NÃO contém SIGO_PALAVRA.
  - `rule` TR-9.6: GET settings/config normal (ex: /definicoes GET) response NÃO contém chave CRM_TOKEN nem fonte_credencial nem mascarados.

## Task 10: UI Quadro: 6 colunas + cartões + estados + contadores
- **Status**: `pending`
- **Priority**: high
- **Depends On**: 8, 9
- **Description**:
  - `app/(app)/quadro/page.tsx`: Server component inicial; client component `Board` faz fetch /api/quadro com SWR ou fetch + cache browser.
  - Linha contadores: "atrasadas" (vermelho se >0, clicável), "hoje" (clicável), "bloqueadas" (vermelho se >0, clicável). Aplicar quick filter. Link "limpar filtros".
  - Barra de vistas: tabs com a vista ativa, dropdown para criar/editar/gerir vistas.
  - Pesquisa: input texto; filtrar nome ou código. Subtítulo "N resultados para x" com link "limpar".
  - 6 colunas com header: nome da fase (Dados, Perfis, Curso, Ação, Certificação, Conclusão) + contagem visível.
  - Coluna 6 (Conclusão) tem toggle "Ver N concluídas há mais de uma semana".
  - Coluna 0 (Dados) tem toggle "Ver N futuras".
  - Cartão renderiza estado (ok/today/late/error/blocked/done/futura) com CSS classes correspondentes, motivo quando aplicável.
  - Ordenação dentro da coluna: ativas primeiro (ordem prazo crescente), depois done cronológico desc.
- **Acceptance Criteria Addressed**: AC-2, AC-4, AC-5, AC-6**
- **Test Requirements**:
  - `rule` TR-10.1: DOM contém 6 headers de coluna cada um com contador.
  - `rule` TR-10.2: Clicar "atrasadas" reduz cartões a só late+error.
  - `rule` TR-10.3: Clicar toggle concluídos mostra + N cartões e contagem da coluna atualizada.
  - `rubric` TR-10.4: Fidelidade ao protótipo AC-26 no quadro quando protótipo chegar. Escala 1-5; threshold >= 4. Evidence: screenshot.

## Task 11: UI Detalhe do cartão: modal + mobile fullscreen + copy instruction
- **Status**: `pending`
- **Priority**: high
- **Depends On**: 10, 6, 9
- **Description**:
  - `components/CardDetail.tsx`: clique no cartão → desktop Modal, mobile fullscreen page (ou fullscreen overlay com sticky header e ×).
  - Ordem de conteúdo: 1) nome + código curso + tipo, 2) Progresso 6 fases com bolinhas (filled done com data, outlined current com prazo/estado, faded futuro), 3) tabela (datas, diasSemana, formandos, formato, duração estimada current phase), 4) Botão "Notificar" abre picker de utilizadores da entidade + mensagem placeholder.
  - Action block condicional por estado:
    - ok/today/late: Botão "Copiar instrução do Flow N" + nota se fase4 e formandos≥8. **Antes de copiar**: fazer GET a `/api/credenciais/copia** para obter variáveis cifradas desencriptadas; depois juntar com SIGO_PALAVRA de localStorage. Substituir tudo client-side usando `lib/docs/variaveis`. Copiar só instrução curta da spec §4.9. Mostrar "Copiado" 1.8s. Toast a avisar se N variáveis em falta. **SIGO_PALAVRA NUNCA É INCLUÍDA NO TEXTO COPIADO (mesmo que exista em localStorage).
    - error: Nota vermelha motivo + nota de repetição segura se fase 5 ou genérica. Copiar ativo.
    - blocked: Nota vermelha + "Resolve na base de dados para desbloquear". Botão "Bloqueado" disabled.
    - done: Botão "Ação concluída" disabled.
  - Se podeReportar: "Reportar problema à TheStarter" → abre diálogo Task 21. Caso contrário hint.
  - Link "Abrir na fonte de dados" → new tab urlOrigem.
- **Acceptance Criteria Addressed**: AC-7, AC-9, AC-17
- **Test Requirements**:
  - `rule` TR-11.1: Copiar instrução → clipboard content NÃO contém substring de SIGO_PALAVRA nem a chave literal {{SIGO_PALAVRA}} substituída. Contém CRM_TOKEN em claro (endpoint devolveu-o). Contém SIGO_URL.
  - `rule` TR-11.2: Botão copy no blocked tem atributo disabled. Botão no done disabled.
  - `rule` TR-11.3: Mobile: abrir detalhe → bottom nav some, overlay fullscreen, header sticky com × volta a nav.

## Task 12: Vistas UI (criar/editar/apagar + quick filters AND layering)
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: 10
- **Description**:
  - Modal "Gerir vistas": lista vistas atuais, editar condições (campo, operador =/≠/em, valor/es), apagar com confirmação "Perdes N condições".
  - Criar vista nova: nome + adicionar linhas de condição.
  - **Quick filters (contadores) são AND adicionais sobre a vista ativa**: clicar em "atrasadas" NÃO alarga, restringe. Ex: vista="Todas" + atrasadas = só atrasadas. vista="A precisar de atenção" + hoje = hoje AND hoje. URL state `?vista=id&filtros=atrasadas&q=abc`.
  - Persistir vista ativa em localStorage por utilizador.
- **Acceptance Criteria Addressed**: AC-6
- **Test Requirements**:
  - `rule` TR-12.1: Vista "A precisar de atenção" aplicada (4 estados) → só esses. Clicar depois "atrasadas" → reduz ainda mais (fica só late/error). Contador de cartões abaixa.
  - `rule` TR-12.2: Apagar vista seedada "Todas" falha (fixa=true).

## Task 13: Staff API admin + Entidades list/criar/editar
- **Status**: `pending`
- **Priority**: high
- **Depends On**: 3, 7
- **Description**:
  - Service role Supabase client: `lib/supabase/service.ts` só importado em /app/api/admin/** e /app/api/cron/**.
  - `POST /api/admin/entidades`: body {nome, nipc, fonteTipo, primeiroEmail}. Cria entidades (ativa=true, setup_em=today), config_entidade (prazos defaults, mapa_campos default TheStarter), seed 2 vistas (trigger T2 já faz), cria convite para primeiroEmail 7 dias, envia email convite.
  - `GET /api/admin/entidades`: lista todas com contadores (users_count, suporte, ultima_atividade, sem_contrato).
  - `PATCH /api/admin/entidades/[id]`: toggle ativa, toggle suporte, toggle contrato_assinado.
  - `GET /api/admin/entidades/[id]/problemas`: lista problemas reportados; POST marcar resolvido.
  - `DELETE /api/admin/entidades/[id]`: **Operação destrutiva. Apenas implementar após tua aprovação explícita em Open Question**. Faz DELETE CASCADE cuidados. Staff confirmação explicando o que é apagado vs não.
- **Acceptance Criteria Addressed**: AC-20, AC-31, AC-32
- **Test Requirements**:
  - `rule` TR-13.1: POST /api/admin/entidades → SELECT entidades, config_entidade, vistas, convites têm as novas linhas. Email enviado.
  - `rule` TR-13.2: Endpoint admin não acessível a users não-staff (403).
  - `rule` TR-13.3: Admin routes não devolvem array Acao ou Registo.

## Task 14: Staff UI Entidades (list + detail modal)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: 8, 13
- **Description**:
  - `app/(app)/entidades/page.tsx`: KPIs acima: entidades ativas, utilizadores, ações rastreadas, entidades com suporte, sem contrato.
  - Lista: nome, activity dot, utilizadores, ações, source, last activity, suporte pill, ativa pill, sem-contrato pill.
  - Detail modal: status, utilizadores, source, last activity, contrato (vermelho "Em falta"), setup date, nota "Não tens acesso ao quadro desta entidade". Toggle suporte com explicação. Convidar utilizador (email + 7 dias). Desativar/Reativar acesso. **Apagar definitivamente** com modal confirmação texto exato da spec §15. Secção problemas reportados com "Marcar resolvido". O modal de apagar enumera claramente: apaga contas, vistas, prazos, credenciais; não apaga ações, registos, formandos — nunca estiveram aqui.
- **Acceptance Criteria Addressed**: AC-31, AC-32, AC-20
- **Test Requirements**:
  - `rule` TR-14.1: Detalhe modal contém a frase exata "Não tens acesso ao quadro desta entidade".
  - `rule` TR-14.2: Modal de apagar enumera as 4 coisas apagadas e 3 não-apagadas. Texto idêntico à spec.

## Task 15: Docs UI lista + leitor com placeholders toggle + copy
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: 6, 8, 9
- **Description**:
  - `app/(app)/documentacao/page.tsx`: lista documentos (base + efetivo da entidade) com versão e data. Linhas com variação mostram pill "adaptado à vossa entidade". Nota no topo se sem suporte e >30 dias: "Documentação congelada".
  - Pesquisa: caixa que filtra por conteúdo, mostra resultado com ficheiro, linha, excerpt destacado. Clicar vai para a âncora.
  - `app/(app)/documentacao/[nome]/page.tsx`: leitor.
    - Renderiza corpo HTML subset sanitizado.
    - Placeholders `{{CHAVE}}` visualizados como <span class="tag">{{CHAVE}}</span>.
    - Toggle "Ver os meus valores": substitui valores não-segredos inline; segredos mostram como 6 ● mesmo que existam.
    - Botão "Copiar conteúdo": faz GET a `/api/credenciais/copia, substitui tudo client-side; segredos SIGO_PALAVRA NÃO incluídos; copia para clipboard.
    - Se variação desatualizada: nota vermelha.
- **Acceptance Criteria Addressed**: AC-16, AC-15
- **Test Requirements**:
  - `rule` TR-15.1: Toggle on + SIGO_PALAVRA está em localStorage → renderiza 6 ●, não o valor. CRM_TOKEN também é 6 ● no modo visualizar.
  - `rule` TR-15.2: Botão copiar → conteúdo NÃO contém SIGO_PALAVRA; CONTÉM CRM_TOKEN (desde endpoint).
  - `rule` TR-15.3: Lista mostra "adaptado à vossa entidade" quando variação existe.

## Task 16: Staff Docs: Editor base + variações + publicar + **conversão seed 7 MDs inicial
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: 14, 6, 2
- **Description**:
  - **Subtarefa 16.1 Seed 7 documentos recebidos**: percorrer os MDs fornecidos, procurar e substituir todas as credenciais literais (URLs de bases, tokens sk-literal, users reais) por {{VARIÁVEIS}} correspondentes. Validar Task 2 passou a inserção.
  - Scope bar na página de documentação quando staff: "Base" + botão por entidade ativa com contagem de variações (vermelho se alguma desatualizada).
  - Base scope: cada linha mostra "N entidades têm variação". Botão Novo documento. Cada ficheiro: Editar / Apagar.
  - Entity scope: linhas "base" têm Personalizar (copia base como variação). Linhas "variação" mostram nota de 1 linha, Editar / Voltar à base (confirmação).
  - Editor: nome, versão, textarea HTML subset. Botão "Carregar .md ≤512KB" → converte via `mdParaHtml`. Botões "Guardar rascunho" (publicado=false) e "Publicar a todas".
  - Confirmar publish: "Esta atualização chega a X entidades (Y excluídas: sem suporte ou com variação deste ficheiro)" + campo "o que mudou" (1 linha) que entra em notificação in-app.
  - Apagar documento base: confirmação "Desaparece de todas as entidades, incluindo alguém em meio de flow."
- **Acceptance Criteria Addressed**: AC-15
- **Test Requirements**:
  - `rule` TR-16.1: Contagem X entidades publicadas + Y excluídas batem com suporte=false OR têm variação.
  - `rule` TR-16.2: Carregar .md com tabela renderiza HTML table correto no textarea.
  - `rule` TR-16.3: 7 documentos iniciais após substituição não contêm credenciais literais.

## Task 17: Settings tabs (Perfil, Equipa, Notificações, Relatório)
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: 8, 2
- **Description**:
  - `app/(app)/definicoes/page.tsx`: 8 tabs com scroll horizontal em mobile.
  - **Todos os tabs usam botão Guardar explícito no footer; NENHUM autosave no blur/Escape.**
  - Perfil: nome, email, função (readonly), alterar password.
  - Equipa (admin só): lista users com role pills, convite por email (7 dias) + função. Remover membro. Botão Guardar no footer do tab.
  - Notificações: toggle por evento (5) e canal (app/email). Grid on/off. Guardar explicitamente.
  - Relatório semanal: on/off, dia, hora, destinatários (emails lista, não precisam de conta), "Ver pré-visualização" abre modal com relatório renderizado com dados atuais. Remover destinatário pede confirmação. Guardar explicitamente.
- **Acceptance Criteria Addressed**: AC-30
- **Test Requirements**:
  - `rule` TR-17.1: Tab Equipa só aparece a users admin/staff. Gestor e leitura não a veem.
  - `rule` TR-17.2: Remover destinatário de relatório mostra modal de confirmação.
  - `rule` TR-17.3: Nenhum dos tabs grava ao perder foco (teste: alterar campo, clicar fora, recarregar → valores originais). Clicar Guardar → persistir.

## Task 18: Settings tabs (Prazos, Credenciais, Ligação de dados, Privacidade)
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: 17, 3, 5, 9
- **Description**:
  - Prazos: entry window select (7,10,15,21,30,45), per-fase selects (fases 0,1,2,3,4,5), aviso lead (1/2/3/5/7 dias). Valores lidos/gravados em `config_entidade.prazos`. **Só grava ao clicar Guardar.**
  - Credenciais: grupo SIGO (URL, utilizador, password [password input com pill "só neste navegador", botão "Apagar deste navegador" → limpa localStorage]). Grupo Base de dados (tipo, base, token [password input, cifrado servidor com cifra, **nunca repopulated após save; TBL_ACOES/TBL_LOGS/TBL_FORMANDOS]). Grupo Regras fixas (AREA_FORMACAO, REGIME). Nota vermelha se N valores vazios. Botão "Testar ligação" chama verificarLigacao e checa valores vazios. **Só grava ao clicar Guardar.**
  - Ligação de dados: source name, ultima leitura. Per tabela "Leitura · N registos" ou "Sem acesso, por configuração". Bloco "Permissões da credencial": escrita=nenhuma, tabela formandos=não pedida, idade da credencial com renew aos 12 meses hint. Botão "Sincronizar agora" (invalida cache). Mudar de fonte: Airtable (em uso), Google Sheets, Notion, Outro (apenas UI disabled v1).
  - Privacidade: texto longo auditor-friendly (§17 + §9 + §8.3). Botões download: contrato (PDF ou md) e lista de campos acedidos (gerado a partir de FonteDeDados Acao/Registo fields — nunca hardcoded).
- **Acceptance Criteria Addressed**: AC-30, AC-17, AC-18
- **Test Requirements**:
  - `rule` TR-18.1: Guardar SIGO_PALAVRA em Credenciais → localStorage contém JSON com a chave; fetch de qualquer página não a contém em request body/header (confirmar com interceptor).
  - `rule` TR-18.2: GET de config_entidade publica não contém fonte_credencial nem CRM_TOKEN (nem mascarado).
  - `rule` TR-18.3: "Testar ligação" chama verificarLigacao e mostra aviso quando tabela formandos acessível.
  - `rule` TR-18.4: Alterar prazos, sem Guardar, refresh → valores originais; Guardar → persistir.

## Task 19: Notificações in-app (bell + painel) + notify colleague
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: 8, 9
- **Description**:
  - Bell icon no topbar com dot vermelha se unread>0.
  - Dropdown painel: últimas 7 notificações, link "Marcar todas lidas", "Ver todas".
  - Cada linha: ícone por tipo, corpo, tempo relativo, lida opaca.
  - No detalhe do cartão Task 11, botão "Notificar": picker de utilizador (mesma entidade) + textarea mensagem. Placeholder "Podes correr o Flow N desta ação?". Submete POST /api/notificacoes que cria linha notificacoes (tipo=notificado, corpo inclui mensagem). Dispara email se canal email ativo nas preferências do destinatário.
- **Acceptance Criteria Addressed**: AC-21
- **Test Requirements**:
  - `rule` TR-19.1: Notificar colega com preferência email=true → Resend log mostra email enviado. Com false → não envia.
  - `rule` TR-19.2: Bell dot some após "Marcar todas lidas".

## Task 20: Crons: prazos (serverless safe com estado_notificacoes tabela) + relatório semanal + purge anexos
- **Status**: `pending`
- **Priority**: high
- **Depends On**: 3, 9, 2
- **Description**:
  - `app/api/cron/prazos/route.ts`: header CRON_SECRET válido obrigatório. Hourly. Por cada tenant ativo: deriva board. **NÃO USA CACHE MEMÓRIA. Usa tabela `estado_notificacoes` (PK entidade_id + acao_ref). Para cada ação compara coluna/estado atual vs armazenado. Se houve transição notificável (ok→late, ok→today com estado late hoje? ok→blocked, fase done 5 alguuma → concluído) gera notificações users com preferências correspondentes (prazo / bloqueio / concluido / falha_sync se adaptador erro). Atualiza/cria linha em estado_notificacoes com o (novo) estado.
  - `app/api/cron/relatorio/route.ts`: hourly, CRON_SECRET. Por cada entidade ativa com config_relatorio.ativo=true: se dia+hora batem com agora, deriva board, monta email PT-PT com 4 secções (atrasadas: nome, fase, dias; bloqueadas: nome, motivo; esta semana: nome, fase; concluídas esta semana: nome). Envia via Resend para cada destinatário. Footer exato da spec.
  - `app/api/cron/purge/route.ts`: daily, CRON_SECRET. DELETE FROM problemas_anexos WHERE apagar_em <= today e apagar objetos Storage correspondentes. Log quantidade apagada.
  - Configurar Vercel Cron em vercel.json com schedules conforme documentação Vercel.
- **Acceptance Criteria Addressed**: AC-21, AC-22, AC-23, AC-25
- **Test Requirements**:
  - `rule` TR-20.1: Chamar cron prazos 2x em cold starts separadas (limpar cache se necessário; simular 2 workers) → SELECT COUNT notificacoes = transições; SELECT estado_notificacoes tem linhas. 2ª run NÃO gera notificações duplicadas.
  - `rule` TR-20.2: Forçar dia+hora no config → cron relatório envia email com as 4 secções, sem nomes de formandos.
  - `rule` TR-20.3: Inserir linha anexo com apagar_em=ontem → purge remove linha + objeto storage.

## Task 21: Problemas UI formulário com anexos + blur/crop hint
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: 11, 9
- **Description**:
  - Modal Reportar problema: textarea descrição (obrigatória). Upload até 5 ficheiros png/jpg/webp ≤5MB cada. Preview thumbnails com botão remover por cada.
  - Linha abaixo anexos: "Por favor, desfoca ou corta dados de formandos antes de enviar."
  - Submit: loading state. Quando sucesso: toast "Enviado" + notificação in-app.
  - Staff em detalhe de entidade (Task 14) vê lista problemas com "Marcar resolvido".
- **Acceptance Criteria Addressed**: AC-24, AC-25
- **Test Requirements**:
  - `rule` TR-21.1: Upload 6 ficheiros → UI bloqueia ou erro antes de submit.
  - `rule` TR-21.2: Descrição vazia → botão submit disabled.

## Task 22: Segurança final: headers + testes isolamento + auditoria básica
- **Status**: `pending`
- **Priority**: high
- **Depends On**: 20, todas as outras
- **Description**:
  - Verificação final CSP headers: `default-src 'self'`; `img-src 'self'` + data: para thumbs? Ajustar. `style-src 'self' 'unsafe-inline'` (Next.js precisa). `script-src 'self'`.
  - Script de testes RLS com duas sessões diferentes + tentativa de forge entidade_id via cliente anon.
  - Script de teste: procurar "SIGO_PALAVRA" em requests via interceptor DevTools (automated ou checklist).
  - Garantir que `service_role` só está importado em `app/api/admin/**` e `app/api/cron/**`. Grep no código.
  - Garantir logger filtra em todos os endpoints (usar wrapper comum).
  - Verificar que Inter está self-hosted: sem `<link href="https://fonts.googleapis.com">`.
- **Acceptance Criteria Addressed**: AC-17, AC-19, AC-20, AC-33, AC-34, NFR-7
- **Test Requirements**:
  - `rule` TR-22.1: `grep -r "fonts.googleapis.com\|fonts.gstatic.com" --include=*.tsx --include=*.ts --include=*.css` vazio.
  - `rule` TR-22.2: `grep -r "from.*supabase/service" app/` retorna só ficheiros em admin/ e cron/.
  - `rule` TR-22.3: Tentativa de `client.from('vistas').select().eq('entidade_id','tenant-forjado')` anon key → 0 linhas.

## Task 23: Polimento visual: protótipo fidelidade + mobile + micro-interações
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: 10, 11, 15, 17, 18, 14
- **Description**:
  - Revisão pixel-by-pixel ao quadro, detalhe, login, settings tabs vs protótipo fluxo.html **assim que for recebido**.
  - Micro-interações: focus-visible outlines claros, transitions apenas quando protótipo especifica (sem elevação/hover lift).
  - Empty states: "Vazio" por coluna, "Sem resultados" por pesquisa, skeleton inicial apenas no primeiro carregamento sem cache.
  - Acessibilidade: todos os botões com aria-labels, focus visível, contraste AA em vermelho sobre fundo pálido.
- **Acceptance Criteria Addressed**: AC-26, AC-27, AC-30
- **Test Requirements**:
  - `rubric` TR-23.1: Fidelidade global ao protótipo (após entrega). Escala 1-5; threshold >= 4. Evidence: side-by-side.
  - `rubric` TR-23.2: Qualidade micro-interações/empty states. Escala 1-5; threshold >= 4; 1 = empty states ausentes, 3=presentes mas inconsistentes; 5 = empty states em todos os locais certos, focus visível, contraste AA.
  - `rule` TR-23.3: DevTools Lighthouse a11y score >= 90.
