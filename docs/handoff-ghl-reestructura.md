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
| 2 | E-02 · Formulario web → contacto + tarjeta | ❌ Descartado (los leads entran por WhatsApp → E-01) |
| 3 | ~~L-03~~ "Asignar Lead a Usuario Creador" | 🗄️ Archivado (01-oct): solo miraba tags de la importación de feb; al crear a mano GHL ya deja la asesora (y Luisa crea para otras asesoras) |
| 4 | X-01 · Tag mayorista → B2B + quitar tarjeta | ✅ Cerrado (01-oct): Find opp = Leads + Open confirmado; borra la tarjeta (decisión del usuario); 0 mayoristas con tarjeta abierta salvo la de prueba de Fabrizio |
| 5 | S-01 · Mensaje entrante → Sol | ✅ Cerrado (01-oct): sin línea `proveedor`; "No contestar" = zolutium-ai / [device] mayorista b2b / mayorista / operadores / stop_bot (espejo de la compuerta 3 de lib/agente/conversacion.ts, se deja como prefiltro barato) |
| 6 | S-02 · IA-NOMBRE → nombre | ✅ |
| 7 | Stop/Active Bot (wait 2 h → quita stop_bot) | 🔁 Reemplazado por **Sol de respaldo** (código, 02-oct): vigilante cada 10 min cubre chats con stop_bot sin respuesta (15 min fuera de horario / 2 h en horario), tag `sol_respaldo`, se retira cuando la asesora escribe; `AGENTE_RESPALDO=off` lo apaga. Usuario: apagar este wf → ZZ y quitar línea `stop_bot` de S-01 |
| 8 | L-01 · Sol califica → Calificado + asignar + tarea | ✅ |
| 9 | L-04 · Sol escala → aviso + tarea a la asesora | ✅ (02-oct): tag `transferencia a humano` → Assign to user (5 asesoras, equitativo, solo no asignados) → SMS interno + tarea. Antes 11/59 escalados sin asesora = nadie avisado. 🟡 Pendiente: el tag nunca se quita → 2ª escalada del mismo cliente no avisa |
| 10 | L-02 · Lead sin respuesta 60 min | ✅ |
| — | 148 leads en Lead Nuevo sin asesora | Falta automatizar (24 h sin calificar → asignar) |
| 11 | C-01 · Venta ganada → Reservaciones | ✅ (2 disparadores) |
| 12 | C-03 · Preview → borrador | ✅ |
| 13 | C-02 · Enviar contrato | ✅ (02-oct): ramas Enviar/Reenviar → If etapa = 📋 Reserva Creada → Update opp → 📤 Contrato Enviado ("mover a etapa anterior" apagado). Probado con opp de prueba MjJyGQv4hzJnmdcu4wJM (PRUEBA – Fabrizio): avanza, y no retrocede si el Generador ya la llevó a En Pagos |
| 14 | C-04 (hoy "Notificación Contrato Firmado") | Renombrar; tras el bloqueo: Find + Update → ✍️ Contrato Firmado; ¿2 notificaciones iguales? · ⏸️ EN PAUSA por decisión del usuario (02-oct) |
| 15 | V-01 · Salida −45 días → recordatorio + Por Viajar si pagó | ✅ (02-oct) modificado en el mismo wf. "Antes de X días" dispara EXACTO (verificado: 8/8 inscritos a 45 d) |
| 16-19 | V-02..V-05 · 30/15/7/2 días | ✅ (02-oct) duplicados de V-01, textos nuevos con {{opportunity.fecha_confirmada_de_salida}}; V-04 crea tarea "Entregar vouchers" / "Cobrar saldo"; V-05 tarea cobro hoy; viejos apagados → ZZ |
| 20 | V-06 · Día de salida → En Viaje | ✅ (02-oct) "Antes de 0 días" (GHL no tiene "después de"); pagados y con saldo → 🛫 En Viaje; None solo aviso. ⚠️ Confirmar en historial que 0 días dispara |
| 21 | V-07 · Día de regreso → Completada | ✅ (02-oct) Fecha confirmada de REGRESO, 0 días → ✈️ Completada |
| 22 | P-01 · Regreso +5 → pedir reseña | ✅ (02-oct) disparador = cambio de fase a ✈️ Completada (Reservaciones) → wait 5 d → ¿sigue en Completada? → SMS + correo → 🌟 Solicitar Review |
| 23 | P-02 · Reseña Google/Facebook | ✅ (02-oct) rama 1-3: tag `cliente_con_mala_experiencia` + notificación interna (asignada + 3 personas fijas) + tarea "Llamar por reseña negativa"; ya no usa Add to Workflow → P-03 |
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
