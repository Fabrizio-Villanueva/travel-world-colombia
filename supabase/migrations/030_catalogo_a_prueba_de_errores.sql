-- ============================================================
-- Travel World Colombia — Catálogo a prueba de errores
-- Migración 030: viajes "a la medida", fecha del precio y candado de publicación
-- ============================================================
-- Plan: docs/plan-sol-vendedora.md §8 (decidido el 05-oct-2026).
--   * Un viaje ACTIVO debe tener precio (valor + moneda), salvo que se marque
--     a propósito como "a la medida" (sin precio publicado). Así un precio
--     vacío es una decisión, no un olvido: Sol y la web dependen de él.
--   * El candado vive en la base para cubrir TODOS los caminos (formulario,
--     botón de activar en la lista, SQL a mano), no solo el formulario.
--   * Solo actúa cuando el viaje se publica o cuando se toca su precio: los
--     viajes que hoy están activos sin precio no rompen otras ediciones (los
--     señala la página "Salud del catálogo" hasta que se corrijan).
--   * precio_actualizado_en lo pone la base sola cada vez que cambia el precio.

alter table destinos
  add column if not exists a_la_medida boolean not null default false,
  add column if not exists precio_actualizado_en timestamptz;

comment on column destinos.a_la_medida is
  'true = se publica sin precio a propósito (se arma a la medida). Sin esto, un viaje activo exige precio.';
comment on column destinos.precio_actualizado_en is
  'Última vez que cambió precio_valor/precio_moneda (lo pone el trigger). Base del aviso de precio viejo.';

-- Los precios que existen hoy se dan por revisados hoy (la agencia los está cargando).
update destinos
   set precio_actualizado_en = now()
 where precio_valor is not null and precio_actualizado_en is null;

create or replace function destinos_candado_precio()
returns trigger
language plpgsql
as $$
declare
  publica boolean;
  toca_precio boolean;
begin
  -- Fecha del precio: solo cuando de verdad cambia.
  if tg_op = 'INSERT' then
    if new.precio_valor is not null then
      new.precio_actualizado_en := coalesce(new.precio_actualizado_en, now());
    end if;
  elsif new.precio_valor is distinct from old.precio_valor
     or new.precio_moneda is distinct from old.precio_moneda then
    new.precio_actualizado_en := case when new.precio_valor is null then null else now() end;
  end if;

  publica := new.activo and (tg_op = 'INSERT' or not old.activo);
  toca_precio := tg_op = 'UPDATE' and (
       new.precio_valor is distinct from old.precio_valor
    or new.precio_moneda is distinct from old.precio_moneda
    or new.a_la_medida is distinct from old.a_la_medida);

  if new.activo and not new.a_la_medida
     and (new.precio_valor is null or new.precio_moneda is null)
     and (publica or toca_precio) then
    raise exception 'No se puede publicar "%" sin precio. Pon el precio (valor y moneda) o márcalo como "A la medida (sin precio publicado)".', new.nombre
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists destinos_candado_precio on destinos;
create trigger destinos_candado_precio
  before insert or update on destinos
  for each row execute function destinos_candado_precio();
