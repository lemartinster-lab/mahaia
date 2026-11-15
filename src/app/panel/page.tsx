import { Suspense } from "react";
import { redirect } from "next/navigation";
import { exigirRestaurante } from "@/lib/datos/sesion";

/** /panel → a la carta (o a crear el restaurante si aún no hay). */
export default function InicioPanel() {
  return (
    <Suspense fallback={<p className="text-neutral-500">Cargando…</p>}>
      <Redirigir />
    </Suspense>
  );
}

async function Redirigir(): Promise<null> {
  await exigirRestaurante(); // sin restaurante → /panel/nuevo
  redirect("/panel/carta");
}
