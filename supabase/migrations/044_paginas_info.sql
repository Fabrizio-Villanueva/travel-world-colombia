-- ============================================================
-- Travel World Colombia — Páginas informativas del pie de página
-- Migración 044 (15-oct-2026): textos que pide la ley y la información de la
-- compañía (¿Quiénes somos?, Política LA/FT, Trabaja con nosotros…),
-- editables desde el panel ("Páginas del pie de página").
--
--   * La LISTA de páginas (título, columna, orden) vive en el código
--     (lib/paginas-info.ts). Esta tabla guarda solo el texto de cada una.
--   * Una página se ve en la web solo si está publicada y tiene texto.
--
-- Lectura pública solo de las publicadas; escritura desde el panel con la
-- service role (no pasa por RLS).
-- ============================================================

create table if not exists paginas_info (
  slug            text primary key,
  intro           text not null default '',
  contenido       text not null default '',
  publicada       boolean not null default false,
  actualizado_en  timestamptz not null default now(),
  actualizado_por text
);

alter table paginas_info enable row level security;

drop policy if exists "paginas_info_public_read" on paginas_info;
create policy "paginas_info_public_read" on paginas_info for select using (publicada);
