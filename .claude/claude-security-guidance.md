# Pro Futbol Antigua - reglas de seguridad especificas del proyecto

Reglas que el revisor no puede inferir solo del codigo (contexto de negocio).

## Pagos

- Ningun endpoint que confirme un pago como COMPLETADO (o equivalente) puede
  quedar publico en produccion sin verificar la firma del gateway. Un endpoint
  de "confirmacion simulada" (uso de desarrollo/pruebas) DEBE estar bloqueado
  por `NODE_ENV === 'production'` (rechazar con 404/403), nunca solo por
  convencion o porque "nadie va a llamarlo a mano". Referencia: pendiente
  `apps/api/src/modules/pagos/pagos.controller.ts` (`POST /payments/simulado/confirmar`),
  actualmente sin ese guard - fix diferido hasta tener los datos reales del
  gateway de pagos.
- La verificacion de firma HMAC de un webhook de pago NUNCA debe omitirse
  silenciosamente si el secreto del gateway no esta configurado. Falta de
  secreto = rechazar la peticion (fail-closed), no procesar el webhook sin
  verificar (fail-open). Referencia: `pagos.controller.ts` webhook handler,
  `hmac.util.ts`.
- El monto de un pago SIEMPRE se calcula server-side desde el registro de la
  referencia (reserva/equipo/mensualidad), nunca se confia en un monto
  enviado por el cliente salvo para validarlo contra el calculado.

## Autenticacion

- Todo endpoint nuevo esta protegido por defecto (JwtAuthGuard + RolesGuard
  globales via APP_GUARD). Si se agrega `@Public()`, justificar por que en un
  comentario junto al decorador - login, webhooks firmados, health check son
  los unicos casos legitimos ya existentes.
