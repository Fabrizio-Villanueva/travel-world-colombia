-- ============================================================
-- Travel World Colombia — Contratos propios con firma electrónica
-- Migración 035: reemplaza las plantillas fijas de GHL (4/8/12 pasajeros).
-- ============================================================
-- El panel arma el contrato desde la oportunidad, guarda una FOTO CONGELADA
-- de su contenido (`datos` + su SHA-256) y le manda al titular un enlace
-- /contrato/<token>. El titular se verifica con un código de 6 dígitos
-- (WhatsApp o correo, igual que el portal de documentos), lee y firma con el
-- dedo. El servidor genera el PDF final (contrato + firma + hoja de
-- evidencia), guarda su SHA-256 y avisa a GHL.
--
-- Solo el servidor (service_role) toca estas tablas y el bucket: RLS activo
-- y sin políticas.

create table if not exists contratos (
  id                  uuid primary key default gen_random_uuid(),
  opportunity_id      text not null,
  contact_id          text,
  -- Hash SHA-256 del token del enlace (el token en claro nunca se guarda).
  token_hash          text not null unique,
  estado              text not null default 'enviado'
                      check (estado in ('enviado', 'firmado', 'anulado')),
  -- Foto congelada de lo que el cliente firma (ContratoDatos) y su huella.
  datos               jsonb not null,
  datos_sha256        text not null,
  reserva             text,
  titular             text,
  telefono_ultimos4   text,
  creado_por          text not null,
  creado_en           timestamptz not null default now(),
  vence_en            timestamptz not null,

  -- Código de acceso de un solo uso (mismo esquema que doc_solicitudes, 027).
  otp_hash            text,
  otp_vence           timestamptz,
  otp_intentos        int not null default 0,
  otp_ultimo_envio_en timestamptz,
  otp_ventana_desde   timestamptz,
  otp_envios_ventana  int not null default 0,
  fallos_totales      int not null default 0,

  -- Bitácora para la hoja de evidencia: [{tipo, en, ip, ua, detalle}].
  eventos             jsonb not null default '[]'::jsonb,
  visto_en            timestamptz,

  -- Firma.
  firmado_en          timestamptz,
  firmante_nombre     text,
  firmante_documento  text,
  firma_ip            text,
  firma_ua            text,
  firma_ruta          text,   -- PNG del trazo en el bucket `contratos`
  pdf_ruta            text,   -- PDF final firmado en el bucket `contratos`
  pdf_sha256          text,

  anulado_en          timestamptz,
  anulado_motivo      text
);

create index if not exists idx_contratos_opp on contratos (opportunity_id, creado_en desc);
create index if not exists idx_contratos_estado on contratos (estado, creado_en desc);

alter table contratos enable row level security;

-- Reserva un envío del código (1 por minuto, 5 por hora) y guarda su HMAC.
create or replace function public.ct_reservar_envio_otp(p_id uuid, p_hash text, p_vence timestamptz)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
begin
  update contratos set
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
    and estado <> 'anulado' -- también firmado: el cliente vuelve a bajar su PDF
    and (otp_ultimo_envio_en is null or otp_ultimo_envio_en < now() - interval '55 seconds')
    and (otp_ventana_desde is null or otp_ventana_desde < now() - interval '1 hour' or otp_envios_ventana < 5);
  return found;
end;
$$;

-- Intento fallido: suma al código actual y al total del enlace.
create or replace function public.ct_fallo_otp(p_id uuid)
returns table (intentos int, totales int)
language sql
security invoker
set search_path = public
as $$
  update contratos
     set otp_intentos = otp_intentos + 1,
         fallos_totales = fallos_totales + 1
   where id = p_id
  returning otp_intentos, fallos_totales;
$$;

-- Agrega un evento a la bitácora en una sola sentencia (sin perder eventos
-- por peticiones simultáneas).
create or replace function public.ct_evento(p_id uuid, p_evento jsonb)
returns void
language sql
security invoker
set search_path = public
as $$
  update contratos set eventos = eventos || jsonb_build_array(p_evento) where id = p_id;
$$;

revoke all on function public.ct_reservar_envio_otp(uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.ct_fallo_otp(uuid) from public, anon, authenticated;
revoke all on function public.ct_evento(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.ct_reservar_envio_otp(uuid, text, timestamptz) to service_role;
grant execute on function public.ct_fallo_otp(uuid) to service_role;
grant execute on function public.ct_evento(uuid, jsonb) to service_role;

-- Bucket privado: trazos de firma (PNG) y PDFs firmados.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('contratos', 'contratos', false, 10485760, array['application/pdf', 'image/png'])
on conflict (id) do nothing;
