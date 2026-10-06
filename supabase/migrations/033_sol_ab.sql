-- ============================================================
-- Travel World Colombia — Prueba A/B de Sol v2
-- Migración 033: interruptor del A/B y bitácora de turnos por versión
-- ============================================================
-- Plan: docs/plan-sol-vendedora.md §16-§17 paso 6 (decidido el 05-oct-2026).
--   * Cada lead NUEVO se asigna a v1 o v2 en su primer mensaje (tag sol_v1 /
--     sol_v2) y no cambia. Las conversaciones que ya venían siguen con v1.
--   * `porcentaje` = probabilidad de que un lead nuevo vaya a v2.
--   * `activa = false` es el botón de regreso: todos vuelven a v1 al instante
--     (sin deploy), incluso los que ya tenían sol_v2.
--   * Cada turno de Sol (de cualquier versión) queda en sol_ab_turnos para
--     revisar las conversaciones v2 con su razonamiento y comparar grupos.

create table if not exists sol_ab_config (
  id smallint primary key default 1 check (id = 1),
  porcentaje integer not null default 20 check (porcentaje between 0 and 100),
  activa boolean not null default true,
  actualizado_en timestamptz not null default now(),
  actualizado_por text
);
alter table sol_ab_config enable row level security;
insert into sol_ab_config (id) values (1) on conflict (id) do nothing;

create table if not exists sol_ab_turnos (
  id uuid primary key default gen_random_uuid(),
  contact_id text not null,
  conversation_id text,
  version text not null check (version in ('v1', 'v2')),
  origen text not null default 'mensaje' check (origen in ('mensaje', 'seguimiento')),
  mensaje text,
  tarjetas jsonb,
  decision jsonb,
  costo_usd numeric(10,5),
  en timestamptz not null default now()
);
alter table sol_ab_turnos enable row level security;
create index if not exists sol_ab_turnos_contacto_idx on sol_ab_turnos (contact_id, en desc);
create index if not exists sol_ab_turnos_version_idx on sol_ab_turnos (version, en desc);

-- Quién cayó en qué grupo y cuándo (base de la comparación v1 vs v2).
create table if not exists sol_ab_asignaciones (
  contact_id text primary key,
  grupo text not null check (grupo in ('v1', 'v2')),
  conversation_id text,
  en timestamptz not null default now()
);
alter table sol_ab_asignaciones enable row level security;
create index if not exists sol_ab_asignaciones_grupo_idx on sol_ab_asignaciones (grupo, en desc);
