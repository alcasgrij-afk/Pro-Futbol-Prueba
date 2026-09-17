# Runbook de Operación — Pro Futbol Antigua

Guía de "qué hacer si..." para cuando el sistema esté en producción. Pensado
para que cualquiera del equipo técnico (no solo quien lo escribió) pueda
resolver un incidente común sin tener que releer todo el código primero.

---

## La API no responde / el panel admin no carga

**Síntomas:** `GET /health` no responde, o la web y el panel admin dan error.

1. **Confirmar que la API está corriendo.**
   ```bash
   curl https://<tu-dominio>/health
   ```
   Si no responde `{"status":"ok"}`, el proceso de la API está caído —
   reinicialo (`docker compose restart api` si usás el stack de referencia,
   o el mecanismo de tu proveedor de hosting).

2. **Revisar los logs de la API** buscando errores recientes (el
   `AllExceptionsFilter` registra cada error 500 con detalle):
   ```bash
   docker compose logs -f api | tail -50
   ```

3. **Confirmar que Postgres y Redis están sanos.** El sistema depende de
   ambos: las reservas y los pagos viven en Postgres; las sesiones del
   chatbot web y el locking anti-doble-reserva viven en Redis.
   ```bash
   docker compose ps postgres redis
   ```

4. **Confirmar que `NEXT_PUBLIC_API_URL` (frontend) apunta a la URL correcta
   de la API** en ese ambiente, y que `WEB_URL` en el `.env` del backend
   coincide con el dominio real desde el que se sirve la web (si no, verás
   errores de CORS en la consola del navegador, F12).

---

## El widget de chat web no responde

**Síntomas:** el cliente abre el widget y escribe, pero no recibe respuesta.

1. **Confirmar que la API está corriendo y que el namespace `/chat`
   (WebSocket) está activo** — vive dentro del mismo proceso de la API
   (ver `chat/chat.gateway.ts`). Si `/health` responde, el WebSocket
   también debería estar arriba.

2. **Confirmar que Redis está sano.** El estado de cada conversación vive en
   Redis (ver Plan Técnico, sección 3.3): si Redis está caído, el bot no
   puede recordar en qué paso de la conversación está cada cliente.
   ```bash
   docker compose ps redis
   ```

3. **Revisar los logs del chat** buscando errores recientes en
   `ChatGateway` o `ChatService`.

---

## Un pago no se confirmó aunque el cliente dice que pagó

**Síntomas:** el cliente muestra un comprobante, pero la reserva sigue en
`PENDIENTE_PAGO` o `PENDIENTE_SEDE`.

1. **Buscar el registro de `Pago`** en `npm run prisma:studio` filtrando por
   el teléfono del cliente o el `id` de la reserva, y revisá su `estado`.

2. **Si el `Pago` sigue en `PENDIENTE`:** el webhook de la pasarela
   (BAC/NeoNet) probablemente no llegó, o llegó y falló la verificación de
   firma. Revisá los logs:
   ```bash
   docker compose logs -f api | grep -i webhook
   ```
   Buscá líneas de "firma inválida / descartado" — si aparecen, el problema
   es un secreto compartido desactualizado (`BAC_WEBHOOK_SECRET` /
   `NEONET_SECRET_KEY`), no del lado del cliente. Ver `pagos/hmac.util.ts`.

3. **Confirmación manual (mientras se investiga la causa raíz):** un
   administrador puede confirmar la reserva desde el panel admin (botón
   "Confirmar" en `/admin/reservas`), después de verificar el comprobante
   por otro medio. Esto llama a `ReservasService.confirmar()` directamente,
   sin depender del webhook.

4. **Nunca marques un `Pago` como `COMPLETADO` manualmente sin confirmar el
   dinero por otra vía** (banco, comprobante) — esa tabla es la fuente de
   verdad para los reportes financieros (ver `ReportesService.ingresos()`).

---

## Un trabajo de BullMQ parece atascado (liberar reserva, cobro mensual)

**Síntomas:** una reserva pendiente de pago no se liberó pasado el timeout,
o no llegó el cobro mensual de la academia.

1. **Confirmar que el worker está corriendo.** Los procesadores de BullMQ
   (`ReservasProcessor`, `MensualidadesProcessor`) corren dentro del mismo
   proceso de la API — si la API está arriba, los workers también.

2. **Inspeccionar la cola con Redis Commander** (incluido en
   `docker-compose.yml`, `http://localhost:8081` en desarrollo). Las colas
   usan los prefijos `bull:reservas:*` y `bull:academia:*`.

3. **Revisar si el trabajo falló y agotó sus reintentos.** La configuración
   por defecto (`queue.module.ts`) reintenta 3 veces con backoff
   exponencial. Un trabajo que falló las 3 veces queda en "failed" de esa
   cola — revisalo con Redis Commander o con `queue.getFailed()`.

4. **Reencolar un trabajo fallido manualmente** (consola de Node, con la API
   detenida para no chocar con el worker real):
   ```bash
   cd apps/api
   npx ts-node -e "
     const { NestFactory } = require('@nestjs/core');
     const { AppModule } = require('./src/app.module');
     const { getQueueToken } = require('@nestjs/bullmq');
     (async () => {
       const app = await NestFactory.createApplicationContext(AppModule);
       const queue = app.get(getQueueToken('reservas')); // o 'academia'
       const fallidos = await queue.getFailed();
       for (const job of fallidos) await job.retry();
       console.log('Reintentados:', fallidos.length);
       await app.close();
     })();
   "
   ```

5. **Si el cobro mensual de la academia no se disparó el día 1:** el cron
   vive en `MensualidadesSchedulerService`. Si el proceso se reinició después
   de la hora programada, el disparo se pierde — corré el job manualmente:
   ```bash
   cd apps/api
   npx ts-node -e "
     const { NestFactory } = require('@nestjs/core');
     const { AppModule } = require('./src/app.module');
     const { MensualidadesService } = require('./src/modules/academia/mensualidades.service');
     (async () => {
       const app = await NestFactory.createApplicationContext(AppModule);
       const n = await app.get(MensualidadesService).generarParaMesActual();
       console.log('Mensualidades generadas:', n);
       await app.close();
     })();
   "
   ```

---

## Sospecha de doble-reserva (dos clientes con el mismo horario)

Esto **no debería pasar nunca** según el diseño (ver Plan Técnico, sección
5.2, y la prueba de carga `loadtest/reservas-concurrencia.js`). Si ocurre:

1. **No canceles ninguna reserva todavía.** Primero confirmá en
   `npm run prisma:studio` cuántas reservas activas (`CONFIRMADA`,
   `PENDIENTE_PAGO`, `PENDIENTE_SEDE`) existen para esa `cancha_id` +
   `fecha` + `hora_inicio_min` exactos.

2. Si hay más de una, es un bug real en el mecanismo de locking — reportalo
   de inmediato con los IDs de ambas reservas y su `creadoEn`, y corré
   `loadtest/reservas-concurrencia.js` contra staging para intentar
   reproducirlo antes de tocar código en producción.

3. Mientras se investiga, resolvé el conflicto real hablando con ambos
   clientes — el sistema no tiene una regla automática de prioridad para
   este caso excepcional.

---

## Rotación de secretos JWT (cada 90 días)

Los tokens de sesión se firman con `JWT_ACCESS_SECRET` (vida 15 min) y
`JWT_REFRESH_SECRET` (7 días). Al rotarlos, **todos los tokens en circulación
se invalidan de golpe**: cualquier usuario con sesión activa tiene que volver
a iniciar sesión. Eso es correcto y esperado — es la señal de "cambio de
material criptográfico".

1. **Generar dos secretos nuevos** (64+ caracteres aleatorios):
   ```bash
   openssl rand -hex 64   # dos veces → uno para access, otro para refresh
   ```
2. **Actualizar `.env` de la API** (y el mismo par de variables en el
   ambiente de producción/hosting):
   ```
   JWT_ACCESS_SECRET=<nuevo-access>
   JWT_REFRESH_SECRET=<nuevo-refresh>
   ```
3. **Reiniciar la API:**
   ```bash
   docker compose restart api
   ```
4. **Verificar** que `/health` responde y que un login de prueba funciona
   (el refresh token viejo en el navegador ya no sirve; el usuario re-loguea).
5. **Calendarizar la siguiente rotación** en ~90 días — o de inmediato si
   hubo sospecha de fuga/compromiso de secretos.

> **No confundir con los secretos de webhook** (`BAC_WEBHOOK_SECRET`,
> `NEONET_SECRET_KEY`): esos solo firman confirmaciones de pago, no tokens de
> sesión, y se rotan por separado cuando la pasarela cambia su llave.

**Evolución futura (Fase 2+):** llaves JWS asimétricas (RS256) — firmar con
clave privada, verificar con pública — permiten rotar la clave de firma sin
invalidar los tokens ya emitidos (los viejos siguen validándose hasta
expirar). Alternativa documentada en PENDIENTES 3.3.

---

## Una cuenta quedó bloqueada por intentos fallidos de login

Desde el bloqueo de cuenta (PENDIENTES 3.1), 5 contraseñas fallidas
consecutivas bloquean la cuenta 15 minutos (`intentosFallidos` /
`bloqueadoHasta` en la tabla `usuarios`). Un admin que pifió la contraseña
verá *"Cuenta temporalmente bloqueada por intentos fallidos..."*.

1. **Esperar 15 min y reintentar** — es la salida normal; el bloqueo caduca
   solo y el contador se reinicia en el siguiente login.
2. **Si urge y el bloqueo es un error legítimo del usuario**, limpiar los
   contadores manualmente (atajo; no requiere tocar código):
   ```bash
   cd apps/api && npm run prisma:studio
   # filtrar por el email → intentosFallidos = 0, bloqueadoHasta = null
   ```
3. **Si parecen ataques en curso** (varios usuarios bloqueados, o muchas IPs
   probando el mismo usuario): el rate limit por IP (5/min en `/auth/login`)
   no frena un ataque distribuido — revisá los logs de la API para el patrón
   y considerá rotar la credencial del usuario afectado.

---

## Contactos y escalamiento

_Esta sección la completa el equipo antes de salir a producción: a quién
avisar si el sistema cae fuera de horario laboral, y los datos de contacto
de soporte de la pasarela de pagos (BAC / NeoNet) y del hosting, para
incidentes del lado de esos proveedores._
