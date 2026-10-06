-- ============================================================
-- Travel World Colombia — Laboratorio de Sol (solo administradores)
-- Migración 032: escenarios de prueba, corridas y valoraciones
-- ============================================================
-- Plan: docs/plan-sol-vendedora.md §14 y §17 paso 5.
--   * Escenario = un "cliente simulado" (otra IA actúa el papel) para ver una
--     conversación completa con Sol v2, sin WhatsApp.
--   * Corrida = una conversación (de escenario o del chat de prueba) con el
--     razonamiento de Sol en cada turno. Valoración = 👍/👎 + comentario por
--     mensaje de Sol. Solo service role (RLS sin políticas).

create table if not exists sol_lab_escenarios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  persona text not null,      -- instrucciones para el cliente simulado
  esperado text,              -- qué debería hacer Sol (lo revisa una persona)
  orden integer not null default 0,
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);
alter table sol_lab_escenarios enable row level security;

create table if not exists sol_lab_corridas (
  id uuid primary key default gen_random_uuid(),
  escenario_id uuid references sol_lab_escenarios(id) on delete set null,
  tipo text not null check (tipo in ('escenario', 'chat')),
  version text not null default 'v2' check (version in ('v1', 'v2')),
  titulo text,
  turnos jsonb not null default '[]'::jsonb,  -- [{rol, texto, decision?, en}]
  estado text not null default 'en_curso' check (estado in ('en_curso', 'terminada', 'error')),
  error text,
  creado_por text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
alter table sol_lab_corridas enable row level security;
create index if not exists sol_lab_corridas_creado_idx on sol_lab_corridas (creado_en desc);

create table if not exists sol_lab_valoraciones (
  id uuid primary key default gen_random_uuid(),
  corrida_id uuid not null references sol_lab_corridas(id) on delete cascade,
  turno integer not null,
  voto smallint not null check (voto in (-1, 1)),
  comentario text,
  por text,
  en timestamptz not null default now(),
  unique (corrida_id, turno, por)
);
alter table sol_lab_valoraciones enable row level security;
