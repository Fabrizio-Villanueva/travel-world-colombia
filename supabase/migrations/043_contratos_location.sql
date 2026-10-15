-- ============================================================
-- Travel World Colombia — Contratos por subcuenta de GHL
-- Migración 043: cada contrato guarda la subcuenta (locationId) desde la que
-- se emitió, para que la lista de "Contratos enviados" del Generador sirva
-- igual cuando el panel atienda varias subcuentas. Los existentes son de TWC.
-- ============================================================

-- El default (TWC) mantiene funcionando el código que aún no manda la
-- subcuenta; el panel la manda siempre en cada contrato nuevo.
alter table contratos add column if not exists location_id text not null default 'RMFUo0i4KOVl7eZHEn7s';

-- Lista del Generador: por subcuenta (y por quien lo emitió), lo más nuevo arriba.
create index if not exists idx_contratos_location on contratos (location_id, creado_en desc);
create index if not exists idx_contratos_location_creador on contratos (location_id, creado_por, creado_en desc);
