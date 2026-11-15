"use client";

import { useMemo, useState } from "react";
import { ALERGENOS, NOMBRE_ALERGENO, esAptoSin, type Alergeno } from "@/lib/domain/alergenos";
import { formatearPrecio } from "@/lib/domain/precio";
import type { CartaPublica, PlatoPublico } from "@/lib/domain/cartaPublica";

/**
 * Vista de la carta para el cliente, con el filtro "No puedo tomar…".
 * Es un componente de cliente porque el filtro cambia al instante, sin
 * volver al servidor. Los datos ya llegan filtrados por RLS.
 */
export function VistaCarta({ carta }: { carta: CartaPublica }) {
  const [excluidos, setExcluidos] = useState<Alergeno[]>([]);
  const [filtroAbierto, setFiltroAbierto] = useState(false);

  const categorias = useMemo(
    () =>
      excluidos.length === 0
        ? carta.categorias
        : carta.categorias
            .map((c) => ({ ...c, platos: c.platos.filter((p) => esAptoSin(p.alergenos, excluidos)) }))
            .filter((c) => c.platos.length > 0),
    [carta, excluidos],
  );

  const totalPlatos = carta.categorias.reduce((n, c) => n + c.platos.length, 0);
  const visibles = categorias.reduce((n, c) => n + c.platos.length, 0);

  const alternar = (a: Alergeno) =>
    setExcluidos((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 bg-white pb-16">
      <header className="px-5 pt-8 pb-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">Carta</p>
        <h1 className="text-3xl font-bold tracking-tight">{carta.restaurante.nombre}</h1>
      </header>

      {/* Barra fija: categorías + filtro */}
      <div className="sticky top-0 z-10 border-y border-neutral-200 bg-white/95 backdrop-blur">
        {categorias.length > 1 && (
          <nav aria-label="Categorías" className="flex gap-2 overflow-x-auto px-5 py-2">
            {categorias.map((c) => (
              <a
                key={c.id}
                href={`#cat-${c.id}`}
                className="shrink-0 rounded-full border border-neutral-300 px-3 py-1 text-sm whitespace-nowrap hover:bg-neutral-100"
              >
                {c.nombre}
              </a>
            ))}
          </nav>
        )}
        <div className="px-5 py-2">
          <button
            type="button"
            onClick={() => setFiltroAbierto((v) => !v)}
            aria-expanded={filtroAbierto}
            className="text-sm font-medium underline underline-offset-4"
          >
            {excluidos.length
              ? `Sin: ${excluidos.map((a) => NOMBRE_ALERGENO[a]).join(", ")} (${visibles} de ${totalPlatos} platos)`
              : "¿Tienes alguna alergia? Filtra la carta"}
          </button>

          {filtroAbierto && (
            <fieldset className="mt-3 pb-1">
              <legend className="mb-2 text-sm text-neutral-600">
                Marca lo que <strong>no puedes tomar</strong> y ocultaremos los platos que lo contienen.
              </legend>
              <div className="flex flex-wrap gap-2">
                {ALERGENOS.map((a) => {
                  const activo = excluidos.includes(a);
                  return (
                    <button
                      key={a}
                      type="button"
                      aria-pressed={activo}
                      onClick={() => alternar(a)}
                      className={`rounded-full border px-3 py-1 text-sm ${
                        activo ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300"
                      }`}
                    >
                      {NOMBRE_ALERGENO[a]}
                    </button>
                  );
                })}
              </div>
              {excluidos.length > 0 && (
                <button type="button" onClick={() => setExcluidos([])} className="mt-3 text-sm underline">
                  Quitar filtro
                </button>
              )}
            </fieldset>
          )}
        </div>
      </div>

      <main className="px-5">
        {categorias.length === 0 ? (
          <p className="py-10 text-center text-neutral-600">
            {totalPlatos === 0
              ? "La carta todavía está vacía."
              : "Ningún plato revisado cumple el filtro. Pregunta al personal: te ayudarán con alternativas."}
          </p>
        ) : (
          categorias.map((c) => (
            <section key={c.id} id={`cat-${c.id}`} className="scroll-mt-28 pt-8">
              <h2 className="text-xl font-bold">{c.nombre}</h2>
              <ul className="mt-2 divide-y divide-neutral-100">
                {c.platos.map((p) => (
                  <Plato key={p.id} plato={p} />
                ))}
              </ul>
            </section>
          ))
        )}

        {excluidos.length > 0 && (
          <p className="mt-6 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            Con el filtro activo ocultamos también los platos cuyos alérgenos el restaurante aún no ha
            revisado.
          </p>
        )}

        <footer className="mt-10 border-t border-neutral-200 pt-4 text-xs text-neutral-500">
          Información sobre alérgenos (Reglamento UE 1169/2011) facilitada por el restaurante. Ante
          cualquier duda, consulta al personal.
        </footer>
      </main>
    </div>
  );
}

function Plato({ plato }: { plato: PlatoPublico }) {
  return (
    <li className="py-4">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="font-semibold">
          {plato.nombre}
          {plato.nuevo && (
            <span className="ml-2 rounded bg-yellow-300 px-1.5 py-0.5 align-middle text-[10px] font-bold">NUEVO</span>
          )}
        </h3>
        <span className="shrink-0 font-semibold tabular-nums">{formatearPrecio(plato.precioCentimos)}</span>
      </div>
      {plato.descripcion && <p className="mt-1 text-sm text-neutral-600">{plato.descripcion}</p>}
      {plato.variantes.length > 0 && (
        <ul className="mt-1 text-sm text-neutral-700">
          {plato.variantes.map((v) => (
            <li key={v.label} className="flex justify-between gap-4">
              <span>{v.label}</span>
              <span className="tabular-nums">{formatearPrecio(v.price_cents)}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 text-xs">
        {plato.alergenos.tipo === "sin_revisar" ? (
          <span className="text-neutral-500">Alérgenos: consulta al personal</span>
        ) : plato.alergenos.alergenos.length === 0 ? (
          <span className="text-green-800">Sin alérgenos declarados</span>
        ) : (
          <ul className="flex flex-wrap gap-1" aria-label="Alérgenos">
            {plato.alergenos.alergenos.map((a) => (
              <li key={a} className="rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-amber-900">
                {NOMBRE_ALERGENO[a]}
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}
