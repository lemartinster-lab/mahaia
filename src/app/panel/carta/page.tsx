import type { Metadata } from "next";
import { Suspense } from "react";
import { exigirRestaurante } from "@/lib/datos/sesion";
import { cargarCartaPanel, type PlatoPanel } from "@/lib/datos/carta";
import { formatearPrecio } from "@/lib/domain/precio";
import { infoAlergenosPublica, NOMBRE_ALERGENO } from "@/lib/domain/alergenos";
import {
  BotonDisponible,
  CabeceraCategoria,
  ChecklistAlergenos,
  FormularioPlato,
  NuevaCategoria,
} from "./componentes";

export const metadata: Metadata = { title: "Carta · Mahaia" };

export default function PaginaCarta() {
  return (
    <section>
      <h1 className="text-2xl font-bold">Tu carta</h1>
      <Suspense fallback={<p className="mt-6 text-neutral-500">Cargando la carta…</p>}>
        <Contenido />
      </Suspense>
    </section>
  );
}

async function Contenido() {
  const ctx = await exigirRestaurante();
  const carta = await cargarCartaPanel(ctx);
  const opciones = carta.categorias.map((c) => ({ id: c.id, nombre: c.name }));
  const total = carta.categorias.reduce((n, c) => n + c.platos.length, carta.sinCategoria.length);

  return (
    <div className="mt-4 flex flex-col gap-8">
      <p className="text-sm text-neutral-600">
        {total === 0
          ? "Empieza creando una categoría (por ejemplo «Entrantes» o «Ramen») y añade tus platos."
          : `${total} plato(s) en ${carta.categorias.length} categoría(s).`}
      </p>

      {carta.categorias.map((cat, i) => (
        <article key={cat.id} className="rounded-xl border border-neutral-200 bg-white">
          <CabeceraCategoria
            id={cat.id}
            nombre={cat.name}
            esPrimera={i === 0}
            esUltima={i === carta.categorias.length - 1}
            numPlatos={cat.platos.length}
          />
          <ListaPlatos platos={cat.platos} categorias={opciones} />
          <div className="border-t border-neutral-100 p-4">
            <FormularioPlato categorias={opciones} categoriaPorDefecto={cat.id} />
          </div>
        </article>
      ))}

      {carta.sinCategoria.length > 0 && (
        <article className="rounded-xl border border-dashed border-neutral-300 bg-white">
          <h2 className="p-4 font-semibold text-neutral-600">Sin categoría</h2>
          <ListaPlatos platos={carta.sinCategoria} categorias={opciones} />
        </article>
      )}

      <NuevaCategoria />
    </div>
  );
}

function ListaPlatos({
  platos,
  categorias,
}: {
  platos: PlatoPanel[];
  categorias: { id: string; nombre: string }[];
}) {
  if (platos.length === 0) {
    return <p className="px-4 pb-2 text-sm text-neutral-500">Todavía no hay platos aquí.</p>;
  }
  return (
    <ul className="divide-y divide-neutral-100">
      {platos.map((p) => {
        const info = infoAlergenosPublica(p.allergens_reviewed_at, p.alergenos);
        return (
          <li key={p.id} className={`p-4 ${p.is_available ? "" : "opacity-60"}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold">
                  {p.name}
                  {p.is_new && (
                    <span className="ml-2 rounded bg-yellow-300 px-1.5 py-0.5 text-xs font-bold">NUEVO</span>
                  )}
                  {!p.is_available && (
                    <span className="ml-2 rounded bg-neutral-200 px-1.5 py-0.5 text-xs">Agotado</span>
                  )}
                </p>
                {p.description && <p className="text-sm text-neutral-600">{p.description}</p>}
                <p className="mt-1 text-sm">
                  {formatearPrecio(p.price_cents)}
                  {p.variants.map((v) => (
                    <span key={v.label} className="text-neutral-600">
                      {" "}
                      · {v.label} {formatearPrecio(v.price_cents)}
                    </span>
                  ))}
                </p>
                <p className="mt-1 text-xs">
                  {info.tipo === "sin_revisar" ? (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-900">
                      ⚠ Alérgenos sin revisar · la carta dirá «Consulta al personal»
                    </span>
                  ) : info.alergenos.length === 0 ? (
                    <span className="text-green-800">✓ Revisado: sin alérgenos</span>
                  ) : (
                    <span className="text-green-800">
                      ✓ {info.alergenos.map((a) => NOMBRE_ALERGENO[a]).join(", ")}
                    </span>
                  )}
                </p>
              </div>
              <BotonDisponible id={p.id} disponible={p.is_available} />
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <FormularioPlato categorias={categorias} plato={p} />
              <ChecklistAlergenos
                platoId={p.id}
                marcados={p.alergenos.map((a) => a.allergen)}
                revisado={p.allergens_reviewed_at !== null}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
