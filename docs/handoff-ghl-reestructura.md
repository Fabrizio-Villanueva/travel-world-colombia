# Traspaso — Reestructura de GHL (pipelines, campos, contratos)

> Estado al 2026-10-01. Subcuenta TWC `RMFUo0i4KOVl7eZHEn7s`, API con `GHL_TWC_PIT`.
> Respaldos, logs y scripts de esta etapa: carpeta local `.respaldos-ghl/`
> (excluida de git: tiene datos de clientes).

## Objetivo
Que el tablero de GoHighLevel muestre métricas correctas y que todo se automatice
en **dos pipelines**: 🎯 Leads (venta) → 🗂️ Reservaciones (operación, hasta el regreso).
Regla de campos: **contacto = la persona** (identidad, facturación, IA - NOMBRE);
**oportunidad = el viaje**. Valor de la venta = "Total Pasajeros - Valor Total". Todo en COP.

## Hecho
- **Pipelines:** ✅ PIPELINE PRINCIPAL y 🛫 Clientes Viajando migrados y **borrados**.
  Historial cerrado en Leads (✅ Ganada / ❌ Perdida); viajes en Reservaciones por fecha real.
  Nueva etapa 🌎 Solicitar Review. Workflows viejos por etapa en borrador.
- **Workflows de viaje** (45/30/15/7/2 días, 4.-En Viaje, 5.-Termino su viaje,
  6.-Solicitar Review): sin "Crear/actualizar oportunidad"; condición "Pago completo";
  rama None con aviso; 4/5/6 usan Find + Update opportunity; 5 y 6 disparan con
  CPA-Fecha de Regreso. wf 3 "Venta Ganada to Reservación" con 2º disparador (botón Ganado).
- **Tags:** único tag de proveedor = `mayorista / operadores` (`proveedor` borrado).
- **Fase 1 (tablero):** 98 ventas duplicadas borradas en Leads; 28 valores cargados;
  aviso Ley 1581 de Sol corregido; endpoint de reservación acepta el botón "Ganado".
- **Fase 2 (datos):** 5.072 valores contacto → oportunidad en 108 reservas; 10 campos de
  calificación de Sol creados en la carpeta de oportunidad "⭐ Calificación (Sol)".
- **Fase 3 (contrato v2):** plantillas "Contrato de viaje · Travel World Colombia" (≤4 pax)
  y "Contrato de viaje grupal · Travel World Colombia" (5-8 pax) con todas las etiquetas
  en `{{opportunity.*}}` (facturación y `{{user.name}}` siguen en contacto). Workflow
  "Envio de Contrato" ahora dispara con **"La oportunidad ha cambiado"** sobre
  ENVIAR CONTRATO? (oportunidad) → el contrato llega con datos ✅. El campo de contacto se
  renombró "ENVIAR CONTRATO? (CONTACTO - NO USAR)".
- **Fase 4 (Generador automático):** `lib/admin/reservas-automatizacion.ts` — al guardar:
  valor de la tarjeta, primer abono → 💳 En Pagos, saldo 0 → 📁 Pagada y Documentada.

## 🔴 Bloqueo abierto — los contratos no se completan
El cliente firma, pero el documento queda "Visualizado / Esperando a otros" (214 hoy).
La asesora figura como **firmante** porque las casillas son campos rellenables asignados al
remitente ("ASSIGN SENDER FIELDS TO: From User" en la acción del workflow). Al intentar
"Terminar" o "Marcar como completado" como asesora: *"Documento incompleto. Rellene los
campos necesarios"*, aunque no se ve ninguna casilla vacía.
Próximos pasos:
1. Ver las opciones del desplegable **"ASSIGN SENDER FIELDS TO"** (en cada rama por asesora).
2. En el editor de la plantilla, revisar elementos asignados al remitente que **no** sean
   texto (firma, iniciales, fecha, casilla de verificación) — posible resto escondido.
3. Si nada de lo anterior: **convertir las casillas en texto fijo con las etiquetas**
   (nadie las "llena"; el contrato se completa con la firma del cliente).
Contrato de prueba: `6abde765e6c30ccdcd4ee846` (cliente firmó, Lynda Quintero pendiente).

## Pendientes (en orden)
1. Resolver el bloqueo de arriba; luego: desmarcar "Obligatorio" en Observaciones (v2),
   renombrar plantillas viejas 🌎4/🌎8 a "ZZ (obsoleto)", apagar
   `ESPEJO_CONTACTO_TRANSICION` en `lib/admin/reservas.ts`, borrar borradores y datos de
   prueba de la oportunidad `oc64f3LFxnkpKBRQFSZ2` ("Fabrizio Villanueva | Ghl & Ia").
2. Workflow de envío: la condición reparte por asesora — confirmar en cada rama la
   plantilla nueva y **dónde se elige 4 vs grupal**.
3. Fechas del contrato salen en inglés ("March 15, 2027"); probar `| date: "%d/%m/%Y"`.
4. **Fase 5:** firma → ✍️ Contrato Firmado automático; guía por WhatsApp + recordatorios
   24/48 h + aviso a la asesora a las 72 h.
5. **Fase 6:** Sol escribe la calificación en la oportunidad (código + workflows/tareas
   que muestran esos campos).
6. **Fase 7:** disparadores de fecha → "Fecha confirmada de salida/regreso" (oportunidad,
   confirmado que GHL lo permite); quitar Find; mensaje según etapa (reemplaza "Pagos").
7. **Fase 8:** carpetas/nombres de workflows (`ZZ · Archivo` para los en borrador).
8. **Fase 9:** tablero (ventas del mes por asesora, conversión; incluir ambos pipelines).
9. **Fase 10:** limpieza de campos de contacto (~30 vacíos primero; resto con cuarentena).

## Notas
- Un documento creado **sin oportunidad vinculada** (pantalla Documentos, o workflow que
  arranca desde el contacto) sale con todas las etiquetas `{{opportunity.*}}` vacías.
- El Generador resuelve campos de oportunidad **por nombre** (no renombrarlos) y de
  contacto por clave.
- Verificación de plantillas por API: `POST /proposals/templates/send` con
  `sendDocument:false` + contacto y oportunidad de prueba → leer `fillableFields`.
- Otra sesión dejó cambios sin commitear en `app/admin/reservas/actions.ts`
  (manejo de contactos duplicados) — no son de esta etapa.
