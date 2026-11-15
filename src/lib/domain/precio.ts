/**
 * Los precios se guardan SIEMPRE en céntimos (enteros) para evitar
 * errores de coma flotante: 0.1 + 0.2 !== 0.3.
 */

const PRECIO_MAXIMO_CENTIMOS = 10_000_000; // 100.000 €, igual que el CHECK de la BD

/** 1595 → "15,95 €" (formato español por defecto) */
export function formatearPrecio(centimos: number, locale = "es-ES"): string {
  if (!Number.isInteger(centimos) || centimos < 0) {
    throw new RangeError(`Precio en céntimos no válido: ${centimos}`);
  }
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
  }).format(centimos / 100);
}

/**
 * Interpreta un precio escrito por una persona o leído de una carta:
 * "15,95 €", "15.95€", "€ 16.5", "16", "1.250,00 €", "1,250.00".
 * Devuelve céntimos o null si no se puede interpretar sin ambigüedad.
 */
export function parsearPrecio(texto: string): number | null {
  const limpio = texto.replace(/€|eur(os)?/gi, "").replace(/\s/g, "");
  if (!/^\d[\d.,]*$/.test(limpio)) return null;

  const ultimoPunto = limpio.lastIndexOf(".");
  const ultimaComa = limpio.lastIndexOf(",");
  const posDecimal = Math.max(ultimoPunto, ultimaComa);

  let entera: string;
  let decimales = "";

  if (posDecimal === -1) {
    entera = limpio;
  } else {
    const tras = limpio.slice(posDecimal + 1);
    const separadorUnico =
      limpio.split(limpio[posDecimal]).length === 2 &&
      (ultimoPunto === -1 || ultimaComa === -1);

    if (tras.length === 3 && separadorUnico) {
      // "1.250" o "1,250": separador de miles, no decimales
      entera = limpio.replace(/[.,]/g, "");
    } else if (
      tras.length >= 1 &&
      tras.length <= 2 &&
      // El separador decimal solo puede aparecer una vez ("1.2.3" no vale)
      limpio.split(limpio[posDecimal]).length === 2
    ) {
      entera = limpio.slice(0, posDecimal).replace(/[.,]/g, "");
      decimales = tras;
    } else {
      return null;
    }
  }

  if (entera === "") return null;
  const centimos = Number(entera) * 100 + Number(decimales.padEnd(2, "0") || "0");
  if (!Number.isSafeInteger(centimos) || centimos > PRECIO_MAXIMO_CENTIMOS) return null;
  return centimos;
}
