-- ============================================================
-- Travel World Colombia — Libro de abonos (estado de cuenta)
-- Migración 046 (17-oct-2026): un cliente se quejó de no ver sus abonos;
-- antes solo contabilidad los llevaba. Cada abono queda aquí, sin tope, con
-- QUIÉN lo registró (la cuenta del panel). De aquí salen:
--   - el estado de cuenta del cliente (/estado-de-cuenta/<token>);
--   - los campos Pago 1..10 y el resumen en la oportunidad de GHL;
--   - el mensaje de confirmación por WhatsApp.
-- El contrato (promesa de compra) no se reenvía por cada abono.
--
-- Solo el servidor (service role) toca la tabla: RLS activo, sin políticas.
-- Un abono no se borra: se anula con motivo (queda en el historial).
-- ============================================================

create table if not exists abonos (
  id                uuid primary key default gen_random_uuid(),
  location_id       text not null default 'RMFUo0i4KOVl7eZHEn7s',
  opportunity_id    text not null,
  contact_id        text,
  fecha             date not null,
  divisa            text not null default 'COP' check (divisa in ('COP', 'USD', 'EUR')),
  monto             numeric(14, 2) not null check (monto > 0),
  -- Total del plan en esta divisa al momento del abono (base del saldo).
  total_plan        numeric(14, 2),
  trm               numeric(12, 2),
  medio             text,
  referencia        text,
  nota              text,
  -- Quién lo registró: la cuenta con la que entró al panel.
  registrado_por    text not null,
  registrado_nombre text,
  creado_en         timestamptz not null default now(),
  -- 'panel' o 'importado' (pagos que ya estaban en GHL antes del libro).
  origen            text not null default 'panel' check (origen in ('panel', 'importado')),
  mensaje_enviado_en timestamptz,
  anulado_en        timestamptz,
  anulado_por       text,
  anulado_motivo    text
);

create index if not exists idx_abonos_opp on abonos (location_id, opportunity_id, fecha, creado_en);

alter table abonos enable row level security;
