# Traspaso — Reestructura de GHL (pipelines, campos, contratos, workflows)

> Estado al 2026-10-01 (cierre de sesión). Subcuenta TWC `RMFUo0i4KOVl7eZHEn7s`.
> API: `https://services.leadconnectorhq.com`, header `Version: 2021-07-28`, token
> `GHL_TWC_PIT` (.env.local). Respaldos, logs, CSVs y scripts Python de esta etapa:
> carpeta local `.respaldos-ghl/` (excluida de git: tiene datos de clientes).
> ⚠️ Otra sesión tiene WIP sin commitear en `app/admin/reservas/actions.ts`
> (manejo de contactos duplicados): NO usar `git add -A`; stagear solo lo propio
> (para ese archivo se usó `git update-index --cacheinfo` con HEAD + hunks propios).

## Reglas acordadas
- Solo **2 pipelines**: 🎯 Leads (venta) → 🗂️ Reservaciones (operación, hasta el regreso).
- **Contacto = la persona** (identidad, facturación, IA - NOMBRE). **Oportunidad = el viaje**.
- Valor de la venta = "Total Pasajeros - Valor Total". Todo en COP.
- Eventos de negocio por etapa/estado de la oportunidad, nunca por campos del contacto.
- Cada movimiento de etapa y cada mensaje tiene **un solo responsable** (sin encimarse).
- Nada se ejecuta en la cuenta sin mostrar el plan y tener el OK del usuario; probar con
  1-3 casos y esperar ~90 s (efectos de workflows) antes del lote.

## Hecho (resumen)
- Pipelines viejos (PRINCIPAL, Clientes Viajando) migrados y borrados.
- Fases 1-4 y 6: ventas duplicadas borradas; valores cargados; 5.072 datos contacto→opp;
  plantillas de contrato v2 en oportunidad; Generador mueve etapa/valor por abonos;
  Sol escribe calificación en contacto Y oportunidad (carpeta "⭐ Calificación (Sol)").
- Generador de Contratos (`lib/admin/reservas-automatizacion.ts`):
  - `prepararEnvioContrato`: ENVIAR CONTRATO? queda solo con la acción pedida (el wf
    "ha cambiado a" siempre dispara).
  - `completarConSugerencias`: al pedir Enviar/Reenviar/Preview guarda las sugerencias
    amarillas (del contacto) en la oportunidad; **no** para clientes repetidos
    (`esClienteRepetido`), cuyo formulario arranca en blanco.
  - Pestaña 12 "Operaciones" (campo opp "Envío de documentos", Pendiente/Completado),
    "Guardar y seguir" nunca salta a ella.
- Campos de operaciones del contacto: Pagos, Fecha de Viaje (operaciones), Compra
  Ejecutada → se eliminan (reemplazo: etapa / Fecha confirmada de salida / won en
  Reservaciones). "Envío de documentos" migrado a opp (`dCkL6hdJ4HNO3HkRxxw6`).
- Contacto "ENVIAR CONTRATO?" renombrado "(CONTACTO - NO USAR)"; los de oportunidad se
  resuelven POR NOMBRE en el Generador (no renombrarlos).
- Sol renombra la tarjeta de Leads al confirmar el nombre real (cd4d90b).
- Limpieza Leads: 17 pares de duplicados resueltos; 62 tarjetas renombradas.

## 🔴 Bloqueo abierto — contratos no quedan "Completado"
El cliente firma pero el doc queda "Visualizado" esperando a la asesora (firmante porque
las casillas son campos rellenables asignados al remitente). Como asesora, "Terminar" /
"Marcar como completado" → "Documento incompleto" sin casillas vacías visibles.
Pendiente: ver opciones de "ASSIGN SENDER FIELDS TO" en la acción del workflow (C-02);
buscar elementos no-texto asignados al remitente en la plantilla; si no, convertir las
casillas en texto fijo con etiquetas. C-04 (firma) depende de esto.

## Workflows — recorrido del cliente (revisión en curso, uno por uno)
Carpetas: 01 Entrada (E-) · 02 Sol (S-) · 03 Ventas (L-) · 04 Contratos (C-) · 05 Viaje
(V-) · 06 Post-viaje (P-) · 07 Relación (R-) · 08 Proveedores (X-) · ZZ Archivo.
Nombre: `PREFIJO-NN · disparador → acción`. La API no deja ver/mover carpetas ni leer
el interior de un workflow: el usuario manda capturas.

| # | Workflow | Estado |
|---|---|---|
| 1 | E-01 · Contacto nuevo → tarjeta en Leads | ✅ Cerrado |
| 2 | E-02 · Formulario web → contacto + tarjeta | 🆕 **SIGUIENTE**: el webhook de la web (`GHL_WEBHOOK_URL`, lib/ghl/webhook.ts) responde "test request received" = sin workflow; nunca hubo contactos `web-form`. Usuario crea wf con Inbound Webhook y pasa la URL; se actualiza en Vercel; prueba; mapear Create/Update Contact |
| 3 | L-03 (hoy "Asignar Lead a Usuario Creador") | Renombrar; faltan ramas Lynda (tag lynda_quintero) y Adriana (sin tag) |
| 4 | X-01 · Tag mayorista → B2B + quitar tarjeta | Hecho; confirmar Find opp = Leads + Open |
| 5 | S-01 · Mensaje entrante → Sol | Quitar línea tag `proveedor` |
| 6 | S-02 · IA-NOMBRE → nombre | ✅ |
| 7 | Stop/Active Bot (wait 2 h → quita stop_bot) | Decidir; recomendación: borrar |
| 8 | L-01 · Sol califica → Calificado + asignar + tarea | ✅ |
| 9 | L-04 (hoy "Internal SMS Alert and Task") | Renombrar |
| 10 | L-02 · Lead sin respuesta 60 min | ✅ |
| — | 148 leads en Lead Nuevo sin asesora | Falta automatizar (24 h sin calificar → asignar) |
| 11 | C-01 · Venta ganada → Reservaciones | ✅ (2 disparadores) |
| 12 | C-03 · Preview → borrador | ✅ |
| 13 | C-02 · Enviar contrato | ✅; pendiente: mover a 📤 Contrato Enviado (lo haría el Generador) |
| 14 | C-04 (hoy "Notificación Contrato Firmado") | Renombrar; tras el bloqueo: Find + Update → ✍️ Contrato Firmado; ¿2 notificaciones iguales? |
| 15-19 | V-01..V-05 · 45/30/15/7/2 días | 🔁 Rehacer (viejos publicados como respaldo) |
| 20 | V-06 · Salida → En Viaje | 🔁 Rehacer |
| 21 | V-07 · Regreso → Completada | 🔁 Rehacer |
| 22 | P-01 · Regreso + 5 → pedir reseña | 🔁 Rehacer |
| 23 | P-02 · Reseña Google/Facebook | Rama 1-3: reemplazar "Add to Workflow" por notificación propia (tag `cliente_con_mala_experiencia`) |
| 24 | P-03 · Formulario reseña negativa | ✅ |
| — | R-01 · Cumpleaños | ✅ |
| ZZ | 1.-Nuevo Lead, Compro, compradores, Picture Review (borradores) | Borrar |

### Patrón para V-01..V-07 y P-01
1. Disparador: Recordatorio de fecha · **Campo de fecha de oportunidad** (Fecha confirmada
   de salida / de regreso) · operador **exactamente** (no "at most": con ventas tardías
   se dispararían varios juntos).
2. **Find opportunity** (Reservaciones · Won · más reciente) — obligatorio: GHL no cuenta el
   recordatorio por fecha como disparador de oportunidad y sin él no hay condiciones de
   etapa ni Update.
3. Condición por **Pipeline stage**: "Pago completo" = Pagada y Documentada **OR** Por
   Viajar; "Saldo pendiente" = Reserva Creada / Contrato Enviado / Contrato Firmado /
   En Pagos; None = solo alerta interna (sin SMS: ahí caen canceladas).
4. Pago completo → Update → 🧳 Por Viajar (en todos los V-01..V-05). V-04 + tarea
   "Entregar vouchers". Not found → aviso interno.
5. Textos: `{{contact.first_name}}`/`{{contact.name}}`, fecha
   `{{opportunity.fecha_confirmada_de_salida}}`, destino `{{opportunity.destino_de_inters}}`.
6. Migrar sin huecos: duplicar el viejo, armar la nueva, publicarla y apagar la vieja el
   mismo día.

## Datos pendientes que solo puede corregir el equipo
- Sin fecha de viaje: Diego Valencia, Cecilia Peñuela (Por Viajar), Héctor Moreno (En Viaje).
- Diana Alarcón: salida 8-ago-2028 (¿2026?). Rocío Salazar: Reserva Creada con salida pasada.
- Eliza Cloting: regreso antes que la salida. 12 clientes con reservas duplicadas en Reservaciones.
- Luz Nelly Adz: liquidación ADL Multiple con tarifa/cantidad invertidas.
- Fechas de oportunidad se imprimen en inglés en contratos (probar `| date: "%d/%m/%Y"`).
