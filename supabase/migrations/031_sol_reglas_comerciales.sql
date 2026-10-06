-- ============================================================
-- Travel World Colombia — Reglas comerciales de Sol (solo administradores)
-- Migración 031: política de reserva, rangos de precio de referencia y promociones
-- ============================================================
-- Plan: docs/plan-sol-vendedora.md §9 y §17 paso 2 (decidido el 05-oct-2026).
--   * Lo edita SOLO el rol admin desde /admin/sol (el panel usa la service role;
--     RLS activado sin políticas = nadie más lo lee ni lo escribe).
--   * Sol (v2) lo lee en cada turno: así el 20 % o un rango se cambian sin deploy.

-- Política de reserva: una sola fila.
create table if not exists sol_politica_reserva (
  id smallint primary key default 1 check (id = 1),
  anticipo_pct numeric(5,2) not null default 20 check (anticipo_pct > 0 and anticipo_pct <= 100),
  saldo_dias_antes integer not null default 30 check (saldo_dias_antes >= 0),
  pago_total_si_faltan_dias integer not null default 30 check (pago_total_si_faltan_dias >= 0),
  medios_pago text,
  notas text,
  actualizado_en timestamptz not null default now(),
  actualizado_por text
);
alter table sol_politica_reserva enable row level security;

insert into sol_politica_reserva (id, anticipo_pct, saldo_dias_antes, pago_total_si_faltan_dias, medios_pago, notas)
values (
  1, 20, 30, 30,
  'Transferencia o llave a Bancolombia o Davivienda, PSE, efectivo en la oficina de Fusagasugá y tarjeta con link de pago (Prix, +5 %). Detalle en travelworldcolombia.com/pagos.',
  'El monto exacto del anticipo lo confirma la asesora al bloquear la tarifa. Tarifas no reembolsables o tiquetes sueltos pueden exigir pago total.'
)
on conflict (id) do nothing;

-- Rangos de precio de referencia por persona (los que Sol puede decir).
create table if not exists sol_rangos (
  id uuid primary key default gen_random_uuid(),
  destino text not null,
  slug text,                       -- programa del catálogo, si existe
  noches text,
  temporada text not null default 'baja' check (temporada in ('baja', 'alta', 'todo_el_ano')),
  desde numeric(14,2) not null check (desde > 0),
  hasta numeric(14,2) not null check (hasta >= desde),
  moneda text not null default 'COP' check (moneda in ('COP', 'USD')),
  incluye text,
  notas text,
  activo boolean not null default true,
  revisado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
alter table sol_rangos enable row level security;
create index if not exists sol_rangos_slug_idx on sol_rangos (slug);

-- Tabla v1 (docs/plan-sol-vendedora.md §7): cotizaciones reales de TWC
-- (feb-sep 2026) cruzadas con ofertas públicas del 05-oct-2026. Por persona,
-- acomodación doble, saliendo de Bogotá, temporada baja/media.
insert into sol_rangos (destino, slug, noches, temporada, desde, hasta, moneda, incluye, notas)
select * from (values
  ('San Andrés', 'san-andres', '3-4 noches', 'baja', 1800000, 3300000, 'COP', 'Vuelo + hotel todo incluido + traslados', 'No incluye la tarjeta de turismo (~$153.000 por persona).'),
  ('Punta Cana', 'republica-dominicana', '4-5 noches', 'baja', 2800000, 5500000, 'COP', 'Vuelo + resort todo incluido + traslados', 'Resorts de gama alta pueden llegar a ~$7.700.000.'),
  ('Cartagena', 'cartagena', '3 noches', 'baja', 1300000, 2500000, 'COP', 'Vuelo + hotel + traslados', null),
  ('Santa Marta', 'santa-marta', '3 noches', 'baja', 1100000, 2500000, 'COP', 'Vuelo + hotel + traslados', null),
  ('Panamá (ciudad + playa)', 'panama', '4 noches', 'baja', 2800000, 4500000, 'COP', 'Vuelo + hoteles + traslados', 'En enero puede llegar a ~$5.300.000.'),
  ('Cancún', 'cancun', '5-6 noches', 'baja', 3000000, 6000000, 'COP', 'Vuelo + hotel todo incluido + traslados', null),
  ('Aruba', 'aruba', '3-4 noches', 'baja', 2500000, 6000000, 'COP', 'Vuelo + hotel', 'Con desayuno ~$2,5-4,5 M; todo incluido ~$5,5-6 M.'),
  ('Curazao', null, '4 noches', 'baja', 3500000, 5000000, 'COP', 'Vuelo + hotel todo incluido', null),
  ('Coveñas / Tolú', 'covenas-tolu', '3 noches', 'baja', 1800000, 3000000, 'COP', 'Vuelo + hotel', 'Por bus sale mucho más barato.'),
  ('Eje Cafetero', 'eje-cafetero', '3 noches', 'baja', 950000, 1400000, 'COP', 'Transporte terrestre + hotel + parques', 'Con vuelo, desde ~$1.400.000.'),
  ('Crucero por el Caribe desde Cartagena', 'crucero-cartagena-colombia', '7 noches', 'baja', 1000, 1900, 'USD', 'Cabina (interior a suite) con comidas a bordo', 'No incluye propinas (~USD 130 por semana) ni el vuelo a Cartagena.')
) as v(destino, slug, noches, temporada, desde, hasta, moneda, incluye, notas)
where not exists (select 1 from sol_rangos);

-- Promociones con fecha límite: la ÚNICA urgencia que Sol puede mencionar.
create table if not exists sol_promociones (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  slug text,
  detalle text not null,
  valida_hasta date not null,
  cupos integer check (cupos is null or cupos >= 0),
  activa boolean not null default true,
  creado_en timestamptz not null default now()
);
alter table sol_promociones enable row level security;
