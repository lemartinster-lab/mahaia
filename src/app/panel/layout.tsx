import Link from "next/link";
import { Suspense } from "react";
import { obtenerRestaurante, obtenerSesion } from "@/lib/datos/sesion";
import { salir } from "@/lib/acciones/auth";

export default function LayoutPanel({ children }: LayoutProps<"/panel">) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/panel" className="text-lg font-bold tracking-tight">
            Mahaia
          </Link>
          {/* Datos de la sesión: dependen de la petición → Suspense */}
          <Suspense fallback={null}>
            <DatosCabecera />
          </Suspense>
        </div>
      </header>
      <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">{children}</div>
    </div>
  );
}

async function DatosCabecera() {
  const sesion = await obtenerSesion();
  if (!sesion) return null;
  const ctx = await obtenerRestaurante(sesion);

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="hidden text-neutral-600 sm:inline">
        {ctx ? <strong className="text-neutral-900">{ctx.restaurante.name}</strong> : null}
        {ctx ? " · " : null}
        {sesion.email}
      </span>
      <form action={salir}>
        <button type="submit" className="rounded-md border border-neutral-300 px-3 py-1 hover:bg-neutral-50">
          Salir
        </button>
      </form>
    </div>
  );
}
