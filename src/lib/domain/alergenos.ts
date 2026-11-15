/**
 * Los 14 alérgenos de declaración obligatoria del Reglamento (UE) 1169/2011.
 * Los códigos coinciden con el enum `public.alergeno` de la base de datos.
 */
export const ALERGENOS = [
  "gluten",
  "crustaceos",
  "huevos",
  "pescado",
  "cacahuetes",
  "soja",
  "lacteos",
  "frutos_cascara",
  "apio",
  "mostaza",
  "sesamo",
  "sulfitos",
  "altramuces",
  "moluscos",
] as const;

export type Alergeno = (typeof ALERGENOS)[number];

export const NOMBRE_ALERGENO: Record<Alergeno, string> = {
  gluten: "Gluten",
  crustaceos: "Crustáceos",
  huevos: "Huevos",
  pescado: "Pescado",
  cacahuetes: "Cacahuetes",
  soja: "Soja",
  lacteos: "Lácteos",
  frutos_cascara: "Frutos de cáscara",
  apio: "Apio",
  mostaza: "Mostaza",
  sesamo: "Sésamo",
  sulfitos: "Sulfitos",
  altramuces: "Altramuces",
  moluscos: "Moluscos",
};

export function esAlergeno(valor: string): valor is Alergeno {
  return (ALERGENOS as readonly string[]).includes(valor);
}

export type EstadoAlergeno = "suggested" | "confirmed";

export interface AlergenoDePlato {
  allergen: Alergeno;
  status: EstadoAlergeno;
}

/**
 * Lo que la carta pública puede afirmar sobre los alérgenos de un plato.
 *
 * - `sin_revisar`: nadie ha revisado el plato → "Consulta al personal".
 * - `revisado`: revisado por una persona; se muestran SOLO los confirmados
 *   (puede ser una lista vacía si el plato no contiene ninguno).
 *
 * Los alérgenos sugeridos por la IA nunca se muestran al público.
 */
export type InfoAlergenosPublica =
  | { tipo: "sin_revisar" }
  | { tipo: "revisado"; alergenos: Alergeno[] };

export function infoAlergenosPublica(
  revisadoEn: string | Date | null,
  alergenos: readonly AlergenoDePlato[],
): InfoAlergenosPublica {
  if (revisadoEn === null) return { tipo: "sin_revisar" };

  const confirmados = alergenos
    .filter((a) => a.status === "confirmed")
    .map((a) => a.allergen);

  // Orden estable y sin duplicados, según el orden oficial de la lista
  const unicos = ALERGENOS.filter((a) => confirmados.includes(a));
  return { tipo: "revisado", alergenos: unicos };
}

/**
 * Filtro "no puedo tomar X": un plato solo es apto si está revisado y
 * no contiene ninguno de los alérgenos excluidos. Un plato sin revisar
 * NUNCA se considera apto.
 */
export function esAptoSin(
  info: InfoAlergenosPublica,
  excluidos: readonly Alergeno[],
): boolean {
  if (info.tipo === "sin_revisar") return false;
  return !info.alergenos.some((a) => excluidos.includes(a));
}
