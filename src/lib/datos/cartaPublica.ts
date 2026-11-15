import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { clientePublico } from "@/lib/supabase/publico";
import { etiquetaCarta, montarCartaPublica, type CartaPublica } from "@/lib/domain/cartaPublica";
import { slugSchema } from "@/lib/domain/esquemas";

/**
 * Carta pública de un restaurante, cacheada.
 * - Se invalida al momento desde el panel con updateTag(etiquetaCarta(slug)).
 * - Devuelve null si no existe o no está publicada (RLS no la deja ver).
 */
export async function cargarCartaPublica(slug: string): Promise<CartaPublica | null> {
  "use cache";
  cacheTag(etiquetaCarta(slug));
  cacheLife("days");

  if (!slugSchema.safeParse(slug).success) return null;
  const supabase = clientePublico();

  const { data: restaurante, error } = await supabase
    .from("restaurants")
    .select("id, name, slug")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`No se pudo leer la carta: ${error.message}`);
  if (!restaurante) return null;

  const [cats, platos, alergenos] = await Promise.all([
    supabase.from("categories").select("id, name, position").eq("restaurant_id", restaurante.id),
    supabase
      .from("dishes")
      .select("id, category_id, name, description, price_cents, variants, is_new, position, allergens_reviewed_at")
      .eq("restaurant_id", restaurante.id),
    supabase.from("dish_allergens").select("dish_id, allergen, status").eq("restaurant_id", restaurante.id),
  ]);
  const e = cats.error ?? platos.error ?? alergenos.error;
  if (e) throw new Error(`No se pudo leer la carta: ${e.message}`);

  return montarCartaPublica(restaurante, cats.data ?? [], platos.data ?? [], alergenos.data ?? []);
}
