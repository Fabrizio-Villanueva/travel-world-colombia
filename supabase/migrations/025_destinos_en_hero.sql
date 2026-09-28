-- ============================================================
-- Travel World Colombia — Selector del hero del home
-- Migración 025: columna `en_hero` en destinos
-- ============================================================
-- Antes el carrusel del hero mostraba TODOS los viajes activos.
-- Ahora el panel tiene el check "Mostrar en el banner del inicio":
-- si hay viajes marcados, el hero rota solo esos; si ninguno está
-- marcado, se mantiene el comportamiento anterior (todos) para que
-- el banner nunca quede vacío.
--
-- IMPORTANTE: aplicar en producción ANTES de desplegar el panel con
-- el check (si no, guardar un viaje fallará con "Could not find the
-- 'en_hero' column").

alter table destinos add column if not exists en_hero boolean not null default false;
