# Pruebas de Carga (k6)

Ver Plan de Desarrollo Técnico, Fase 5 / Sprint 1. Estas pruebas **no
corren con `npm test`** — usan [k6](https://k6.io), una herramienta
externa hecha específicamente para simular tráfico concurrente real, algo
que las pruebas unitarias (con mocks) no pueden validar.

## Instalar k6

- **Mac:** `brew install k6`
- **Windows:** `choco install k6` (o descargar el instalador desde
  [k6.io](https://k6.io/docs/get-started/installation/))
- **Linux:** ver instrucciones específicas de tu distribución en la misma página.

## Requisitos antes de correr las pruebas

1. El backend tiene que estar corriendo (`npm run dev:api`), con Postgres y
   Redis levantados (`docker compose up -d`).
2. Necesitás el `id` real de al menos una cancha de tu base de datos —
   consultalo con `npm run prisma:studio` o `GET /canchas`.

## `disponibilidad.js` — carga normal de lectura

Simula hasta 20 usuarios simultáneos consultando disponibilidad durante
~1.5 minutos. Es el patrón de tráfico más común del sistema.

```bash
CANCHA_ID=<id-de-una-cancha> k6 run loadtest/disponibilidad.js
```

**Qué mirar en el resultado:** que `http_req_duration` (p95) esté por
debajo de 500ms y que `http_req_failed` esté por debajo del 5%. k6 marca
la prueba como fallida automáticamente si no se cumplen esos umbrales
(configurados en el archivo).

## `reservas-concurrencia.js` — la prueba más importante

Dispara 20 intentos de reserva **simultáneos** sobre el mismo horario
exacto, con clientes distintos, para confirmar bajo carga real (no con
mocks) que el lock de Redis + la verificación en transacción de Prisma
evitan una doble reserva.

```bash
CANCHA_ID=<id-de-una-cancha> FECHA=2026-08-15 HORA=20:00 k6 run loadtest/reservas-concurrencia.js
```

**Usá una fecha/hora que sepas que está libre** (confirmalo con
`GET /canchas/:id/disponibilidad` antes de correr la prueba).

**Qué mirar en el resultado:** el log final debe decir
`Reservas exitosas: 1`. Si dice cualquier otro número mayor a 1, hay un
problema real en el mecanismo de locking que hay que investigar antes de
ir a producción — **esto no debería pasar nunca** según el diseño (ver
Plan Técnico, sección 5.2), y si pasa, es la prueba más valiosa de esta
fase para haberlo detectado a tiempo.

Después de correrla, confirmá también en `npm run prisma:studio` que
existe una sola fila activa en `reservas` para ese horario — es la
verificación definitiva, más allá de lo que reporte k6.
