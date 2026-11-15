/** Idiomas de la carta. Coinciden con el enum `public.idioma` de la BD. */
export const IDIOMAS = ["es", "en", "de", "fr", "it", "eu"] as const;

export type Idioma = (typeof IDIOMAS)[number];

export const NOMBRE_IDIOMA: Record<Idioma, string> = {
  es: "Español",
  en: "English",
  de: "Deutsch",
  fr: "Français",
  it: "Italiano",
  eu: "Euskara",
};

export function esIdioma(valor: string): valor is Idioma {
  return (IDIOMAS as readonly string[]).includes(valor);
}

/**
 * Elige el idioma en que mostrar la carta: el pedido si el restaurante lo
 * ofrece; si no, el idioma base del restaurante.
 */
export function resolverIdioma(
  pedido: string | null | undefined,
  disponibles: readonly Idioma[],
  base: Idioma,
): Idioma {
  if (pedido) {
    const corto = pedido.toLowerCase().split(/[-_]/)[0];
    if (esIdioma(corto) && disponibles.includes(corto)) return corto;
  }
  return base;
}
