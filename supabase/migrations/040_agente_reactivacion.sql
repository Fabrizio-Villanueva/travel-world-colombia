-- ============================================================
-- Travel World Colombia — Agente Sol
-- Migración 040: reactivación de leads no calificados (A/B IA vs. plantilla)
-- ============================================================
-- Una fila por intento de reactivación (lib/agente/reactivacion/correr.ts):
--   * segmento: 'rescate' (habló con Sol y no calificó) | 'silencioso' (nunca
--     respondió al primer mensaje de Sol).
--   * capa: de dónde salió el interés — 1 lo que le dijo a Sol, 2 el anuncio
--     de origen, 3 nada (temporada).
--   * variante: 'ia' | 'plantilla', estable por contacto (hash del contactId;
--     la que quede guardada aquí manda).
--   * decision: lo que pasó. 'dry_run' no cuenta para nada (ni métricas ni la
--     regla de "no repetir en 30 días").
--   * respondio_en: lo marca el webhook cuando el cliente escribe después de
--     un envío (ventana de 30 días). baja_en: cuando responde SALIR.
--
-- Sin políticas RLS a propósito: igual que las demás tablas agente_*, solo se
-- toca con service-role desde el servidor (cron, webhook y panel).

create table if not exists public.agente_reactivacion (
  id               uuid primary key default gen_random_uuid(),
  contact_id       text not null,
  conversation_id  text,
  segmento         text not null check (segmento in ('rescate', 'silencioso')),
  capa             smallint not null check (capa between 1 and 3),
  variante         text not null check (variante in ('ia', 'plantilla')),
  decision         text not null check (decision in ('enviado', 'callar', 'error_validacion', 'error_envio', 'dry_run')),
  motivo           text,
  mensaje          text,
  fichas           jsonb,
  modelo           text,
  costo_usd        numeric(10,5),
  creado_en        timestamptz not null default now(),
  enviado_en       timestamptz,
  respondio_en     timestamptz,
  baja_en          timestamptz
);

-- "¿Ya lo reactivamos en los últimos 30 días?" y "¿qué fichas ya le mandamos?".
create index if not exists agente_reactivacion_contacto_idx
  on public.agente_reactivacion (contact_id, creado_en desc);
-- Panel: métricas por variante y lista de los últimos.
create index if not exists agente_reactivacion_variante_idx
  on public.agente_reactivacion (variante, decision, creado_en desc);

alter table public.agente_reactivacion enable row level security;
