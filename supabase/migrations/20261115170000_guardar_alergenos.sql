-- =====================================================================
-- Mahaia · Guardar el checklist de alérgenos de un plato de forma atómica
--
-- En una sola transacción:
--   1. borra los alérgenos que ya no están marcados,
--   2. confirma los marcados a nombre del usuario actual,
--   3. marca el plato como revisado (quién y cuándo).
--
-- SECURITY INVOKER: se ejecuta con los permisos del usuario, así que
-- todas las políticas RLS siguen aplicándose.
-- =====================================================================

create or replace function public.guardar_alergenos(
  p_plato     uuid,
  p_alergenos public.alergeno[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_usuario     uuid := auth.uid();
  v_restaurante uuid;
  v_lista       public.alergeno[] := coalesce(p_alergenos, '{}');
begin
  if v_usuario is null then
    raise exception 'Hace falta iniciar sesión' using errcode = '42501';
  end if;

  select d.restaurant_id into v_restaurante
  from public.dishes d
  where d.id = p_plato;

  if v_restaurante is null or not public.es_miembro(v_restaurante) then
    raise exception 'Plato no encontrado' using errcode = '42501';
  end if;

  delete from public.dish_allergens
  where dish_id = p_plato
    and not (allergen = any (v_lista));

  insert into public.dish_allergens
    (restaurant_id, dish_id, allergen, status, source, confirmed_by, confirmed_at)
  select distinct v_restaurante, p_plato, a, 'confirmed'::public.estado_alergeno,
         'manual'::public.origen_dato, v_usuario, now()
  from unnest(v_lista) as a
  on conflict (dish_id, allergen) do update
    set status       = 'confirmed',
        confirmed_by = excluded.confirmed_by,
        confirmed_at = excluded.confirmed_at;
    -- `source` se conserva: si lo sugirió la IA, queda constancia

  update public.dishes
  set allergens_reviewed_at = now(),
      allergens_reviewed_by = v_usuario
  where id = p_plato;
end;
$$;

revoke execute on function public.guardar_alergenos(uuid, public.alergeno[]) from public;
grant execute on function public.guardar_alergenos(uuid, public.alergeno[]) to authenticated;
