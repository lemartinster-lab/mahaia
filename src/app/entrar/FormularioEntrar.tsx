"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { enviarEnlace, type EstadoEnlace } from "@/lib/acciones/auth";

const inicial: EstadoEnlace = { estado: "inicial" };

export function FormularioEntrar() {
  const [estado, accion, enviando] = useActionState(enviarEnlace, inicial);
  const errorEnlace = useSearchParams().get("error") === "enlace";

  if (estado.estado === "enviado") {
    return (
      <div className="rounded-lg border border-green-300 bg-green-50 p-4 text-green-900" role="status">
        <p className="font-semibold">Revisa tu correo</p>
        <p className="mt-1 text-sm">
          Te hemos enviado un enlace de acceso a <strong>{estado.mensaje}</strong>. Ábrelo en este
          mismo navegador. Si no lo ves, mira en la carpeta de spam.
        </p>
      </div>
    );
  }

  return (
    <form action={accion} className="flex flex-col gap-3">
      {errorEnlace && estado.estado === "inicial" && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900" role="alert">
          El enlace ha caducado o ya se usó. Pide uno nuevo.
        </p>
      )}
      <label htmlFor="email" className="text-sm font-medium">
        Tu email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="tu@restaurante.com"
        className="rounded-md border border-neutral-300 px-3 py-2 text-base"
      />
      {estado.estado === "error" && (
        <p className="text-sm text-red-700" role="alert">
          {estado.mensaje}
        </p>
      )}
      <button
        type="submit"
        disabled={enviando}
        className="rounded-md bg-neutral-900 px-4 py-2 font-semibold text-white disabled:opacity-60"
      >
        {enviando ? "Enviando…" : "Enviarme el enlace de acceso"}
      </button>
      <p className="text-xs text-neutral-500">
        Sin contraseñas: te llega un enlace al correo y con él entras.
      </p>
    </form>
  );
}
