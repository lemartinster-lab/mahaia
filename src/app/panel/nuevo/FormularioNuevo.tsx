"use client";

import { useActionState, useState } from "react";
import { crearRestaurante } from "@/lib/acciones/panel";
import { ESTADO_INICIAL } from "@/lib/acciones/estado";
import { generarSlug } from "@/lib/domain/slug";

export function FormularioNuevo() {
  const [estado, accion, enviando] = useActionState(crearRestaurante, ESTADO_INICIAL);
  const [nombre, setNombre] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTocado, setSlugTocado] = useState(false);

  const slugMostrado = slugTocado ? slug : generarSlug(nombre);

  return (
    <form action={accion} className="mt-6 flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="nombre" className="text-sm font-medium">
          Nombre del restaurante
        </label>
        <input
          id="nombre"
          name="nombre"
          required
          maxLength={120}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Taberna Beñat"
          className="rounded-md border border-neutral-300 px-3 py-2"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="slug" className="text-sm font-medium">
          Dirección de tu carta
        </label>
        <div className="flex items-center rounded-md border border-neutral-300">
          <span className="pl-3 text-sm text-neutral-500">mahaia…/r/</span>
          <input
            id="slug"
            name="slug"
            value={slugMostrado}
            onChange={(e) => {
              setSlugTocado(true);
              setSlug(e.target.value);
            }}
            className="min-w-0 flex-1 rounded-md px-1 py-2"
          />
        </div>
        <p className="text-xs text-neutral-500">Es la que llevará el QR de tus mesas.</p>
      </div>

      {estado.error && (
        <p className="text-sm text-red-700" role="alert">
          {estado.error}
        </p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="rounded-md bg-neutral-900 px-4 py-2 font-semibold text-white disabled:opacity-60"
      >
        {enviando ? "Creando…" : "Crear restaurante"}
      </button>
    </form>
  );
}
