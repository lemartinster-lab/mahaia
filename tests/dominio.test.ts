import { describe, expect, it } from "vitest";
import { esAptoSin, infoAlergenosPublica } from "@/lib/domain/alergenos";
import { formatearPrecio, parsearPrecio } from "@/lib/domain/precio";
import { resolverIdioma } from "@/lib/domain/idiomas";
import { platoEditableSchema, resultadoImportacionSchema, slugSchema } from "@/lib/domain/esquemas";

describe("precio", () => {
  it("formatea céntimos en euros con formato español", () => {
    // Intl usa espacio duro antes del símbolo
    expect(formatearPrecio(1595).replace(/\s/g, " ")).toBe("15,95 €");
    expect(formatearPrecio(0).replace(/\s/g, " ")).toBe("0,00 €");
  });

  it("rechaza precios no enteros o negativos", () => {
    expect(() => formatearPrecio(15.95)).toThrow(RangeError);
    expect(() => formatearPrecio(-1)).toThrow(RangeError);
  });

  it.each([
    ["15,95 €", 1595],
    ["15.95€", 1595],
    ["16.5€", 1650],
    ["€ 19.95", 1995],
    ["20", 2000],
    ["1.250,00 €", 125000],
    ["1,250.00", 125000],
    ["1.250", 125000],
    ["3,5 euros", 350],
  ])("interpreta %s como %i céntimos", (texto, centimos) => {
    expect(parsearPrecio(texto)).toBe(centimos);
  });

  it.each(["", "gratis", "12,345,6", "1.2.3", "€", "-5"])("no adivina con '%s'", (texto) => {
    expect(parsearPrecio(texto)).toBeNull();
  });
});

describe("alérgenos en la carta pública", () => {
  it("un plato sin revisar dice 'consulta al personal'", () => {
    expect(infoAlergenosPublica(null, [{ allergen: "gluten", status: "confirmed" }])).toEqual({
      tipo: "sin_revisar",
    });
  });

  it("solo muestra los confirmados, nunca los sugeridos", () => {
    const info = infoAlergenosPublica("2026-11-15T10:00:00Z", [
      { allergen: "soja", status: "suggested" },
      { allergen: "huevos", status: "confirmed" },
      { allergen: "gluten", status: "confirmed" },
    ]);
    // Orden oficial del reglamento: gluten antes que huevos
    expect(info).toEqual({ tipo: "revisado", alergenos: ["gluten", "huevos"] });
  });

  it("un plato revisado sin alérgenos es apto", () => {
    const info = infoAlergenosPublica(new Date(), []);
    expect(esAptoSin(info, ["gluten"])).toBe(true);
  });

  it("un plato sin revisar NUNCA es apto para el filtro", () => {
    expect(esAptoSin({ tipo: "sin_revisar" }, ["gluten"])).toBe(false);
    expect(esAptoSin({ tipo: "sin_revisar" }, [])).toBe(false);
  });

  it("excluye platos con el alérgeno indicado", () => {
    const info = infoAlergenosPublica(new Date(), [{ allergen: "gluten", status: "confirmed" }]);
    expect(esAptoSin(info, ["gluten"])).toBe(false);
    expect(esAptoSin(info, ["lacteos"])).toBe(true);
  });
});

describe("idioma", () => {
  const disponibles = ["es", "en", "eu"] as const;

  it("usa el pedido si el restaurante lo ofrece", () => {
    expect(resolverIdioma("eu", disponibles, "es")).toBe("eu");
    expect(resolverIdioma("en-GB", disponibles, "es")).toBe("en");
  });

  it("vuelve al idioma base si no está disponible o no existe", () => {
    expect(resolverIdioma("de", disponibles, "es")).toBe("es");
    expect(resolverIdioma("klingon", disponibles, "es")).toBe("es");
    expect(resolverIdioma(null, disponibles, "es")).toBe("es");
  });
});

describe("esquemas", () => {
  it("valida slugs de URL", () => {
    expect(slugSchema.safeParse("ramen-kagura-tenerife").success).toBe(true);
    expect(slugSchema.safeParse("Ramen Kagura").success).toBe(false);
    expect(slugSchema.safeParse("-ramen").success).toBe(false);
  });

  it("valida un plato editable con variantes", () => {
    const r = platoEditableSchema.safeParse({
      name: "  Sukiyaki miso ",
      description: null,
      price_cents: 1595,
      variants: [{ label: "XL", price_cents: 2095 }],
      category_id: null,
      is_available: true,
      is_new: true,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.name).toBe("Sukiyaki miso");
  });

  it("rechaza precios con decimales (deben ir en céntimos)", () => {
    const r = platoEditableSchema.safeParse({
      name: "X",
      description: null,
      price_cents: 15.95,
      variants: [],
      category_id: null,
      is_available: true,
      is_new: false,
    });
    expect(r.success).toBe(false);
  });

  it("acepta una respuesta de importación correcta y rellena valores por defecto", () => {
    const r = resultadoImportacionSchema.parse({
      categories: [{ name: "Ramen", dishes: [{ name: "Tonkotsu", price_cents: 1450, suggested_allergens: ["gluten"] }] }],
    });
    expect(r.detected_language).toBeNull();
    expect(r.warnings).toEqual([]);
    expect(r.categories[0].dishes[0].variants).toEqual([]);
  });

  it("rechaza alérgenos inventados por la IA", () => {
    const r = resultadoImportacionSchema.safeParse({
      categories: [{ name: "Ramen", dishes: [{ name: "X", price_cents: 100, suggested_allergens: ["picante"] }] }],
    });
    expect(r.success).toBe(false);
  });

  it("rechaza una importación vacía", () => {
    expect(resultadoImportacionSchema.safeParse({ categories: [] }).success).toBe(false);
  });
});
