-- Grupos de hasta 20 pasajeros (08-oct): el portal de documentos pasa de 12 a
-- 20 viajeros (campos P1–P20 de la oportunidad). Solo amplía los topes.

alter table doc_solicitudes drop constraint if exists doc_solicitudes_viajeros_check;
alter table doc_solicitudes
  add constraint doc_solicitudes_viajeros_check check (viajeros between 1 and 20);

alter table doc_archivos drop constraint if exists doc_archivos_viajero_check;
alter table doc_archivos
  add constraint doc_archivos_viajero_check check (viajero between 1 and 20);
