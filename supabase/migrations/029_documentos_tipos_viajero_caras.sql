-- ============================================================
-- Travel World Colombia — Portal de documentos v2
-- Migración 029: tipos de viajero, documentos de dos caras y registro civil
-- ============================================================
-- Traspaso: docs/handoff-portal-documentos-v2.md (decisiones del 05-oct).
--   * Cada viajero es adulto, menor o infante (lo marca la asesora).
--   * Cédula (adulto) y tarjeta de identidad (menor) se suben por las DOS
--     caras: una fila por cara en doc_archivos. Pasaporte, visa y registro
--     civil son una sola foto ('unica').
--   * Registro civil de nacimiento: infantes en viajes nacionales, y menores e
--     infantes en viajes internacionales (prueba de parentesco).
-- La lectura y la confirmación viven en la cara principal (frente o única);
-- el reverso solo guarda la imagen. Las filas viejas quedan como 'unica'.

alter table doc_solicitudes
  add column if not exists viajeros_tipo jsonb not null default '[]'::jsonb;

comment on column doc_solicitudes.viajeros_tipo is
  'Tipo de cada viajero (índice 0 = viajero 1): adulto | menor | infante. Faltante = adulto.';

alter table doc_archivos
  add column if not exists cara text not null default 'unica';

alter table doc_archivos drop constraint if exists doc_archivos_cara_check;
alter table doc_archivos
  add constraint doc_archivos_cara_check check (cara in ('frente', 'reverso', 'unica'));

alter table doc_archivos drop constraint if exists doc_archivos_tipo_check;
alter table doc_archivos
  add constraint doc_archivos_tipo_check check (tipo in ('pasaporte', 'cedula', 'visa', 'registro_civil'));

alter table doc_archivos drop constraint if exists doc_archivos_solicitud_id_viajero_tipo_key;
alter table doc_archivos drop constraint if exists doc_archivos_solicitud_viajero_tipo_cara_key;
alter table doc_archivos
  add constraint doc_archivos_solicitud_viajero_tipo_cara_key unique (solicitud_id, viajero, tipo, cara);
