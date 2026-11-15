"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  alternarDisponible,
  borrarCategoria,
  borrarPlato,
  crearCategoria,
  guardarAlergenos,
  guardarPlato,
  moverCategoria,
  renombrarCategoria,
} from "@/lib/acciones/panel";
import { ESTADO_INICIAL, type EstadoAccion } from "@/lib/acciones/estado";
import { ALERGENOS, NOMBRE_ALERGENO, type Alergeno } from "@/lib/domain/alergenos";
import type { PlatoPanel } from "@/lib/datos/carta";

const boton = "rounded-md border border-neutral-300 px-3 py-1 text-sm hover:bg-neutral-50 disabled:opacity-60";
const botonPrincipal =
  "rounded-md bg-neutral-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60";
const campo = "rounded-md border border-neutral-300 px-3 py-2";

function Aviso({ estado }: { estado: EstadoAccion }) {
  if (estado.error) return <p className="text-sm text-red-700" role="alert">{estado.error}</p>;
  if (estado.ok && estado.mensaje) return <p className="text-sm text-green-800" role="status">{estado.mensaje}</p>;
  return null;
}

/**
 * Cierra el panel desplegable cuando LLEGA un resultado correcto nuevo.
 * Depende solo de `estado` (cada respuesta es un objeto nuevo), así que
 * volver a abrir el formulario después no lo cierra de inmediato.
 */
function useCerrarAlTerminar(estado: EstadoAccion, cerrar: () => void) {
  const cerrarRef = useRef(cerrar);
  useEffect(() => {
    cerrarRef.current = cerrar;
  });
  useEffect(() => {
    if (estado.ok) cerrarRef.current();
  }, [estado]);
}

// ---------------------------------------------------------------------
// Categorías
// ---------------------------------------------------------------------
export function NuevaCategoria() {
  const [estado, accion, enviando] = useActionState(crearCategoria, ESTADO_INICIAL);
  return (
    <form action={accion} className="flex flex-col gap-2 rounded-xl border border-dashed border-neutral-300 p-4">
      <label htmlFor="nueva-categoria" className="font-semibold">
        Nueva categoría
      </label>
      <div className="flex gap-2">
        <input id="nueva-categoria" name="nombre" required maxLength={80} placeholder="Ramen" className={`${campo} flex-1`} />
        <button type="submit" disabled={enviando} className={botonPrincipal}>
          Añadir
        </button>
      </div>
      <Aviso estado={estado} />
    </form>
  );
}

export function CabeceraCategoria(props: {
  id: string;
  nombre: string;
  esPrimera: boolean;
  esUltima: boolean;
  numPlatos: number;
}) {
  const [editando, setEditando] = useState(false);
  const [estado, accion, enviando] = useActionState(renombrarCategoria, ESTADO_INICIAL);
  useCerrarAlTerminar(estado, () => setEditando(false));

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 p-4">
      {editando ? (
        <form action={accion} className="flex flex-1 gap-2">
          <input type="hidden" name="id" value={props.id} />
          <input name="nombre" defaultValue={props.nombre} required maxLength={80} className={`${campo} flex-1`} aria-label="Nombre de la categoría" />
          <button type="submit" disabled={enviando} className={boton}>Guardar</button>
          <button type="button" onClick={() => setEditando(false)} className={boton}>Cancelar</button>
          <Aviso estado={estado} />
        </form>
      ) : (
        <h2 className="text-lg font-semibold">{props.nombre}</h2>
      )}
      {!editando && (
        <div className="flex gap-1">
          <form action={moverCategoria}>
            <input type="hidden" name="id" value={props.id} />
            <input type="hidden" name="direccion" value="arriba" />
            <button type="submit" disabled={props.esPrimera} className={boton} aria-label="Subir categoría">↑</button>
          </form>
          <form action={moverCategoria}>
            <input type="hidden" name="id" value={props.id} />
            <input type="hidden" name="direccion" value="abajo" />
            <button type="submit" disabled={props.esUltima} className={boton} aria-label="Bajar categoría">↓</button>
          </form>
          <button type="button" onClick={() => setEditando(true)} className={boton}>Renombrar</button>
          <BotonBorrar
            accion={borrarCategoria}
            id={props.id}
            texto="Borrar"
            pregunta={props.numPlatos ? `¿Borrar? Sus ${props.numPlatos} plato(s) quedarán sin categoría` : "¿Borrar?"}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Platos
// ---------------------------------------------------------------------
const aTexto = (c: number) => (c / 100).toFixed(2).replace(".", ",");

export function FormularioPlato(props: {
  categorias: { id: string; nombre: string }[];
  categoriaPorDefecto?: string;
  plato?: PlatoPanel;
}) {
  const { plato } = props;
  const [abierto, setAbierto] = useState(false);
  const [estado, accion, enviando] = useActionState(guardarPlato, ESTADO_INICIAL);
  useCerrarAlTerminar(estado, () => setAbierto(false));

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className={plato ? boton : botonPrincipal}>
        {plato ? "Editar" : "+ Añadir plato"}
      </button>
    );
  }

  return (
    <form action={accion} className="flex w-full flex-col gap-3 rounded-lg bg-neutral-50 p-4">
      {plato && <input type="hidden" name="id" value={plato.id} />}
      <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Nombre
          <input name="nombre" required maxLength={120} defaultValue={plato?.name} className={campo} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Precio (€)
          <input
            name="precio"
            required
            inputMode="decimal"
            placeholder="15,95"
            defaultValue={plato ? aTexto(plato.price_cents) : ""}
            className={campo}
          />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Descripción <span className="font-normal text-neutral-500">(opcional)</span>
        <textarea name="descripcion" maxLength={600} rows={2} defaultValue={plato?.description ?? ""} className={campo} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Variantes <span className="font-normal text-neutral-500">(opcional · una por línea: «Nombre | precio»)</span>
        <textarea
          name="variantes"
          rows={2}
          placeholder={"Doble ternera | 19,95\nXL | 20,95"}
          defaultValue={plato?.variants.map((v) => `${v.label} | ${aTexto(v.price_cents)}`).join("\n")}
          className={`${campo} font-mono text-sm`}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Categoría
        <select name="categoria" defaultValue={plato ? (plato.category_id ?? "") : props.categoriaPorDefecto} className={campo}>
          <option value="">Sin categoría</option>
          {props.categorias.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
      </label>
      <div className="flex gap-6 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="disponible" defaultChecked={plato?.is_available ?? true} /> Disponible
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="nuevo" defaultChecked={plato?.is_new ?? false} /> Marcar como «nuevo»
        </label>
      </div>
      <Aviso estado={estado} />
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={enviando} className={botonPrincipal}>
          {enviando ? "Guardando…" : plato ? "Guardar cambios" : "Añadir plato"}
        </button>
        <button type="button" onClick={() => setAbierto(false)} className={boton}>Cancelar</button>
        {plato && <BotonBorrar accion={borrarPlato} id={plato.id} texto="Borrar plato" pregunta="¿Borrar este plato?" />}
      </div>
    </form>
  );
}

export function BotonDisponible({ id, disponible }: { id: string; disponible: boolean }) {
  return (
    <form action={alternarDisponible}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="disponible" value={String(!disponible)} />
      <button type="submit" className={boton}>{disponible ? "Marcar agotado" : "Volver a ofrecer"}</button>
    </form>
  );
}

// ---------------------------------------------------------------------
// Alérgenos
// ---------------------------------------------------------------------
export function ChecklistAlergenos(props: { platoId: string; marcados: Alergeno[]; revisado: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion, enviando] = useActionState(guardarAlergenos, ESTADO_INICIAL);
  useCerrarAlTerminar(estado, () => setAbierto(false));

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className={boton}>
        {props.revisado ? "Revisar alérgenos" : "⚠ Revisar alérgenos"}
      </button>
    );
  }

  return (
    <form action={accion} className="flex w-full flex-col gap-3 rounded-lg bg-amber-50 p-4">
      <input type="hidden" name="id" value={props.platoId} />
      <p className="text-sm">
        Marca <strong>todos</strong> los alérgenos que contiene este plato (también como trazas). Al guardar,
        quedarán confirmados a tu nombre con la fecha de hoy.
      </p>
      <fieldset className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <legend className="sr-only">Alérgenos</legend>
        {ALERGENOS.map((a) => (
          <label key={a} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="alergeno" value={a} defaultChecked={props.marcados.includes(a)} />
            {NOMBRE_ALERGENO[a]}
          </label>
        ))}
      </fieldset>
      <Aviso estado={estado} />
      <div className="flex gap-2">
        <button type="submit" disabled={enviando} className={botonPrincipal}>
          {enviando ? "Guardando…" : "Confirmar alérgenos"}
        </button>
        <button type="button" onClick={() => setAbierto(false)} className={boton}>Cancelar</button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------
// Borrado en dos pasos (sin diálogos del navegador)
// ---------------------------------------------------------------------
function BotonBorrar(props: {
  accion: (fd: FormData) => Promise<void>;
  id: string;
  texto: string;
  pregunta: string;
}) {
  const [confirmando, setConfirmando] = useState(false);
  if (!confirmando) {
    return (
      <button type="button" onClick={() => setConfirmando(true)} className={`${boton} text-red-700`}>
        {props.texto}
      </button>
    );
  }
  return (
    <form action={props.accion} className="flex items-center gap-2">
      <input type="hidden" name="id" value={props.id} />
      <span className="text-sm text-red-700">{props.pregunta}</span>
      <button type="submit" className="rounded-md bg-red-700 px-3 py-1 text-sm text-white">Sí, borrar</button>
      <button type="button" onClick={() => setConfirmando(false)} className={boton}>No</button>
    </form>
  );
}
