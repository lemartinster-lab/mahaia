"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { exigirRestaurante, exigirSesion } from "@/lib/datos/sesion";
import type { EstadoAccion } from "./estado";
import {
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
 */

const fallo = (error: string): EstadoAccion => ({ ok: false, error });
const ERROR_GENERICO = "No se pudo guardar. Inténtalo de nuevo.";

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
    return fallo("No se pudo crear el restaurante. Inténtalo de nuevo.");
  }
  redirect("/panel/carta");
}

// ---------------------------------------------------------------------
// Categorías
// ---------------------------------------------------------------------
export async function crearCategoria(_p: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  const { supabase, restaurante } = await exigirRestaurante();
  const datos = leerCategoria(fd);
  if (!datos.ok) return fallo(datos.error);

  const { data: ultima } = await supabase
    .from("categories")
    .select("position")
    .eq("restaurant_id", restaurante.id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("categories").insert({
    restaurant_id: restaurante.id,
    name: datos.datos.name,
    position: (ultima?.position ?? -1) + 1,
  });
  if (error) return fallo(ERROR_GENERICO);
  refresh();
  return { ok: true, mensaje: "Categoría creada." };
}

export async function renombrarCategoria(_p: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  const { supabase, restaurante } = await exigirRestaurante();
  const id = leerId(fd);
  const datos = leerCategoria(fd);
  if (!id) return fallo("Categoría no válida.");
  if (!datos.ok) return fallo(datos.error);

  const { data, error } = await supabase
    .from("categories")
    .update({ name: datos.datos.name })
    .eq("id", id)
    .eq("restaurant_id", restaurante.id)
    .select("id");
  if (error || !data?.length) return fallo(ERROR_GENERICO);
  refresh();
  return { ok: true, mensaje: "Guardado." };
}

/** Borra la categoría. Sus platos no se borran: quedan "sin categoría". */
export async function borrarCategoria(fd: FormData): Promise<void> {
  const { supabase, restaurante } = await exigirRestaurante();
  const id = leerId(fd);
  if (!id) return;
  await supabase.from("categories").delete().eq("id", id).eq("restaurant_id", restaurante.id);
  refresh();
}

/** Sube o baja una categoría intercambiando su posición con la vecina. */
export async function moverCategoria(fd: FormData): Promise<void> {
  const { supabase, restaurante } = await exigirRestaurante();
  const id = leerId(fd);
  const direccion = fd.get("direccion") === "arriba" ? -1 : 1;
  if (!id) return;

  const { data: lista } = await supabase
    .from("categories")
    .select("id, position")
    .eq("restaurant_id", restaurante.id)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (!lista) return;

  const i = lista.findIndex((c) => c.id === id);
  const j = i + direccion;
  if (i < 0 || j < 0 || j >= lista.length) return;

  // Renumeramos todo 0..n-1 con el intercambio aplicado: así se corrigen
  // también posiciones repetidas que pudiera haber.
  const orden = lista.map((c) => c.id);
  [orden[i], orden[j]] = [orden[j], orden[i]];
  await Promise.all(
    orden.map((catId, pos) =>
      supabase.from("categories").update({ position: pos }).eq("id", catId).eq("restaurant_id", restaurante.id),
    ),
  );
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
    if (error || !data?.length) return fallo(mensajeError(error?.code));
  } else {
    const { error } = await supabase.from("dishes").insert({ ...datos.datos, restaurant_id: restaurante.id });
    if (error) return fallo(mensajeError(error.code));
  }
  refresh();
  return { ok: true, mensaje: id ? "Plato guardado." : "Plato añadido." };
}

export async function borrarPlato(fd: FormData): Promise<void> {
  const { supabase, restaurante } = await exigirRestaurante();
  const id = leerId(fd);
  if (!id) return;
  await supabase.from("dishes").delete().eq("id", id).eq("restaurant_id", restaurante.id);
  refresh();
}

export async function alternarDisponible(fd: FormData): Promise<void> {
  const { supabase, restaurante } = await exigirRestaurante();
  const id = leerId(fd);
  if (!id) return;
  await supabase
    .from("dishes")
    .update({ is_available: fd.get("disponible") === "true" })
    .eq("id", id)
    .eq("restaurant_id", restaurante.id);
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
  if (error) return fallo("No se pudieron guardar los alérgenos. Inténtalo de nuevo.");
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
