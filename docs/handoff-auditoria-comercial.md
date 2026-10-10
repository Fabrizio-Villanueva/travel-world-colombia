# Traspaso: auditoría comercial y plan de acción (09–10 oct 2026)

> Para la próxima sesión de Claude. Léelo completo antes de tocar nada.
> Regla de siempre: **nada se escribe en GHL ni se envía a clientes sin el OK del dueño**; lotes con muestra
> de 1–3 y espera de ~90 s. "Publica" = checklist de `.claude/commands/publicar.md`.

## 1. Enlaces

| Qué | Dónde |
|---|---|
| Informe de la auditoría (privado) | https://claude.ai/artifact/HfWeKfuRsaMhrdELYb5WKX |
| Plan de acción con casillas (privado) | https://claude.ai/artifact/VeQy2iHGVbz7acft5wuPp2 |
| Guiones del equipo, respuestas rápidas, specs | `docs/comercial/` |
| Tablero GHL | Tablero → "Comercial TWC" (id `6ac9b45a5574cd59832155ab`) |
| Panel reactivación | `/admin/sol/reactivacion` |

## 2. Diagnóstico en una línea

Las ventas se pierden **entre el traspaso de Sol y la asesora**: Sol responde en 18 s, pero la asesora tardaba
21 h de mediana (40 % > 24 h, 23 % nunca). Los leads se triplicaron (181 ago → 452 sep) y las reservas
siguieron en ~42/mes. Además el CRM no registraba cotización, valor, fuente ni motivo de pérdida.

Línea base para comparar: 21 h de espera · conversión de la cohorte de septiembre 9,7 % · 1–2 ventas de Meta
desde el 08-sep · 32 % de las ventas de octubre con valor · 335 tareas vencidas · 262 leads sin dueño.

## 3. Publicado (main)

| Commit | Qué |
|---|---|
| `0812dd9` | Inclusiones nuevas en GHL ("Traslado en bus…", "Coordinador de viaje") |
| `493cd33` | Portal de documentos: el botón ya no fuerza la cámara (iPhone) |
| `94b848c` | Rol representante puede abrir el PDF firmado (`proxy.ts`) |
| `9e36928` | Sol: horario real de apertura (`lib/agente/horario.ts`, salta festivos) y nombres "Johanna/Gina" |
| `e383397` | **Reactivación A/B** (IA vs plantilla) + migración **040** `agente_reactivacion` |
| `2d01586` | Reactivación: sin promesas, "sin visa" solo con respaldo del catálogo, reintento de la IA |
| `4810374` | Reactivación **encendida**, 1 cliente por minuto (cron `0-39 15 * * 1-6`) |
| `acfe0da` | **SLA humano** (aviso 60 min / 3 h, migración **041** `agente_sla_humano`), **fuente real** y **valor** automáticos, PSE Davivienda en el contrato, etiquetas "equipo"/"administrador" |

Migraciones 040 y 041 **aplicadas en producción**.

### Reactivación A/B (`lib/agente/reactivacion/*`)
- Elegibles: rescate (habló y no calificó) y silencioso (nunca respondió), solo WhatsApp QR, ≥3 días sin
  respuesta tras el último mensaje de Sol, sin humano en el chat, sin tags de exclusión.
- 20 enviados por día (50/50 por variante, estable por hash del contactId), uno por pasada, cada minuto de
  10:00 a 10:39 Bogotá, L-S; nunca domingos/festivos ni fuera de la ventana de la Ley 2300.
- Validación igual para las dos variantes: sin precios, cupos, descuentos, demanda inventada, voseo, promesas
  ("estamos armando", "hoy mismo"), "sin visa" solo si TODAS las fichas son `visa: no_requiere` en el
  catálogo, ni "sin salir del país" en cruceros; en silenciosos no se permite "sé que / me contaste / quedamos en".
- "SALIR" → tag `no_contactar`, confirmación única, Sol no vuelve a hablarle.
- Interruptor: `REACTIVACION.activo` en `lib/agente/config.ts`. Primer envío real: **sáb 10-oct 10:00**.
- Pendiente: medir respuesta por variante a 7 y 30 días; conectar la etapa 🧊 No calificado (ver §5).

### SLA humano, fuente y valor (`lib/agente/sla-*.ts`, `opp-reglas.ts`, `mantenimiento-opp.ts`)
- Sol registra cada traspaso (calificado/escalado); el cron del vigilante avisa a la asesora asignada por su
  WhatsApp interno (`CONTACTO_INTERNO_DE_ASESORA`) a los 60 min hábiles y a supervisión (`ALERTAS_INTERNAS`:
  Fabrizio, Ginna, Lynda) a las 3 h. Interruptor `AGENTE_SLA_HUMANO=off`.
- Fuente real en el `source` nativo de la oportunidad (GHL lo acepta, verificado 10-oct: 60 tarjetas en la
  primera pasada). `AGENTE_FUENTE=off`.
- Valor: copia "Total Pasajeros - Valor Total" a ventas sin valor (≥ 100.000). 11 casos dudosos solo se
  reportan (uno de 20.083.205 COP con "4" en el campo). `AGENTE_VALOR_VENTA=off`.

## 4. Cambios hechos en GHL

| Qué | Estado |
|---|---|
| Opp de 8,6 billones (`mWQWA0qGo0lQHbj49g7N`) | Corregida por el dueño. Origen: L-01 paso "Calificado Por Bot" → Valor = Presupuesto Estimado |
| Pilar → Ginna | 11 opps + 70 tareas reasignadas (respaldo en scratchpad); usuario de Pilar eliminado |
| FB-Token | Rotado y reemplazado por el dueño (lo usan los workflows con Meta Conversion API) |
| L-01 | Quitado "Etapa del Lead" (cuarentena). **Verificar** que ningún contacto nuevo reciba campos de la carpeta "🗄️ Por eliminar" antes de borrarla (~16-oct) y que el Valor de "Calificado Por Bot" quedó vacío |
| E-01 | Excluye "equipo" y "administrador" (dueño) |
| Etiquetas | "administrador": Ginna, Lynda · "equipo": Adriana, Alejandra, Johana, Juan Camilo, Juanita, Luisa, Sofía, Milena. Sin "mayorista / operadores" |
| Pipeline Leads | Etapa nueva **🧊 No calificado** (después de Lead Nuevo). "Mostrar en informes": embudo+circular de Lead Nuevo a Ganada; circular en No calificado y Perdida |
| Vista "Leads · vista asesoras" | Tarjetas con Propietario, Fuente, Valor, Destino, Fechas tentativas, Adultos, Temperatura. **Falta compartirla** (permisos bloquearon a Claude) |
| Tablero "Comercial TWC" | Clon limpio + "Leads asignados por asesora" (donut por Responsable, filtro pipeline Leads). La conversión usa **Todas las secuencias + Fecha de creación** (filtrar por Leads da ~0 % porque las ventas se mudan a Reservaciones) |
| Eventos Meta | En curso por el dueño: L-01 → Lead, C-02 → InitiateCheckout, C-04 (activador "Estado del contrato = Firmado") → Purchase. "Probar flujo" de GHL omite el paso de Meta; probar con firma real. Si sale "Skipped" por falta de atribución → CAPI de mensajería desde código con `ctwa_clid` |

## 5. Pendientes

**Del dueño (UI o decisiones)**
- Renovar el tope de gasto de Meta ($450k, se agotaba ~11-oct).
- Reseñas: Reputación → Reviews AI → "Legacy Reviews AI" → idioma **Fijo · Spanish** + instrucciones en español (`docs/comercial/tablero-y-pendientes-ghl.md` §1). Hoy responde en inglés.
- Compartir "Leads · vista asesoras" con las asesoras.
- Terminar y probar Lead / InitiateCheckout / Purchase; quitar el código TEST19726.
- Motivos de pérdida en lista cerrada; despublicar C-02 viejo y C-03.
- Repo de GitHub en privado (pendiente de la auditoría de seguridad del 08-oct).
- Decidir capacidad del equipo (46 % de los leads llega fuera de horario).

**De Claude (código, con "publica")**
1. Revisar resultados de la reactivación (panel) y del SLA (tabla `agente_sla_humano`, avisos enviados).
2. Conectar **🧊 No calificado**: al cerrar los seguimientos sin calificar, mover la tarjeta ahí con tag
   rescate/silencioso; que Sol (`crm.ts moverSiCalificado`, hoy solo desde Lead Nuevo) y el cron
   (`etapas.ts ETAPAS_TEMPRANAS`) sigan funcionando desde esa etapa. Pedir al dueño el id de la etapa
   (o leerlo por API de pipelines).
3. Sol: no prometer tiempos y escalar al primer reclamo; quitar mensajes dobles de la ráfaga; red de
   seguridad para mensajes que nunca llegan a Sol; Hawái/Disney en el catálogo; filtrar salidas vencidas.
4. Alerta diaria de reservas sin fecha de salida (52 no reciben V-01..V-07).
5. Panel /admin comercial: cola sin respuesta, tiempo por asesora, costo por lead por anuncio.
6. Limpieza del pipeline por lotes (24 huérfanas, 26 ganadas viejas en Leads, 12 reservas duplicadas,
   25 etapa/estado incoherentes): regenerar la lista; la de la sesión anterior estaba en el scratchpad.
7. Estrategia de Meta Ads con la demanda real (ver memoria `estrategia-ads-pendiente`).

## 5b. Sesión del 09-oct noche (sin publicar al cierre: esperaba "publica")

- **🧊 No calificado** conectado (`lib/agente/no-calificado.ts`, etapa `7811ad09-…`): al dormir (despedida
  fija v2 / tope v1) o "Sol decidió no insistir", la tarjeta pasa de Lead Nuevo a No calificado con tag
  `no_calificado_rescate|silencioso`. Sol sube a Calificado desde ahí; el cron de etapas y la pausa también
  la miran. `AGENTE_NO_CALIFICADO=off`. Sin backfill (9 dormidos viejos siguen en Lead Nuevo).
- Sol: prompts v1/v2 sin promesas de tiempo y escalada al PRIMER reclamo de la cotización.
- Dobles: filtro de webhook duplicado de GHL (mismo messageId + mismo `message.body`) en `eventos.ts`.
- **Red de seguridad** (`lib/agente/red-seguridad.ts`, en el cron del vigilante): chats con mensaje del
  cliente sin evento → se registra y pasa a Sol. Dry-run de 6 días: 2 de 305 (los 2 de Hawái), 0 falsos.
  `AGENTE_RED_SEGURIDAD=off`.
- Anuncios: `salidas-vencidas.ts` avisa a Sol de fechas ya pasadas en el texto del anuncio; "nunca digas
  que no lo tenemos" para productos fuera del catálogo. Hawái/Disney siguen SIN ficha (falta contenido del
  dueño) y sus anuncios tienen fechas vencidas (Disney 01 y 04-oct, Hawái "septiembre").

### Limpieza pendiente (después del sáb 10-oct)
- [ ] Confirmar que Sol atendió los 2 leads de Hawái: en `agente_eventos`, nota "RED DE SEGURIDAD" en
      `2pcYg1taiPayqXLTXP3W` y `8pDG1UneiQ6Ik2nHckcG` (respuesta de Sol en la nota "SOL → …").
- [ ] Vaciar la lista `RECUPERAR` de `lib/agente/red-seguridad.ts` (uso único; no hace daño si queda,
      porque el evento evita repetir, pero es código muerto) y publicar.
- [ ] Anuncios pausados el 09-oct por fechas vencidas: Hawái `120251839809900047` y Disney
      `120251839733600047`. Reemplazarlos con fechas nuevas o archivarlos cuando haya fichas en el catálogo.
- [ ] Extensión `pg_trgm` en Supabase: se queda (OK del dueño), solo se usó para medir dobles.
- 5 tarjetas dormidas movidas a 🧊 No calificado el 09-oct (195rHVL…, XVd3FPE…, kxmf92E…, 3irybHT…, VtkUgWx…).

## 6. Datos útiles

- GHL: location `RMFUo0i4KOVl7eZHEn7s`, token `GHL_TWC_PIT` en `.env.local`. Paginar oportunidades **por
  cursor** (`startAfter`/`startAfterId`); `page=` se corta. No usar el MCP `prod-ghl-mcp`.
- Pipelines: Leads `MLoZOGIYvCBRUgQdYRA8`, Reservaciones `Jq7CxjuirY9Gu44el0bs`.
- Usuarios (id → contacto interno): ver `CONTACTO_INTERNO_DE_ASESORA` y `ALERTAS_INTERNAS` en `lib/agente/config.ts`.
- Píxel Meta `1112372080170789`; cuenta publicitaria `320184193754094`.
- El editor de workflows de GHL y algunos cambios de permisos no se pueden hacer desde el navegador de
  Claude (cargan en blanco o los bloquea el sistema de permisos): dar el paso a paso al dueño.
