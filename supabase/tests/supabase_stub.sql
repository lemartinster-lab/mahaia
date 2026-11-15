-- =====================================================================
-- SOLO PARA TESTS. Reproduce lo mínimo de Supabase que usa el esquema:
-- roles anon/authenticated, tabla auth.users y la función auth.uid().
-- En Supabase real todo esto ya existe; este archivo NO se despliega.
-- =====================================================================
create role anon nologin;
create role authenticated nologin;

create schema auth;
grant usage on schema auth to anon, authenticated;

create table auth.users (
  id    uuid primary key,
  email text
);

-- Igual que en Supabase: el id del usuario sale del claim "sub" del JWT
create function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

grant execute on function auth.uid() to anon, authenticated;
grant select on auth.users to authenticated;
