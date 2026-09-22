# Registo de atividades de tratamento

Documento exigido pelo artigo 30 do Regulamento Geral sobre a Proteção de Dados, na qualidade de subcontratante. Documento interno, apresentado apenas à autoridade de controlo ou em auditoria de cliente.

> **Aviso.** Minuta para revisão jurídica. Preencher os campos entre parênteses retos e manter atualizado sempre que a arquitetura ou os fornecedores mudarem.

**Última atualização:** [DATA]

---

## 1. Identificação do subcontratante

| | |
|---|---|
| Denominação | [DENOMINAÇÃO SOCIAL] |
| NIPC | [NIPC] |
| Sede | [MORADA] |
| Contacto para proteção de dados | [EMAIL] |
| Encarregado de proteção de dados | Não designado. Ver nota. |

> **Nota sobre o encarregado de proteção de dados.** A designação é obrigatória quando o tratamento exija controlo regular e sistemático em larga escala, ou trate categorias especiais em larga escala. Com base na arquitetura descrita neste registo, nenhuma das condições parece verificar-se. Esta conclusão deve ser confirmada por jurista e reavaliada se o produto mudar.

---

## 2. Responsáveis pelo tratamento por conta de quem se atua

Entidades formadoras clientes da plataforma Fluxo. Lista mantida em separado e atualizada a cada contrato celebrado ou cessado.

| Entidade | NIPC | Contrato desde | Contacto |
|---|---|---|---|
| [preencher] | | | |

---

## 3. Categorias de tratamento efetuadas

### 3.1 Gestão de contas de utilizador

| | |
|---|---|
| Finalidade | Autenticação e controlo de acessos à plataforma |
| Titulares | Colaboradores das entidades clientes |
| Dados | Nome, email profissional, palavra-passe cifrada, função, data do último acesso |
| Conservação | Enquanto a conta existir. Último acesso, 12 meses. |
| Destinatários | Fornecedor de base de dados e autenticação |

### 3.2 Leitura de dados operacionais

| | |
|---|---|
| Finalidade | Apresentar o estado dos processos administrativos de formação |
| Titulares | Não aplicável. Não são tratados dados pessoais. |
| Dados | Designação da ação, código do curso, datas, tipo, formato, estado, contagens agregadas, registos de execução |
| Conservação | Nenhuma. Leitura em tempo real, mantida em memória durante o pedido. |
| Destinatários | Nenhum |

Esta categoria consta do registo por transparência, apesar de não envolver dados pessoais.

### 3.3 Notificações entre utilizadores

| | |
|---|---|
| Finalidade | Coordenação de trabalho dentro da entidade |
| Titulares | Colaboradores das entidades clientes |
| Dados | Identificação do remetente e destinatário, conteúdo da mensagem, data |
| Conservação | 12 meses |
| Destinatários | Fornecedor de base de dados, fornecedor de email quando enviada por essa via |

### 3.4 Relatório periódico

| | |
|---|---|
| Finalidade | Envio do estado das ações aos destinatários indicados pela entidade |
| Titulares | Pessoas indicadas pela entidade, com ou sem conta |
| Dados | Endereço de email |
| Conservação | Até remoção pela entidade |
| Destinatários | Fornecedor de email |

O conteúdo do relatório não contém dados pessoais.

### 3.5 Registos de segurança

| | |
|---|---|
| Finalidade | Deteção de acessos indevidos e diagnóstico |
| Titulares | Colaboradores das entidades clientes |
| Dados | Identificador de utilizador e de entidade, operação, resultado, data e hora |
| Conservação | 90 dias |
| Destinatários | Fornecedor de alojamento |

Excluídos por configuração: conteúdos lidos da base do responsável, credenciais e cabeçalhos de autenticação.

---

## 4. Categorias especiais de dados

Não são tratadas categorias especiais nos termos do artigo 9, nem dados relativos a condenações penais nos termos do artigo 10.

---

## 5. Transferências para países terceiros

Não existem. Todo o tratamento ocorre em território do Espaço Económico Europeu.

| Componente | Fornecedor | Região |
|---|---|---|
| Alojamento aplicacional | [FORNECEDOR] | Alemanha |
| Base de dados e autenticação | [FORNECEDOR] | Alemanha |
| Envio de email | [FORNECEDOR] | União Europeia |

---

## 6. Prazos de apagamento

| Dado | Prazo |
|---|---|
| Dados de conta | 30 dias após remoção da conta ou cessação do contrato |
| Notificações | 12 meses |
| Registos de segurança | 90 dias |
| Cópias de segurança | 30 dias |
| Credencial de acesso à fonte | Imediato na cessação do contrato |

---

## 7. Descrição geral das medidas de segurança

Remete-se para o Anexo II do contrato de subcontratação, que constitui parte integrante deste registo.

Em síntese: autenticação com palavra-passe cifrada de forma irreversível, ausência de registo público, segregação de funções, isolamento entre entidades ao nível do sistema de gestão de base de dados, cifra em trânsito e em repouso das credenciais, credencial de acesso limitada a leitura e a duas tabelas, registos que excluem conteúdos e credenciais, cópias de segurança diárias.

---

## 8. Avaliação de impacto sobre a proteção de dados

Não realizada.

Fundamento: o tratamento não configura nenhuma das situações do artigo 35, n.º 3, nem consta da lista de tratamentos sujeitos a avaliação de impacto adotada pela Comissão Nacional de Proteção de Dados. Não há avaliação sistemática e automatizada de aspetos pessoais, tratamento em larga escala de categorias especiais, nem controlo sistemático de zona acessível ao público.

> **Nota.** Esta conclusão assenta na ausência de tratamento de dados de formandos. Deve ser reavaliada por jurista se a arquitetura mudar.

---

## 9. Histórico de revisões

| Data | Alteração | Por |
|---|---|---|
| [DATA] | Versão inicial | [NOME] |
