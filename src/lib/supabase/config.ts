/**
 * Configuración pública de Supabase. La clave "anon" está pensada para ir
 * en el navegador: la seguridad real la ponen las políticas RLS.
 */
export function configSupabase(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
        "Copia .env.example como .env.local y rellena los valores.",
    );
  }
  return { url, anonKey };
}
