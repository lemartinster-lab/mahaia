/**
 * Conversión de formularios (FormData) a datos validados.
 * Es lógica pura, sin Supabase ni Next.js, para poder probarla con tests.
 */
import { z } from "zod";
import { esAlergeno, type Alergeno } from "@/lib/domain/alergenos";
import { parsearPrecio } from "@/lib/domain/precio";
import { generarSlug } from "@/lib/domain/slug";
import { platoEditableSchema, slugSchema, type PlatoEditable } from "@/lib/domain/esquemas";

export type Resultado<T> = { ok: true; datos: T } | { ok: false; error: string };

const texto = (fd: FormData, campo: string): string => {
  const v = fd.get(campo);
  return typeof v === "string" ? v.trim() : "";
};

// ---------------------------------------------------------------------
// Restaurante
// ---------------------------------------------------------------------
export function leerNuevoRestaurante(fd: FormData): Resultado<{ name: string; slug: string }> {
  const name = texto(fd, "nombre");
  if (!name) return { ok: false, error: "Escribe el nombre del restaurante." };
  if (name.length > 120) return { ok: false, error: "El nombre es demasiado largo (máximo 120 caracteres)." };

  const slug = generarSlug(texto(fd, "slug") || name);
  if (!slugSchema.safeParse(slug).success) {
    return {
      ok: false,
      error: "La dirección web debe tener entre 3 y 60 caracteres: letras sin tildes, números y guiones.",
    };
  }
  return { ok: true, datos: { name, slug } };
}

// ---------------------------------------------------------------------
// Categoría
// ---------------------------------------------------------------------
export function leerCategoria(fd: FormData): Resultado<{ name: string }> {
  const name = texto(fd, "nombre");
  if (!name) return { ok: false, error: "Escribe el nombre de la categoría." };
  if (name.length > 80) return { ok: false, error: "Máximo 80 caracteres." };
  return { ok: true, datos: { name } };
}

// ---------------------------------------------------------------------
// Variantes: una por línea, "Etiqueta | precio"
//   "Doble ternera | 19,95"
//   "XL | 20,95 €"
// ---------------------------------------------------------------------
export function leerVariantes(textoVariantes: string): Resultado<PlatoEditable["variants"]> {
  const lineas = textoVariantes
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const variantes: PlatoEditable["variants"] = [];
  for (const [i, linea] of lineas.entries()) {
    const partes = linea.split("|");
    if (partes.length !== 2) {
      return { ok: false, error: `Variante ${i + 1}: usa el formato "Nombre | precio", por ejemplo "XL | 20,95".` };
    }
    const label = partes[0].trim();
    const precio = parsearPrecio(partes[1]);
    if (!label) return { ok: false, error: `Variante ${i + 1}: falta el nombre.` };
    if (precio === null) return { ok: false, error: `Variante ${i + 1}: no entiendo el precio "${partes[1].trim()}".` };
    variantes.push({ label, price_cents: precio });
  }
  if (variantes.length > 10) return { ok: false, error: "Máximo 10 variantes por plato." };
  return { ok: true, datos: variantes };
}

// ---------------------------------------------------------------------
// Plato
// ---------------------------------------------------------------------
export function leerPlato(fd: FormData): Resultado<PlatoEditable> {
  const precio = parsearPrecio(texto(fd, "precio"));
  if (precio === null) return { ok: false, error: "Escribe un precio válido, por ejemplo 15,95." };

  const variantes = leerVariantes(texto(fd, "variantes"));
  if (!variantes.ok) return variantes;

  const categoria = texto(fd, "categoria");
  const candidato = {
    name: texto(fd, "nombre"),
    description: texto(fd, "descripcion") || null,
    price_cents: precio,
    variants: variantes.datos,
    category_id: categoria || null,
    is_available: fd.get("disponible") === "on",
    is_new: fd.get("nuevo") === "on",
  };

  const r = platoEditableSchema.safeParse(candidato);
  if (!r.success) {
    const campo = r.error.issues[0]?.path[0];
    const mensajes: Record<string, string> = {
      name: "Escribe el nombre del plato (máximo 120 caracteres).",
      description: "La descripción es demasiado larga (máximo 600 caracteres).",
      category_id: "La categoría elegida no es válida.",
    };
    return { ok: false, error: mensajes[String(campo)] ?? "Revisa los datos del plato." };
  }
  return { ok: true, datos: r.data };
}

// ---------------------------------------------------------------------
// Alérgenos: casillas name="alergeno" value="gluten", ...
// ---------------------------------------------------------------------
export function leerAlergenos(fd: FormData): Resultado<Alergeno[]> {
  const valores = fd.getAll("alergeno").map(String);
  const invalidos = valores.filter((v) => !esAlergeno(v));
  if (invalidos.length) return { ok: false, error: "Hay alérgenos no reconocidos en el formulario." };
  return { ok: true, datos: [...new Set(valores)] as Alergeno[] };
}

export const idSchema = z.uuid();

// ---------------------------------------------------------------------
// Nombres duplicados
// ---------------------------------------------------------------------
/** "  Café  Ñoño " y "cafe ñoño" cuentan como el mismo nombre. */
export function normalizarNombre(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Busca otra categoría con el mismo nombre (sin distinguir mayúsculas,
 * tildes ni espacios). `excluirId` sirve al renombrar: la propia categoría
 * no cuenta como duplicado. Devuelve el nombre existente o null.
 */
export function buscarDuplicado(
  existentes: readonly { id: string; name: string }[],
  nombre: string,
  excluirId?: string,
): string | null {
  const buscado = normalizarNombre(nombre);
  const encontrada = existentes.find((c) => c.id !== excluirId && normalizarNombre(c.name) === buscado);
  return encontrada ? encontrada.name : null;
}
