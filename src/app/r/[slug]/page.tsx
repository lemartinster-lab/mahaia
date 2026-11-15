import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { cargarCartaPublica } from "@/lib/datos/cartaPublica";
import { VistaCarta } from "./VistaCarta";

export const metadata: Metadata = { title: "Carta" };

/**
 * Carta pública de un restaurante: /r/<slug>.
 * Los params dependen de la URL, así que se leen dentro de Suspense.
 */
export default function PaginaCartaPublica({ params }: PageProps<"/r/[slug]">) {
  return (
    <Suspense fallback={<p className="p-6 text-center text-neutral-500">Cargando la carta…</p>}>
      <Carta params={params} />
    </Suspense>
  );
}

async function Carta({ params }: { params: PageProps<"/r/[slug]">["params"] }) {
  const { slug } = await params;
  const carta = await cargarCartaPublica(slug);
  if (!carta) notFound();
  return <VistaCarta carta={carta} />;
}
