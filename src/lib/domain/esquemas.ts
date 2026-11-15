import { z } from "zod";
import { ALERGENOS } from "./alergenos";
import { IDIOMAS } from "./idiomas";

/** Slug de URL: minúsculas, números y guiones. Igual que el CHECK de la BD. */
export const slugSchema = z
  .string()
  .min(3)
  .max(60)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Solo minúsculas, números y guiones");

export const precioCentimosSchema = z.number().int().min(0).max(10_000_000);

export const varianteSchema = z.object({
  label: z.string().trim().min(1).max(60),
  price_cents: precioCentimosSchema,
});

export const variantesSchema = z.array(varianteSchema).max(10);

export const alergenoSchema = z.enum(ALERGENOS);
export const idiomaSchema = z.enum(IDIOMAS);

/** Datos de un plato tal como los edita el restaurante en el panel. */
export const platoEditableSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(600).nullable(),
  price_cents: precioCentimosSchema,
  variants: variantesSchema,
  category_id: z.uuid().nullable(),
  is_available: z.boolean(),
  is_new: z.boolean(),
});

export type PlatoEditable = z.infer<typeof platoEditableSchema>;

/**
 * Resultado que debe devolver la IA al leer una foto de carta (fase 2).
 * Se define ya para fijar el contrato. Todo lo que devuelva Claude pasa
 * por aquí antes de convertirse en borrador.
 */
export const platoImportadoSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(600).nullable().default(null),
  price_cents: precioCentimosSchema.nullable(),
  variants: variantesSchema.default([]),
  // Solo sugerencias: SIEMPRE entran como 'suggested'
  suggested_allergens: z.array(alergenoSchema).max(14).default([]),
});

export const categoriaImportadaSchema = z.object({
  name: z.string().trim().min(1).max(80),
  dishes: z.array(platoImportadoSchema).max(200),
});

export const resultadoImportacionSchema = z.object({
  detected_language: idiomaSchema.nullable().default(null),
  categories: z.array(categoriaImportadaSchema).min(1).max(50),
  warnings: z.array(z.string().max(300)).max(50).default([]),
});

export type ResultadoImportacion = z.infer<typeof resultadoImportacionSchema>;
