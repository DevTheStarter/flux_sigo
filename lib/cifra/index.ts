const NONCE_BYTES = 12;

async function ensureKey(hex: string): Promise<CryptoKey> {
  if (!hex || hex.length !== 64) {
    throw new Error("CHAVE_CIFRA: esperado 64 caracteres hex (AES-256)");
  }
  const raw = Buffer.from(hex, "hex");
  if (raw.length !== 32) {
    throw new Error("CHAVE_CIFRA: 32 bytes esperados");
  }
  const algo: AesKeyAlgorithm = { name: "AES-GCM", length: 256 };
  return crypto.subtle.importKey("raw", raw, algo, false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encriptar(texto: string): Promise<string> {
  const chave = process.env.CHAVE_CIFRA;
  if (!chave) throw new Error("CHAVE_CIFRA não definida");
  if (texto === "") return "";

  const key = await ensureKey(chave);
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_BYTES));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce },
      key,
      new TextEncoder().encode(texto)
    )
  );
  const n = Buffer.from(nonce).toString("base64");
  const c = Buffer.from(ct).toString("base64");
  return `${n}.${c}`;
}

export async function desencriptar(
  blob: string | null | undefined
): Promise<string | null> {
  if (!blob) return null;
  if (blob === "") return "";
  const chave = process.env.CHAVE_CIFRA;
  if (!chave) throw new Error("CHAVE_CIFRA não definida");

  const partes = blob.split(".");
  if (partes.length !== 2) {
    throw new Error("formato cifrado inválido");
  }
  const key = await ensureKey(chave);
  const nonce = Buffer.from(partes[0], "base64");
  const ct = Buffer.from(partes[1], "base64");
  try {
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: nonce },
      key,
      ct
    );
    return new TextDecoder().decode(pt);
  } catch {
    throw new Error("falha ao decifrar: chave ou dados corrompidos");
  }
}

export interface CredencialDescifrada {
  token?: string;
  usuario?: string;
  entidade_id?: string;
  sigo_palavra?: string;
  [k: string]: string | undefined;
}

/**
 * Desencripta `config_entidade.fonte_credencial` (JSONB serializado AES-256-GCM).
 * Estrutura interna pode ser arbitraria; extrai campos mais usados por docs/copy.
 * Retorna null se a chave não estiver definida ou o blob for inválido (nunca
 * lança para não quebrar render de documentação).
 */
export async function decifrarCredencial(
  blob: string | null | undefined
): Promise<CredencialDescifrada | null> {
  try {
    const pt = await desencriptar(blob);
    if (!pt) return null;
    try {
      const obj = JSON.parse(pt);
      if (obj && typeof obj === "object") {
        const out: CredencialDescifrada = {};
        for (const k of Object.keys(obj)) {
          const v = obj[k];
          if (typeof v === "string") out[k] = v;
        }
        return out;
      }
    } catch {
      // plain text string (legacy ou só token).
      return { token: pt };
    }
  } catch {
    // não logar segredos
  }
  return null;
}
