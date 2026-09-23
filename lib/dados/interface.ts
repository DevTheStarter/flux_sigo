export interface Acao {
  id: string;
  nome: string;
  codigoCurso: string;
  dataInicio: string;
  dataFim: string;
  tipo: string;
  formato: string;
  diasSemana: string | null;
  estado: string;
  ano: number;
  formandos: number;
  temAvaliacoes: boolean;
  urlOrigem: string | null;
}

export type Flow = 0 | 1 | 2 | 3 | 4 | 5;

export type EstadoLog = "success" | "missing_data" | "error";

export interface Registo {
  acaoId: string;
  flow: Flow;
  estado: EstadoLog;
  data: string;
  detalhe: string;
}

export interface EstadoLigacao {
  ok: boolean;
  ultimaLeitura: string | null;
  erro: string | null;
  /** aviso de configuração, por exemplo a tabela de formandos estar acessível (§7.2) */
  aviso?: string | null;
}

export interface FonteDeDados {
  obterAcoes(): Promise<Acao[]>;
  obterRegistos(): Promise<Registo[]>;
  verificarLigacao(): Promise<EstadoLigacao>;
  /** número de ações acompanhadas, barato (§15 KPI). Nunca devolve conteúdo. */
  contarAcoes(): Promise<number>;
}
