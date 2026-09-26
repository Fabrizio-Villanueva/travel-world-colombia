-- ============================================================
-- Travel World Colombia — Textos editables del sitio
-- Migración 024: `textos_sitio` (plantilla global) + `destinos.textos` (por viaje)
-- ============================================================
-- Títulos, subtítulos y etiquetas de sección de la página principal y de la
-- página de producto, editables desde el panel ("Textos del sitio").
--
--   * Los ORIGINALES viven en el código (lib/textos.ts). Esta tabla guarda solo
--     lo que se cambió: clave → valor. "Restaurar" borra la fila.
--   * `destinos.textos` permite que un viaje concreto sobreescriba alguno de
--     los textos de producto (mismas claves). Vacío = usa la plantilla.
--
-- Lectura pública (son textos de la web); escritura solo desde el panel con la
-- service role (no pasa por RLS).

create table if not exists textos_sitio (
  clave           text primary key,
  valor           text not null,
  actualizado_en  timestamptz not null default now(),
  actualizado_por text
);

alter table textos_sitio enable row level security;

drop policy if exists "textos_sitio_public_read" on textos_sitio;
create policy "textos_sitio_public_read" on textos_sitio for select using (true);

alter table destinos add column if not exists textos jsonb not null default '{}'::jsonb;
