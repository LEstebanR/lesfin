# Billing: seguridad, observabilidad y operación

Este documento describe los controles y procesos para checkout, portal de billing y webhooks de Polar. El objetivo es que un fallo del proveedor, un reintento o una ejecución manual no conceda acceso indebido ni deje la suscripción local en un estado ambiguo.

## Matriz de amenazas y controles

| Riesgo                                                                    | Control                                                                                                          | Evidencia o revisión                              |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Checkout manipulado para comprar otro producto o asociarlo a otro usuario | Producto y usuario se resuelven en el servidor; el cliente solo recibe la URL alojada por Polar                  | `createProCheckout` y prueba de autorización      |
| Usuario no autenticado abre checkout, portal o cancelación                | Todas las acciones llaman `getServerSession()`                                                                   | Tests de acciones y revisión de server actions    |
| Webhook falsificado                                                       | `validateEvent` verifica la firma sobre el body original y `POLAR_WEBHOOK_SECRET`                                | Respuesta 403 ante firma inválida                 |
| Webhook repetido                                                          | `BillingWebhookEvent.eventId` es único y la actualización se ejecuta dentro de una transacción                   | Reintento devuelve 200 sin repetir efectos        |
| Dos reintentos concurrentes                                               | Inserción única dentro de la misma transacción; el ganador aplica el efecto y el otro se reconoce como duplicado | Error `P2002` tratado como duplicado              |
| Evento procesado parcialmente                                             | Registro de evento y mutaciones de billing comparten transacción                                                 | Un fallo hace rollback y permite reintento        |
| Estado local desincronizado                                               | Los webhooks actualizan `BillingSubscription` y `User.plan`; `getUserPlan` deriva el entitlement desde billing   | Reconciliación manual documentada abajo           |
| Datos de tarjeta o secretos en logs                                       | No se persiste el payload y los logs solo incluyen proveedor, evento, IDs técnicos y nombre del error            | Revisión de logs sin PAN, CVC, tokens ni payloads |
| Acción administrativa no autorizada                                       | `requireAdmin()` valida sesión y rol en servidor                                                                 | Tests de autorización de acciones admin           |
| Error sin trazabilidad                                                    | Cada operación genera `correlationId` y lo devuelve en respuestas de webhook                                     | Buscar `scope=billing` y `correlationId`          |

## Variables y secretos

Solo el servidor puede leer estas variables:

- `POLAR_ACCESS_TOKEN`
- `POLAR_PRO_PRODUCT_ID`
- `POLAR_WEBHOOK_SECRET`
- `NEXT_PUBLIC_APP_URL` en producción, si la URL pública no es `https://lesfin.app`

No deben aparecer en el cliente, en commits, en comentarios de issues ni en logs. En local se usa Polar Sandbox; producción debe usar el token, producto y secreto de Polar Production.

## Estados y reintentos

El endpoint `/api/webhooks/polar` acepta eventos de suscripción y `customer.state_changed`.

1. Lee `webhook-id` y genera un `correlationId` interno.
2. Verifica la firma con el body original.
3. Ignora eventos que no pertenecen al flujo de billing.
4. Comprueba si `webhook-id` ya fue procesado.
5. Registra el evento como `processing` y actualiza suscripción y entitlement en una transacción.
6. Marca el evento como `processed` solo después de completar todas las mutaciones.
7. Devuelve el `x-correlation-id` en todas las respuestas del endpoint.

Si una mutación falla, la transacción se revierte y el endpoint devuelve 500 para que Polar reintente. Un evento repetido devuelve 200 y no repite el efecto.

## Revisión de un pago fallido

`past_due` conserva temporalmente el acceso Pro mientras Polar mantenga ese estado. La recuperación de pago debe llegar como evento posterior `subscription.active` o `customer.state_changed`. Si el proveedor pasa a un estado terminal, el siguiente webhook aplica Free; los datos nunca se eliminan.

## Runbook de incidente

### Webhook fallido

1. Buscar el `correlationId` en los logs de producción.
2. Confirmar `eventId`, `eventType`, respuesta HTTP y `errorName`.
3. Revisar si existe un registro `BillingWebhookEvent` para ese evento.
4. Si no está en estado `processed`, corregir la causa y solicitar/repetir la entrega desde Polar.
5. Confirmar que `BillingSubscription.status`, `endsAt`, `cancelAtPeriodEnd` y `User.plan` coinciden con Polar.

### Suscripción local desincronizada

1. No cambiar `User.plan` manualmente para un usuario normal.
2. Consultar el estado actual en Polar usando `polarSubscriptionId` o `polarCustomerId`.
3. Reenviar el webhook correspondiente desde Polar.
4. Si no es posible, ejecutar una corrección controlada en base de datos con respaldo previo y registrar motivo, operador, fecha y valores anterior/nuevo.
5. Verificar que `getUserPlan` devuelve el entitlement esperado y que los locks se reconcilian al consultar cuentas, deudas o suscripciones.

### Rollback

- No borrar `BillingWebhookEvent` para corregir un evento; su unicidad protege contra duplicados.
- Si se despliega una versión defectuosa, detener nuevas altas si el checkout está afectado y revertir el despliegue de aplicación.
- Mantener el webhook apuntando a una versión que rechace de forma segura eventos no procesables con 500, para permitir reintento.
- Restaurar datos solo con backup verificable y registrar la operación.

## Pruebas antes de producción

- Firma válida e inválida en Polar Sandbox.
- Evento repetido y dos entregas concurrentes.
- Alta, renovación, cancelación, reactivación, pago fallido y revocación.
- Evento sin `webhook-id`.
- Usuario no encontrado o sin `externalId`.
- Error de base de datos durante la transacción y reintento posterior.
- Checkout y portal con sesión ausente.

Las pruebas unitarias locales se ejecutan con:

```bash
bun test
```

Las pruebas de firma y entrega deben ejecutarse con fixtures de Polar Sandbox; nunca con datos o secretos de producción.
