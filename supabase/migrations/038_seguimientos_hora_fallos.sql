-- Seguimientos de Sol v2 (08-oct-2026):
--  · hora: hora de Bogotá (0-23) a la que el cliente solía escribir; el runner
--    corre cada hora y envía el día programado a partir de esa hora (acotada a
--    la ventana legal). Null = 10 a. m.
--  · fallos: intentos de envío que fallaron. Antes un fallo dejaba la fila
--    pendiente para siempre y, al ir primero en la cola, atascaba a las demás.
alter table public.agente_seguimientos
  add column if not exists hora smallint check (hora between 0 and 23),
  add column if not exists fallos smallint not null default 0;
