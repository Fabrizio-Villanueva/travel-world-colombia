-- ============================================================
-- Travel World Colombia — Agente Sol
-- Migración 023: anuncios de Meta (clic a WhatsApp) y su vínculo con el catálogo
-- ============================================================
-- Cuando un cliente escribe desde un anuncio de Meta (Instagram, Facebook o
-- estados de WhatsApp), GHL reenvía en el webhook la "etiqueta" del anuncio:
-- `source_id` (id del anuncio), `title`, `body` (texto completo), `source_app`,
-- `media_type`, `source_url` y `ctwa_clid`. Medido el 2026-09-26: 514 de 2.136
-- mensajes entrantes (134 conversaciones en 20 días) la traían y Sol la ignoraba.
--
-- `agente_anuncios`: un registro por anuncio, con el vínculo a los programas del
-- catálogo (`slugs`). El vínculo lo decide el modelo la primera vez que aparece
-- el anuncio (`vinculo = 'auto'`), se re-evalúa cuando el catálogo cambia
-- (`catalogo_firma`) y el panel puede fijarlo a mano (`'manual'`).
-- `agente_conversacion_anuncio`: por cuál anuncio llegó cada conversación.
--
-- Sin políticas RLS a propósito: como el resto de tablas `agente_*`, solo se
-- tocan con service-role desde el servidor.

create table if not exists agente_anuncios (
  ad_id           text primary key,          -- source_id de Meta
  titulo          text,                      -- title (el headline; a veces genérico)
  texto           text,                      -- body: el texto completo del anuncio
  source_app      text,                      -- facebook | instagram | whatsapp (estados)
  media_type      text,                      -- IMAGE | VIDEO
  source_url      text,
  nombre          text,                      -- nombre corto que deriva el modelo ("Crucero Disney Caribe")
  slugs           text[] not null default '{}',  -- programas del catálogo vinculados
  vinculo         text not null default 'pendiente'
                  check (vinculo in ('pendiente', 'auto', 'manual', 'ninguno')),
  vinculo_motivo  text,                      -- por qué el modelo (o la persona) lo vinculó así
  catalogo_firma  text,                      -- firma del catálogo con la que se hizo el vínculo automático
  leads           int not null default 0,    -- conversaciones que llegaron por este anuncio
  primera_vez     timestamptz not null default now(),
  ultima_vez      timestamptz not null default now()
);

create index if not exists idx_agente_anuncios_ultima on agente_anuncios (ultima_vez desc);

alter table agente_anuncios enable row level security;

create table if not exists agente_conversacion_anuncio (
  conversation_id text primary key,
  contact_id      text,
  ad_id           text not null references agente_anuncios (ad_id) on delete cascade,
  ctwa_clid       text,
  visto_en        timestamptz not null default now()
);

create index if not exists idx_agente_conv_anuncio_ad on agente_conversacion_anuncio (ad_id);

alter table agente_conversacion_anuncio enable row level security;

-- ── Backfill desde la bitácora: los anuncios que ya llegaron quedan registrados ──
-- (el vínculo con el catálogo queda 'pendiente' y lo resuelve el modelo con el
-- siguiente lead de cada anuncio, o desde el panel).

with ref as (
  select
    payload->'webhook'->>'source_id'  as ad_id,
    payload->'webhook'->>'title'      as titulo,
    payload->'webhook'->>'body'       as texto,
    payload->'webhook'->>'source_app' as source_app,
    payload->'webhook'->>'media_type' as media_type,
    payload->'webhook'->>'source_url' as source_url,
    recibido_en
  from agente_eventos
  where direccion = 'inbound'
    and coalesce(payload->'webhook'->>'source_id', '') ~ '^[0-9]+$'
),
-- El evento más COMPLETO de cada anuncio: los clics desde estados de WhatsApp
-- llegan sin texto y con título genérico ("Anuncio en estados"); los de
-- Instagram/Facebook traen el texto y el titular real.
ultimo as (
  select distinct on (ad_id) ad_id, titulo, texto, source_app, media_type, source_url
  from ref
  order by ad_id,
           (coalesce(texto, '') <> '') desc,
           (lower(coalesce(titulo, '')) not in ('', 'travel world colombia', 'anuncio en estados')) desc,
           recibido_en desc
),
rango as (
  select ad_id, min(recibido_en) as primera_vez, max(recibido_en) as ultima_vez
  from ref group by ad_id
)
insert into agente_anuncios (ad_id, titulo, texto, source_app, media_type, source_url, primera_vez, ultima_vez)
select u.ad_id, nullif(u.titulo, ''), nullif(u.texto, ''), nullif(u.source_app, ''),
       nullif(u.media_type, ''), nullif(u.source_url, ''), r.primera_vez, r.ultima_vez
from ultimo u join rango r using (ad_id)
on conflict (ad_id) do nothing;

with ref as (
  select
    payload->'webhook'->>'source_id' as ad_id,
    payload->'webhook'->>'ctwa_clid' as ctwa_clid,
    conversation_id, contact_id, recibido_en
  from agente_eventos
  where direccion = 'inbound'
    and conversation_id is not null
    and coalesce(payload->'webhook'->>'source_id', '') ~ '^[0-9]+$'
)
insert into agente_conversacion_anuncio (conversation_id, contact_id, ad_id, ctwa_clid, visto_en)
select distinct on (conversation_id) conversation_id, contact_id, ad_id, nullif(ctwa_clid, ''), recibido_en
from ref
order by conversation_id, recibido_en asc
on conflict (conversation_id) do nothing;

update agente_anuncios a
set leads = (select count(*) from agente_conversacion_anuncio c where c.ad_id = a.ad_id);
