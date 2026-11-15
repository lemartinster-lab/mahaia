"use client";

export function BotonImprimir() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-semibold text-white"
    >
      Imprimir tarjeta
    </button>
  );
}
