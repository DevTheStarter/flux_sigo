"use client";

import { listaCamposTexto } from "../../lib/dados/campos";

function descarregarTexto(nome: string, conteudo: string) {
  const blob = new Blob([conteudo], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Privacidade (§17, §9, §8.4): página que um auditor consegue ler. */
export function Privacidade() {
  const L = ({ t, s, pill }: { t: string; s?: string; pill?: string }) => (
    <div className="lrow">
      <span className="lrow-b"><span className="lrow-t">{t}</span>{s ? <span className="lrow-s">{s}</span> : null}</span>
      {pill ? <span className="pill">{pill}</span> : null}
    </div>
  );
  return (
    <div className="sblock">
      <h2>Privacidade</h2>
      <p className="sdesc">O que o Fluxo lê, o que guarda, e durante quanto tempo. Esta página existe para poderem responder a uma auditoria sem nos perguntar nada.</p>

      <h2 style={{ marginTop: 28 }}>O que lemos da vossa base de dados</h2>
      <p className="sdesc">Em tempo real, a cada leitura. Nunca copiado para os nossos servidores.</p>
      <L t="Ações de formação" s="Nome, código do curso, datas, tipo, formato, dias, estado, ano" />
      <L t="Contagens" s="Número de formandos inscritos e se existe tabela de avaliações. Campos calculados na vossa base de dados, que devolvem apenas números." />
      <L t="Registos de execução" s="Flow, estado, data e o resumo que os vossos flows escrevem, mostrado tal como está na vossa base de dados. Esse resumo pode conter nomes: é lido por pedido, mostrado à vossa equipa e descartado. Nunca chega à TheStarter." />

      <h2 style={{ marginTop: 32 }}>O que nunca lemos</h2>
      <p className="sdesc">Não é filtrado à chegada. Não é pedido.</p>
      <L t="Tabela de formandos" s="NIF, cartão de cidadão, morada, data de nascimento, nacionalidade" pill="sem acesso" />
      <L t="Anexos" s="Certificados, contratos, tabelas de avaliação" pill="sem acesso" />

      <h2 style={{ marginTop: 32 }}>O que a TheStarter vê</h2>
      <p className="sdesc">Nada do que está no vosso quadro.</p>
      <L t="Ações e registos" s="Nunca. Não existe rota de administração que os devolva." pill="sem acesso" />
      <L t="Contas e ligação" s="Quem tem acesso, se a ligação está a funcionar, quando foi a última atividade" pill="visível" />
      <L t="Problemas reportados" s="Apenas o que escreverem e anexarem ao reportar. Os anexos ficam num bucket privado na União Europeia e são apagados ao fim de 90 dias." pill="quando enviado" />
      <L t="Palavra-passe do SIGO e token de escrita" s="Nunca saem do vosso navegador. Não existem nos nossos servidores, nem cifrados." pill="nunca recebidos" />

      <h2 style={{ marginTop: 32 }}>O que guardamos</h2>
      <L t="Contas de utilizador" s="Nome, email profissional, função · enquanto a conta existir" />
      <L t="Vistas, prazos e preferências" s="Configuração da equipa · enquanto a conta existir" />
      <L t="Notificações" s="Mensagens trocadas entre vocês e avisos de prazo · 12 meses" />
      <L t="Estado das notificações" s="Última fase e estado notificados por ação de formação, para não repetir avisos. Uma referência, não o conteúdo." />
      <L t="Token de leitura da base de dados" s="Só leitura, duas tabelas. Cifrado com AES-256-GCM, nunca visível depois de guardado, nem para nós." />

      <h2 style={{ marginTop: 32 }}>Onde ficam</h2>
      <L t="Alojamento" s="Frankfurt, Alemanha · União Europeia" />
      <L t="Base de dados" s="Frankfurt, Alemanha · União Europeia" />
      <L t="Envio de email" s="União Europeia" />
      <p className="fld-h">Sem transferências para fora do Espaço Económico Europeu.</p>

      <h2 style={{ marginTop: 32 }}>Se deixarem de usar o Fluxo</h2>
      <p className="sdesc">Não perdem nada. As ações de formação, os registos e os formandos sempre estiveram na vossa base de dados. Não há nada para devolver. Apagamos as contas e a configuração quando pedirem.</p>

      <div className="row2" style={{ marginTop: 8 }}>
        <a className="btn sec sm" href="/docs/contrato-subcontratacao.md" download="contrato-subcontratacao.md">Contrato de subcontratação</a>
        <button type="button" className="btn sec sm" onClick={() => descarregarTexto("fluxo-campos-acedidos.txt", listaCamposTexto())}>Lista de campos acedidos</button>
      </div>
    </div>
  );
}
