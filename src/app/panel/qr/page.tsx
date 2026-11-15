import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import QRCode from "qrcode";
import { exigirRestaurante } from "@/lib/datos/sesion";
import { origenDelSitio } from "@/lib/datos/origen";
import { BotonImprimir } from "./BotonImprimir";

export const metadata: Metadata = { title: "Código QR · Mahaia" };

export default function PaginaQR() {
  return (
    <section>
      <div className="print:hidden">
        <Link href="/panel/carta" className="text-sm underline">
          ← Volver a la carta
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Código QR de tu carta</h1>
      </div>
      <Suspense fallback={<p className="mt-6 text-neutral-500">Generando el código…</p>}>
        <Contenido />
      </Suspense>
    </section>
  );
}

async function Contenido() {
  const { restaurante } = await exigirRestaurante();
  const url = `${await origenDelSitio()}/r/${restaurante.slug}`;
  const local = /localhost|127\.0\.0\.1/.test(url);

  // Corrección de errores "M": aguanta manchas o arañazos en la pegatina
  const opciones = { errorCorrectionLevel: "M" as const, margin: 2 };
  const svg = await QRCode.toString(url, { ...opciones, type: "svg" });
  const png = await QRCode.toDataURL(url, { ...opciones, width: 1024 });
  const svgDescarga = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

  return (
    <div className="mt-6 flex flex-col gap-6">
      {/* Avisos (no se imprimen) */}
      <div className="flex flex-col gap-3 print:hidden">
        {!restaurante.is_published && (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            ⚠ Tu carta está en <strong>borrador</strong>: quien escanee el código verá «Carta no disponible»
            hasta que la publiques desde la página de la carta.
          </p>
        )}
        {local && (
          <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">
            ℹ Estás en modo local: este código apunta a <span className="font-mono">{url}</span>, que solo
            funciona en este ordenador. Cuando la app esté publicada en Internet, el código apuntará a la
            dirección definitiva. No lo imprimas todavía.
          </p>
        )}
      </div>

      {/* Tarjeta imprimible */}
      <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-3 rounded-2xl border-2 border-neutral-900 p-6 text-center print:max-w-none print:border-0">
        <p className="text-2xl font-bold">{restaurante.name}</p>
        <div
          className="w-full max-w-[16rem] [&>svg]:h-auto [&>svg]:w-full"
          role="img"
          aria-label={`Código QR que abre ${url}`}
          // SVG generado por la librería qrcode a partir de nuestra propia URL
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <p className="text-lg font-semibold">Escanea para ver la carta</p>
        <p className="text-sm text-neutral-600">Alérgenos y precios siempre al día</p>
        <p className="font-mono text-xs break-all text-neutral-500">{url}</p>
      </div>

      <div className="flex flex-wrap justify-center gap-2 print:hidden">
        <BotonImprimir />
        <a
          href={png}
          download={`qr-${restaurante.slug}.png`}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50"
        >
          Descargar PNG
        </a>
        <a
          href={svgDescarga}
          download={`qr-${restaurante.slug}.svg`}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50"
        >
          Descargar SVG (imprenta)
        </a>
      </div>
      <p className="text-center text-xs text-neutral-500 print:hidden">
        Consejo: en «Imprimir» elige «Guardar como PDF» para tener la tarjeta en PDF.
      </p>
    </div>
  );
}
