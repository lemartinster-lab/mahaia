/**
 * Convierte un nombre en un slug de URL válido para la carta pública.
 * "Taberna Beñat" → "taberna-benat"; "Ra-men Kagura (Tenerife)" → "ra-men-kagura-tenerife".
 * Devuelve "" si no queda nada aprovechable.
 */
export function generarSlug(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita tildes y la virgulilla de la ñ
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}
