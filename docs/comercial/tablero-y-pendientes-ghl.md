> **Estado 10-oct:** el **tablero "Comercial TWC" ya está creado** (sección 3 hecha, más el widget "Leads asignados por asesora"). Siguen pendientes las secciones 1 (reseñas en español) y 2 (compartir la vista), y los gráficos de Reservaciones.

# Lo que quedó para ti en GHL (10-oct)

Lo que hice anoche en GHL quedó guardado (ver resumen al final). Estos tres cambios
los bloqueó el sistema de permisos porque tocan recursos compartidos de la cuenta,
así que te los dejo con el paso a paso. Cada uno toma 2–5 minutos.

---

## 1. Reseñas en español (2 min)

**Reputación → Configuración → Reviews AI → "Legacy Reviews AI" → ⋮ → Editar**

1. **Idioma:** cambia **Dinámico** por **Fijo** y elige **Spanish**.
2. **Instrucciones del mensaje:** borra el texto en inglés y pega esto:

   > Eres Travel World Colombia, agencia de viajes en Fusagasugá. Responde siempre en español de Colombia, tuteando, con calidez y en máximo 3 frases. Agradece por el nombre y menciona algo concreto de la reseña si lo hay. No hagas preguntas ni incluyas precios, promociones o datos de contacto. Si la reseña es negativa: discúlpate sin excusas y di que te escribiremos por WhatsApp para resolverlo.

3. En la vista previa dale **Generar** y revisa que salga en español.
4. **Guardar agente**.

---

## 2. Compartir la vista "Leads · vista asesoras" (2 min)

La creé anoche: tarjetas con **Propietario, Fuente, Valor, Destino de interés,
Fechas tentativas, Cantidad de adultos y Temperatura**.
Solo la ves tú y las administradoras hasta que la compartas.

**Clientes potenciales → pestaña "Leads · vista asesoras" → Personalizar lista → Compartir y permisos**

1. **Compartir con usuarios seleccionados** → añade a **Alejandra, Johana, Juan Camilo, Adriana y Juanita**.
2. Permiso: **Puede ver**.
3. **Compartir**.
4. Opcional: en **Vista por defecto**, márcala para que sea la que abre todo el equipo.

---

## 3. Tablero comercial (5 min)

No toques el "Dashboard" actual. Crea uno nuevo:

**Tablero → selector de tableros → "+ Nuevo" → nombre "Comercial TWC"**

Filtro de fecha arriba: **Este mes**.

| Fila | Widget | Configuración | Para qué |
|---|---|---|---|
| 1 | **Opportunity Status** | Pipeline 🎯 Leads | Cuántos leads entraron y cuántos siguen abiertos |
| 1 | **Conversion Rate** | Pipeline 🎯 Leads | Conversión real (cuando dejen de crear ventas en tarjetas nuevas) |
| 1 | **Opportunity Value** | Pipeline 🗂️ **Reservaciones** | Valor vendido (las ventas viven en Reservaciones, no en Leads) |
| 2 | **Funnel** | Pipeline 🎯 Leads | Embudo Lead Nuevo → Ganada (ya quedó activado) |
| 2 | **Stages Distribution** | Pipeline 🎯 Leads | Cuántos hay en cada etapa, incluida 🧊 No calificado |
| 3 | **Tasks** | Pendiente · Todos los usuarios · vencimiento ascendente | Cola de trabajo (pide al equipo cerrar las tareas atendidas) |
| 3 | **Lead Source Report** | Todas las secuencias | Se vuelve útil cuando publiquemos la fuente automática (código listo esta noche) |
| 4 | **Google Business Profile** | — | Es el único widget de marketing que hoy funciona bien |

**Quitar o no agregar:**
- **Google Analytics:** no está conectado; marca error.
- **Google Ads:** conexión vencida; no pautan en Google.
- **Facebook Ads Report:** solo cuenta clics, no conversaciones de WhatsApp. Engaña más de lo que ayuda.
- **Manual Actions:** siempre en 0.

**Para que el embudo de Reservaciones también se vea:**
**Configuración → Clientes potenciales & Pipelines → Pipelines → Reservaciones → Editar →
columna "Mostrar en informes"**: marca **Gráfico circular** en todas las etapas y
**Gráfico de embudo** en Reserva Creada → Contrato Enviado → Contrato Firmado → En Pagos →
Pagada y Documentada → Por Viajar → En Viaje → Completada. Deja Cancelada solo en circular.
**Guardar**. Luego agrega al tablero un segundo **Funnel** con pipeline Reservaciones.

**Lo que el tablero de GHL no puede mostrar** (va en el panel /admin, tarea a9 del plan):
leads calificados sin respuesta humana en más de 1 hora, tiempo de respuesta por asesora,
costo por lead de cada anuncio y ventas por anuncio.

---

## Resumen de lo que sí hice anoche en GHL

- **Pipeline 🎯 Leads → "Mostrar en informes":**
  - Embudo + circular: Lead Nuevo, Calificado por Bot, Asignado, Contactado, Cotización Enviada, En Seguimiento y Ganada.
  - Solo circular: 🧊 No calificado (es un desvío: en el embudo inflaría las barras) y Perdida/Abandonado.
  - Guardado: "Secuencia Leads (venta) actualizada".
  - Nota: en la tabla de configuración la fila de Perdida/Abandonado se ve sin íconos, pero lo verifiqué directamente y tiene el circular marcado.
- **Vista nueva "Leads · vista asesoras":** tarjetas con Propietario, Fuente, Valor, Destino de interés, Fechas tentativas, Cantidad de adultos y Temperatura. Quité Empresa, Razón de abandono y Etiquetas inteligentes. La vista original no se tocó.
- **No se borró ni se creó nada más.** Un formulario de "crear agente de reseñas" se abrió por error y se cerró sin guardar.
