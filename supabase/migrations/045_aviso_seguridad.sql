-- ============================================================
-- Travel World Colombia — Aviso antisuplantación
-- Migración 045 (16-oct-2026): hay estafadores que mandan la web como
-- "prueba" y escriben desde otro número. Una franja en todo el sitio y la
-- página /verificar dicen cuál es el único WhatsApp oficial.
--
-- Una sola fila (id = 1), editable desde el panel ("Aviso de seguridad").
-- Sin fila, el sitio usa los valores del código (lib/aviso-seguridad.ts).
-- Lectura pública; escritura con la service role.
-- ============================================================

create table if not exists aviso_seguridad (
  id              int primary key default 1 check (id = 1),
  activo          boolean not null default true,
  -- Pop-up con la pieza "nuestras únicas cuentas y canales" al entrar al sitio.
  popup_activo    boolean not null default true,
  mensaje         text not null,
  -- Números oficiales, solo dígitos con indicativo (573204891930), separados por coma.
  numeros         text not null,
  actualizado_en  timestamptz not null default now(),
  actualizado_por text
);

alter table aviso_seguridad enable row level security;

drop policy if exists "aviso_seguridad_public_read" on aviso_seguridad;
create policy "aviso_seguridad_public_read" on aviso_seguridad for select using (true);
