import { NextResponse, type NextRequest } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";

/**
 * Destino del enlace mágico. Supabase redirige aquí con ?code=...;
 * lo canjeamos por una sesión (cookies) y entramos al panel.
 */
export async function GET(request: NextRequest) {
  const codigo = request.nextUrl.searchParams.get("code");
  const destino = request.nextUrl.clone();
  destino.search = "";

  if (codigo) {
    const supabase = await clienteServidor();
    const { error } = await supabase.auth.exchangeCodeForSession(codigo);
    if (!error) {
      destino.pathname = "/panel";
      return NextResponse.redirect(destino);
    }
  }

  destino.pathname = "/entrar";
  destino.searchParams.set("error", "enlace");
  return NextResponse.redirect(destino);
}
