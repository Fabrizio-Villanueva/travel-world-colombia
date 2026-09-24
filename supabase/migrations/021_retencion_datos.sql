-- ============================================================
-- Travel World Colombia — Retención de datos personales
-- Migración 021: borrado automático a 90 días + tablas heredadas fuera
-- ============================================================
-- Principio de finalidad y temporalidad (Ley 1581 de 2012): no guardar datos
-- personales más allá de lo necesario. El CRM (GHL) sigue siendo la fuente de
-- verdad del cliente; aquí solo vive la bitácora técnica del agente Sol.
--
-- Se purgan a los 90 días:
--   agente_eventos          → texto del mensaje + payload crudo del webhook
--                             (nombre, teléfono, correo). Sol solo consulta
--                             ventanas de horas (ráfaga, vigilante).
--   agente_transcripciones  → texto de las notas de voz. Es una caché: si una
--                             conversación vieja se reabre, se vuelve a transcribir.
--
-- NO se purgan (solo guardan ids y estado, y borrarlos cambia el comportamiento):
--   agente_mensajes_enviados → sin ella, los mensajes viejos de Sol se leerían
--                              como de un asesor y Sol se callaría (humanoTomoElChat).
--   agente_seguimientos      → guarda los 'cerrado' (p. ej. "no me escriban
--                              más"); borrarlos reactivaría el seguimiento.

create extension if not exists pg_cron;

-- Idempotente: si el job ya existe, se reemplaza.
select cron.unschedule(jobid) from cron.job where jobname = 'purgar-datos-agente';

-- Todos los días a las 08:00 UTC (3am Colombia).
select cron.schedule(
  'purgar-datos-agente',
  '0 8 * * *',
  $$
    delete from public.agente_eventos         where recibido_en < now() - interval '90 days';
    delete from public.agente_transcripciones where creado_en   < now() - interval '90 days';
  $$
);

-- ── Tablas heredadas del sitio anterior ──
-- `leads` (los leads viven en GHL desde la auditoría pre-dominio) y
-- `security_logs` no tienen uso en el código y estaban vacías al aplicar esto.
-- Sin cascade a propósito: si algo dependiera de ellas, la migración falla.
drop table if exists public.leads;
drop table if exists public.security_logs;
