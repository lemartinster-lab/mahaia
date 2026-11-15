import { describe, expect, it } from "vitest";
import { etiquetaCarta, montarCartaPublica } from "@/lib/domain/cartaPublica";
import { esAptoSin } from "@/lib/domain/alergenos";

const rest = { id: "r1", name: "Ramen Ana", slug: "ramen-ana" };
const REVISADO = "2026-11-15T10:00:00Z";

const plato = (o: Partial<Parameters<typeof montarCartaPublica>[2][number]> & { id: string }) => ({
  category_id: "c-ramen",
  name: o.id,
  description: null,
  price_cents: 1000,
  variants: [],
  is_new: false,
  position: 0,
  allergens_reviewed_at: REVISADO,
  ...o,
});

const categorias = [
  { id: "c-postres", name: "Postres", position: 1 },
  { id: "c-ramen", name: "Ramen", position: 0 },
  { id: "c-vacia", name: "Bebidas", position: 2 },
];

describe("montarCartaPublica", () => {
  const carta = montarCartaPublica(
    rest,
    categorias,
    [
      plato({ id: "tonkotsu", position: 1 }),
      plato({ id: "sukiyaki", position: 0, is_new: true }),
      plato({ id: "mochi", category_id: "c-postres" }),
      plato({ id: "suelto", category_id: null }),
      plato({ id: "sin-revisar", category_id: "c-postres", allergens_reviewed_at: null, position: 5 }),
    ],
    [
      { dish_id: "tonkotsu", allergen: "gluten", status: "confirmed" },
      { dish_id: "tonkotsu", allergen: "huevos", status: "confirmed" },
      { dish_id: "mochi", allergen: "soja", status: "suggested" }, // nunca debe salir
    ],
  );

  it("respeta el orden de categorías y platos, y oculta categorías vacías", () => {
    expect(carta.categorias.map((c) => c.nombre)).toEqual(["Ramen", "Postres", "Otros"]);
    expect(carta.categorias[0].platos.map((p) => p.id)).toEqual(["sukiyaki", "tonkotsu"]);
  });

  it("lleva los platos sin categoría a «Otros», al final", () => {
    expect(carta.categorias.at(-1)).toMatchObject({ id: "otros", platos: [{ id: "suelto" }] });
  });

  it("muestra los alérgenos confirmados en orden oficial", () => {
    const tonkotsu = carta.categorias[0].platos[1];
    expect(tonkotsu.alergenos).toEqual({ tipo: "revisado", alergenos: ["gluten", "huevos"] });
  });

  it("nunca muestra alérgenos sugeridos (aunque llegaran por error)", () => {
    const mochi = carta.categorias[1].platos.find((p) => p.id === "mochi")!;
    expect(mochi.alergenos).toEqual({ tipo: "revisado", alergenos: [] });
  });

  it("marca como «sin revisar» los platos que nadie ha revisado", () => {
    const p = carta.categorias[1].platos.find((x) => x.id === "sin-revisar")!;
    expect(p.alergenos).toEqual({ tipo: "sin_revisar" });
  });

  it("conserva la marca de «nuevo» y los datos del restaurante", () => {
    expect(carta.categorias[0].platos[0].nuevo).toBe(true);
    expect(carta.restaurante).toEqual({ nombre: "Ramen Ana", slug: "ramen-ana" });
  });

  it("con filtro «sin gluten»: fuera el tonkotsu y el plato sin revisar", () => {
    const aptos = carta.categorias.flatMap((c) => c.platos).filter((p) => esAptoSin(p.alergenos, ["gluten"]));
    expect(aptos.map((p) => p.id).sort()).toEqual(["mochi", "suelto", "sukiyaki"]);
  });

  it("una carta sin platos queda sin categorías", () => {
    expect(montarCartaPublica(rest, categorias, [], []).categorias).toEqual([]);
  });
});

describe("etiquetaCarta", () => {
  it("es estable y distinta por restaurante", () => {
    expect(etiquetaCarta("ramen-ana")).toBe("carta:ramen-ana");
    expect(etiquetaCarta("ramen-ana")).not.toBe(etiquetaCarta("taberna-benat"));
  });
});
