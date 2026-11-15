/**
 * Tests de aislamiento entre restaurantes (RLS).
 * Se ejecutan contra un Postgres real (PGlite) con el esquema de producción.
 */
import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { ANONIMO, como, crearBaseDeDatos, crearUsuarios, usuario } from "./helpers/db";

const ANA = "00000000-0000-4000-8000-00000000000a"; // dueña de "Ramen Ana"
const BEÑAT = "00000000-0000-4000-8000-00000000000b"; // dueño de "Taberna Beñat"
const IKER = "00000000-0000-4000-8000-00000000000c"; // empleado de Ana

let db: PGlite;
let restA: string;
let restB: string;
let platoA: string;
let platoOcultoA: string;
let platoB: string;
let categoriaB: string;

const filas = async <T>(
  p: Promise<{ rows: unknown[] }>,
): Promise<T[]> => (await p).rows as T[];

beforeAll(async () => {
  db = await crearBaseDeDatos();
  await crearUsuarios(db, ANA, BEÑAT, IKER);

  // Cada dueño crea su restaurante como usuario normal (pasa por RLS)
  restA = await como(db, usuario(ANA), async (tx) => {
    const r = await tx.query<{ id: string }>(
      `insert into restaurants (slug, name, languages, is_published)
       values ('ramen-ana', 'Ramen Ana', '{es,en,eu}', true) returning id`,
    );
    return r.rows[0].id;
  });

  restB = await como(db, usuario(BEÑAT), async (tx) => {
    const r = await tx.query<{ id: string }>(
      `insert into restaurants (slug, name) values ('taberna-benat', 'Taberna Beñat') returning id`,
    );
    return r.rows[0].id;
  });

  // Ana añade a Iker como empleado
  await como(db, usuario(ANA), (tx) =>
    tx.query(`insert into members (restaurant_id, user_id, role) values ($1, $2, 'staff')`, [restA, IKER]),
  );

  [platoA, platoOcultoA] = await como(db, usuario(ANA), async (tx) => {
    const a = await tx.query<{ id: string }>(
      `insert into dishes (restaurant_id, name, price_cents) values ($1, 'Sukiyaki miso', 1595) returning id`,
      [restA],
    );
    const b = await tx.query<{ id: string }>(
      `insert into dishes (restaurant_id, name, price_cents, is_available)
       values ($1, 'Plato agotado', 900, false) returning id`,
      [restA],
    );
    // Un alérgeno confirmado y otro solo sugerido por la IA
    await tx.query(
      `insert into dish_allergens (restaurant_id, dish_id, allergen, status, source, confirmed_by, confirmed_at)
       values ($1, $2, 'gluten', 'confirmed', 'manual', $3, now())`,
      [restA, a.rows[0].id, ANA],
    );
    await tx.query(
      `insert into dish_allergens (restaurant_id, dish_id, allergen, status, source)
       values ($1, $2, 'soja', 'suggested', 'ai')`,
      [restA, a.rows[0].id],
    );
    await tx.query(
      `insert into dish_translations (restaurant_id, dish_id, language, name)
       values ($1, $2, 'eu', 'Sukiyaki misoa')`,
      [restA, a.rows[0].id],
    );
    return [a.rows[0].id, b.rows[0].id];
  });

  [platoB, categoriaB] = await como(db, usuario(BEÑAT), async (tx) => {
    const c = await tx.query<{ id: string }>(
      `insert into categories (restaurant_id, name) values ($1, 'Pintxos') returning id`,
      [restB],
    );
    const d = await tx.query<{ id: string }>(
      `insert into dishes (restaurant_id, category_id, name, price_cents)
       values ($1, $2, 'Gilda', 250) returning id`,
      [restB, c.rows[0].id],
    );
    return [d.rows[0].id, c.rows[0].id];
  });
});

describe("alta de restaurante", () => {
  it("el creador queda como propietario automáticamente", async () => {
    const m = await filas<{ role: string }>(
      db.query(`select role from members where restaurant_id = $1 and user_id = $2`, [restA, ANA]),
    );
    expect(m).toEqual([{ role: "owner" }]);
  });

  it("no se puede crear un restaurante a nombre de otro usuario", async () => {
    await expect(
      como(db, usuario(BEÑAT), (tx) =>
        tx.query(`insert into restaurants (slug, name, created_by) values ('falso', 'Falso', $1)`, [ANA]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("el anónimo no puede crear restaurantes", async () => {
    await expect(
      como(db, ANONIMO, (tx) => tx.query(`insert into restaurants (slug, name) values ('anon', 'Anon')`)),
    ).rejects.toThrow();
  });
});

describe("aislamiento entre restaurantes", () => {
  it("Beñat no ve los platos ocultos de Ana ni sus alérgenos sugeridos", async () => {
    const platos = await como(db, usuario(BEÑAT), (tx) =>
      filas<{ name: string }>(tx.query(`select name from dishes where restaurant_id = $1`, [restA])),
    );
    // Solo lo que vería cualquier cliente: el plato disponible
    expect(platos.map((p) => p.name)).toEqual(["Sukiyaki miso"]);

    const alergenos = await como(db, usuario(BEÑAT), (tx) =>
      filas<{ allergen: string }>(tx.query(`select allergen from dish_allergens where dish_id = $1`, [platoA])),
    );
    expect(alergenos.map((a) => a.allergen)).toEqual(["gluten"]);
  });

  it("Beñat no puede modificar ni borrar platos de Ana", async () => {
    await como(db, usuario(BEÑAT), async (tx) => {
      const upd = await tx.query(`update dishes set price_cents = 1 where id = $1`, [platoA]);
      const del = await tx.query(`delete from dishes where id = $1`, [platoA]);
      expect(upd.affectedRows).toBe(0);
      expect(del.affectedRows).toBe(0);
    });
    const precio = await filas<{ price_cents: number }>(
      db.query(`select price_cents from dishes where id = $1`, [platoA]),
    );
    expect(precio[0].price_cents).toBe(1595);
  });

  it("Beñat no puede insertar platos en el restaurante de Ana", async () => {
    await expect(
      como(db, usuario(BEÑAT), (tx) =>
        tx.query(`insert into dishes (restaurant_id, name, price_cents) values ($1, 'Intruso', 100)`, [restA]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("Beñat no puede mover su plato al restaurante de Ana", async () => {
    await expect(
      como(db, usuario(BEÑAT), (tx) =>
        tx.query(`update dishes set restaurant_id = $1 where id = $2`, [restA, platoB]),
      ),
    ).rejects.toThrow();
  });

  it("Ana no puede usar una categoría de Beñat en su plato", async () => {
    await expect(
      como(db, usuario(ANA), (tx) =>
        tx.query(`update dishes set category_id = $1 where id = $2`, [categoriaB, platoA]),
      ),
    ).rejects.toThrow(/foreign key/);
  });

  it("Ana no puede colgar alérgenos de un plato de Beñat declarándolos como suyos", async () => {
    await expect(
      como(db, usuario(ANA), (tx) =>
        tx.query(
          `insert into dish_allergens (restaurant_id, dish_id, allergen) values ($1, $2, 'huevos')`,
          [restA, platoB],
        ),
      ),
    ).rejects.toThrow(/foreign key/);
  });

  it("Beñat no ve al equipo de Ana", async () => {
    const equipo = await como(db, usuario(BEÑAT), (tx) =>
      filas(tx.query(`select * from members where restaurant_id = $1`, [restA])),
    );
    expect(equipo).toHaveLength(0);
  });

  it("Beñat no puede añadirse como miembro del restaurante de Ana", async () => {
    await expect(
      como(db, usuario(BEÑAT), (tx) =>
        tx.query(`insert into members (restaurant_id, user_id, role) values ($1, $2, 'owner')`, [restA, BEÑAT]),
      ),
    ).rejects.toThrow(/row-level security/);
  });
});

describe("carta pública (anónimo)", () => {
  it("ve el restaurante publicado pero no el no publicado", async () => {
    const r = await como(db, ANONIMO, (tx) => filas<{ slug: string }>(tx.query(`select slug from restaurants`)));
    expect(r.map((x) => x.slug)).toEqual(["ramen-ana"]);
  });

  it("no ve ningún plato de un restaurante sin publicar", async () => {
    const p = await como(db, ANONIMO, (tx) =>
      filas(tx.query(`select * from dishes where restaurant_id = $1`, [restB])),
    );
    expect(p).toHaveLength(0);
  });

  it("no ve platos no disponibles", async () => {
    const p = await como(db, ANONIMO, (tx) => filas(tx.query(`select * from dishes where id = $1`, [platoOcultoA])));
    expect(p).toHaveLength(0);
  });

  it("solo ve alérgenos confirmados, nunca los sugeridos por la IA", async () => {
    const a = await como(db, ANONIMO, (tx) =>
      filas<{ allergen: string; status: string }>(
        tx.query(`select allergen, status from dish_allergens where dish_id = $1`, [platoA]),
      ),
    );
    expect(a).toEqual([{ allergen: "gluten", status: "confirmed" }]);
  });

  it("ve las traducciones de la carta publicada", async () => {
    const t = await como(db, ANONIMO, (tx) =>
      filas<{ name: string }>(tx.query(`select name from dish_translations where dish_id = $1`, [platoA])),
    );
    expect(t).toEqual([{ name: "Sukiyaki misoa" }]);
  });

  it("no puede leer las importaciones ni el equipo", async () => {
    await expect(como(db, ANONIMO, (tx) => tx.query(`select * from menu_imports`))).rejects.toThrow(
      /permission denied/,
    );
    await expect(como(db, ANONIMO, (tx) => tx.query(`select * from members`))).rejects.toThrow(
      /permission denied/,
    );
  });

  it("no puede modificar nada", async () => {
    await expect(
      como(db, ANONIMO, (tx) => tx.query(`update dishes set price_cents = 0 where id = $1`, [platoA])),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("empleados y propietarios", () => {
  it("un empleado gestiona platos de su restaurante", async () => {
    await como(db, usuario(IKER), async (tx) => {
      const r = await tx.query(`update dishes set is_new = true where id = $1`, [platoA]);
      expect(r.affectedRows).toBe(1);
    });
  });

  it("un empleado NO puede cambiar los datos del restaurante ni el equipo", async () => {
    await como(db, usuario(IKER), async (tx) => {
      const r = await tx.query(`update restaurants set name = 'Hackeado' where id = $1`, [restA]);
      expect(r.affectedRows).toBe(0);
    });
    await expect(
      como(db, usuario(IKER), (tx) =>
        tx.query(`update members set role = 'owner' where restaurant_id = $1 and user_id = $2`, [restA, IKER]),
      ),
    ).resolves.toMatchObject({ affectedRows: 0 });
  });
});

describe("trazabilidad de alérgenos", () => {
  it("nadie puede confirmar un alérgeno en nombre de otra persona", async () => {
    await expect(
      como(db, usuario(IKER), (tx) =>
        tx.query(
          `insert into dish_allergens (restaurant_id, dish_id, allergen, status, confirmed_by, confirmed_at)
           values ($1, $2, 'huevos', 'confirmed', $3, now())`,
          [restA, platoA, ANA],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("un alérgeno confirmado exige responsable y fecha (RLS lo bloquea para usuarios)", async () => {
    await expect(
      como(db, usuario(ANA), (tx) =>
        tx.query(
          `insert into dish_allergens (restaurant_id, dish_id, allergen, status) values ($1, $2, 'apio', 'confirmed')`,
          [restA, platoA],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("…y el CHECK de la tabla lo bloquea incluso sin RLS (procesos internos)", async () => {
    // Como superusuario: RLS no aplica, solo queda la restricción de la tabla
    await expect(
      db.query(
        `insert into dish_allergens (restaurant_id, dish_id, allergen, status) values ($1, $2, 'apio', 'confirmed')`,
        [restA, platoA],
      ),
    ).rejects.toThrow(/confirmacion_trazable/);
  });

  it("confirmar con el propio usuario sí está permitido", async () => {
    await como(db, usuario(IKER), async (tx) => {
      const r = await tx.query(
        `update dish_allergens set status = 'confirmed', confirmed_by = $3, confirmed_at = now()
         where dish_id = $1 and allergen = 'soja' and restaurant_id = $2`,
        [platoA, restA, IKER],
      );
      expect(r.affectedRows).toBe(1);
    });
  });
});

describe("guardar_alergenos (función atómica)", () => {
  it("sustituye la lista, confirma a nombre del usuario y marca el plato como revisado", async () => {
    await como(db, usuario(IKER), (tx) =>
      tx.query(`select guardar_alergenos($1, '{huevos,gluten}')`, [platoA]),
    );
    const filas = await filas2(
      db.query<{ allergen: string; status: string; confirmed_by: string }>(
        `select allergen, status, confirmed_by from dish_allergens where dish_id = $1 order by allergen`,
        [platoA],
      ),
    );
    // 'soja' desaparece; gluten y huevos quedan confirmados por Iker
    expect(filas).toEqual([
      { allergen: "gluten", status: "confirmed", confirmed_by: IKER },
      { allergen: "huevos", status: "confirmed", confirmed_by: IKER },
    ]);
    const plato = await filas2(
      db.query<{ allergens_reviewed_by: string; revisado: boolean }>(
        `select allergens_reviewed_by, allergens_reviewed_at is not null as revisado from dishes where id = $1`,
        [platoA],
      ),
    );
    expect(plato).toEqual([{ allergens_reviewed_by: IKER, revisado: true }]);
  });

  it("una lista vacía deja el plato revisado y sin alérgenos", async () => {
    await como(db, usuario(ANA), (tx) => tx.query(`select guardar_alergenos($1, '{}')`, [platoA]));
    const n = await filas2(db.query<{ n: number }>(`select count(*)::int as n from dish_allergens where dish_id = $1`, [platoA]));
    expect(n[0].n).toBe(0);
  });

  it("Beñat no puede tocar los alérgenos de un plato de Ana (aunque sea visible al público)", async () => {
    await expect(
      como(db, usuario(BEÑAT), (tx) => tx.query(`select guardar_alergenos($1, '{gluten}')`, [platoA])),
    ).rejects.toThrow(/Plato no encontrado/);
  });

  it("el anónimo no puede ejecutarla", async () => {
    await expect(
      como(db, ANONIMO, (tx) => tx.query(`select guardar_alergenos($1, '{gluten}')`, [platoA])),
    ).rejects.toThrow(/permission denied/);
  });

  it("si algo falla, no se aplica nada (atomicidad)", async () => {
    // Estado de partida conocido: gluten confirmado
    await como(db, usuario(ANA), (tx) => tx.query(`select guardar_alergenos($1, '{gluten}')`, [platoA]));
    // Un valor inválido hace fallar la llamada entera
    await expect(
      como(db, usuario(ANA), (tx) => tx.query(`select guardar_alergenos($1, '{soja,picante}')`, [platoA])),
    ).rejects.toThrow();
    const filas = await filas2(
      db.query<{ allergen: string }>(`select allergen from dish_allergens where dish_id = $1`, [platoA]),
    );
    expect(filas).toEqual([{ allergen: "gluten" }]);
  });
});

async function filas2<T>(p: Promise<{ rows: T[] }>): Promise<T[]> {
  return (await p).rows;
}
