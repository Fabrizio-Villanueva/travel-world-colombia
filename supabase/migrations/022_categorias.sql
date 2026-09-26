-- ============================================================
-- Travel World Colombia — Categorías de viajes (editables desde el panel)
-- Migración 022: tabla `categorias` (2 niveles) + `destinos.categorias`
-- ============================================================
-- El cliente define sus categorías (Cruceros, Todo incluido, Paquetes…) y
-- subcategorías (Cruceros › Con visa / Sin visa). Un viaje puede tener varias.
--
-- Reglas que garantiza la BASE (no solo el panel):
--   * Solo dos niveles: una subcategoría no puede tener hijas.
--   * Las categorías del sistema (`clave` no nula, hoy solo 'cruceros') se
--     pueden renombrar pero NO borrar.
--   * Al borrar una categoría, se quita sola de los viajes que la tenían
--     (borrar la madre borra sus subcategorías en cascada).
--   * `destinos.es_crucero` se DERIVA de las categorías: un viaje con la
--     categoría Cruceros (o una subcategoría suya) sale en /cruceros. La
--     columna se conserva porque la leen la web, el menú y el sitemap.

create table if not exists categorias (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null check (btrim(nombre) <> ''),
  slug       text not null unique,
  parent_id  uuid references categorias(id) on delete cascade,
  clave      text unique,
  orden      int  not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_categorias_parent on categorias (parent_id);

alter table categorias enable row level security;

-- Lectura pública (nombres de categorías, sin datos sensibles). La escritura
-- es solo del panel, que usa la service role (no pasa por RLS).
drop policy if exists "categorias_public_read" on categorias;
create policy "categorias_public_read" on categorias for select using (true);

-- ── Solo dos niveles; una categoría del sistema no puede ser subcategoría ──
create or replace function public.categorias_validar()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.parent_id is not null then
    if new.parent_id = new.id then
      raise exception 'Una categoría no puede estar dentro de sí misma.';
    end if;
    if exists (select 1 from categorias where id = new.parent_id and parent_id is not null) then
      raise exception 'Solo se permiten dos niveles: una subcategoría no puede tener subcategorías.';
    end if;
    if exists (select 1 from categorias where parent_id = new.id) then
      raise exception 'Esta categoría tiene subcategorías: no puede pasar a ser subcategoría.';
    end if;
    if new.clave is not null then
      raise exception 'La categoría "%" es del sistema y debe ser principal.', new.nombre;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_categorias_validar on categorias;
create trigger trg_categorias_validar
  before insert or update on categorias
  for each row execute function public.categorias_validar();

-- ── Las categorías del sistema no se borran ──
create or replace function public.categorias_proteger()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.clave is not null then
    raise exception 'La categoría "%" es del sistema y no se puede eliminar (puedes renombrarla).', old.nombre;
  end if;
  return old;
end;
$$;

drop trigger if exists trg_categorias_proteger on categorias;
create trigger trg_categorias_proteger
  before delete on categorias
  for each row execute function public.categorias_proteger();

-- ── Categorías del viaje ──
alter table destinos add column if not exists categorias uuid[] not null default '{}';
create index if not exists idx_destinos_categorias on destinos using gin (categorias);

-- Al borrar una categoría, quitarla de los viajes (el UPDATE re-deriva es_crucero).
create or replace function public.categorias_quitar_de_destinos()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update destinos set categorias = array_remove(categorias, old.id)
  where old.id = any(categorias);
  return old;
end;
$$;

drop trigger if exists trg_categorias_quitar on categorias;
create trigger trg_categorias_quitar
  after delete on categorias
  for each row execute function public.categorias_quitar_de_destinos();

-- es_crucero = tiene la categoría del sistema 'cruceros' o una de sus hijas.
create or replace function public.destinos_derivar_crucero()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.es_crucero := exists (
    select 1
    from categorias c
    left join categorias p on p.id = c.parent_id
    where c.id = any(new.categorias)
      and (c.clave = 'cruceros' or p.clave = 'cruceros')
  );
  return new;
end;
$$;

drop trigger if exists trg_destinos_crucero on destinos;
create trigger trg_destinos_crucero
  before insert or update on destinos
  for each row execute function public.destinos_derivar_crucero();

-- ── Categorías iniciales (el cliente las edita después) ──
insert into categorias (nombre, slug, clave, orden) values
  ('Cruceros', 'cruceros', 'cruceros', 1),
  ('Todo incluido', 'todo-incluido', null, 2),
  ('Paquetes', 'paquetes', null, 3)
on conflict (slug) do nothing;

insert into categorias (nombre, slug, parent_id, orden)
select v.nombre, v.slug, c.id, v.orden
from (values ('Con visa', 'cruceros-con-visa', 1), ('Sin visa', 'cruceros-sin-visa', 2)) as v(nombre, slug, orden)
cross join categorias c
where c.clave = 'cruceros'
on conflict (slug) do nothing;

-- Los cruceros que ya existían (casilla "Es crucero") pasan a la categoría.
update destinos
set categorias = array_append(categorias, (select id from categorias where clave = 'cruceros'))
where es_crucero
  and not ((select id from categorias where clave = 'cruceros') = any(categorias));
