# Documentos base dos flows

Colocar aqui os sete ficheiros da TheStarter, já templatizados (§13.3 da spec):

- `sigo-master-overview.md`
- `flow-0-recolha-de-dados.md`
- `flow-1-perfis-formandos.md`
- `flow-2-curso-modulos.md`
- `flow-3-criacao-acao.md`
- `flow-4-inscricao-certificacao.md`
- `flow-5-conclusao.md`

Regras:

- Nenhuma credencial real. Ids de base e de tabela, tokens, URL, utilizador e palavra-passe do SIGO passam a `{{SIGO_URL}}`, `{{SIGO_UTILIZADOR}}`, `{{SIGO_PALAVRA}}`, `{{CRM_TIPO}}`, `{{CRM_BASE}}`, `{{CRM_TOKEN}}`, `{{TBL_ACOES}}`, `{{TBL_FORMANDOS}}`, `{{TBL_LOGS}}`, `{{AREA_FORMACAO}}`, `{{REGIME}}`.
- Primeira linha opcional com a versão: `<!-- versao: v1.1 -->`. Sem ela, `v1.0`.
- O nome do ficheiro é o nome do documento. `flow-N-…` define o flow.

Publicar:

```
npm run seed:docs -- --dry   # valida e lista
npm run seed:docs            # escreve em `documentos` com o service role
```

O script recusa qualquer ficheiro com `app…`, `tbl…`, `pat…` do Airtable, URL do SIGO ou palavra-passe em claro.
