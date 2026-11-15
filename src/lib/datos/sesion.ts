import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import type { FilaRestaurante } from "@/lib/supabase/tipos";

export type Contexto = {
  supabase: Awaited<ReturnType<typeof clienteServidor>>;
  usuarioId: string;
  email: string | null;
};

/**
 * Usuario de la sesión, verificado con getClaims (valida la firma del JWT).
 * Devuelve null si no hay sesión.
 */
export async function obtenerSesion(): Promise<Contexto | null> {
  // La sesión se verifica SIEMPRE con la petición real: getClaims compara
  // la caducidad del token con Date.now(), algo que Next.js 16 no permite
  // al preparar páginas por adelantado (prefetch / App Shell).
  await connection();
  const supabase = await clienteServidor();
  const { data, error } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (error || !sub) return null;
  const email = typeof data.claims.email === "string" ? data.claims.email : null;
  return { supabase, usuarioId: sub, email };
}

/** Como obtenerSesion, pero manda a /entrar si no hay sesión. */
export async function exigirSesion(): Promise<Contexto> {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/entrar");
  return sesion;
}

export type ContextoRestaurante = Contexto & {
  restaurante: FilaRestaurante;
  rol: "owner" | "staff";
};

/**
 * Restaurante con el que trabaja el usuario. De momento, el primero que
 * creó o al que se unió (más adelante habrá selector si gestiona varios).
 * Devuelve null si aún no tiene ninguno.
 */
export async function obtenerRestaurante(ctx: Contexto): Promise<ContextoRestaurante | null> {
  const { data: miembro, error } = await ctx.supabase
    .from("members")
    .select("restaurant_id, role")
    .eq("user_id", ctx.usuarioId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`No se pudo leer el equipo: ${error.message}`);
  if (!miembro) return null;

  const { data: restaurante, error: e2 } = await ctx.supabase
    .from("restaurants")
    .select("*")
    .eq("id", miembro.restaurant_id)
    .single();
  if (e2) throw new Error(`No se pudo leer el restaurante: ${e2.message}`);

  return { ...ctx, restaurante, rol: miembro.role };
}

/** Exige sesión y restaurante; si falta el restaurante, lleva a crearlo. */
export async function exigirRestaurante(): Promise<ContextoRestaurante> {
  const ctx = await exigirSesion();
  const conRestaurante = await obtenerRestaurante(ctx);
  if (!conRestaurante) redirect("/panel/nuevo");
  return conRestaurante;
}
