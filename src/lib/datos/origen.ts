import "server-only";
import { headers } from "next/headers";

/**
 * Dirección pública del sitio (https://…), sin barra final.
 * Usa NEXT_PUBLIC_SITE_URL si está definida (producción); si no, la deduce
 * de la petición (en local: http://localhost:3000).
 */
export async function origenDelSitio(): Promise<string> {
  const configurado = process.env.NEXT_PUBLIC_SITE_URL;
  if (configurado) return configurado.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const protocolo = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocolo}://${host}`;
}
