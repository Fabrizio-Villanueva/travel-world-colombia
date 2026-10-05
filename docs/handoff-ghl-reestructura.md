# Traspaso — Reestructura de GHL (pipelines, campos, contratos, workflows)

> Estado al 2026-10-02 (cierre de sesión; recorrido de workflows COMPLETO y limpieza de campos en cuarentena). Subcuenta TWC `RMFUo0i4KOVl7eZHEn7s`.
> API: `https://services.leadconnectorhq.com`, header `Version: 2021-07-28`, token
> `GHL_TWC_PIT` (.env.local). Respaldos, logs, CSVs y scripts Python de esta etapa:
> carpeta local `.respaldos-ghl/` (excluida de git: tiene datos de clientes).
> ⚠️ `app/admin/reservas/actions.ts` tiene WIP sin commitear de otra sesión (contactos
> duplicados, ver pendiente 6): NO usar `git add -A`; stagear solo lo propio.

## ▶️ PENDIENTES AL CIERRE DEL 02-OCT (empezar aquí)
**Usuario / equipo, pronto**
1. 3 clientes escalados que esperan persona: "😀" (reserva noviembre, 01-oct), Sandra Zapata (calificada 09-sep, nunca
   contactada), Angie (25-sep). + 8 escaladas viejas sin asesora (solo asignar).
2. Quitar la acción que llena "Etapa del Lead" (contacto) en E-01 y/o L-01 (12 de 40 contactos nuevos aún la reciben).
**Con fecha**
3. ~16-oct: si nada falló, el usuario borra en GHL la carpeta de contacto "🗄️ Por eliminar" (193 campos).
4. Con la primera salida/regreso: confirmar en "Historial de inscripciones" que V-06/V-07 disparan con "0 días".
**Para la próxima sesión de Claude**
5. Ver en agente_eventos la nota nueva de Sol "calificación (...): guardada en la oportunidad".
6. `app/admin/reservas/actions.ts` (WIP de otra sesión, 01-oct 12:27): arreglo de contactos duplicados del Generador;
   completo y compila; falta OK del usuario para publicarlo.
**Cuando se quiera**
7. 148 leads en Lead Nuevo sin asesora → L-03 (24 h sin calificar → asignar). El usuario los revisa primero.
8. Datos que corrige el equipo (sección al final). 9. Borrar 6 workflows viejos en borrador.
10. Presentación "Así trabaja tu CRM" (https://claude.ai/artifact/8mNrAwVAkurCs8B6z4BoSE): compartir desde su menú.
11. Opcional Sol de respaldo: presentarse como Sol, copiar usted/tú de la asesora, una sola nota.
- C-04 (contrato no queda "Completado"): DESCARTADO por ahora (decisión del usuario).
- Portal seguro de documentos de viajeros: **IMPLEMENTADO 03-oct** (Fases 1-3) → ver sección "Portal de documentos" abajo y docs/idea-portal-documentos.md. C-05 y C-06 armados y probados. **v2 HECHA 05-oct** (tipos de viajero, dos caras, enlace `P{n} - Documentos (panel)` en la opp) → docs/handoff-portal-documentos-v2.md.

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
  Sol escribe la calificación SOLO en la oportunidad (desde 02-oct; antes en ambos).
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
- 05-oct: 273 tarjetas con mensaje de asesora → 📞 Contactado (44 recibieron asesor = quien escribió;
  las de Pilar → Ginna); 20 sin actividad >90 días → ❌ Abandonado; tag `new_lead` (muerto desde ~08-ago)
  quitado de toda la cuenta. Desde ahí el cron `/api/agente/etapas` (cada 10 min, `lib/agente/etapas.ts`)
  lo mantiene solo: mensaje de asesora → Contactado; Lead Nuevo con asesor → Asignado. Solo avanza.

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
| 9 | L-04 · Sol escala → aviso + tarea a la asesora | ✅ (02-oct): tag `transferencia a humano` → Assign to user (5 asesoras, equitativo, solo no asignados) → SMS interno + tarea. Antes 11/59 escalados sin asesora = nadie avisado. Rearmado: al final Wait 24 h → Remove Tag `transferencia a humano` (escaladas repetidas en 24 h no re-avisan; después vuelve a avisar) |
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
| 25 | C-05 · Solicitar documentos → enlace al cliente | ✅ Armado y probado por el usuario (03-oct) |
| 26 | C-06 · Documentos completos → tarea a la asesora | ✅ Armado y probado por el usuario (03-oct) |
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

## Limpieza de campos de contacto (en curso, 02-oct)
- 154 campos de contacto tienen copia en la oportunidad (catálogo scripts/ghl-campos-oportunidad.catalog.json).
- Respaldo de sus valores (7.059 contactos): `.respaldos-ghl/respaldo_campos_contacto_migrados.json.gz`;
  clasificación: `.respaldos-ghl/inventario_campos_contacto.csv` (scripts `inventario_campos.py`, `huerfanos.py`).
- Datos sin copia en opp: solo 30 contactos (4 de prueba/equipo, 24 con 1 dato ≈ Acomodación, 4 reales:
  Jairo Londoño, Sergio León, Javier Jiménez, Guillermo Ramos). CPA-Fecha de Ida: 119/125 iguales, Sergio copiada;
  Javier NO (tarjeta abandonada, dispararía V-01).
- Código (a7f72e7): Generador ya no espeja al contacto (ESPEJO_CONTACTO_TRANSICION=false) y la mudanza ya no
  copia CPA-Fecha de Ida → ningún proceso escribe los 154.
- Plantillas 🌎8/🌎4 ya no se usan (C-02 usa las v2 con {{opportunity.*}}); textos de workflows pasados a opp.
- ✅ Cuarentena (02-oct): los 154 movidos por API a la carpeta de contacto "🗄️ Por eliminar (migrados a oportunidad)"
  (`8QoctQg2QrsSGx5vVNwv`); datos intactos (verificado). Carpetas originales en
  `.respaldos-ghl/carpetas_originales_campos.json`. 7 carpetas que quedaron vacías se borraron (Liquidación Vuelos,
  Registro de Pagos, Información de Pasajeros, Enviar Contratos., Inclusiones y Exclusiones, Paquetes - Generales
  del Viaje, Informacion de Vuelos): para devolver un campo habría que recrear su carpeta.
- (02-oct) También a cuarentena los 7 de "Acciones del Representante" (Etapa del Lead, Cliente en Viaje, Contrato y
  Facturación, Fecha del Viaje, Fecha de Regreso, Cotización Enviada, Tipo de Compra; respaldo
  `respaldo_acciones_representante.json.gz`) y carpeta borrada; luego "Firma del cliente" (vacío en los 7.060) y carpeta 🧾 Contratos borrada → 162 en cuarentena.
  Después: Liquidación Porción Terrestre (2 espejos de Total Pasajeros; 8 cantidades + Javier copiadas a su tarjeta),
  Pasaportes (7, sin archivos), Form | Pasaportes (5, form sin envíos), Operaciones Luisa (4; Fecha de Viaje ops 65
  iguales a la opp) → cuarentena y sus 4 carpetas borradas. Total en cuarentena: 180 (respaldos *.json.gz en
  .respaldos-ghl/). Quedan carpetas: Additional Info, Calificación (Sol), Contact, 📋Datos de Facturación. ⚠️ "Etapa del Lead" la sigue
  llenando algún workflow (¿E-01/L-01?): quitar esa acción antes del borrado. ~16-oct: si nada falló, el usuario los borra en GHL.
- 2ª ronda (02-oct, 7f503f3): Sol escribe la calificación SOLO en la opp (al contacto solo ia__nombre). Los 13 campos de la carpeta
  de contacto "Calificación" → cuarentena (respaldo respaldo_calificacion_contacto.json.gz, 1.026 contactos) y carpeta
  borrada; antes se copiaron 1.608 datos a 320 tarjetas abiertas de Leads que solo los tenían en el contacto
  (calif_copia.py / calif_aplicar.py, 0 errores). sol_* (11) SE QUEDAN en el contacto (decisión: describen la
  conversación con la persona). Cuarentena total: 193. Pendiente: ver en agente_eventos la nota nueva
  "calificación (...): guardada en la oportunidad".

## Carpetas de oportunidad (02-oct)
Renombradas y ordenadas como el contrato (nombres previos en .respaldos-ghl/carpetas_opp_nombres_antes.json):
⭐ Calificación (Sol) · 📄 Contrato · 🧾 Facturación · 🗺️ Generales del Viaje · ✈️ Vuelos · 👥 Pasajeros ·
🧮 Liquidación · 💳 Plan de Pagos · ✅ Inclusiones y Exclusiones. El Generador agrupa por su catálogo (no por el
nombre de la carpeta en GHL); los CAMPOS de oportunidad no se renombran (el Generador los resuelve por nombre).

## Datos pendientes que solo puede corregir el equipo
- Sin fecha de viaje: Diego Valencia, Cecilia Peñuela (Por Viajar), Héctor Moreno (En Viaje).
- Diana Alarcón: salida 8-ago-2028 (¿2026?). Rocío Salazar: Reserva Creada con salida pasada.
- Eliza Cloting: regreso antes que la salida. 12 clientes con reservas duplicadas en Reservaciones.
- Luz Nelly Adz: liquidación ADL Multiple con tarifa/cantidad invertidas.
- Fechas de oportunidad se imprimen en inglés en contratos (probar `| date: "%d/%m/%Y"`).

## Portal de documentos de viajeros (03-oct, implementado)
Código: `lib/documentos/*`, `app/documentos/[token]`, pestaña Documentos del Generador, `/admin/documentos`. Migración 026 en prod.
Campos de oportunidad nuevos (carpeta 👥 Pasajeros): `Link de documentos` (`QGhEZI6g6dcUFrDcnAsD`, TEXT),
`Solicitar documentos` (`BKkSYqWHYFufZET1oKl7`, Enviar/Reenviar), `Documentos del cliente` (`9TEMrVYyVwNhTVmJFkFr`,
Solicitados/Parciales/Completos) y `P1..P8 - Visa Número` / `Visa Vencimiento` (16; también en el catálogo del Generador).
Flujo: asesora (pestaña Documentos) → "Enviar enlace" → el servidor crea el token, escribe `Link de documentos`, pone
`Documentos del cliente = Solicitados` y cambia `Solicitar documentos` (lo vacía y escribe Enviar o Reenviar: GHL siempre ve
un cambio) → **C-05** manda el enlace → el cliente pide un código de 6 dígitos (le llega por WhatsApp desde la cuenta, o por
correo; lo envía el servidor, no un workflow), acepta la Ley 1581 y
sube los documentos → el sistema lee (MRZ/visión), el cliente confirma → P{n} escritos → al completar:
`Documentos del cliente = Completos` + nota en el contacto. Fotos solo en el bucket privado; se borran 30 días tras el regreso.
Oportunidad de prueba: `NnDUr5gyZfnGI4LWGHWl` (PRUEBA – Portal documentos, contacto Fabrizio).
v2 (05-oct): 8 campos TEXT de oportunidad `P1..P8 - Documentos (panel)` (👥 Pasajeros) con el enlace a
`/admin/reservas/<opp>/documentos/<n>` (pide sesión; las asesoras con rol representante lo abren). Ninguna foto se sube a GHL.

### C-05 · Solicitar documentos → enlace al cliente — ✅ ARMADO y probado por el usuario (03-oct)
Carpeta 04 Contratos. Nombre: `C-05 · Solicitar documentos → enlace al cliente`.
1. **Disparador 1**: Opportunity custom field changed → campo `Solicitar documentos` → "has changed to" `Enviar`.
   **Disparador 2** (mismo workflow): igual, "has changed to" `Reenviar`. Filtro opcional: Pipeline = 🗂️ Reservaciones.
2. **Acción WhatsApp/SMS** (canal de la cuenta): texto sugerido —
   «Hola {{contact.first_name}} 👋 Para dejar lista tu reserva a {{opportunity.destino_de_inters}} necesitamos los
   documentos de los viajeros (pasaporte, cédula o visa, según el viaje). Súbelos aquí de forma segura 🔒
   {{opportunity.link_de_documentos}} — el enlace es personal: al abrirlo te llega un código a este WhatsApp. Las fotos
   quedan cifradas, solo las ve tu asesora y se borran al terminar el viaje. ¡Gracias!»
3. **Acción Email** (asunto «Documentos para tu viaje a {{opportunity.destino_de_inters}}»), mismo texto + botón al enlace.
4. **Nota interna** (opcional): «Enlace de documentos enviado».
Probar con la oportunidad de prueba: en el Generador → pestaña Documentos → "Reenviar (enlace nuevo)" y revisar que
llegue el WhatsApp al contacto de prueba.

### C-06 · Documentos completos → tarea a la asesora — ✅ ARMADO por el usuario (03-oct), publicado
Disparador «La oportunidad ha cambiado»: `Documentos del cliente` ha cambiado a `Completos` + pipeline = 🗂️ Reservaciones →
Add task «Revisar documentos de viajeros» (asignado del contacto, vence en 1 día) → notificación interna SMS al propietario
asignado → notificación interna SMS fija a Luisa Aguirre. Falta la prueba: en la tarjeta de prueba poner el campo en
Parciales y volver a Completos; debe inscribirse y crear la tarea. El sistema además deja una nota en el contacto.

### Pendientes del portal
- Revisar la semilla de reglas de visa (/admin/documentos/visas): 33 países, criterio "colombiano con pasaporte ordinario".
- Opcional: en V-03/V-04 agregar rama «si `Documentos del cliente` ≠ Completos → recordar el enlace».
- La oportunidad de prueba tiene el enlace apuntando a localhost (se generó en local); al probar C-05 usar "Reenviar".

### Capacitación del equipo (05-oct)
Oportunidades "CAPACITACIÓN – Portal documentos (Nombre)" en 🗂️ Reservaciones / Reserva Creada, asignadas a cada asesor,
destino Cancún, México, 1 pasajero, SIN fecha de salida (para no disparar V-01..V-07):
Alejandra `Afh31Y92ciu2SEU75FQ0`, Ginna `5N1sJi9oX91wDtFqMK7P`, Juan Camilo `AsR4istQ6T4LjUawHN18`, Juanita `N8AfO5I4hg6ozQSIgbYb`,
Luisa `xfV90cli1OcvJ1JgdUxR` (contacto sin correo), Lynda `4dO3QKZsM6Vit9HXOm3U`, Maria Pilar `P9ccLVyqPloRSYo0q5qO`,
Adriana `vM6B2H38UUjladE9ZIL5` (contacto SIN celular: su usuario tiene el número de la agencia; falta su celular personal),
Johana `lmss11BLOWacsyrhWebq` (contacto sin celular; su número está en el contacto "Cl Conta al día" `Dpby2l4v7VZBpk53HsVS`, tag
johana_lozano: confirmar con el usuario antes de mover). Alejandra, Ginna y Juan Camilo se movieron al contacto que tiene su
celular (zgflFnJFQCDvYTFGGZ0N, J2zSGMpjGr865pH1Qx95, Yo0UDSlBsxSq95YFsXkZ). Al terminar: borrar fotos y cerrar estas oportunidades.
