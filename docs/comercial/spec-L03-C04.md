> **Estado 10-oct:** la parte de **L-03 quedó DESCARTADA** como está escrita (repartía leads fríos a las asesoras). Los no calificados los trabaja la reactivación de Sol (lib/agente/reactivacion). Ver docs/handoff-auditoria-comercial.md. La parte de **C-04** sigue vigente.

# Especificación para armar en GHL: L-03 y C-04

> Para armar a mano en Automatización → Workflows (la API de GHL no permite crear ni editar workflows).
> Regla de siempre: probar con 1–3 casos y esperar ~90 s antes de dejarlo correr.

---

## L-03 · Lead sin asesora → asignar

**Para qué:** que ningún lead pase más de un día sin dueña. Hoy hay 215 en "🆕 Lead Nuevo" sin asesora.
**Qué NO hace:** no mueve la etapa. Cuando la tarjeta tiene dueña, el cron `/api/agente/etapas` la pasa solo a "👤 Asignado a Agente" (un solo responsable por movimiento).

### Activador
- **Oportunidad creada**
  - Filtro: Pipeline **es** 🎯 Leads (venta)

### Pasos
1. **Esperar** 24 horas.
   - En "Ventana avanzada": continuar solo lunes a sábado, 8:00–18:00 (Bogotá). Si la espera termina de noche, sigue a primera hora.
2. **Si/Sino** (todas las condiciones):
   - Oportunidad → Asignado a → **está vacío**
   - Oportunidad → Etapa → **es** 🆕 Lead Nuevo
   - Oportunidad → Estado → **es** Abierta
   - Contacto → Etiquetas → **no incluye** `mayorista / operadores`
   - Si **no** se cumple → Fin.
3. **Dividir** (acción "Split" / prueba A-B) en partes iguales, una rama por asesora activa. Ejemplo con 5: 20 % cada una.
   - **Tú decides la lista.** Sugerencia según los datos (más rápidas primero): Ginna, Adriana, Juan Camilo, Alejandra, Johana. **Sin Pilar.**
4. En **cada rama**:
   1. **Actualizar oportunidad** → Asignado a = (la asesora de esa rama).
   2. **Asignar a usuario** (contacto) → la misma asesora. Marca "Solo contactos sin asignar".
   3. **Añadir tarea** → título `👤 Lead sin dueño: escribir hoy`, asignada a esa asesora, vence en 4 h. Descripción: `Lead de hace 24 h que nadie tomó. Revisa el chat y escribe con el resumen de Sol si existe.`
5. **Fin.**

### Ajustes del workflow
- Permitir reingreso: **Sí** (un cliente puede volver con otro viaje).
- Publicar y probar con una oportunidad de prueba con la espera bajada a 2 minutos; luego regresarla a 24 h.

### Los 215 que ya están
No entran solos (el activador es "creada"). Los reparto yo por API con tu OK, después de que revises la lista (tarea b4 del plan).

---

## C-04 · Contrato firmado → aviso + Purchase

**Base:** el workflow existente **"Notificación Contrato Firmado"**. Solo se cambia el activador y se añade Meta.

### Por qué cambiarlo
Su activador "Documents & Contracts → Status is Signed/Accepted" escucha los contratos de GHL, que ya no se usan desde el 08-oct (el último documento de GHL es del 07-oct). Con el contrato propio, al firmar, **nuestro código** escribe en la oportunidad:
- **"Estado del contrato" = `Firmado`** (otros valores: Enviado, Visto, Anulado)
- **"Contrato firmado (PDF)"** = enlace del panel al PDF
- y mueve la tarjeta a **✍️ Contrato Firmado** (Reservaciones)

### Activador
1. Borra el activador "Documents & Contracts".
2. Añade **La oportunidad ha cambiado**
   - Filtro: **Estado del contrato** → **es** → `Firmado`
   - (Usa el campo, no la etapa: el campo cambia a Firmado una sola vez por firma; la etapa a veces va y vuelve.)

### Acciones
1. **Las 3 notificaciones que ya tiene** ("Notificacion Representante" ×2 y "Notification Luisa & Linda"):
   - Ábrelas y revisa el texto: si usan variables de documento (`{{document.…}}`), ahora salen vacías. Cámbialas por datos de la oportunidad, por ejemplo `{{opportunity.name}}` y el campo **Contrato firmado (PDF)**.
2. **Añadir → Meta Conversion API**
   - Tipo de conexión: Integración
   - Tipo de evento: Funnel Event
   - Token: Custom Values → FB-Token · Conjunto de datos: Custom Values → Pixel Id
   - Evento: **Purchase**
   - Valor: Opportunity → Custom Fields → **Total Pasajeros - Valor Total**
   - Moneda: **COP**
   - Código de prueba: `TEST19726` solo mientras pruebas
   - Mapeo personalizado: **apagado**
3. **No** añadas ninguna acción que mueva la etapa (ya lo hace el código).

### Nombre
`C-04 · Contrato firmado → aviso + Purchase`

### Prueba (real, no con "Probar flujo de trabajo", que omite el paso de Meta)
1. Oportunidad tuya en Reservaciones con "Total Pasajeros - Valor Total" lleno.
2. Envía el contrato desde el Generador y fírmalo desde el enlace.
3. Revisa: Registros de ejecución (las 3 notificaciones + Meta en verde) y Meta → Probar eventos (Purchase desde **Servidor**, valor en COP).
4. Si Meta sale **Skipped** por falta de datos de origen → avísame (plan a13: envío desde código).
5. Quita `TEST19726` y guarda.

### Y en C-02 (enlace para firma)
Cambia el evento de **Purchase** a **InitiateCheckout** (mismo valor y moneda), para no contar la venta dos veces.
