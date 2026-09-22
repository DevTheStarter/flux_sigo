# Fluxo - Product Requirements Document

## Overview
- **Summary**: Aplicação web multi-tenant para entidades formadoras certificadas pela DGERT, que visualiza o estado de cada ação de formação nas seis fases do processo de certificação SIGO, avisa sobre prazos, contém documentação passo-a-passo e fornece instruções prontas a copiar.
- **Purpose**: Centralizar o acompanhamento do ciclo de vida das ações de formação, reduzir erros administrativos e garantir cumprimento de prazos SIGO sem automatizar a execução das fases.
- **Target Users**: staff (TheStarter), admin (administrador da entidade), gestor (utilizador da entidade), leitura (só leitura).

## Goals
- Visualizar em quadro kanban a fase atual de cada ação de formação.
- Derivar estado e prazos por entidade a partir de dados lidos em tempo real da base de dados da entidade.
- Fornecer documentação de processo por fase, com variáveis por entidade e variações por entidade.
- Emitir notificações in-app e email sobre prazos, bloqueios e conclusões — com persistência de último estado para evitar duplicações em serverless.
- Permitir reporte de problemas com anexos para entidades com suporte.
- Enviar relatório semanal por email com resumo do quadro.
- Garantir isolamento estrito entre tenants (RLS, sem acesso staff a dados de quadro).
- Nunca persistir dados operacionais (ações, registos) na base de dados da aplicação.

## Non-Goals
- Sem chamadas LLM. Sem interface de chat. Sem automação de navegador.
- Sem atribuição de tarefas ou ownership.
- Sem registo público.
- Sem faturação ou pagamentos.
- Sem multi-idioma (apenas PT-PT).
- Sem 2FA em v1 (decidir antes do lançamento).
- Sem Google Sheets ou Notion em v1 (Airtable primeiro).
- Sem autosave em formulários de definições; todos os tabs usam botão Guardar explícito.

## Background & Context
- Fonte única de verdade: FLUXO-SPEC.md v1.0 de 21 Set 2026.
- Stack: Next.js 14 App Router, TypeScript, Supabase (Auth + DB + Storage), Vercel fra1, Resend EU.
- Fases 1 e 2 paralelas; 3 depende de 1+2; 4 depende de 3; 5 depende de 4.
- Adaptador de dados read-only com whitelist de campos; tabela de formandos nunca lida.
- SIGO password só em localStorage do navegador, nunca chega ao servidor.
- CRM_TOKEN é cifrada no servidor e disponibilizada ao cliente SÓ no momento da cópia (instrução ou documento), nunca persistida no cliente.

## Functional Requirements
- **FR-1**: Autenticação via Supabase Auth com emails de convite (7 dias) e reset (60 min); mínimo 10 caracteres; sem signup público.
- **FR-2**: Quadro kanban com 6 colunas por fase, ordenação (ativas primeiro, depois concluídas), estados visuais (ok/today/late/error/blocked/done/futura), contadores clicáveis (atrasadas, hoje, bloqueadas).
- **FR-3**: Derivação de coluna e estado por ação a partir de registos de sucesso, nunca persistida; função `derivar` implementa a lógica exata da spec.
- **FR-4**: Ocultação de cartões concluídos há >7d e futuros por detrás de toggle, com contagem dinâmica.
- **FR-5**: Vistas (filtros nomeados AND) partilhadas por tenant; duas seeded (Todas, A precisar de atenção); condições: ano, formato, tipo, estado, diasSemana com operadores =, ≠, em.
- **FR-6**: Pesquisa por nome de ação ou código do curso, case-insensitive.
- **FR-7**: Detalhe de cartão (modal desktop / fullscreen mobile): progresso de 6 fases, tabela de metadados, botão copiar instrução, estado do flow, notificar colega, reportar problema, abrir na fonte.
- **FR-8**: Cópia de instrução curta com substituição de variáveis client-side; CRM_TOKEN e SIGO_URL etc são obtidos de endpoint seguro no momento da cópia; SIGO_PALAVRA vem de localStorage; aviso de variáveis em falta; SIGO_PALAVRA nunca incluída.
- **FR-9**: Prazos por tenant em `config_entidade.prazos` com defaults da especificação; janelas de entrada e aviso configuráveis.
- **FR-10**: Adaptador Airtable com interface FonteDeDados, whitelist de campos, cache 15min em memória, mapeamento de campos por tenant, sem métodos de escrita.
- **FR-11**: Modelo de documentação base + variação por entidade; resolução `documentoEfetivo`; variações desatualizadas sinalizadas.
- **FR-12**: Editor de documentação staff (base e variações) com publish a todas; markdown → HTML subset.
- **FR-13**: Notificações por evento (notificado, prazo, bloqueio, concluido, falha_sync) com canais app/email; preferências por utilizador. Tabela obrigatória `estado_notificacoes` previne duplicações em ambiente serverless.
- **FR-14**: Cron `/api/cron/prazos` horário com `CRON_SECRET`; deteção de transições de estado via tabela `estado_notificacoes`.
- **FR-15**: Cron `/api/cron/relatorio` horário; envio por email quando dia+hora coincidem; destinatários sem conta obrigatória.
- **FR-16**: Reporte de problemas (descrição + até 5 anexos ≤5MB) só para staff, entidades com suporte, ou ≤30 dias de setup; armazenamento EU bucket; anexos apagados aos 90 dias.
- **FR-17**: Gestão de entidades (staff): KPIs, lista, detalhe modal, criação, convites, toggle suporte, ativar/desativar, apagar.
- **FR-18**: Definições por entidade em tabs: Perfil, Equipa, Notificações, Relatório semanal, Prazos, Credenciais, Ligação de dados, Privacidade. Todos os tabs usam botão Guardar explícito.
- **FR-19**: Credenciais: SIGO_PALAVRA só localStorage; CRM_TOKEN cifrado AES-256-GCM no servidor nunca retornado em leituras, apenas disponibilizado num endpoint dedicado no momento da cópia.
- **FR-20**: Variáveis `{{CHAVE}}` substituídas client-side na cópia; leitor mostra placeholders como tags com toggle para valores não-segredos.
- **FR-21**: Staff nunca vê conteúdo de quadro de entidades (rotas admin só devolvem entidades, utilizadores, documentação, problemas).
- **FR-22**: RLS em todas as tabelas Supabase com políticas por `entidade_id` via `utilizadores`.
- **FR-23**: Cron diário de limpeza de anexos com data `apagar_em` expirada.

## Non-Functional Requirements
- **NFR-1**: Isolamento de tenant garantido por RLS, não por código de aplicação.
- **NFR-2**: Sem dados operacionais (ações, registos) persistidos na base de dados da aplicação.
- **NFR-3**: `SIGO_PALAVRA` nunca enviada em request body ou header.
- **NFR-4**: Valores cifrados (CRM_TOKEN, fonte_credencial) nunca retornados ao cliente em endpoints de leitura (nem mascarados). Apenas endpoint de cópia (autorizado por sessão) devolve CRM_TOKEN desencriptado.
- **NFR-5**: Logger filtra cabeçalhos: authorization, cookie, x-api-key, fonte_credencial.
- **NFR-6**: CSP `default-src 'self'`; sem scripts externos; Inter self-hosted.
- **NFR-7**: Região EU em todos os serviços (Vercel fra1, Supabase EU, Resend EU, Storage bucket EU).
- **NFR-8**: UI minimalista preto-e-branco com vermelho só para estados bloqueados/atrasados; Inter duas pesos; borders 0.5px; radius 6px; sem sombras exceto dropdowns; sem elevação/hover lift.
- **NFR-9**: Responsivo ≤760px: quadro como lista vertical full-width, detalhe fullscreen, navegação inferior fixa.
- **NFR-10**: Tempo de resposta do quadro <2s com cache; skeleton sem cache.
- **NFR-11**: PT-PT em toda a interface; vocabulário exato da spec (ação de formação, base de dados, assistente de IA, DTP).
- **NFR-12**: Tema claro/escuro via `prefers-color-scheme` e `[data-theme]`; escolha persistida em localStorage. Tokens dark: --border = #242424, --fg = #F2F2F2, --bg = #0F0F0F.

## Constraints
- **Technical**: Next.js 14 App Router + TypeScript. Sem bibliotecas de UI. Sem CSS framework. CSS puro com variáveis. Supabase Postgres. Resend. Vercel Cron. Tabela estado_notificacoes obrigatória em Supabase para deduplicação de notificações em serverless.
- **Business**: 8 restrições inegociáveis da spec (§2): não persistir dados operacionais, não ler tabela de formandos, não escrever na BD da entidade, staff não vê quadro, SIGO password só navegador, posição da coluna derivada nunca armazenada, RLS, região EU.
- **Dependencies**: Projeto Supabase EU criado manualmente com service_role key, anon key, CHAVE_CIFRA (64 hex), RESEND_API_KEY, CRON_SECRET, EMAIL_REPORTES. Storage bucket EU para anexos com política staff-only. Protótipo visual `fluxo.html` necessário para validação de AC-26.

## Assumptions
- O utilizador final tem Node.js 18+ e acesso a contas Vercel, Supabase EU, Resend EU.
- A entidade configura os 2 campos calculados no Airtable (Nº Formandos, Tem Avaliações) durante o setup.
- Os sete documentos de flow (flow-0 a flow-5 + intro se existir) serão convertidos para {{VARIÁVEIS}} antes de seed (7).
- Variáveis de ambiente são geridas fora do repositório.

## Acceptance Criteria

### AC-1: Autenticação e convites
- **Type**: `rule`
- **Given**: Uma entidade criada e um convite emitido
- **When**: O destinatário clica no link e define password ≥10 caracteres
- **Then**: A conta fica associada à entidade e função corretas; login funciona; token single-use invalida após uso
- **Pass Condition**: E2E: criar entidade → receber email → definir password → entrar → ver perfil com entidade correta
- **Evidence**: Screenshot do perfil e output `SELECT entidade_id, funcao FROM utilizadores WHERE email=...`

### AC-2: Quadro renderiza 6 colunas com cartões ordenados
- **Type**: `rule`
- **Given**: Dados com ações em fases 0-5 e algumas concluídas
- **When**: Aceder a /quadro
- **Then**: Existem 6 colunas (Dados, Perfis, Curso, Ação, Certificação, Conclusão); cada coluna mostra contagem; dentro de cada coluna ativas primeiro, depois done
- **Pass Condition**: DOM contém 6 elementos com role="columnheader" e contagens; ordem dos cartões verificada por inspecção
- **Evidence**: Screenshot do quadro e output de console.log da ordem

### AC-3: Derivação de coluna e estado (algoritmo exato)
- **Type**: `rule`
- **Given**: Conjunto de ações e registos que cobrem todos os ramos de `derivar()`
- **When**: Correr a função `derivar` com cada caso
- **Then**: Retorna {col, estado} e campos auxiliares (dias, motivo, entraEm, concluidaHa) exatamente como a especificação
- **Pass Condition**: Testes unitários para 12 casos: done, futura, blocked p4 sem avaliações, error, missing_data, late d<0, today d=0, ok d>0, phase1 sem log, phase2 sem log, phase3 com 1+2 ok, undefined deadline quando log ancora não existe
- **Evidence**: Resultado `npx jest` ou equivalente a 100% pass

### AC-4: Estados visuais e cores
- **Type**: `rule`
- **Given**: Cartões em todos os 7 estados
- **When**: Visualizar o quadro
- **Then**: ok=c cinza; today=preto bold "Hoje"; late=vermelho borda #b4443c fundo pálido; error=igual late mais motivo; blocked=borda vermelha tracejada mais motivo; done=38% opacidade "Concluída há N dias"; futura=50% opacidade tracejada "Entra daqui a N dias". Contadores atrasadas/bloqueadas vermelhas quando >0.
- **Pass Condition**: Inspecionar CSS computado de cada cartão e confirmar tokens de cor
- **Evidence**: Screenshot composto com os 7 estados

### AC-5: Ocultação de concluídos >7d e futuros
- **Type**: `rule`
- **Given**: Ação concluída há 10 dias e 2 ações futuras
- **When**: Carregar o quadro inicialmente
- **Then**: Cartões ocultos; no fim das colunas respetivas aparecem "Ver 1 concluídas há mais de uma semana" e "Ver 2 futuras"; clicar toggle mostra; contagens de coluna refletem visível
- **Pass Condition**: Toggle clique → DOM atualizado → contagens atualizadas
- **Evidence**: Vídeo curto ou 2 screenshots + contagens

### AC-6: Vistas e pesquisa
- **Type**: `rule`
- **Given**: Vistas seeded (Todas, A precisar de atenção) e 5 ações com estados variados
- **When**: Selecionar vista "A precisar de atenção", depois clicar contador "atrasadas", depois pesquisar por "ABC"
- **Then**: Vista filtra por estado em [late,today,blocked,error]; contador aplica filtro AND adicional (restringe mais, não alarga); pesquisa por nome ou código case-insensitive; subtítulo "N resultados para x" com link limpar
- **Pass Condition**: URL state reflete filtros; contagem de cartões bate com o esperado
- **Evidence**: Screenshots de cada passo + contagem

### AC-7: Detalhe de cartão e cópia de instrução
- **Type**: `rule`
- **Given**: Cartão na fase 4, 10 formandos, SIGO_URL, SIGO_UTILIZADOR, CRM_TIPO, CRM_BASE definidos no servidor; SIGO_PALAVRA em localStorage; CRM_TOKEN cifrado no servidor
- **When**: Clicar no cartão, depois "Copiar instrução do Flow 4"
- **Then**: Antes da cópia é feito GET a `/api/credenciais/copia` (autorizado por sessão) que devolve {SIGO_URL, SIGO_UTILIZADOR, CRM_TIPO, CRM_BASE, CRM_TOKEN}; substitui tudo client-side; SIGO_PALAVRA NÃO incluída no texto final; botão mostra "Copiado" 1.8s; toast avisa N variáveis em falta
- **Pass Condition**: Verificar conteúdo da clipboard não contém "SIGO_PALAVRA" nem valor da password; contém CRM_TOKEN em claro (porque é para o assistente do utilizador), contém SIGO_URL etc
- **Evidence**: Log da clipboard após cópia + network log da chamada a /api/credenciais/copia

### AC-8: Estimativa de duração
- **Type**: `rule`
- **Given**: Fase 4 com 8 formandos, fase 0 com qualquer número
- **When**: Chamar `estimar(4, 8)` e `estimar(0, 8)`
- **Then**: `estimar(4,8)` retorna {min:40, max:56}; `estimar(0,8)` retorna {min:3, max:10}. Renderizado como "40 min a 56 min" e "3 min a 10 min".
- **Pass Condition**: Output de função e string renderizada batem
- **Evidence**: Screenshot do detalhe e unit test

### AC-9: Bloqueado desativa cópia; done desativa botão
- **Type**: `rule`
- **Given**: Cartão blocked (Falta tabela de avaliações) e cartão done
- **When**: Abrir detalhe
- **Then**: Blocked: nota vermelha com motivo, botão "Bloqueado" disabled. Done: botão "Ação concluída" disabled.
- **Pass Condition**: disabled attribute verificado no DOM
- **Evidence**: Screenshot detalhe blocked + detalhe done

### AC-10: Adaptador FonteDeDados read-only e whitelist
- **Type**: `rule`
- **Given**: Adaptador airtable.ts
- **When**: Inspecionar interface e implementação
- **Then**: FonteDeDados tem só obterAcoes, obterRegistos, verificarLigacao; sem write; Nenhum import de fora de `lib/dados/` importa diretamente de airtable.ts; reads usam `fields[]` whitelist; não existe campo de formandos na whitelist
- **Pass Condition**: `grep -r "from.*airtable" components/ app/ lib/ --include=*.ts --include=*.tsx` retorna vazio exceto dentro de lib/dados/; grep por "fields[" nos reads; grep por ".update\|.create\|.delete" em airtable.ts retorna vazio
- **Evidence**: Output dos 3 comandos grep

### AC-11: Campos calculados Nº Formandos e Tem Avaliações mapeados
- **Type**: `rule`
- **Given**: Configuração de mapeamento default
- **When**: Obter ações
- **Then**: Interface Acao inclui `formandos: number` e `temAvaliacoes: boolean`; mapeamento padrão TheStarter presente
- **Pass Condition**: obterAcoes retorna objetos com ambos os campos
- **Evidence**: Log de uma resposta de obterAcoes

### AC-12: Cache 15min em memória por tenant
- **Type**: `rule`
- **Given**: Duas chamadas sucessivas ao quadro no mesmo tenant
- **When**: Segunda chamada dentro de 15min
- **Then**: Não há novo pedido Airtable; resposta servida de cache
- **Pass Condition**: Adicionar log à chamada Airtable; duas chamadas → 1 log
- **Evidence**: Log do servidor

### AC-13: Filtros padrão Estado≠Descontinuado, Formato=PT
- **Type**: `rule`
- **Given**: Ação Descontinuada e ação Formato BR
- **When**: obterAcoes com config default
- **Then**: Ambas excluídas do resultado
- **Pass Condition**: obterAcoes retorna array sem as duas ações
- **Evidence**: Log de obterAcoes com ambas presentes na origem e ausentes no retorno

### AC-14: VerificarLigacao reporta acesso a tabela de formandos como warning
- **Type**: `rule`
- **Given**: Token com acesso à tabela Formandos
- **When**: verificarLigacao()
- **Then**: Retorna {ok: true, ultimaLeitura: ..., erro: null} MAS UI mostra aviso de configuração "A credencial tem acesso à tabela de formandos — Fluxo não a lê, mas deves restringir"
- **Pass Condition**: Interface Ligação de dados mostra o warning
- **Evidence**: Screenshot do painel Ligação de dados

### AC-15: Documentação base + variações resolve corretamente
- **Type**: `rule`
- **Given**: Documento base flow-1, entidade X com variação do mesmo, entidade Y sem variação; base atualizada para versão nova
- **When**: documentoEfetivo("flow-1", X.id) e documentoEfetivo("flow-1", Y.id)
- **Then**: X retorna corpo da variação, origem="variacao", versao_base antiga, desatualizada=true; Y retorna corpo base, origem="base"; staff view mostra contagem de variações desatualizadas a vermelho
- **Pass Condition**: Testes unitários de documentoEfetivo e screenshot staff view
- **Evidence**: Unit test + screenshot

### AC-16: Variáveis substituídas; segredos só devolvidos em endpoint de cópia; CRM_TOKEN tem comportamento duplo
- **Type**: `rule`
- **Given**: Documento com {{SIGO_URL}}, {{SIGO_UTILIZADOR}}, {{SIGO_PALAVRA}}, {{CRM_TOKEN}}
- **When**: (A) alternar toggle "Ver os meus valores" no leitor; (B) clicar "Copiar conteúdo" no leitor; (C) GET /api/credenciais/copia autenticado
- **Then**: (A) Toggle inline mostra SIGO_URL e SIGO_UTILIZADOR; SIGO_PALAVRA e CRM_TOKEN aparecem como ●●●●●● (segredo); (B) Cópia substitui SIGO_URL, SIGO_UTILIZADOR, CRM_TOKEN (obtido do endpoint de cópia); NÃO inclui SIGO_PALAVRA; (C) Endpoint /api/credenciais/copia devolve CRM_TOKEN desencriptado + outros não-segredos; (D) Qualquer outro endpoint de leitura de config NÃO devolve CRM_TOKEN nem fonte_credencial
- **Pass Condition**: (A) DOM inspecionado; (B) conteúdo clipboard logado; (C) Response body JSON contém CRM_TOKEN; (D) GET /api/definicoes/config não contém CRM_TOKEN nem fonte_credencial
- **Evidence**: 4 evidências respetivas

### AC-17: SIGO_PALAVRA nunca em pedidos ao servidor
- **Type**: `rule`
- **Given**: SIGO_PALAVRA definida em localStorage
- **When**: Realizar qualquer ação na app (copiar instrução, navegar, gravar settings)
- **Then**: Nenhuma request body ou header contém a string da password ou o substring "SIGO_PALAVRA" com valor
- **Pass Condition**: MitM proxy ou DevTools Network tab: 0 ocorrências da password em qualquer request
- **Evidence**: HAR export filtrado por conteúdos sensíveis

### AC-18: CRM_TOKEN e fonte_credencial cifrados AES-256-GCM; só endpoint cópia devolve CRM_TOKEN desencriptado
- **Type**: `rule`
- **Given**: Credencial gravada
- **When**: (A) SELECT direto na BD coluna fonte_credencial e variaveis->>'CRM_TOKEN'; (B) GET settings config normal; (C) GET /api/credenciais/copia
- **Then**: (A) valores cifrados não legíveis (hex/ciphertext); (B) API response NÃO contém campo fonte_credencial nem CRM_TOKEN (nem mascarado); (C) API response contém CRM_TOKEN em claro
- **Pass Condition**: (A) Screenshot SQL; (B) fetch response sem campos; (C) fetch response com CRM_TOKEN
- **Evidence**: 3 evidências respetivas

### AC-19: RLS em todas as tabelas; tenant A não vê dados tenant B
- **Type**: `rule`
- **Given**: Dois tenants A e B com dados próprios (vistas, preferências, notificações, problemas, estado_notificacoes)
- **When**: Utilizador de A consulta qualquer tabela via anon key (forjando entidade_id falsa nos testes)
- **Then**: Só vê linhas de A; tentativa de aceder a B retorna vazio; erros de RLS em log
- **Pass Condition**: Testes: duas sessões diferentes, query cross-tenant retorna 0 linhas
- **Evidence**: Output dos testes RLS

### AC-20: Staff não acede a quadro de entidades
- **Type**: `rule`
- **Given**: Utilizador staff logado
- **When**: Tentar GET `/api/quadro?entidade_id=UUID_CLIENTE` ou navegar para hipotético `/entidades/{id}/quadro`
- **Then**: 403 ou redirecionado; routes admin listam entidades, utilizadores, documentação, problemas — nunca ações ou registos
- **Pass Condition**: curl como staff → 403 no endpoint de quadro alheio; grep código por route que devolve Acao[] fora do próprio tenant
- **Evidence**: curl output + grep

### AC-21: Notificações in-app e email por preferências
- **Type**: `rule`
- **Given**: Utilizador com prazo=true, canais={app:true,email:true}; outra utilizadora com prazo=false
- **When**: Cron prazos deteta transição → late
- **Then**: Primeira recebe notificação no painel e email; segunda não recebe nenhum
- **Pass Condition**: Tabela notificacoes tem linha; Resend dashboard mostra envio para um só
- **Evidence**: SELECT notificacoes + Resend log

### AC-22: Cron prazos não duplica notificações graças a tabela estado_notificacoes (serverless safe)
- **Type**: `rule`
- **Given**: Ação passou para late há uma hora; duas runs do cron em instâncias cold-start diferentes
- **When**: Correr cron prazos duas vezes (ou em dois workers separados sem memória partilhada)
- **Then**: Apenas uma notificação gerada; tabela `estado_notificacoes` tem linha para acao_ref com o último estado processado
- **Pass Condition**: SELECT COUNT(*) notificacoes = 1 após duas runs; SELECT COUNT(*) estado_notificacoes >= 1
- **Evidence**: SELECT COUNT antes e depois da segunda run + conteúdo tabela estado_notificacoes

### AC-23: Relatório semanal envia no dia+hora corretos
- **Type**: `rule`
- **Given**: Tenant com relatório ativo segunda 09:00, destinatários [a@x, b@x]
- **When**: Cron relatório corre às 09:00 de segunda
- **Then**: Dois emails enviados com conteúdo: atrasadas, bloqueadas, esta semana, concluídas esta semana; sem dados pessoais
- **Pass Condition**: Resend log mostra 2 envios; conteúdo do email verificado
- **Evidence**: Screenshot do email recebido

### AC-24: Reporte de problemas só quando permitido
- **Type**: `rule`
- **Given**: Staff sempre permitido; entidade X com suporte=true; entidade Y setup há 5 dias; entidade Z suporte=false e setup há 60 dias. Todas com cartão blocked.
- **When**: Abrir detalhe do cartão
- **Then**: Staff/X/Y veem botão "Reportar problema"; Z vê hint "Reportar requer plano de suporte" com email
- **Pass Condition**: 4 screenshots ou 1 composição
- **Evidence**: Screenshot dos 4 casos

### AC-25: Anexos de problema armazenados EU bucket; apagados aos 90d
- **Type**: `rule`
- **Given**: Problema submetido com 3 anexos em 21/09/2026
- **When**: Criado_em + 90d e cron purge corre
- **Then**: Storage path existe em bucket EU; data apagar_em = 20/12/2026; após cron, linha problemas_anexos apagada e ficheiro removido
- **Pass Condition**: Bucket location = EU; SELECT apagar_em; após cron → file 404
- **Evidence**: Bucket region output, SELECT, e DELETE confirmação

### AC-26: Equivalência visual ao protótipo HTML fluxo.html
- **Type**: `rubric`
- **Dimension**: Fidelidade visual e comportamental ao protótipo fluxo.html
- **Scale**: 1-5
- **Anchors**: 1 = layout quebrado, divergências gritantes; 3 = layout correto mas tipografia, espaçamentos, micro-interações (hover, focus, transitions) divergem em vários sítios; 5 = pixel-perfect, animações e estados idênticos ao protótipo
- **Pass Threshold**: >= 4
- **Evidence**: Bloqueado até entrega do protótipo `fluxo.html` pelo utilizador. Após entrega: screenshot side-by-side protótipo vs implementação (quadro, detalhe, settings tabs, login).

### AC-27: Responsividade mobile ≤760px
- **Type**: `rule`
- **Given**: Viewport 375×812
- **When**: Navegar para quadro, abrir cartão, settings, documentação, entidades
- **Then**: Nenhum scroll horizontal; cartões full-width com cabeçalhos por fase; detalhe fullscreen sticky header com ×; navegação inferior fixa (Quadro, Documentos, Perfil, +Entidades se staff); tabs scroll horizontal
- **Pass Condition**: DevTools device mode sem overflow-x em todos os ecrãs chave
- **Evidence**: 4 screenshots mobile

### AC-28: Navegação e top bar
- **Type**: `rule`
- **Given**: Sessão iniciada
- **When**: Desktop render
- **Then**: Top bar: logo → Quadro, Documentação, Entidades (se staff); direita: sync status com tooltip, bell, avatar dropdown (Perfil, Equipa, Notificações, Relatório semanal, Prazos, Ligação de dados, Mudar tema, Terminar sessão). Staff vê tag "TheStarter" ao lado do logo.
- **Pass Condition**: Elementos presentes no DOM na ordem correta
- **Evidence**: Screenshot top bar desktop

### AC-29: Tema escuro/claro automático e manual
- **Type**: `rule`
- **Given**: Sistema com prefers-color-scheme: dark; utilizador clica "Mudar tema" para light
- **When**: Atualizar a página
- **Then**: Inicialmente tema escuro aplicado (-- tokens dark incluindo --border: #242424); após toggle, tema light; escolha persiste em localStorage [data-theme]
- **Pass Condition**: :root variáveis CSS alteram, localStorage contém chave de tema
- **Evidence**: DevTools Application → localStorage + CSS vars

### AC-30: Definições tabs com botão Guardar explícito (sem autosave)
- **Type**: `rule`
- **Given**: Utilizador admin
- **When**: Aceder /definicoes, tab Prazos, alterar entrada de 15 para 21 dias
- **Then**: 8 tabs renderizadas na ordem Perfil, Equipa, Notificações, Relatório semanal, Prazos, Credenciais, Ligação de dados, Privacidade. Nenhuma grava é feita ao perder foco ou Escape. Botão "Guardar" no footer de cada tab executa persistência. Cancelar sai sem gravar. Especificamente:
  - Tab Equipa lista equipa com role pills e convite (botão Guardar após convidar).
  - Tab Prazos tem entry window (7/10/15/21/30/45), per-phase selects, aviso lead select.
  - Tab Credenciais mostra SIGO_PALAVRA com pill "só neste navegador" e botão "Apagar deste navegador". Save só ao clicar Guardar.
  - Tab Ligação de dados mostra per table N registos ou "Sem acesso, por configuração", bloco Permissões da credencial, "Sincronizar agora".
  - Tab Privacidade com texto auditor-friendly e 2 botões download (contrato, campos acedidos gerados a partir da interface).
- **Pass Condition**: Alterar valor → blur → recarregar → valor não persiste (sem Guardar); Clicar Guardar → recarregar → valor persiste.
- **Evidence**: 4 passes (2 tabs diferentes) gravados/não-gravados

### AC-31: Criação de entidade (staff)
- **Type**: `rule`
- **Given**: Utilizador staff em /entidades
- **When**: Preencher "Nova entidade" com nome, NIPC, fonte=Airtable, primeiro email
- **Then**: Linha entidades criada; config_entidade com defaults; duas vistas seeded (Todas, A precisar de atenção); convite enviado para o email
- **Pass Condition**: SELECT * tabelas relevantes + Resend log do convite
- **Evidence**: Output SQL + Resend

### AC-32: Apagar entidade descreve consequências exatas
- **Type**: `rule`
- **Given**: Staff a apagar entidade
- **When**: Clicar "Apagar definitivamente"
- **Then**: Modal de confirmação enumera: apaga (contas, vistas, prazos, credenciais); não apaga (ações, registos, formandos — nunca estiveram aqui)
- **Pass Condition**: Texto da confirmação idêntico à spec
- **Evidence**: Screenshot modal

### AC-33: Logger filtra cabeçalhos sensíveis
- **Type**: `rule`
- **Given**: Pedido HTTP com Authorization, Cookie, x-api-key, fonte_credencial no body
- **When**: Logger regista o pedido
- **Then**: Log não contém valores desses campos (apenas [FILTERED] ou removidos)
- **Pass Condition**: Log output mostra redacted
- **Evidence**: Excerto de log com pedido sensível

### AC-34: Validação de segurança headers
- **Type**: `rule`
- **Given**: Pedido a qualquer página
- **When**: Verificar response headers
- **Then**: Strict-Transport-Security, X-Content-Type-Options: nosniff, X-Frame-Options: DENY, Referrer-Policy: strict-origin-when-cross-origin, Content-Security-Policy: default-src 'self' presentes
- **Pass Condition**: `curl -I https://...` mostra todos os headers
- **Evidence**: Output curl -I

### AC-35: Setup inicial e DB migrations (inclui tabela obrigatória estado_notificacoes)
- **Type**: `rule`
- **Given**: Supabase vazio
- **When**: Aplicar migrações SQL (schema §6 + estado_notificacoes + RLS policies + storage bucket + seed 7 docs convertidos)
- **Then**: Todas as tabelas, constraints, índices e RLS policies criadas; tabela `estado_notificacoes (entidade_id, acao_ref, estado_anterior, col_anterior, atualizado_em)` com PK composta (entidade_id, acao_ref) existe; seed documentos base flow-0..flow-5 inseridos com variáveis {{VARIÁVEIS}}.
- **Pass Condition**: `\dt` lista todas as tabelas (incluindo estado_notificacoes); `SELECT policyname FROM pg_policies WHERE tablename IN (...);` retorna policy por tabela; `SELECT count(*) FROM documentos = 7`.
- **Evidence**: Output SQL

## Open Questions
- [x] ~~Existe protótipo HTML `fluxo.html` para referência visual?~~ → Bloqueado: AC-26 marcado como dependente da entrega. Fornece quando possível.
- [x] ~~Bucket Supabase Storage EU criado manualmente antes de iniciar?~~ → Será incluído na migration (Task 2) com instruções para criar bucket caso não exista CLI.
- [x] ~~O seed de documentos base (flow-0 a flow-5.md) é fornecido ou v1 arranca sem docs?~~ → Fornecido; adicionar tarefa de conversão para placeholders antes de seed.
- [x] ~~Resend domain verificado? Email de envio configurado?~~ → Assumido como feito; caso contrário, emails em dev caem em modo fail-safe log.
- [ ] Operação DELETE entidades: no detalhe de entidade, quando clica "Apagar definitivamente" — confirma que aceitas a implementação do SQL DELETE CASCADE? (Operação destrutiva em BD; pedida na spec §15)
