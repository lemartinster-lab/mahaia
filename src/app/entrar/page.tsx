import type { Metadata } from "next";
import { Suspense } from "react";
import { FormularioEntrar } from "./FormularioEntrar";

export const metadata: Metadata = { title: "Entrar · Mahaia" };

export default function PaginaEntrar() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Mahaia</h1>
        <p className="mt-1 text-neutral-600">Entra para gestionar la carta de tu restaurante.</p>
      </div>
      {/* useSearchParams depende de la petición: va dentro de Suspense */}
      <Suspense fallback={<p className="text-sm text-neutral-500">Cargando…</p>}>
        <FormularioEntrar />
      </Suspense>
    </main>
  );
}
