const PALAVRAS_SENSIVEIS = [
  "authorization",
  "cookie",
  "set-cookie",
  "crm_token",
  "sigo_palavra",
  "sigo-palavra",
  "chave_cifra",
  "service_role",
  "service-role",
  "resend_api_key",
  "cron_secret",
  "password",
  "senha",
  "token",
  "credencial",
];

function sensivel(chave: string): boolean {
  const k = chave.toLowerCase();
  return PALAVRAS_SENSIVEIS.some((s) => k.includes(s));
}

function mascarar(valor: unknown): unknown {
  if (typeof valor !== "string") return "[REDACTED]";
  if (!valor) return valor;
  return "[REDACTED]";
}

function limparObjeto(input: unknown, profundidade = 0): unknown {
  if (profundidade > 6) return "[REDACTED-prof-max]";
  if (input === null || input === undefined) return input;
  if (Array.isArray(input)) return input.map((v) => limparObjeto(v, profundidade + 1));
  if (typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      out[k] = sensivel(k) ? mascarar(v) : limparObjeto(v, profundidade + 1);
    }
    return out;
  }
  return input;
}

type Nivel = "info" | "warn" | "error" | "debug";

function escrever(nivel: Nivel, mensagem: string, contexto?: unknown) {
  const data = {
    t: new Date().toISOString(),
    nivel,
    msg: mensagem,
    ctx: contexto !== undefined ? limparObjeto(contexto) : undefined,
  };
  if (nivel === "error") {
    console.error(JSON.stringify(data));
  } else if (nivel === "warn") {
    console.warn(JSON.stringify(data));
  } else {
    console.log(JSON.stringify(data));
  }
}

export const log = {
  info(mensagem: string, ctx?: unknown) {
    escrever("info", mensagem, ctx);
  },
  warn(mensagem: string, ctx?: unknown) {
    escrever("warn", mensagem, ctx);
  },
  error(mensagem: string, ctx?: unknown) {
    escrever("error", mensagem, ctx);
  },
  debug(mensagem: string, ctx?: unknown) {
    if (process.env.NODE_ENV !== "production") {
      escrever("debug", mensagem, ctx);
    }
  },
};
