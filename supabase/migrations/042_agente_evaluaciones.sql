-- ============================================================
-- Travel World Colombia — Agente Sol
-- Migración 042: evaluación automática de la calidad de cada lead
-- ============================================================
-- Plan del 13-oct-2026 (panel "Resultados de Sol"): la dueña siente que Sol
-- "pasa leads no calificados" y que "no se ven las ventas". Las asesoras no
-- marcan nada, así que un evaluador (IA, criterio de jefe comercial, el mismo
-- método del A/B a ciegas del 13-oct) lee cada conversación que atendió Sol
-- cuando ya se asentó y deja aquí su veredicto. El panel /admin/sol/resultados
-- lo cruza con el traspaso (agente_sla_humano) y las ventas de GHL.
--
-- Una fila por lead (contacto). La escribe el cron /api/agente/evaluador
-- (lib/agente/evaluador.ts). Sin políticas RLS a propósito: como el resto de
-- tablas `agente_*`, solo se toca con service-role desde el servidor.

create table if not exists public.agente_evaluaciones (
  contact_id        text primary key,
  conversation_id   text,
  nombre            text,
  -- Tipo de conversación: un lead de venta nuevo, un cliente con reserva o
  -- trámite en curso, o alguien que no es cliente (proveedor, spam, error).
  tipo              text not null check (tipo in ('venta_nueva', 'cliente_existente', 'no_cliente')),
  -- ¿Merecía que una asesora le dedicara tiempo YA? (solo venta_nueva)
  merecia_pasar     text not null check (merecia_pasar in ('si', 'dudoso', 'no', 'no_aplica')),
  motivo            text not null,
  -- Calidad de la conversación de Sol, 1 (mala) a 5 (como la mejor asesora).
  nota_sol          smallint check (nota_sol between 1 and 5),
  error_sol         text,
  datos             jsonb,
  criterio          text not null,
  costo_usd         numeric(10,5),
  evaluado_en       timestamptz not null default now()
);

create index if not exists agente_evaluaciones_fecha_idx
  on public.agente_evaluaciones (evaluado_en desc);

alter table public.agente_evaluaciones enable row level security;
