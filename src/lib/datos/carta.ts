import "server-only";
import type { Alergeno } from "@/lib/domain/alergenos";
import type { FilaCategoria, FilaPlato } from "@/lib/supabase/tipos";
import type { ContextoRestaurante } from "./sesion";

export type PlatoPanel = FilaPlato & {
  alergenos: { allergen: Alergeno; status: "suggested" | "confirmed" }[];
};

export type CartaPanel = {
  categorias: (FilaCategoria & { platos: PlatoPanel[] })[];
  sinCategoria: PlatoPanel[];
};

/** Carta completa del restaurante para el panel (incluye no disponibles). */
export async function cargarCartaPanel(ctx: ContextoRestaurante): Promise<CartaPanel> {
  const rid = ctx.restaurante.id;
  const [cats, platos, alergenos] = await Promise.all([
    ctx.supabase
      .from("categories")
      .select("*")
      .eq("restaurant_id", rid)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true }),
    ctx.supabase
      .from("dishes")
      .select("*")
      .eq("restaurant_id", rid)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true }),
    ctx.supabase.from("dish_allergens").select("dish_id, allergen, status").eq("restaurant_id", rid),
  ]);

  const error = cats.error ?? platos.error ?? alergenos.error;
  if (error) throw new Error(`No se pudo cargar la carta: ${error.message}`);

  const porPlato = new Map<string, PlatoPanel["alergenos"]>();
  for (const a of alergenos.data ?? []) {
    const lista = porPlato.get(a.dish_id) ?? [];
    lista.push({ allergen: a.allergen, status: a.status });
    porPlato.set(a.dish_id, lista);
  }

  const conAlergenos: PlatoPanel[] = (platos.data ?? []).map((p) => ({
    ...p,
    alergenos: porPlato.get(p.id) ?? [],
  }));

  const categorias = (cats.data ?? []).map((c) => ({
    ...c,
    platos: conAlergenos.filter((p) => p.category_id === c.id),
  }));
  const sinCategoria = conAlergenos.filter((p) => p.category_id === null);

  return { categorias, sinCategoria };
}
