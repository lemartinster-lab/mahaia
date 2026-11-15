import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { configSupabase } from "./config";
import type { Database } from "./tipos";

/**
 * Cliente de Supabase para Server Components, Server Actions y Route
 * Handlers. Lee la sesión de las cookies de la petición.
 *
 * Con Cache Components, cualquier componente que lo use debe ir dentro de
 * un <Suspense>, porque depende de datos de la petición.
 */
export async function clienteServidor() {
  const almacen = await cookies();
  const { url, anonKey } = configSupabase();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return almacen.getAll();
      },
      setAll(lista) {
        try {
          for (const { name, value, options } of lista) {
            almacen.set(name, value, options);
          }
        } catch {
          // En un Server Component no se pueden escribir cookies. No pasa
          // nada: proxy.ts ya renueva la sesión en cada petición al panel.
        }
      },
    },
  });
}
