/**
 * Forma de la carta pública y cómo se monta a partir de las filas de la BD.
 * Lógica pura (sin Supabase ni Next.js) para poder probarla con tests.
 */
import { infoAlergenosPublica, type Alergeno, type InfoAlergenosPublica } from "./alergenos";

export type PlatoPublico = {
  id: string;
  nombre: string;
  descripcion: string | null;
  precioCentimos: number;
  variantes: { label: string; price_cents: number }[];
  nuevo: boolean;
  alergenos: InfoAlergenosPublica;
};

export type CategoriaPublica = { id: string; nombre: string; platos: PlatoPublico[] };

export type CartaPublica = {
  restaurante: { nombre: string; slug: string };
  categorias: CategoriaPublica[];
};

type FilaRestaurante = { id: string; name: string; slug: string };
type FilaCategoria = { id: string; name: string; position: number };
type FilaPlato = {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price_cents: number;
  variants: { label: string; price_cents: number }[];
  is_new: boolean;
  position: number;
  allergens_reviewed_at: string | null;
};
type FilaAlergeno = { dish_id: string; allergen: Alergeno; status: "suggested" | "confirmed" };

/**
 * Monta la carta pública:
 * - categorías en su orden; las vacías no se muestran;
 * - los platos sin categoría van al final, en "Otros";
 * - los alérgenos pasan por infoAlergenosPublica (solo confirmados, y
 *   "sin revisar" si nadie ha revisado el plato).
 */
export function montarCartaPublica(
  restaurante: FilaRestaurante,
  categorias: FilaCategoria[],
  platos: FilaPlato[],
  alergenos: FilaAlergeno[],
): CartaPublica {
  const porPlato = new Map<string, FilaAlergeno[]>();
  for (const a of alergenos) {
    porPlato.set(a.dish_id, [...(porPlato.get(a.dish_id) ?? []), a]);
  }

  const aPublico = (p: FilaPlato): PlatoPublico => ({
    id: p.id,
    nombre: p.name,
    descripcion: p.description,
    precioCentimos: p.price_cents,
    variantes: p.variants,
    nuevo: p.is_new,
    alergenos: infoAlergenosPublica(p.allergens_reviewed_at, porPlato.get(p.id) ?? []),
  });

  const ordenados = [...platos].sort((a, b) => a.position - b.position);
  const idsCategorias = new Set(categorias.map((c) => c.id));

  const resultado: CategoriaPublica[] = [...categorias]
    .sort((a, b) => a.position - b.position)
    .map((c) => ({
      id: c.id,
      nombre: c.name,
      platos: ordenados.filter((p) => p.category_id === c.id).map(aPublico),
    }))
    .filter((c) => c.platos.length > 0);

  // Sin categoría, o con una categoría que el público no puede ver
  const sueltos = ordenados.filter((p) => p.category_id === null || !idsCategorias.has(p.category_id));
  if (sueltos.length) resultado.push({ id: "otros", nombre: "Otros", platos: sueltos.map(aPublico) });

  return { restaurante: { nombre: restaurante.name, slug: restaurante.slug }, categorias: resultado };
}

/** Etiqueta de caché de la carta de un restaurante (para invalidarla al editar). */
export const etiquetaCarta = (slug: string) => `carta:${slug}`;
