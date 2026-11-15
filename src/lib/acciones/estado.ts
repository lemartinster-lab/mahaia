/** Estado que devuelven las Server Actions del panel a useActionState. */
export type EstadoAccion = { ok: boolean; error?: string; mensaje?: string };

export const ESTADO_INICIAL: EstadoAccion = { ok: false };
