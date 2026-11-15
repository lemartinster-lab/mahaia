import { describe, expect, it } from "vitest";
import { generarSlug } from "@/lib/domain/slug";
import {
  buscarDuplicado,
  leerAlergenos,
  normalizarNombre,
  leerCategoria,
  leerNuevoRestaurante,
  leerPlato,
  leerVariantes,
} from "@/lib/acciones/formularios";

const fd = (campos: Record<string, string | string[]>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) {
    for (const valor of Array.isArray(v) ? v : [v]) f.append(k, valor);
  }
  return f;
};

const CAT = "11111111-1111-4111-8111-111111111111";

describe("generarSlug", () => {
  it.each([
    ["Taberna Beñat", "taberna-benat"],
    ["Ra-men Kagura (Tenerife)", "ra-men-kagura-tenerife"],
    ["  Café   Ñoño!! ", "cafe-nono"],
    ["Guachinche El Puntillo · La Orotava", "guachinche-el-puntillo-la-orotava"],
    ["¡¡¡", ""],
  ])("%s → %s", (nombre, esperado) => {
    expect(generarSlug(nombre)).toBe(esperado);
  });

  it("recorta a 60 caracteres sin dejar guion al final", () => {
    const s = generarSlug("a".repeat(59) + " bcd");
    expect(s.length).toBeLessThanOrEqual(60);
    expect(s.endsWith("-")).toBe(false);
  });
});

describe("leerNuevoRestaurante", () => {
  it("genera el slug a partir del nombre si no se indica", () => {
    expect(leerNuevoRestaurante(fd({ nombre: "Taberna Beñat" }))).toEqual({
      ok: true,
      datos: { name: "Taberna Beñat", slug: "taberna-benat" },
    });
  });

  it("normaliza el slug escrito a mano", () => {
    const r = leerNuevoRestaurante(fd({ nombre: "X", slug: "Mi Bar Favorito" }));
    expect(r).toMatchObject({ ok: true, datos: { slug: "mi-bar-favorito" } });
  });

  it("rechaza nombre vacío o slug demasiado corto", () => {
    expect(leerNuevoRestaurante(fd({ nombre: "  " })).ok).toBe(false);
    expect(leerNuevoRestaurante(fd({ nombre: "Ñu" })).ok).toBe(false); // "nu" < 3
  });
});

describe("leerCategoria", () => {
  it("acepta y recorta el nombre", () => {
    expect(leerCategoria(fd({ nombre: "  Ramen " }))).toEqual({ ok: true, datos: { name: "Ramen" } });
  });
  it("rechaza vacío", () => {
    expect(leerCategoria(fd({ nombre: "" })).ok).toBe(false);
  });
});

describe("leerVariantes", () => {
  it("interpreta una variante por línea", () => {
    expect(leerVariantes("Doble ternera | 19,95\n\nXL | 20.95 €\n")).toEqual({
      ok: true,
      datos: [
        { label: "Doble ternera", price_cents: 1995 },
        { label: "XL", price_cents: 2095 },
      ],
    });
  });

  it("vacío = sin variantes", () => {
    expect(leerVariantes("")).toEqual({ ok: true, datos: [] });
  });

  it("explica el formato si falta el separador", () => {
    const r = leerVariantes("XL 20,95");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Nombre \| precio/);
  });

  it("señala la línea con precio incorrecto", () => {
    const r = leerVariantes("XL | 20,95\nMini | barato");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Variante 2/);
  });
});

describe("leerPlato", () => {
  const base = {
    nombre: "Sukiyaki miso",
    precio: "15,95",
    descripcion: "Fideos ramen con ternera laminada",
    variantes: "XL | 20,95",
    categoria: CAT,
    disponible: "on",
  };

  it("convierte el formulario en un plato válido", () => {
    expect(leerPlato(fd(base))).toEqual({
      ok: true,
      datos: {
        name: "Sukiyaki miso",
        description: "Fideos ramen con ternera laminada",
        price_cents: 1595,
        variants: [{ label: "XL", price_cents: 2095 }],
        category_id: CAT,
        is_available: true,
        is_new: false,
      },
    });
  });

  it("las casillas sin marcar son false y la categoría vacía es null", () => {
    const r = leerPlato(fd({ ...base, categoria: "", disponible: [], nuevo: "on" }));
    expect(r).toMatchObject({ ok: true, datos: { category_id: null, is_available: false, is_new: true } });
  });

  it("la descripción vacía se guarda como null", () => {
    expect(leerPlato(fd({ ...base, descripcion: "   " }))).toMatchObject({ ok: true, datos: { description: null } });
  });

  it("rechaza precio ilegible con un mensaje claro", () => {
    expect(leerPlato(fd({ ...base, precio: "quince" }))).toEqual({
      ok: false,
      error: "Escribe un precio válido, por ejemplo 15,95.",
    });
  });

  it("rechaza nombre vacío y categoría que no es un id", () => {
    expect(leerPlato(fd({ ...base, nombre: "" })).ok).toBe(false);
    expect(leerPlato(fd({ ...base, categoria: "'; drop table dishes;--" })).ok).toBe(false);
  });
});

describe("leerAlergenos", () => {
  it("devuelve los marcados sin duplicados", () => {
    expect(leerAlergenos(fd({ alergeno: ["gluten", "soja", "gluten"] }))).toEqual({
      ok: true,
      datos: ["gluten", "soja"],
    });
  });

  it("sin marcar ninguno = lista vacía (plato revisado sin alérgenos)", () => {
    expect(leerAlergenos(fd({}))).toEqual({ ok: true, datos: [] });
  });

  it("rechaza valores manipulados", () => {
    expect(leerAlergenos(fd({ alergeno: ["gluten", "picante"] })).ok).toBe(false);
  });
});

describe("categorías duplicadas", () => {
  const existentes = [
    { id: "a", name: "Ramen" },
    { id: "b", name: "Café y postres" },
  ];

  it("normaliza mayúsculas, tildes y espacios", () => {
    expect(normalizarNombre("  Café   Ñoño ")).toBe("cafe nono");
  });

  it.each(["Ramen", "ramen", "  RAMEN ", "Ramén"])("detecta «%s» como duplicado de Ramen", (n) => {
    expect(buscarDuplicado(existentes, n)).toBe("Ramen");
  });

  it("detecta duplicados con tildes distintas", () => {
    expect(buscarDuplicado(existentes, "cafe y  POSTRES")).toBe("Café y postres");
  });

  it("un nombre nuevo no es duplicado", () => {
    expect(buscarDuplicado(existentes, "Entrantes")).toBeNull();
  });

  it("al renombrar, la propia categoría no cuenta (p. ej. cambiar solo mayúsculas)", () => {
    expect(buscarDuplicado(existentes, "RAMEN", "a")).toBeNull();
    expect(buscarDuplicado(existentes, "Ramen", "b")).toBe("Ramen");
  });
});
