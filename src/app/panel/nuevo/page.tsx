import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { exigirSesion, obtenerRestaurante } from "@/lib/datos/sesion";
import { FormularioNuevo } from "./FormularioNuevo";

export const metadata: Metadata = { title: "Nuevo restaurante · Mahaia" };

export default function PaginaNuevo() {
  return (
    <section className="mx-auto max-w-md">
      <h1 className="text-2xl font-bold">Da de alta tu restaurante</h1>
      <p className="mt-1 text-neutral-600">
        Solo necesitamos el nombre. Lo demás lo podrás cambiar más adelante.
      </p>
      <Suspense fallback={<p className="mt-6 text-neutral-500">Cargando…</p>}>
        <Contenido />
      </Suspense>
    </section>
  );
}

async function Contenido() {
  const sesion = await exigirSesion();
  if (await obtenerRestaurante(sesion)) redirect("/panel/carta");
  return <FormularioNuevo />;
}
