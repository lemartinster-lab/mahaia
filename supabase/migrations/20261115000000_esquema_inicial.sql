-- =====================================================================
-- Mahaia · Esquema inicial
-- SaaS de cartas digitales multi-restaurante.
--
-- Principio de seguridad: TODAS las tablas llevan restaurant_id y tienen
-- RLS activado. Ningún restaurante puede leer ni modificar datos de otro,
-- aunque el código de la aplicación tuviera un fallo.
-- =====================================================================

-- gen_random_uuid() es nativa desde Postgres 13: no hace falta pgcrypto.

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------

-- Los 14 alérgenos de declaración obligatoria (Reglamento UE 1169/2011, anexo II)
create type public.alergeno as enum (
  'gluten', 'crustaceos', 'huevos', 'pescado', 'cacahuetes', 'soja',
  'lacteos', 'frutos_cascara', 'apio', 'mostaza', 'sesamo', 'sulfitos',
  'altramuces', 'moluscos'
);

create type public.idioma as enum ('es', 'en', 'de', 'fr', 'it', 'eu');

create type public.rol_miembro as enum ('owner', 'staff');

-- 'suggested': lo propuso la IA o un empleado; NO se muestra al público.
-- 'confirmed': validado por una persona con nombre y fecha.
create type public.estado_alergeno as enum ('suggested', 'confirmed');

create type public.origen_dato as enum ('ai', 'manual');

create type public.estado_importacion as enum ('pending', 'processing', 'draft', 'published', 'failed');

-- ---------------------------------------------------------------------
-- Utilidad: updated_at automático
-- ---------------------------------------------------------------------
create or replace function public.tocar_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Restaurantes
-- ---------------------------------------------------------------------
create table public.restaurants (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique
                check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 60),
  name          text not null check (char_length(name) between 1 and 120),
  base_language public.idioma not null default 'es',
  languages     public.idioma[] not null default array['es']::public.idioma[],
  logo_path     text,
  brand_color   text check (brand_color is null or brand_color ~ '^#[0-9a-fA-F]{6}$'),
  is_published  boolean not null default false,
  created_by    uuid not null default auth.uid() references auth.users (id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint idioma_base_incluido check (base_language = any (languages))
);

create trigger restaurants_updated_at
  before update on public.restaurants
  for each row execute function public.tocar_updated_at();

-- ---------------------------------------------------------------------
-- Miembros (quién gestiona qué restaurante)
-- ---------------------------------------------------------------------
create table public.members (
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  role          public.rol_miembro not null default 'staff',
  created_at    timestamptz not null default now(),
  primary key (restaurant_id, user_id)
);

create index members_user_idx on public.members (user_id);

-- Funciones de comprobación. SECURITY DEFINER para que las políticas
-- puedan consultar members sin entrar en recursión de RLS.
create or replace function public.es_miembro(rid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.members m
    where m.restaurant_id = rid and m.user_id = auth.uid()
  );
$$;

create or replace function public.es_propietario(rid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.members m
    where m.restaurant_id = rid and m.user_id = auth.uid() and m.role = 'owner'
  );
$$;

create or replace function public.esta_publicado(rid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.restaurants r
    where r.id = rid and r.is_published
  );
$$;

-- Al crear un restaurante, su creador pasa a ser propietario.
create or replace function public.alta_propietario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.members (restaurant_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$$;

create trigger restaurants_alta_propietario
  after insert on public.restaurants
  for each row execute function public.alta_propietario();

-- ---------------------------------------------------------------------
-- Categorías
-- ---------------------------------------------------------------------
create table public.categories (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 80),
  position      integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- Permite claves foráneas compuestas que garantizan el mismo restaurante
  unique (id, restaurant_id)
);

create index categories_restaurant_idx on public.categories (restaurant_id, position);

create trigger categories_updated_at
  before update on public.categories
  for each row execute function public.tocar_updated_at();

-- ---------------------------------------------------------------------
-- Platos
-- ---------------------------------------------------------------------
create table public.dishes (
  id                    uuid primary key default gen_random_uuid(),
  restaurant_id         uuid not null references public.restaurants (id) on delete cascade,
  category_id           uuid,
  name                  text not null check (char_length(name) between 1 and 120),
  description           text check (description is null or char_length(description) <= 600),
  -- Precio en céntimos para evitar errores de redondeo con decimales
  price_cents           integer not null check (price_cents >= 0 and price_cents <= 10000000),
  -- Variantes: [{ "label": "XL", "price_cents": 2095 }, ...]
  variants              jsonb not null default '[]'::jsonb check (jsonb_typeof(variants) = 'array'),
  photo_path            text,
  is_available          boolean not null default true,
  is_new                boolean not null default false,
  position              integer not null default 0,
  -- Distingue "sin alérgenos confirmados" de "sin revisar".
  -- Si es null, la carta pública muestra "Consulta al personal".
  allergens_reviewed_at timestamptz,
  allergens_reviewed_by uuid references auth.users (id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (id, restaurant_id),
  -- La categoría debe pertenecer al mismo restaurante que el plato
  foreign key (category_id, restaurant_id)
    references public.categories (id, restaurant_id) on delete set null (category_id),
  constraint revision_completa check (
    (allergens_reviewed_at is null) = (allergens_reviewed_by is null)
  )
);

create index dishes_restaurant_idx on public.dishes (restaurant_id, category_id, position);

create trigger dishes_updated_at
  before update on public.dishes
  for each row execute function public.tocar_updated_at();

-- ---------------------------------------------------------------------
-- Alérgenos por plato
-- ---------------------------------------------------------------------
create table public.dish_allergens (
  restaurant_id uuid not null,
  dish_id       uuid not null,
  allergen      public.alergeno not null,
  status        public.estado_alergeno not null default 'suggested',
  source        public.origen_dato not null default 'manual',
  confirmed_by  uuid references auth.users (id),
  confirmed_at  timestamptz,
  created_at    timestamptz not null default now(),
  primary key (dish_id, allergen),
  foreign key (dish_id, restaurant_id)
    references public.dishes (id, restaurant_id) on delete cascade,
  -- Un alérgeno confirmado siempre tiene responsable y fecha (trazabilidad)
  constraint confirmacion_trazable check (
    (status = 'confirmed' and confirmed_by is not null and confirmed_at is not null)
    or (status = 'suggested' and confirmed_by is null and confirmed_at is null)
  )
);

create index dish_allergens_restaurant_idx on public.dish_allergens (restaurant_id);

-- ---------------------------------------------------------------------
-- Traducciones
-- ---------------------------------------------------------------------
create table public.dish_translations (
  restaurant_id uuid not null,
  dish_id       uuid not null,
  language      public.idioma not null,
  name          text not null check (char_length(name) between 1 and 160),
  description   text check (description is null or char_length(description) <= 800),
  -- 'manual' = corregida por el restaurante; la IA no la sobrescribe
  source        public.origen_dato not null default 'ai',
  updated_at    timestamptz not null default now(),
  primary key (dish_id, language),
  foreign key (dish_id, restaurant_id)
    references public.dishes (id, restaurant_id) on delete cascade
);

create trigger dish_translations_updated_at
  before update on public.dish_translations
  for each row execute function public.tocar_updated_at();

create table public.category_translations (
  restaurant_id uuid not null,
  category_id   uuid not null,
  language      public.idioma not null,
  name          text not null check (char_length(name) between 1 and 120),
  source        public.origen_dato not null default 'ai',
  updated_at    timestamptz not null default now(),
  primary key (category_id, language),
  foreign key (category_id, restaurant_id)
    references public.categories (id, restaurant_id) on delete cascade
);

create trigger category_translations_updated_at
  before update on public.category_translations
  for each row execute function public.tocar_updated_at();

-- ---------------------------------------------------------------------
-- Importaciones de carta desde foto
-- ---------------------------------------------------------------------
create table public.menu_imports (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  image_path    text not null,
  status        public.estado_importacion not null default 'pending',
  -- Respuesta de la IA ya validada con Zod (borrador revisable)
  result        jsonb,
  error         text,
  created_by    uuid not null default auth.uid() references auth.users (id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index menu_imports_restaurant_idx on public.menu_imports (restaurant_id, created_at desc);

create trigger menu_imports_updated_at
  before update on public.menu_imports
  for each row execute function public.tocar_updated_at();

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.restaurants           enable row level security;
alter table public.members               enable row level security;
alter table public.categories            enable row level security;
alter table public.dishes                enable row level security;
alter table public.dish_allergens        enable row level security;
alter table public.dish_translations     enable row level security;
alter table public.category_translations enable row level security;
alter table public.menu_imports          enable row level security;

-- ---- restaurants ----------------------------------------------------
create policy "publico ve restaurantes publicados"
  on public.restaurants for select to anon, authenticated
  using (is_published);

create policy "miembros ven su restaurante"
  on public.restaurants for select to authenticated
  using (public.es_miembro(id));

-- Necesaria para `insert ... returning` (lo que hace supabase-js con
-- .insert().select()): el trigger que da de alta al propietario se ejecuta
-- DESPUÉS de comprobar el RETURNING, así que sin esto el creador no podría
-- leer el restaurante recién creado si aún no está publicado.
create policy "creador ve su restaurante"
  on public.restaurants for select to authenticated
  using (created_by = auth.uid());

create policy "usuario crea restaurante propio"
  on public.restaurants for insert to authenticated
  with check (created_by = auth.uid());

create policy "propietario edita restaurante"
  on public.restaurants for update to authenticated
  using (public.es_propietario(id))
  with check (public.es_propietario(id));

create policy "propietario borra restaurante"
  on public.restaurants for delete to authenticated
  using (public.es_propietario(id));

-- ---- members --------------------------------------------------------
create policy "miembros ven al equipo"
  on public.members for select to authenticated
  using (public.es_miembro(restaurant_id));

create policy "propietario gestiona equipo (alta)"
  on public.members for insert to authenticated
  with check (public.es_propietario(restaurant_id));

create policy "propietario gestiona equipo (cambio)"
  on public.members for update to authenticated
  using (public.es_propietario(restaurant_id))
  with check (public.es_propietario(restaurant_id));

create policy "propietario gestiona equipo (baja)"
  on public.members for delete to authenticated
  using (public.es_propietario(restaurant_id));

-- ---- categories / dishes / translations: patrón común ---------------
-- Público: solo lectura y solo si el restaurante está publicado.
-- Miembros: todo dentro de su restaurante.

create policy "publico lee categorias"
  on public.categories for select to anon, authenticated
  using (public.esta_publicado(restaurant_id));
create policy "miembros gestionan categorias"
  on public.categories for all to authenticated
  using (public.es_miembro(restaurant_id))
  with check (public.es_miembro(restaurant_id));

create policy "publico lee platos disponibles"
  on public.dishes for select to anon, authenticated
  using (public.esta_publicado(restaurant_id) and is_available);
create policy "miembros gestionan platos"
  on public.dishes for all to authenticated
  using (public.es_miembro(restaurant_id))
  with check (public.es_miembro(restaurant_id));

create policy "publico lee traducciones de platos"
  on public.dish_translations for select to anon, authenticated
  using (public.esta_publicado(restaurant_id));
create policy "miembros gestionan traducciones de platos"
  on public.dish_translations for all to authenticated
  using (public.es_miembro(restaurant_id))
  with check (public.es_miembro(restaurant_id));

create policy "publico lee traducciones de categorias"
  on public.category_translations for select to anon, authenticated
  using (public.esta_publicado(restaurant_id));
create policy "miembros gestionan traducciones de categorias"
  on public.category_translations for all to authenticated
  using (public.es_miembro(restaurant_id))
  with check (public.es_miembro(restaurant_id));

-- ---- dish_allergens -------------------------------------------------
-- El público SOLO ve alérgenos confirmados. Los sugeridos por la IA
-- nunca salen del panel hasta que una persona los valida.
create policy "publico lee alergenos confirmados"
  on public.dish_allergens for select to anon, authenticated
  using (public.esta_publicado(restaurant_id) and status = 'confirmed');

create policy "miembros gestionan alergenos"
  on public.dish_allergens for all to authenticated
  using (public.es_miembro(restaurant_id))
  with check (
    public.es_miembro(restaurant_id)
    -- Nadie puede confirmar en nombre de otra persona
    and (status = 'suggested' or confirmed_by = auth.uid())
  );

-- ---- menu_imports ---------------------------------------------------
create policy "miembros gestionan importaciones"
  on public.menu_imports for all to authenticated
  using (public.es_miembro(restaurant_id))
  with check (public.es_miembro(restaurant_id));

-- =====================================================================
-- Permisos de tabla (RLS filtra filas; esto habilita operaciones)
-- =====================================================================
grant usage on schema public to anon, authenticated;

grant select on public.restaurants, public.categories, public.dishes,
  public.dish_allergens, public.dish_translations, public.category_translations
  to anon;

grant select, insert, update, delete on all tables in schema public to authenticated;

-- Las funciones se conceden por defecto a PUBLIC: lo retiramos y damos
-- solo lo necesario. El público no necesita las funciones de miembro.
revoke execute on function public.es_miembro(uuid), public.es_propietario(uuid),
  public.esta_publicado(uuid), public.alta_propietario() from public;
grant execute on function public.esta_publicado(uuid) to anon, authenticated;
grant execute on function public.es_miembro(uuid), public.es_propietario(uuid) to authenticated;
