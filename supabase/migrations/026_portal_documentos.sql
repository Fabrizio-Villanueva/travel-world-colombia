-- ============================================================
-- Travel World Colombia — Portal seguro de documentos de viajeros
-- Migración 026: bucket PRIVADO + solicitudes/tokens + archivos + reglas de visa
-- ============================================================
-- Diseño: docs/idea-portal-documentos.md. Un enlace por VIAJE (oportunidad de
-- GHL) lleva al cliente a /documentos/<token>, donde sube pasaporte / cédula /
-- visa de cada viajero. Los archivos son datos SENSIBLES (Ley 1581): viven en
-- un bucket privado propio (sin URL pública; solo el servidor sube y el panel
-- los ve con URLs firmadas de 5 minutos), y se borran 30 días después del
-- regreso. En GHL queda el dato extraído (P1–P8) y el estado, nunca la imagen.
--
-- Sin políticas RLS a propósito (igual que agente_*): estas tablas y el bucket
-- solo se tocan con service-role desde el servidor. El cliente anónimo nunca
-- habla con PostgREST ni con Storage directamente; las subidas usan URLs de
-- subida firmadas que emite el servidor por archivo.

-- ── Bucket privado ──
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documentos-viajeros',
  'documentos-viajeros',
  false,
  10485760, -- 10 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Por si alguna política vieja genérica aplicara a este bucket: ninguna.
-- (storage.objects tiene RLS activo; sin política = sin acceso salvo service-role.)

-- ── Solicitudes: un enlace por oportunidad ──
create table if not exists doc_solicitudes (
  id                 uuid primary key default gen_random_uuid(),
  opportunity_id     text not null,
  contact_id         text,
  -- Solo el HASH del token: el enlace completo vive en GHL (campo "Link de
  -- documentos") y se le muestra a la asesora al crearlo. Si la base se
  -- filtrara, nadie podría abrir los enlaces.
  token_hash         text not null unique,
  -- Lo que ve el cliente en la portada (sin más datos personales).
  nombre_viaje       text,
  destino            text,
  fecha_salida       date,
  fecha_regreso      date,
  -- Verificación: últimos 4 dígitos del celular del contacto al crear el enlace.
  telefono_ultimos4  text not null check (telefono_ultimos4 ~ '^[0-9]{4}$'),
  intentos_fallidos  int  not null default 0,
  bloqueada_hasta    timestamptz,
  -- Qué pide este viaje: {"pasaporte": true, "cedula": false, "visa": true}
  requisitos         jsonb not null default '{"pasaporte": true, "cedula": false, "visa": false}'::jsonb,
  viajeros           int  not null default 1 check (viajeros between 1 and 8),
  -- Nombres precargados desde P1–P8 (índice 0 = viajero 1); puede traer nulos.
  nombres            jsonb not null default '[]'::jsonb,
  estado             text not null default 'activa'
                     check (estado in ('activa', 'completa', 'revocada')),
  vence_en           timestamptz not null,
  -- Consentimiento Ley 1581 (casilla obligatoria antes de subir).
  consentimiento_en  timestamptz,
  consentimiento_ip  text,
  consentimiento_ua  text,
  ultimo_acceso_en   timestamptz,
  -- Retención: cuándo se borraron las fotos (los datos en GHL se quedan).
  purgada_en         timestamptz,
  creada_por         text not null,
  creada_en          timestamptz not null default now(),
  actualizada_en     timestamptz not null default now()
);

create index if not exists idx_doc_solicitudes_opp on doc_solicitudes (opportunity_id, creada_en desc);
create index if not exists idx_doc_solicitudes_estado on doc_solicitudes (estado, vence_en);

alter table doc_solicitudes enable row level security;

-- ── Archivos subidos (uno por viajero × tipo; reemplazar borra el anterior) ──
create table if not exists doc_archivos (
  id                 uuid primary key default gen_random_uuid(),
  solicitud_id       uuid not null references doc_solicitudes (id) on delete cascade,
  viajero            int  not null check (viajero between 1 and 8),
  tipo               text not null check (tipo in ('pasaporte', 'cedula', 'visa')),
  ruta               text not null,           -- objeto en el bucket documentos-viajeros
  mime               text,
  bytes              int,
  ip                 text,
  subido_en          timestamptz not null default now(),
  -- Lectura automática (Fase 2): MRZ determinística o visión; siempre se confirma.
  metodo             text check (metodo in ('mrz', 'vision', 'manual')),
  confianza          text check (confianza in ('alta', 'media', 'baja')),
  datos_extraidos    jsonb,
  revision_requerida boolean not null default false,
  -- Lo que el cliente confirmó/corrigió y se escribió en P1–P8.
  datos_confirmados  jsonb,
  confirmado_en      timestamptz,
  escrito_ghl_en     timestamptz,
  error_ghl          text,
  -- Avisos útiles (p. ej. "pasaporte vence antes de 6 meses del regreso").
  avisos             jsonb not null default '[]'::jsonb,
  -- Retención: el objeto ya no existe en el bucket.
  borrado_en         timestamptz,
  unique (solicitud_id, viajero, tipo)
);

create index if not exists idx_doc_archivos_solicitud on doc_archivos (solicitud_id);

alter table doc_archivos enable row level security;

-- ── Reglas de visa por país (editables desde el panel) ──
-- ¿Un colombiano con pasaporte ordinario necesita visa para entrar? Alimenta la
-- sugerencia de requisitos del Generador (la asesora siempre confirma). NO se
-- adivina: lo que no esté aquí no se sugiere.
create table if not exists doc_reglas_visa (
  pais             text primary key,          -- nombre en español, igual que lib/paises.ts
  requiere_visa    boolean not null default false,
  nota             text,                      -- excepciones ("no si tiene visa de EE. UU. vigente")
  actualizado_por  text,
  actualizado_en   timestamptz not null default now()
);

alter table doc_reglas_visa enable row level security;

-- Semilla inicial (octubre 2026; el equipo la revisa y ajusta desde el panel).
insert into doc_reglas_visa (pais, requiere_visa, nota) values
  ('Estados Unidos', true,  'Visa B1/B2 vigente.'),
  ('Canadá',         true,  'Visa de residente temporal (no basta eTA).'),
  ('México',         true,  'Exento si tiene visa de EE. UU., Canadá, Reino Unido, Japón o Schengen vigente.'),
  ('Cuba',           false, 'Tarjeta de turista (la gestiona la agencia).'),
  ('Reino Unido',    true,  'Visa de visitante.'),
  ('España',         false, 'Espacio Schengen: sin visa hasta 90 días. ETIAS cuando entre en vigor.'),
  ('Francia',        false, 'Espacio Schengen: sin visa hasta 90 días. ETIAS cuando entre en vigor.'),
  ('Italia',         false, 'Espacio Schengen: sin visa hasta 90 días. ETIAS cuando entre en vigor.'),
  ('Portugal',       false, 'Espacio Schengen: sin visa hasta 90 días. ETIAS cuando entre en vigor.'),
  ('Alemania',       false, 'Espacio Schengen: sin visa hasta 90 días. ETIAS cuando entre en vigor.'),
  ('Países Bajos',   false, 'Espacio Schengen: sin visa hasta 90 días. ETIAS cuando entre en vigor.'),
  ('Grecia',         false, 'Espacio Schengen: sin visa hasta 90 días. ETIAS cuando entre en vigor.'),
  ('Turquía',        false, null),
  ('Egipto',         true,  'Visa a la llegada / e-visa.'),
  ('Emiratos Árabes Unidos', true, 'Visa electrónica (suele gestionarla la aerolínea).'),
  ('Japón',          false, null),
  ('China',          true,  null),
  ('Tailandia',      false, null),
  ('Australia',      true,  'Visa de visitante (subclase 600).'),
  ('Perú',           false, null),
  ('Ecuador',        false, null),
  ('Chile',          false, null),
  ('Argentina',      false, null),
  ('Brasil',         false, null),
  ('Uruguay',        false, null),
  ('Panamá',         false, null),
  ('Costa Rica',     false, null),
  ('Guatemala',      false, null),
  ('República Dominicana', false, null),
  ('Aruba',          false, null),
  ('Curazao',        false, null),
  ('Jamaica',        false, null),
  ('Colombia',       false, 'Viaje nacional: solo cédula / tarjeta de identidad.')
on conflict (pais) do nothing;
