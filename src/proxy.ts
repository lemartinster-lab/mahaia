import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { configSupabase } from "@/lib/supabase/config";

/**
 * Proxy (antes "middleware" en Next.js ≤15).
 *
 * 1. Renueva la sesión de Supabase si el token ha caducado y escribe las
 *    cookies nuevas en la respuesta.
 * 2. Comprobación optimista: sin sesión no se entra en /panel, y con
 *    sesión /entrar lleva directamente al panel.
 *
 * La comprobación de verdad (RLS + getClaims en el servidor) se repite en
 * cada página y acción: esto es solo un filtro rápido.
 */
export async function proxy(request: NextRequest) {
  let respuesta = NextResponse.next({ request });
  const { url, anonKey } = configSupabase();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(lista, cabeceras) {
        for (const { name, value } of lista) request.cookies.set(name, value);
        respuesta = NextResponse.next({ request });
        for (const { name, value, options } of lista) {
          respuesta.cookies.set(name, value, options);
        }
        for (const [clave, valor] of Object.entries(cabeceras ?? {})) {
          respuesta.headers.set(clave, valor);
        }
      },
    },
  });

  // getClaims valida el JWT (y lo renueva si hace falta)
  const { data } = await supabase.auth.getClaims();
  const conSesion = Boolean(data?.claims?.sub);
  const ruta = request.nextUrl.pathname;

  if (!conSesion && ruta.startsWith("/panel")) {
    const destino = request.nextUrl.clone();
    destino.pathname = "/entrar";
    destino.search = "";
    return NextResponse.redirect(destino);
  }

  if (conSesion && ruta === "/entrar") {
    const destino = request.nextUrl.clone();
    destino.pathname = "/panel";
    destino.search = "";
    return NextResponse.redirect(destino);
  }

  return respuesta;
}

export const config = {
  // Solo donde importa la sesión: la carta pública no pasa por aquí
  matcher: ["/panel/:path*", "/entrar"],
};
