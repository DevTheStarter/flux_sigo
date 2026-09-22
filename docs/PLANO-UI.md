# Plano de implementação da interface

Fonte: `FLUXO-SPEC.md` v1.1 (manda), `base/trae-pack/prototipo/fluxo.html` e as 39 capturas em `base/trae-pack/mockups/`.

## O que estava construído e o que faltava

| Área | Estado antes | Problema face à spec |
|---|---|---|
| Design system | Tokens corretos em `globals.css`; componentes com estilos inline | Variáveis inexistentes (`--border`, `--panel`, `--red-pale`), pills a 999px, verdes e azuis, bordas 1px, pesos 600/700. Inter não existia em `public/fonts`. Sem tema. |
| Shell | TopBar e BottomNav | Navegação com rotas inexistentes (Definições, Problemas, Ações), sem sino funcional, sem menu da spec, sem etiqueta TheStarter, sem estado de sincronização real. |
| Quadro | Colunas e cartões | Sem vistas, pesquisa, filtros AND, toggles de futuras e concluídas, detalhe do cartão, copiar instrução, notificar, reportar. Contadores lidos do campo errado na API. |
| Documentação | Sidebar com render servidor | Sem lista com versão e data, pesquisa, leitor com etiquetas `{{CHAVE}}`, "Ver os meus valores", copiar, nota de congelamento, âmbito staff, editor, variações, publicar. |
| Definições | Oito separadores | Um único Guardar global no rodapé, estilos fora da spec, prazos com defaults errados, sem Testar ligação, sem pré-visualização, sem Apagar deste navegador, Privacidade sem downloads. |
| Entidades | Tabela genérica | Sem KPIs da spec, sem detalhe modal, sem suporte, convite, desativar, problemas reportados, sem criação com primeiro utilizador. |
| Autenticação | Formulários genéricos | Textos e layout fora do protótipo; sem ecrã "Verifica o teu email". |

## Decisões

- CSS global por classes, portado do protótipo (`app/globals.css`). Sem biblioteca de componentes, sem framework. Radius 6/8/4, bordas 0.5px, Inter 400 e 500.
- Tema: `public/tema.js` aplica `data-theme` antes do primeiro render (compatível com `script-src 'self'`). "Mudar tema" no menu da conta.
- Segredos do navegador (`SIGO_PALAVRA`, `CRM_TOKEN`) numa única chave de `localStorage` (`fluxo-local`), JSON, com try/catch. Nunca entram em pedidos. A instrução curta nunca os inclui; a cópia de um documento completo inclui-os, só no cliente.
- Variáveis não secretas em `config_entidade.variaveis` (JSON), com fallback às colunas antigas (`sigo_url`, `fonte_base`, etc.).
- Prazos em `config_entidade.prazos` (JSON com `entrada`, `aviso`, `0`..`5`), como a spec.
- Sessão (utilizador, função, entidade, suporte, `setup_em`) carregada uma vez no layout e partilhada por contexto.
- Dados lidos diretamente com o cliente Supabase (RLS) onde a spec o permite; rotas de API só onde é preciso o servidor: quadro, ligação de dados (credencial cifrada, contagens, sincronizar), problemas (anexos e email), admin.

## Ordem de aplicação

1. `globals.css`, fontes, tema, componentes base (Modal, Toast, Toggle, Pill, Note, Btn).
2. Shell: layout com sessão, TopBar (nav, sync com tooltip, sino, menu), BottomNav, modais em ecrã inteiro no mobile.
3. API do quadro corrigida (contadores, credencial, datas de sucesso por fase, última leitura) e rota de ligação de dados.
4. Quadro: contadores, vistas, pesquisa, colunas, cartões, toggles, detalhe, copiar instrução, notificar, reportar.
5. Documentação: lista, pesquisa, leitor, âmbito staff, editor, variações, publicar.
6. Definições: oito separadores com Guardar por separador.
7. Entidades: KPIs, lista, detalhe, criar.
8. Autenticação: Entrar, Recuperar, Verifica o teu email, Definir palavra-passe.
9. Verificação: typecheck, lint, testes, build.

## Encontrado durante a verificação

- A CSP em `next.config.mjs` (`script-src 'self' 'unsafe-eval'`) bloqueava os scripts inline do App Router: a aplicação nunca hidratava em produção. Passou a ser gerada no middleware com um nonce por pedido (`script-src 'self' 'nonce-…' 'strict-dynamic'`), que o Next aplica aos seus próprios scripts. Os restantes cabeçalhos de segurança ficam em `next.config.mjs`.
- `GET /api/credenciais/copia` devolvia a credencial de leitura do Fluxo ao cliente. Contradiz §8.1 da v1.1 e nada a usava. Foi removida.
- O quadro contava atrasadas, hoje e bloqueadas a partir do campo errado (`prazo` em vez de `estado`), e lia a credencial como objeto quando a coluna é texto cifrado. Corrigido em `lib/dados/credencial.ts`, partilhado pelo quadro, pela ligação de dados e pelo cron.
- Verificação visual feita com um Supabase falso e dados fictícios, em 41 capturas (desktop, escuro, mobile, staff). Não entram no repositório.

## Fora deste plano (assinalado)

- Contagem de "ações acompanhadas" por entidade (§15) exige um `acoes_count` do adaptador com service role. Mostra-se "—" até existir.
- Crons de relatório e purga de anexos, seed real dos sete documentos, adaptadores Google Sheets e Notion.
