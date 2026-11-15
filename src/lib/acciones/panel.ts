"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { exigirRestaurante, exigirSesion, type ContextoRestaurante } from "@/lib/datos/sesion";
import type { EstadoAccion } from "./estado";
import {
  buscarDuplicado,
  idSchema,
  leerAlergenos,
  leerCategoria,
  leerNuevoRestaurante,
  leerPlato,
} from "./formularios";

/**
 * Server Actions del panel.
 *
 * Reglas de seguridad:
 * - El restaurante SIEMPRE sale de la sesión, nunca del formulario.
 * - Toda escritura filtra también por restaurant_id (además de RLS).
 * - Todo lo que llega del formulario pasa por las funciones de formularios.ts.
 *
 * Errores: el usuario ve un mensaje amable; el detalle técnico se escribe
 * en el registro del servidor (Terminal de `npm run dev`, logs de Vercel).
 */

const fallo = (error: string): EstadoAccion => ({ ok: false, error });
const ERROR_GENERICO = "No se pudo guardar. Inténtalo de nuevo.";

type ErrorSupabase = { code?: string; message?: string; details?: string | null; hint?: string | null };

/** Escribe el error técnico en el registro del servidor (nunca al usuario). */
function registrarError(accion: string, error: ErrorSupabase | null | undefined, extra?: Record<string, unknown>) {
  console.error(`[mahaia] ${accion} falló`, {
    code: error?.code,
    message: error?.message,
    details: error?.details,
    hint: error?.hint,
    ...extra,
  });
}

function leerId(fd: FormData, campo = "id"): string | null {
  const r = idSchema.safeParse(fd.get(campo));
  return r.success ? r.data : null;
}

// ---------------------------------------------------------------------
// Restaurante
// ---------------------------------------------------------------------
export async function crearRestaurante(_p: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  const { supabase } = await exigirSesion();
  const datos = leerNuevoRestaurante(fd);
  if (!datos.ok) return fallo(datos.error);

  const { error } = await supabase.from("restaurants").insert(datos.datos).select("id").single();
  if (error) {
    if (error.code === "23505") {
      return fallo(`La dirección "${datos.datos.slug}" ya está en uso. Prueba con otra.`);
    }
    registrarError("crearRestaurante", error);
    return fallo("No se pudo crear el restaurante. Inténtalo de nuevo.");
  }
  redirect("/panel/carta");
}

// ---------------------------------------------------------------------
// Categorías
// ---------------------------------------------------------------------
async function categoriasDe(ctx: ContextoRestaurante) {
  const { data, error } = await ctx.supabase
    .from("categories")
    .select("id, name, position")
    .eq("restaurant_id", ctx.restaurante.id)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) registrarError("leer categorías", error);
  return data ?? [];
}

export async function crearCategoria(_p: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  const ctx = await exigirRestaurante();
  const datos = leerCategoria(fd);
  if (!datos.ok) return fallo(datos.error);

  const existentes = await categoriasDe(ctx);
  const duplicada = buscarDuplicado(existentes, datos.datos.name);
  if (duplicada) return fallo(`Ya tienes una categoría «${duplicada}».`);

  const ultimaPosicion = existentes.reduce((max, c) => Math.max(max, c.position), -1);
  const { error } = await ctx.supabase.from("categories").insert({
    restaurant_id: ctx.restaurante.id,
    name: datos.datos.name,
    position: ultimaPosicion + 1,
  });
  if (error) {
    registrarError("crearCategoria", error);
    return fallo(ERROR_GENERICO);
  }
  refresh();
  return { ok: true, mensaje: `Categoría «${datos.datos.name}» creada.` };
}

export async function renombrarCategoria(_p: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  const ctx = await exigirRestaurante();
  const id = leerId(fd);
  const datos = leerCategoria(fd);
  if (!id) return fallo("Categoría no válida.");
  if (!datos.ok) return fallo(datos.error);

  const duplicada = buscarDuplicado(await categoriasDe(ctx), datos.datos.name, id);
  if (duplicada) return fallo(`Ya tienes una categoría «${duplicada}».`);

  const { data, error } = await ctx.supabase
    .from("categories")
    .update({ name: datos.datos.name })
    .eq("id", id)
    .eq("restaurant_id", ctx.restaurante.id)
    .select("id");
  if (error || !data?.length) {
    registrarError("renombrarCategoria", error, { id, filas: data?.length ?? 0 });
    return fallo(ERROR_GENERICO);
  }
  refresh();
  return { ok: true, mensaje: "Guardado." };
}

/** Borra la categoría. Sus platos no se borran: quedan "sin categoría". */
export async function borrarCategoria(fd: FormData): Promise<void> {
  const { supabase, restaurante } = await exigirRestaurante();
  const id = leerId(fd);
  if (!id) return;
  const { error } = await supabase.from("categories").delete().eq("id", id).eq("restaurant_id", restaurante.id);
  if (error) registrarError("borrarCategoria", error, { id });
  refresh();
}

/** Sube o baja una categoría intercambiando su posición con la vecina. */
export async function moverCategoria(fd: FormData): Promise<void> {
  const ctx = await exigirRestaurante();
  const id = leerId(fd);
  const direccion = fd.get("direccion") === "arriba" ? -1 : 1;
  if (!id) return;

  const lista = await categoriasDe(ctx);
  const i = lista.findIndex((c) => c.id === id);
  const j = i + direccion;
  if (i < 0 || j < 0 || j >= lista.length) return;

  // Renumeramos todo 0..n-1 con el intercambio aplicado: así se corrigen
  // también posiciones repetidas que pudiera haber.
  const orden = lista.map((c) => c.id);
  [orden[i], orden[j]] = [orden[j], orden[i]];
  const resultados = await Promise.all(
    orden.map((catId, pos) =>
      ctx.supabase.from("categories").update({ position: pos }).eq("id", catId).eq("restaurant_id", ctx.restaurante.id),
    ),
  );
  const conError = resultados.find((r) => r.error);
  if (conError) registrarError("moverCategoria", conError.error, { id });
  refresh();
}

// ---------------------------------------------------------------------
// Platos
// ---------------------------------------------------------------------
export async function guardarPlato(_p: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  const { supabase, restaurante } = await exigirRestaurante();
  const datos = leerPlato(fd);
  if (!datos.ok) return fallo(datos.error);

  const id = fd.get("id") ? leerId(fd) : null;
  if (fd.get("id") && !id) return fallo("Plato no válido.");

  if (id) {
    const { data, error } = await supabase
      .from("dishes")
      .update(datos.datos)
      .eq("id", id)
      .eq("restaurant_id", restaurante.id)
      .select("id");
    if (error || !data?.length) {
      registrarError("guardarPlato (editar)", error, { id, filas: data?.length ?? 0 });
      return fallo(mensajeError(error?.code));
    }
  } else {
    const { error } = await supabase.from("dishes").insert({ ...datos.datos, restaurant_id: restaurante.id });
    if (error) {
      registrarError("guardarPlato (crear)", error);
      return fallo(mensajeError(error.code));
    }
  }
  refresh();
  return { ok: true, mensaje: id ? "Plato guardado." : "Plato añadido." };
}

export async function borrarPlato(fd: FormData): Promise<void> {
  const { supabase, restaurante } = await exigirRestaurante();
  const id = leerId(fd);
  if (!id) return;
  const { error } = await supabase.from("dishes").delete().eq("id", id).eq("restaurant_id", restaurante.id);
  if (error) registrarError("borrarPlato", error, { id });
  refresh();
}

export async function alternarDisponible(fd: FormData): Promise<void> {
  const { supabase, restaurante } = await exigirRestaurante();
  const id = leerId(fd);
  if (!id) return;
  const { error } = await supabase
    .from("dishes")
    .update({ is_available: fd.get("disponible") === "true" })
    .eq("id", id)
    .eq("restaurant_id", restaurante.id);
  if (error) registrarError("alternarDisponible", error, { id });
  refresh();
}

// ---------------------------------------------------------------------
// Alérgenos
// ---------------------------------------------------------------------
/**
 * Guarda el checklist completo. La función SQL lo hace de forma atómica y
 * deja constancia de quién lo confirmó y cuándo.
 */
export async function guardarAlergenos(_p: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  const { supabase } = await exigirRestaurante();
  const id = leerId(fd);
  const alergenos = leerAlergenos(fd);
  if (!id) return fallo("Plato no válido.");
  if (!alergenos.ok) return fallo(alergenos.error);

  const { error } = await supabase.rpc("guardar_alergenos", { p_plato: id, p_alergenos: alergenos.datos });
  if (error) {
    registrarError("guardarAlergenos", error, { id });
    // PGRST202: la función no existe en la API → falta aplicar la migración
    if (error.code === "PGRST202") {
      return fallo("Falta configurar la base de datos (función guardar_alergenos). Avisa al administrador.");
    }
    return fallo("No se pudieron guardar los alérgenos. Inténtalo de nuevo.");
  }
  refresh();
  return {
    ok: true,
    mensaje: alergenos.datos.length
      ? `Confirmados ${alergenos.datos.length} alérgeno(s).`
      : "Confirmado: este plato no contiene ninguno de los 14 alérgenos.",
  };
}

function mensajeError(codigo?: string): string {
  // 23503: la categoría no existe o es de otro restaurante (clave foránea)
  if (codigo === "23503") return "La categoría elegida no existe.";
  return ERROR_GENERICO;
}
