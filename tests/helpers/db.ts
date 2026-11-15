import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "supabase");

/**
 * Arranca un Postgres real en memoria (PGlite), carga el stub mínimo de
 * Supabase y aplica todas las migraciones en orden.
 */
export async function crearBaseDeDatos(): Promise<PGlite> {
  const db = await PGlite.create();
  await db.exec(readFileSync(join(RAIZ, "tests", "supabase_stub.sql"), "utf8"));

  const migraciones = readdirSync(join(RAIZ, "migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const archivo of migraciones) {
    await db.exec(readFileSync(join(RAIZ, "migrations", archivo), "utf8"));
  }
  return db;
}

export type Identidad = { tipo: "anon" } | { tipo: "usuario"; id: string };

export const ANONIMO: Identidad = { tipo: "anon" };
export const usuario = (id: string): Identidad => ({ tipo: "usuario", id });

/**
 * Ejecuta `fn` como lo haría Supabase con un JWT: cambia de rol y fija el
 * claim `sub`. Todo va en una transacción que se revierte o confirma según
 * `confirmar`, para que cada comprobación sea independiente si se quiere.
 */
export async function como<T>(
  db: PGlite,
  identidad: Identidad,
  fn: (tx: Pick<PGlite, "query" | "exec">) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    if (identidad.tipo === "anon") {
      await tx.exec(`set local role anon; select set_config('request.jwt.claim.sub', '', true);`);
    } else {
      await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [identidad.id]);
      await tx.exec(`set local role authenticated;`);
    }
    return fn(tx);
  });
}

/** Crea usuarios en auth.users (como superusuario, igual que hace Supabase Auth). */
export async function crearUsuarios(db: PGlite, ...ids: string[]): Promise<void> {
  for (const id of ids) {
    await db.query(`insert into auth.users (id, email) values ($1, $2)`, [id, `${id}@test.local`]);
  }
}
