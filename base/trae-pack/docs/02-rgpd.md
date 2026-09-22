# Proteção de dados e RGPD

Documento de referência interna e base para o que é apresentado a clientes.

> **Aviso.** Este documento foi preparado com base no Regulamento Geral sobre a Proteção de Dados e não substitui aconselhamento jurídico. A minuta de contrato incluída no final tem de ser revista por um advogado antes de ser usada. Há decisões neste documento, nomeadamente sobre prazos de conservação e fundamentos de licitude, que devem ser confirmadas por quem tenha competência para o fazer.

---

## 1. Quem é quem

| Papel | Quem | O que significa |
|---|---|---|
| Responsável pelo tratamento | A entidade formadora cliente | Decide que dados existem e para quê. É dela a relação com os formandos. |
| Subcontratante | TheStarter | Trata dados por conta do cliente, apenas segundo as instruções dele. |
| Titulares dos dados | Utilizadores da plataforma na entidade | As 3 a 6 pessoas com conta. |

**O Fluxo não conserva dados de formandos.** Lê o resumo dos registos de execução da base do responsável e apresenta-o aos utilizadores desse mesmo responsável, sem o guardar. Esse resumo pode conter nomes.

A formulação correta é esta, e não "o Fluxo não lê dados de formandos". Uma afirmação falsa num documento de conformidade é pior do que uma afirmação modesta e verdadeira.

O que continua a ser verdade, e é o que sustenta tudo o resto:

- Nada é conservado nos sistemas do subcontratante
- A TheStarter não tem acesso ao conteúdo de nenhuma entidade
- Os destinatários da apresentação são os próprios colaboradores do responsável, que já dispõem de acesso à mesma base

Qualquer alteração que introduza conservação, ou que dê à TheStarter acesso ao conteúdo, obriga a reescrever tudo o que se segue.

---

## 2. Que dados são tratados

### Dados pessoais, dos utilizadores da entidade

| Dado | Origem | Fundamento | Conservação |
|---|---|---|---|
| Nome | Introduzido no convite | Execução do contrato | Enquanto a conta existir |
| Email profissional | Introduzido no convite | Execução do contrato | Enquanto a conta existir |
| Palavra-passe cifrada | Definida pelo utilizador | Execução do contrato | Enquanto a conta existir |
| Função na plataforma | Definida pelo administrador | Execução do contrato | Enquanto a conta existir |
| Data do último acesso | Gerada pelo sistema | Interesse legítimo, segurança | 12 meses |
| Notificações trocadas | Geradas pelos utilizadores | Execução do contrato | 12 meses |
| Endereços do relatório semanal | Introduzidos pelo administrador | Execução do contrato | Até serem removidos |
| Variáveis de configuração e token da base de dados | Introduzidos pelo utilizador | Execução do contrato | Enquanto o contrato vigorar |

**Não tratado:** a palavra-passe de acesso ao SIGO. É conservada exclusivamente no armazenamento local do navegador do utilizador e não é transmitida ao subcontratante em momento algum.

Os endereços do relatório semanal merecem nota: podem incluir pessoas sem conta, por exemplo a direção. São dados pessoais e a entidade tem de ter base para os incluir. O produto assinala isto no ecrã de configuração.

### Dados operacionais, lidos em trânsito

Nome da ação, código do curso, datas, tipo, formato, número de formandos inscritos, estados de execução e resumo dos registos.

Lidos da base do responsável a cada pedido, apresentados, e não conservados. O resumo dos registos pode conter nomes de formandos.

**Base de licitude:** execução do contrato entre o responsável e os seus colaboradores, e instrução documentada do responsável ao subcontratante. Não há finalidade própria do subcontratante sobre estes dados.

**Conservação:** nenhuma. Existem em memória durante o tempo do pedido.

---

## 3. Onde os dados ficam

| Componente | Fornecedor | Região | O que guarda |
|---|---|---|---|
| Aplicação | Vercel | Europa, Frankfurt | Nada em persistência |
| Base de dados e autenticação | Supabase | Europa, Frankfurt | Utilizadores, vistas, preferências, credencial cifrada |
| Envio de email | Resend | Europa | Emails em trânsito |

**Configuração obrigatória.** Nenhum destes fornecedores usa a Europa por omissão. A região tem de ser escolhida no momento da criação do projeto e não pode ser alterada depois sem migração. Verificar antes do primeiro cliente.

Sem transferências para fora do Espaço Económico Europeu no funcionamento normal.

---

## 4. Subcontratantes ulteriores

A entidade tem de ser informada e pode opor-se.

| Subcontratante | Finalidade | Localização |
|---|---|---|
| Vercel Inc. | Alojamento da aplicação | Europa |
| Supabase Inc. | Base de dados e autenticação | Europa |
| Resend | Envio de email transacional | Europa |

Alterações a esta lista exigem aviso prévio à entidade com antecedência razoável, a definir no contrato. Trinta dias é o habitual.

---

## 5. Medidas de segurança

Enumeradas aqui porque o artigo 32 exige que estejam descritas.

**Controlo de acesso**
- Autenticação com email e palavra-passe cifrada
- Criação de contas exclusivamente pela TheStarter, sem registo público
- Isolamento entre entidades garantido ao nível da base de dados, não apenas da aplicação
- Funções distintas: administrador, gestor, leitura

**Cifra**
- Trânsito cifrado em todas as ligações
- Credenciais de acesso à fonte de dados cifradas em repouso
- Palavras-passe com função de derivação adequada, nunca reversíveis

**Registos**
- Nunca é registado o conteúdo lido da fonte, apenas identificadores e resultado da operação
- Registos de acesso conservados 90 dias

**Minimização**
- Credencial de acesso à fonte com permissões de leitura apenas
- Lista branca de campos no adaptador: nenhum campo fora dela é pedido
- A tabela de formandos nunca é consultada
- Nenhum dado operacional é conservado

**Segregação**
- Nenhuma rota de administração devolve conteúdo lido da base de um cliente
- O acesso da TheStarter limita-se a entidades, utilizadores e documentação

**Continuidade**
- A perda total da base de dados do Fluxo não implica perda de dados operacionais da entidade, porque estes nunca saem da fonte dela
- Reposição implica recriar contas e vistas, não recuperar dados de formação

---

## 6. Direitos dos titulares

Os titulares são os utilizadores da entidade. Os pedidos devem ser dirigidos à entidade, que é a responsável. A TheStarter apoia no prazo acordado.

| Direito | Como é cumprido |
|---|---|
| Acesso | Exportação dos dados da conta |
| Retificação | Editável no ecrã de perfil |
| Apagamento | Remoção da conta pelo administrador |
| Portabilidade | Exportação em formato estruturado |
| Oposição | Desativação da conta |

---

## 7. Violações de dados

Se a TheStarter detetar uma violação, notifica a entidade **sem demora injustificada**, com:

- O que aconteceu e quando
- Que dados e que utilizadores foram afetados
- Consequências prováveis
- Medidas tomadas

A entidade decide se notifica a CNPD. O prazo de 72 horas aplica-se a ela, não a nós, mas a nossa notificação tem de ser suficientemente rápida para lhe permitir cumprir.

**Cenário mais provável:** exposição da credencial de acesso à fonte de dados de uma entidade. Não expõe dados pessoais tratados pelo Fluxo, mas dá acesso de leitura à base da entidade. Procedimento: revogar imediatamente, notificar a entidade, pedir emissão de nova credencial.

---

## 8. Conservação e fim do contrato

Ao terminar o contrato, a entidade escolhe entre devolução dos dados da conta ou apagamento.

Na ausência de escolha, apagamento ao fim de 30 dias.

Não há nada de operacional para devolver: as ações, os registos e os formandos sempre estiveram na base da entidade.

---

## 9. Minuta de contrato de subcontratação

> **Esta minuta não está pronta a usar.** Serve para levar a um advogado, não para assinar. Os campos entre parênteses retos têm de ser preenchidos e várias cláusulas exigem decisão jurídica.

**Objeto.** Regula o tratamento de dados pessoais efetuado pela TheStarter, na qualidade de subcontratante, por conta de [ENTIDADE], na qualidade de responsável pelo tratamento, no âmbito da utilização da plataforma Fluxo.

**Duração.** Vigora enquanto durar a prestação do serviço.

**Natureza e finalidade.** Disponibilização de uma plataforma de acompanhamento do estado de processos administrativos de formação. Leitura de dados operacionais não pessoais a partir da base de dados do responsável, e gestão de contas de utilizador.

**Tipos de dados.** Nome, endereço de email profissional, palavra-passe cifrada, função atribuída, data do último acesso.

**Categorias de titulares.** Colaboradores do responsável com acesso à plataforma, e destinatários do relatório periódico indicados pelo responsável.

**Ausência de tratamento de dados de formandos.** A plataforma não acede, não lê e não conserva dados pessoais de formandos. O acesso técnico à base de dados do responsável está limitado, por configuração de permissões, às tabelas de ações de formação e de registos de execução.

**Obrigações do subcontratante.** Tratar os dados apenas segundo instruções documentadas. Garantir a confidencialidade de quem acede. Aplicar as medidas do artigo 32 descritas no anexo. Não recorrer a subcontratante ulterior sem autorização. Apoiar o responsável nos direitos dos titulares. Notificar violações sem demora injustificada. Devolver ou apagar no fim do contrato. Disponibilizar a informação necessária a auditorias.

**Subcontratantes ulteriores.** Os constantes do anexo. Alterações com aviso prévio de [30] dias e direito de oposição.

**Localização.** Tratamento exclusivamente em território do Espaço Económico Europeu.

**Anexos.** Lista de subcontratantes. Descrição das medidas técnicas e organizativas. Lista de campos acedidos na base do responsável.

O último anexo é o mais útil numa auditoria. Deve enumerar campo a campo o que é lido, tal como consta em `01-arquitetura-e-dados.md`.

---

## 10. Antes do primeiro cliente

- [ ] Região europeia confirmada em Vercel, Supabase e no serviço de email
- [ ] Minuta revista por advogado
- [ ] Anexo com a lista de campos acedidos, gerado a partir do código
- [ ] Verificado que nenhum registo da aplicação contém conteúdo lido da fonte
- [ ] Procedimento escrito para o cenário de credencial exposta
- [ ] Isolamento entre entidades testado, não apenas implementado
