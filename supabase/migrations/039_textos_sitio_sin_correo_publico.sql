-- ============================================================
-- Travel World Colombia — Auditoría de seguridad 2026-10-08
-- Migración 039: la llave pública ya no lee `textos_sitio.actualizado_por`
--                + search_path fijo en destinos_candado_precio
-- ============================================================
-- `textos_sitio` es de lectura pública (son textos de la web), pero la columna
-- `actualizado_por` guarda el correo del editor del panel: con la anon key se
-- podía listar (GET /rest/v1/textos_sitio?select=actualizado_por → correos de
-- cuentas del panel, útiles para phishing o fuerza bruta de login).
--
-- Revocar la columna no basta mientras exista el SELECT de tabla completa, así
-- que se quita el de tabla y se concede solo sobre las columnas públicas. El
-- sitio solo pide `clave, valor` (lib/textos.ts); el panel usa la service role.

revoke select on public.textos_sitio from anon, authenticated;
grant select (clave, valor, actualizado_en) on public.textos_sitio to anon, authenticated;

-- Advisor WARN de Supabase: la función trigger de la migración 030 no fijaba
-- search_path (riesgo nulo en la práctica, pero es la única sin fijar).
alter function public.destinos_candado_precio() set search_path = public;
