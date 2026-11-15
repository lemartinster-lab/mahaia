import "server-only";
import { createClient } from "@supabase/supabase-js";
import { configSupabase } from "./config";
import type { Database } from "./tipos";

/**
 * Cliente ANÓNIMO para la carta pública: sin cookies ni sesión.
 * Solo ve lo que las políticas RLS permiten al público (cartas publicadas,
 * platos disponibles y alérgenos confirmados). Al no depender de la
 * petición, sus resultados se pueden cachear con "use cache".
 */
export function clientePublico() {
  const { url, anonKey } = configSupabase();
  return createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
