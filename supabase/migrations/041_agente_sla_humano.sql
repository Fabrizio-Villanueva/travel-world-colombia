-- ============================================================
-- Travel World Colombia — Agente Sol
-- Migración 041: SLA de respuesta humana a los leads que Sol pasa al equipo
-- ============================================================
-- Auditoría del 09-oct-2026: Sol responde en 18 s, pero el primer mensaje de
-- una asesora a un lead que Sol calificó tardaba una mediana de 21 h y el 23 %
-- nunca recibía uno. El vigilante no lo detectaba porque Sol sigue en "espera
-- caliente" contestando: para él el chat estaba respondido.
--
-- Una fila por TRASPASO (episodio): Sol calificó el lead (`sol_calificado`) o
-- lo escaló (`transferencia a humano`, también desde el modo respaldo). La
-- abre Sol en el momento del traspaso (lib/agente/sla-humano.ts
-- `registrarTraspaso`) y la recorre el cron del vigilante cada 10 min:
--   * alerta_asesora_en: aviso a los 60 min HÁBILES sin mensaje humano
--     (asesora asignada o, si no se tiene su WhatsApp, ALERTAS_INTERNAS) +
--     nota en el contacto + tag `sla_sin_respuesta_humana`.
--   * alerta_supervision_en: aviso a ALERTAS_INTERNAS a las 3 h hábiles.
--   * cerrado_en + cierre: 'respondido' (escribió alguien del equipo; queda
--     respondido_en = fecha de ese mensaje), 'vencido' (más viejo que la
--     ventana) o 'no_cliente'.
-- Las columnas de alerta se marcan ANTES de enviar con un UPDATE condicional
-- (`... is null`): dos corridas solapadas no pueden avisar dos veces.
--
-- A lo sumo UNA fila abierta por contacto (índice único parcial): una segunda
-- escalada del mismo episodio no reinicia el reloj.
--
-- Sin políticas RLS a propósito: como el resto de tablas `agente_*`, solo se
-- toca con service-role desde el servidor.

create table if not exists public.agente_sla_humano (
  id                     uuid primary key default gen_random_uuid(),
  contact_id             text not null,
  conversation_id        text,
  motivo                 text not null check (motivo in ('calificado', 'escalado', 'escalado_respaldo')),
  inicio                 timestamptz not null default now(),
  alerta_asesora_en      timestamptz,
  alerta_asesora_nota    text,
  alerta_supervision_en  timestamptz,
  alerta_supervision_nota text,
  respondido_en          timestamptz,
  cerrado_en             timestamptz,
  cierre                 text check (cierre in ('respondido', 'vencido', 'no_cliente'))
);

create unique index if not exists agente_sla_humano_abierto_uidx
  on public.agente_sla_humano (contact_id)
  where cerrado_en is null;

-- El cron lee solo las abiertas; el panel/medición, por fecha.
create index if not exists agente_sla_humano_inicio_idx
  on public.agente_sla_humano (inicio desc);

alter table public.agente_sla_humano enable row level security;
