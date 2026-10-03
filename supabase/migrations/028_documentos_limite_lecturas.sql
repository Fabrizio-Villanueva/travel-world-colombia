-- ============================================================
-- Travel World Colombia — Portal de documentos: tope de lecturas con IA
-- Migración 028 (auditoría 2026-10-03, hallazgo #3)
-- ============================================================
-- Cada lectura automática llama al modelo de visión (costo por llamada). Antes
-- no había límite: con acceso a un enlace se podía pedir la lectura una y otra
-- vez. Ahora el código:
--   * no vuelve a leer un archivo que ya tiene datos extraídos, y
--   * descuenta cada lectura de un cupo por enlace (proporcional a los
--     documentos que pide el viaje), con esta función atómica.

alter table doc_solicitudes
  add column if not exists lecturas_ia int not null default 0;

-- Suma una lectura si aún hay cupo. Devuelve true si se puede leer.
create or replace function public.doc_sumar_lectura_ia(p_id uuid, p_max int)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
begin
  update doc_solicitudes set lecturas_ia = lecturas_ia + 1
   where id = p_id and lecturas_ia < p_max;
  return found;
end;
$$;

revoke all on function public.doc_sumar_lectura_ia(uuid, int) from public, anon, authenticated;
grant execute on function public.doc_sumar_lectura_ia(uuid, int) to service_role;
