-- ============================================================
-- Travel World Colombia — Bucket `documentos` cerrado a la allowlist
-- Migración 020: mismas reglas que el bucket `destinos` (migración 010)
-- ============================================================
-- La 018 abrió el bucket con las políticas de la 003 (anteriores a la
-- allowlist): cualquier usuario AUTENTICADO podía subir, reemplazar o borrar
-- los PDF de los viajes, y cualquiera (incluso anónimo) podía listarlo.
--
-- Queda igual que `destinos`: el bucket sigue público para LEER cada archivo
-- por su URL (así funcionan los enlaces de la página del producto), pero
-- listar y escribir es solo para aprobados (es_admin_aprobado()).
-- El panel sube con upsert: true, que necesita select + update: ambos quedan
-- permitidos para aprobados.

drop policy if exists "documentos_storage_read"   on storage.objects;
drop policy if exists "documentos_storage_list"   on storage.objects;
drop policy if exists "documentos_storage_insert" on storage.objects;
drop policy if exists "documentos_storage_update" on storage.objects;
drop policy if exists "documentos_storage_delete" on storage.objects;

create policy "documentos_storage_list" on storage.objects
  for select to authenticated
  using (bucket_id = 'documentos' and (select public.es_admin_aprobado()));

create policy "documentos_storage_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documentos' and (select public.es_admin_aprobado()));

create policy "documentos_storage_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'documentos' and (select public.es_admin_aprobado()));

create policy "documentos_storage_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'documentos' and (select public.es_admin_aprobado()));
