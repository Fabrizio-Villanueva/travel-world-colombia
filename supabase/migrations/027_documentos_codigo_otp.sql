-- ============================================================
-- Travel World Colombia — Portal de documentos: código de un solo uso
-- Migración 027: el acceso pasa de "últimos 4 dígitos del celular" a un
-- código de 6 dígitos enviado por WhatsApp o correo.
-- ============================================================
-- Auditoría 2026-10-03 (hallazgo #2): con 4 dígitos y un bloqueo que se
-- reiniciaba, quien tuviera el enlace podía adivinarlos en la vida del enlace.
-- Ahora: código aleatorio de 6 dígitos (solo se guarda su HMAC), vence en 10
-- minutos, un solo uso, 5 intentos por código, máx. 1 envío por minuto y 5 por
-- hora, y un tope de 10 fallos en la vida del enlace (luego se desactiva).
--
-- Los contadores se mueven con funciones (una sola sentencia UPDATE cada una)
-- para que peticiones simultáneas no se salten los límites. Solo las puede
-- ejecutar el servidor (service_role).

alter table doc_solicitudes
  add column if not exists otp_hash            text,
  add column if not exists otp_vence           timestamptz,
  add column if not exists otp_intentos        int not null default 0,
  add column if not exists otp_ultimo_envio_en timestamptz,
  add column if not exists otp_ventana_desde   timestamptz,
  add column if not exists otp_envios_ventana  int not null default 0,
  add column if not exists fallos_totales      int not null default 0;

-- Reserva un envío (respeta 1/minuto y 5/hora) y guarda el código nuevo.
-- Devuelve true si se pudo reservar.
create or replace function public.doc_reservar_envio_otp(p_id uuid, p_hash text, p_vence timestamptz)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
begin
  update doc_solicitudes set
    otp_envios_ventana = case
      when otp_ventana_desde is null or otp_ventana_desde < now() - interval '1 hour' then 1
      else otp_envios_ventana + 1 end,
    otp_ventana_desde = case
      when otp_ventana_desde is null or otp_ventana_desde < now() - interval '1 hour' then now()
      else otp_ventana_desde end,
    otp_ultimo_envio_en = now(),
    otp_hash = p_hash,
    otp_vence = p_vence,
    otp_intentos = 0
  where id = p_id
    and estado <> 'revocada'
    and (otp_ultimo_envio_en is null or otp_ultimo_envio_en < now() - interval '55 seconds')
    and (otp_ventana_desde is null or otp_ventana_desde < now() - interval '1 hour' or otp_envios_ventana < 5);
  return found;
end;
$$;

-- Registra un intento fallido: suma al código actual y al total del enlace.
create or replace function public.doc_fallo_otp(p_id uuid)
returns table (intentos int, totales int)
language sql
security invoker
set search_path = public
as $$
  update doc_solicitudes
     set otp_intentos = otp_intentos + 1,
         fallos_totales = fallos_totales + 1
   where id = p_id
  returning otp_intentos, fallos_totales;
$$;

revoke all on function public.doc_reservar_envio_otp(uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.doc_fallo_otp(uuid) from public, anon, authenticated;
grant execute on function public.doc_reservar_envio_otp(uuid, text, timestamptz) to service_role;
grant execute on function public.doc_fallo_otp(uuid) to service_role;
