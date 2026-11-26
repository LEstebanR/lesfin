# Billing: seguridad, observabilidad y operación

Este documento describe los controles y procesos para checkout, portal de billing y webhooks de Polar. El objetivo es que un fallo del proveedor, un reintento o una ejecución manual no conceda acceso indebido ni deje la suscripción local en un estado ambiguo.

## Matriz de amenazas y controles

| Riesgo                                                                    | Control                                                                                                          | Evidencia o revisión                                       |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Checkout manipulado para comprar otro producto o asociarlo a otro usuario | Producto y usuario se resuelven en el servidor; el cliente solo recibe la URL alojada por Polar                  | `createProCheckout` y prueba de autorización               |
| Usuario no autenticado abre checkout, portal o cancelación                | Todas las acciones llaman `getServerSession()`                                                                   | Tests de acciones y revisión de server actions             |
| Webhook falsificado                                                       | `validateEvent` verifica la firma sobre el body original y `POLAR_WEBHOOK_SECRET`                                | Respuesta 403 ante firma inválida                          |
| Webhook repetido                                                          | `BillingWebhookEvent.eventId` es único y la actualización se ejecuta dentro de una transacción                   | Reintento devuelve 200 sin repetir efectos                 |
| Dos reintentos concurrentes                                               | Inserción única dentro de la misma transacción; el ganador aplica el efecto y el otro se reconoce como duplicado | Error `P2002` tratado como duplicado                       |
| Evento procesado parcialmente                                             | Registro de evento y mutaciones de billing comparten transacción                                                 | Un fallo hace rollback y permite reintento                 |
| Evento viejo entregado después de uno nuevo                               | `BillingSubscription.providerModifiedAt` guarda el `modifiedAt` de Polar; un evento con fecha anterior se ignora | Tests `out-of-order events` en `lib/polar-webhook.test.ts` |
| Reembolso total sin quitar acceso                                         | `order.refunded` con estado `refunded` marca la suscripción como `refunded` y pasa el plan a FREE                | Tests `order.refunded`                                     |
| Estado local desincronizado                                               | Los webhooks actualizan `BillingSubscription` y `User.plan`; `getUserPlan` deriva el entitlement desde billing   | Reconciliación manual documentada abajo                    |
| Datos de tarjeta o secretos en logs                                       | No se persiste el payload y los logs solo incluyen proveedor, evento, IDs técnicos y nombre del error            | Revisión de logs sin PAN, CVC, tokens ni payloads          |
| Acción administrativa no autorizada                                       | `requireAdmin()` valida sesión y rol en servidor                                                                 | Tests de autorización de acciones admin                    |
| Error sin trazabilidad                                                    | Cada operación genera `correlationId` y lo devuelve en respuestas de webhook                                     | Buscar `scope=billing` y `correlationId`                   |

## Variables y secretos

Solo el servidor puede leer estas variables:

- `POLAR_ACCESS_TOKEN`
- `POLAR_PRO_PRODUCT_ID`
- `POLAR_WEBHOOK_SECRET`
- `NEXT_PUBLIC_APP_URL` en producción, si la URL pública no es `https://www.lesfin.app` (si apunta al apex `lesfin.app`, `getAppUrl()` la normaliza a `www`)

No deben aparecer en el cliente, en commits, en comentarios de issues ni en logs. En local se usa Polar Sandbox; producción debe usar el token, producto y secreto de Polar Production.

## Estados y reintentos

El endpoint `/api/webhooks/polar` acepta eventos `subscription.*`, `customer.state_changed` y `order.refunded`. En Polar, el webhook de producción debe tener habilitados esos tres grupos de eventos.

1. Lee `webhook-id` y genera un `correlationId` interno.
2. Verifica la firma con el body original.
3. Ignora eventos que no pertenecen al flujo de billing.
4. Comprueba si `webhook-id` ya fue procesado.
5. Registra el evento como `processing` y actualiza suscripción y entitlement en una transacción.
6. Marca el evento como `processed` solo después de completar todas las mutaciones.
7. Devuelve el `x-correlation-id` en todas las respuestas del endpoint.

Si una mutación falla, la transacción se revierte y el endpoint devuelve 500 para que Polar reintente. Un evento repetido devuelve 200 y no repite el efecto.

### Eventos fuera de orden

Polar no garantiza el orden de entrega y reintenta con backoff, así que un `subscription.active` viejo puede llegar después de un `subscription.revoked`. Para evitar que eso reactive el acceso:

- Cada evento de suscripción usa su `modifiedAt` (o `createdAt` si viene vacío) y lo guarda en `BillingSubscription.providerModifiedAt`.
- Si el evento es estrictamente más viejo que lo guardado, se ignora con resultado `ignored_stale`. Un evento con la misma fecha se aplica, para permitir reenvíos manuales.
- `customer.state_changed` no trae una fecha comparable. Cuando reporta que no hay suscripción activa pero la suscripción local todavía da acceso, se ignora (`ignored_stale`): el evento `subscription.*` terminal es el que quita el acceso.

El resultado de cada evento queda en el log `webhook.processed` en el campo `outcome`.

## Revisión de un pago fallido

`past_due` conserva temporalmente el acceso Pro mientras Polar mantenga ese estado. La recuperación de pago debe llegar como evento posterior `subscription.active` o `customer.state_changed`. Si el proveedor pasa a un estado terminal, el siguiente webhook aplica Free; los datos nunca se eliminan.

## Reembolsos y disputas

Política vigente:

| Caso                                                    | Qué hace Polar                                                                         | Qué hace lesfin                                                                                                                                                                     |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reembolso total (`order.refunded`, orden en `refunded`) | Devuelve el dinero; la suscripción puede seguir activa si no se revoca                 | La suscripción local pasa a `refunded` y el usuario a FREE de inmediato. Es terminal: eventos `subscription.*` posteriores de esa misma suscripción se ignoran (`ignored_refunded`) |
| Reembolso parcial (`partially_refunded`)                | Devuelve parte del dinero                                                              | No cambia el acceso (`ignored_partial_refund`). Es un ajuste de buena voluntad                                                                                                      |
| Disputa o chargeback                                    | Polar gestiona la disputa como Merchant of Record. Si se pierde, revoca la suscripción | `subscription.revoked` pasa el usuario a FREE. No hay lógica propia de disputas                                                                                                     |
| Cancelación sin reembolso                               | `subscription.canceled` con `endsAt`                                                   | Conserva Pro hasta `endsAt`                                                                                                                                                         |

Al reembolsar manualmente desde Polar:

1. Si el reembolso es total, revocar también la suscripción en Polar para que no se renueve ni cobre de nuevo.
2. Confirmar en logs un `webhook.processed` con `eventType=order.refunded` y `outcome=applied`.
3. Confirmar `BillingSubscription.status = refunded` y `User.plan = FREE`.

Si el usuario vuelve a comprar, Polar crea una suscripción nueva con otro ID, que reemplaza a la reembolsada y vuelve a dar Pro.

## Conciliación mensual

Hacerla el primer día hábil de cada mes, sobre el mes anterior. Es de solo lectura; cualquier corrección sigue el runbook de "Suscripción local desincronizada".

1. **Polar → lesfin.** En Polar Production, exportar las suscripciones del producto Pro (activas, canceladas y revocadas en el mes). Para cada una, comparar `id`, `status`, `ends_at` y `cancel_at_period_end` con `BillingSubscription` (`polarSubscriptionId`, `status`, `endsAt`, `cancelAtPeriodEnd`).
2. **lesfin → Polar.** Listar los usuarios con plan PRO que no son ADMIN y confirmar que cada uno tiene una `BillingSubscription` con acceso vigente que exista en Polar:

   ```sql
   SELECT u.id, u.plan, b."polarSubscriptionId", b.status, b."endsAt", b."providerModifiedAt"
   FROM "User" u
   LEFT JOIN "BillingSubscription" b ON b."userId" = u.id
   WHERE u.plan = 'PRO' AND u.role <> 'ADMIN';
   ```

3. **Órdenes y reembolsos.** Comparar las órdenes pagadas y reembolsadas del mes en Polar con los eventos `order.refunded` registrados en `BillingWebhookEvent`.
4. **Payouts.** Confirmar que la suma de órdenes pagadas menos reembolsos y comisiones de Polar cuadra con el payout del mes.
5. **Eventos no procesados.** `SELECT * FROM "BillingWebhookEvent" WHERE status <> 'processed'` debe estar vacío. Revisar también entregas fallidas en el panel de webhooks de Polar.
6. Anotar el resultado (fecha, totales, diferencias y acción tomada).

Un usuario tiene una sola fila en `BillingSubscription`: la suscripción que hoy define su acceso. Si Polar reporta otra suscripción del mismo usuario (por ejemplo, una compra después de un reembolso), esa fila se reemplaza, salvo que el evento sea más viejo que lo guardado (`ignored_stale`) o que no dé acceso mientras la actual sí lo da (`ignored_superseded`). El historial de la suscripción anterior queda en Polar y en `BillingWebhookEvent`.

## Go/no-go

Pro se muestra públicamente solo si se cumple todo esto:

- [ ] La prueba controlada en producción (abajo) pasó completa y quedó anotada con fecha en el issue #3.
- [ ] El webhook de producción apunta a `https://www.lesfin.app/api/webhooks/polar`, tiene habilitados `subscription.*`, `customer.state_changed` y `order.refunded`, y su última entrega respondió 200.
- [ ] La migración `billing_provider_modified_at` está aplicada en la rama `main` de Neon.
- [ ] Los términos publicados cubren cancelación y reembolsos y coinciden con la política de este documento.
- [ ] La organización LESFin en Polar está aprobada para cobrar y con payouts configurados.
- [ ] La primera conciliación (aunque sea con solo la prueba controlada) cuadra.

### Pausar nuevas altas

En orden, de menor a mayor impacto:

1. **Archivar el producto Pro en Polar.** Los checkouts nuevos fallan (`checkout.failed` en logs) y las suscripciones existentes siguen funcionando. Es lo más rápido y no requiere deploy.
2. **Quitar `POLAR_PRO_PRODUCT_ID` en Vercel y redeplegar.** `createProCheckout` falla antes de llamar a Polar. Ojo: el webhook también usa esa variable para filtrar el producto y empezaría a ignorar los eventos de suscriptores existentes (`ignored_product`). Usar solo si no hay suscriptores.
3. **Ocultar el CTA de upgrade** en `components/dashboard/pricing.tsx` y `components/dashboard/plan.tsx` con un PR. Requiere cambio de código.

Para reanudar, se revierte el paso aplicado y se confirma un checkout de prueba.

## Prueba controlada en producción

La hace una persona con una cuenta propia que **no** sea ADMIN (los ADMIN siempre son Pro). Usa una tarjeta real y se reembolsa al final.

- [ ] Iniciar sesión en `https://www.lesfin.app` con la cuenta de prueba y confirmar que el plan es Free.
- [ ] Abrir el upgrade a Pro y completar el checkout de Polar.
- [ ] Confirmar en Polar que el webhook `subscription.created`/`subscription.active` respondió 200.
- [ ] Confirmar en lesfin que la cuenta es Pro y que `BillingSubscription` tiene `status = active` y `providerModifiedAt` con valor.
- [ ] Cancelar desde el portal de billing. Confirmar `cancelAtPeriodEnd = true` y que Pro sigue hasta `endsAt`.
- [ ] Reembolsar la orden completa desde Polar y revocar la suscripción.
- [ ] Confirmar el log `webhook.processed` con `eventType=order.refunded` y `outcome=applied`, `BillingSubscription.status = refunded` y `User.plan = FREE`.
- [ ] Revisar que no haya filas en `BillingWebhookEvent` con estado distinto de `processed`.
- [ ] Anotar en el issue #3 la fecha, los IDs de suscripción y orden y el resultado de cada paso.

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
- Reembolso total y parcial.
- Evento viejo entregado después de uno nuevo.
- Evento sin `webhook-id`.
- Usuario no encontrado o sin `externalId`.
- Error de base de datos durante la transacción y reintento posterior.
- Checkout y portal con sesión ausente.

Las pruebas unitarias locales se ejecutan con:

```bash
bun test
```

Las pruebas de firma y entrega deben ejecutarse con fixtures de Polar Sandbox; nunca con datos o secretos de producción.
