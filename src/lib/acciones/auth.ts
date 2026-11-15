"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { clienteServidor } from "@/lib/supabase/servidor";

export type EstadoEnlace = { estado: "inicial" | "enviado" | "error"; mensaje?: string };

async function origenDelSitio(): Promise<string> {
  const configurado = process.env.NEXT_PUBLIC_SITE_URL;
  if (configurado) return configurado.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const protocolo = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocolo}://${host}`;
}

/** Envía el enlace mágico de acceso al email indicado. */
export async function enviarEnlace(_previo: EstadoEnlace, fd: FormData): Promise<EstadoEnlace> {
  const email = z.email().safeParse(String(fd.get("email") ?? "").trim().toLowerCase());
  if (!email.success) return { estado: "error", mensaje: "Escribe un email válido." };

  const supabase = await clienteServidor();
  const { error } = await supabase.auth.signInWithOtp({
    email: email.data,
    options: { emailRedirectTo: `${await origenDelSitio()}/auth/confirmar` },
  });

  if (error) {
    const limite = error.status === 429 || /rate limit/i.test(error.message);
    return {
      estado: "error",
      mensaje: limite
        ? "Se han enviado demasiados emails en poco tiempo. Espera unos minutos y vuelve a intentarlo."
        : "No se pudo enviar el enlace. Inténtalo de nuevo.",
    };
  }
  return { estado: "enviado", mensaje: email.data };
}

/** Cierra la sesión y vuelve a la pantalla de acceso. */
export async function salir(): Promise<void> {
  const supabase = await clienteServidor();
  await supabase.auth.signOut();
  redirect("/entrar");
}
