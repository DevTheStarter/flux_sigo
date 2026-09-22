export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      entidades: {
        Row: {
          id: string;
          nome: string;
          nipc: string | null;
          ativa: boolean;
          suporte: boolean;
          setup_em: string | null;
          contrato_assinado: boolean;
          criada_em: string;
        };
        Insert: {
          id?: string;
          nome: string;
          nipc?: string | null;
          ativa?: boolean;
          suporte?: boolean;
          setup_em?: string | null;
          contrato_assinado?: boolean;
          criada_em?: string;
        };
        Update: {
          id?: string;
          nome?: string;
          nipc?: string | null;
          ativa?: boolean;
          suporte?: boolean;
          setup_em?: string | null;
          contrato_assinado?: boolean;
          criada_em?: string;
        };
      };
      utilizadores: {
        Row: {
          id: string;
          entidade_id: string;
          nome: string;
          email: string;
          funcao: "staff" | "admin" | "gestor" | "leitura";
          ultimo_acesso: string | null;
          criado_em: string;
        };
        Insert: {
          id: string;
          entidade_id: string;
          nome: string;
          email: string;
          funcao?: "staff" | "admin" | "gestor" | "leitura";
          ultimo_acesso?: string | null;
          criado_em?: string;
        };
        Update: {
          id?: string;
          entidade_id?: string;
          nome?: string;
          email?: string;
          funcao?: "staff" | "admin" | "gestor" | "leitura";
          ultimo_acesso?: string | null;
          criado_em?: string;
        };
      };
      convites: {
        Row: {
          id: string;
          entidade_id: string;
          email: string;
          funcao: "admin" | "gestor" | "leitura";
          token: string;
          expira_em: string;
          usado_em: string | null;
          criado_em: string;
        };
        Insert: {
          id?: string;
          entidade_id: string;
          email: string;
          funcao: "admin" | "gestor" | "leitura";
          token: string;
          expira_em: string;
          usado_em?: string | null;
          criado_em?: string;
        };
        Update: {
          id?: string;
          entidade_id?: string;
          email?: string;
          funcao?: "admin" | "gestor" | "leitura";
          token?: string;
          expira_em?: string;
          usado_em?: string | null;
          criado_em?: string;
        };
      };
      config_entidade: {
        Row: {
          entidade_id: string;
          fonte_tipo: string | null;
          fonte_credencial: string | null;
          fonte_base: string | null;
          mapa_campos: Json;
          filtros: Json;
          prazos: Json;
          variaveis: Json;
          atualizado_em: string;
          fonte_tabela_acoes: string | null;
          fonte_tabela_formandos: string | null;
          fonte_tabela_registos: string | null;
          prazo_entrada_dias: number | null;
          aviso_prazo_dias: number | null;
          area_formacao_default: string | null;
          regime_default: string | null;
          sigo_url: string | null;
          sigo_utilizador: string | null;
        };
        Insert: {
          entidade_id: string;
          fonte_tipo?: string | null;
          fonte_credencial?: string | null;
          fonte_base?: string | null;
          mapa_campos?: Json;
          filtros?: Json;
          prazos?: Json;
          variaveis?: Json;
          atualizado_em?: string;
          fonte_tabela_acoes?: string | null;
          fonte_tabela_formandos?: string | null;
          fonte_tabela_registos?: string | null;
          prazo_entrada_dias?: number | null;
          aviso_prazo_dias?: number | null;
          area_formacao_default?: string | null;
          regime_default?: string | null;
          sigo_url?: string | null;
          sigo_utilizador?: string | null;
        };
        Update: {
          entidade_id?: string;
          fonte_tipo?: string | null;
          fonte_credencial?: string | null;
          fonte_base?: string | null;
          mapa_campos?: Json;
          filtros?: Json;
          prazos?: Json;
          variaveis?: Json;
          atualizado_em?: string;
          fonte_tabela_acoes?: string | null;
          fonte_tabela_formandos?: string | null;
          fonte_tabela_registos?: string | null;
          prazo_entrada_dias?: number | null;
          aviso_prazo_dias?: number | null;
          area_formacao_default?: string | null;
          regime_default?: string | null;
          sigo_url?: string | null;
          sigo_utilizador?: string | null;
        };
      };
      vistas: {
        Row: {
          id: string;
          entidade_id: string;
          criada_por: string | null;
          nome: string;
          condicoes: Json;
          fixa: boolean;
          criada_em: string;
        };
        Insert: {
          id?: string;
          entidade_id: string;
          criada_por?: string | null;
          nome: string;
          condicoes?: Json;
          fixa?: boolean;
          criada_em?: string;
        };
        Update: {
          id?: string;
          entidade_id?: string;
          criada_por?: string | null;
          nome?: string;
          condicoes?: Json;
          fixa?: boolean;
          criada_em?: string;
        };
      };
      preferencias_notificacao: {
        Row: {
          utilizador_id: string;
          eventos: Json;
          canais: Json;
        };
        Insert: {
          utilizador_id: string;
          eventos?: Json;
          canais?: Json;
        };
        Update: {
          utilizador_id?: string;
          eventos?: Json;
          canais?: Json;
        };
      };
      config_relatorio: {
        Row: {
          entidade_id: string;
          ativo: boolean;
          dia_semana: string;
          hora: string;
          destinatarios: string[];
        };
        Insert: {
          entidade_id: string;
          ativo?: boolean;
          dia_semana?: string;
          hora?: string;
          destinatarios?: string[];
        };
        Update: {
          entidade_id?: string;
          ativo?: boolean;
          dia_semana?: string;
          hora?: string;
          destinatarios?: string[];
        };
      };
      notificacoes: {
        Row: {
          id: string;
          entidade_id: string | null;
          destinatario_id: string | null;
          remetente_id: string | null;
          tipo: string;
          corpo: string;
          acao_ref: string | null;
          lida: boolean;
          criada_em: string;
        };
        Insert: {
          id?: string;
          entidade_id?: string | null;
          destinatario_id?: string | null;
          remetente_id?: string | null;
          tipo: string;
          corpo: string;
          acao_ref?: string | null;
          lida?: boolean;
          criada_em?: string;
        };
        Update: {
          id?: string;
          entidade_id?: string | null;
          destinatario_id?: string | null;
          remetente_id?: string | null;
          tipo?: string;
          corpo?: string;
          acao_ref?: string | null;
          lida?: boolean;
          criada_em?: string;
        };
      };
      problemas_reportados: {
        Row: {
          id: string;
          entidade_id: string | null;
          reportado_por: string | null;
          flow: number;
          acao_ref: string | null;
          acao_nome: string | null;
          descricao: string;
          estado: "aberto" | "resolvido";
          criado_em: string;
        };
        Insert: {
          id?: string;
          entidade_id?: string | null;
          reportado_por?: string | null;
          flow: number;
          acao_ref?: string | null;
          acao_nome?: string | null;
          descricao: string;
          estado?: "aberto" | "resolvido";
          criado_em?: string;
        };
        Update: {
          id?: string;
          entidade_id?: string | null;
          reportado_por?: string | null;
          flow?: number;
          acao_ref?: string | null;
          acao_nome?: string | null;
          descricao?: string;
          estado?: "aberto" | "resolvido";
          criado_em?: string;
        };
      };
      problemas_anexos: {
        Row: {
          id: string;
          problema_id: string;
          caminho: string;
          nome: string;
          tamanho: number;
          apagar_em: string;
        };
        Insert: {
          id?: string;
          problema_id: string;
          caminho: string;
          nome: string;
          tamanho: number;
          apagar_em: string;
        };
        Update: {
          id?: string;
          problema_id?: string;
          caminho?: string;
          nome?: string;
          tamanho?: number;
          apagar_em?: string;
        };
      };
      documentos: {
        Row: {
          id: string;
          nome: string;
          versao: string;
          flow: number | null;
          corpo: string;
          publicado: boolean;
          atualizado_em: string;
        };
        Insert: {
          id?: string;
          nome: string;
          versao: string;
          flow?: number | null;
          corpo: string;
          publicado?: boolean;
          atualizado_em?: string;
        };
        Update: {
          id?: string;
          nome?: string;
          versao?: string;
          flow?: number | null;
          corpo?: string;
          publicado?: boolean;
          atualizado_em?: string;
        };
      };
      documentos_variacao: {
        Row: {
          id: string;
          documento_id: string;
          entidade_id: string;
          corpo: string;
          nota: string | null;
          versao_base: string;
          atualizado_em: string;
        };
        Insert: {
          id?: string;
          documento_id: string;
          entidade_id: string;
          corpo: string;
          nota?: string | null;
          versao_base: string;
          atualizado_em?: string;
        };
        Update: {
          id?: string;
          documento_id?: string;
          entidade_id?: string;
          corpo?: string;
          nota?: string | null;
          versao_base?: string;
          atualizado_em?: string;
        };
      };
      estado_notificacoes: {
        Row: {
          entidade_id: string;
          acao_ref: string;
          coluna: string;
          estado: string;
          updated_at: string;
        };
        Insert: {
          entidade_id: string;
          acao_ref: string;
          coluna: string;
          estado: string;
          updated_at?: string;
        };
        Update: {
          entidade_id?: string;
          acao_ref?: string;
          coluna?: string;
          estado?: string;
          updated_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: {
      auth_uid: { Args: Record<PropertyKey, never>; Returns: string | null };
      eu_sou_staff: { Args: Record<PropertyKey, never>; Returns: boolean };
      minha_entidade_id: {
        Args: Record<PropertyKey, never>;
        Returns: string | null;
      };
    };
    Enums: Record<string, never>;
  };
}
