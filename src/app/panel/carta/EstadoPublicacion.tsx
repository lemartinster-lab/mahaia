"use client";

import Link from "next/link";
import { useActionState } from "react";
import { cambiarPublicacion } from "@/lib/acciones/panel";
import { ESTADO_INICIAL } from "@/lib/acciones/estado";

/** Barra con el estado de la carta: publicada o en borrador. */
export function EstadoPublicacion(props: { slug: string; publicada: boolean; totalPlatos: number }) {
  const [estado, accion, enviando] = useActionState(cambiarPublicacion, ESTADO_INICIAL);

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 ${
        props.publicada ? "border-green-300 bg-green-50" : "border-neutral-300 bg-neutral-50"
      }`}
    >
      <div className="text-sm">
        {props.publicada ? (
          <p>
            <strong className="text-green-900">● Carta publicada.</strong> Tus clientes la ven en{" "}
            <Link href={`/r/${props.slug}`} target="_blank" className="font-mono underline">
              /r/{props.slug}
            </Link>
          </p>
        ) : (
          <p>
            <strong>○ Borrador.</strong> Nadie más puede ver tu carta hasta que la publiques.
          </p>
        )}
        {estado.error && <p className="mt-1 text-red-700" role="alert">{estado.error}</p>}
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href="/panel/qr" className="rounded-md border border-neutral-300 bg-white px-3 py-1 text-sm hover:bg-neutral-50">
          Código QR
        </Link>
        {props.publicada && (
          <Link
            href={`/r/${props.slug}`}
            target="_blank"
            className="rounded-md border border-neutral-300 bg-white px-3 py-1 text-sm hover:bg-neutral-50"
          >
            Ver carta ↗
          </Link>
        )}
        <form action={accion}>
          <input type="hidden" name="publicar" value={String(!props.publicada)} />
          <button
            type="submit"
            disabled={enviando || (!props.publicada && props.totalPlatos === 0)}
            title={!props.publicada && props.totalPlatos === 0 ? "Añade al menos un plato antes de publicar" : undefined}
            className={
              props.publicada
                ? "rounded-md border border-neutral-300 bg-white px-3 py-1 text-sm hover:bg-neutral-50 disabled:opacity-60"
                : "rounded-md bg-green-700 px-3 py-1 text-sm font-semibold text-white disabled:opacity-50"
            }
          >
            {enviando ? "…" : props.publicada ? "Retirar carta" : "Publicar carta"}
          </button>
        </form>
      </div>
    </div>
  );
}
