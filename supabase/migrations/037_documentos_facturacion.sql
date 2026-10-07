-- Portal de documentos (07-oct): antes de subir documentos el cliente confirma
-- sus datos de facturación (paso 1 del portal). Lo confirmado se escribe en los
-- campos de facturación del CONTACTO en GHL (los que imprime el contrato) y
-- aquí queda la foto de lo que el cliente confirmó y cuándo.

alter table doc_solicitudes
  add column if not exists facturacion jsonb,
  add column if not exists facturacion_confirmada_en timestamptz;
