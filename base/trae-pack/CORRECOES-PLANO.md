# Correções ao PRD e ao plano de implementação

Aplicar antes de começar a Task 1. A spec passou a v1.1 e reflete tudo o que está aqui.

## 1. Dois tokens, não um (spec §8.1)

O `CRM_TOKEN` do PRD e da Task 18 estava a servir dois fins incompatíveis. Corrigir para:

- **Credencial do Fluxo**: `config_entidade.fonte_credencial`. Só leitura, duas tabelas, cifrada no servidor, nunca devolvida ao cliente. **Não é uma variável** e nunca entra em documentos.
- **`{{CRM_TOKEN}}`**: token de leitura e escrita que os flows usam. Só em localStorage, como `SIGO_PALAVRA`. Substituído apenas ao copiar um documento completo, no cliente.

AC-16: `CRM_TOKEN` **é** uma chave de documento. Não aparece na instrução curta (§4.9), aparece na cópia de um documento completo, e nunca chega ao servidor.

AC-17, AC-18, TR-18.1, TR-18.2: aplicar a ambos os segredos do navegador.

## 2. `estado_notificado` é uma tabela (spec §10.3)

Task 20 e AC-22: o cache `ultimo_estado` **não pode** ser em memória. Na Vercel cada execução do cron pode correr numa instância nova, e em memória o cron reenviaria todas as notificações de hora a hora. A tabela está no schema da spec, §6. Adicionar à migration da Task 2.

## 3. Sem autosave

Remover AC-36 e TR-17.3. Todos os separadores com dados têm botão **Guardar** explícito (spec §17). Gravar credenciais ou prazos ao perder o foco é perigoso.

## 4. Filtros rápidos são AND

Task 12: os contadores restringem a vista ativa. Não são uma camada OR.

## 5. Tokens visuais exatos (spec §18.2)

Task 8 e Task 23: usar os valores da tabela da spec. Sem raio de 13px, sem borda escura `#E8E8E8`, sem elevação no hover. Raio 6px em cartões e botões, 8px em modais. Escuro: linha `#242424`.

## 6. Documentos iniciais (spec §13.3)

Existem sete ficheiros. Serão fornecidos já convertidos para `{{VARIÁVEIS}}`. O script de seed tem de falhar se encontrar algo parecido com um id de base, id de tabela ou token do Airtable.

## 7. Mockups e protótipo

Estão nesta pasta: `mockups/` com 39 capturas e índice, `prototipo/fluxo.html` interativo. O AC-26 usa-os como referência.

## Perguntas em aberto do PRD, respondidas

| Pergunta | Resposta |
|---|---|
| Existe protótipo HTML? | Sim, `prototipo/fluxo.html`. |
| Bucket EU criado antes de iniciar? | A criar manualmente, nome `problemas-anexos`, privado, região EU. |
| Seed de documentos base? | Sete ficheiros, fornecidos após conversão para variáveis. |
| Resend domain verificado? | A tratar antes da Task 3. |
