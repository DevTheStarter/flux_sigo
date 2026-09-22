import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Service role — NÃO expor ao browser.
 * Apenas usar em:
 *   - app/api/admin/**
 *   - app/api/cron/**
 * NÃO usar em páginas (app) nem em endpoints gerais.
 */
export function createClientService() {
  if (
    !process.env.SUPABASE_SERVICE_ROLE_KEY ||
    typeof window !== "undefined"
  ) {
    throw new Error("SERVICE_ROLE só disponível em SSR server-side");
  }
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
