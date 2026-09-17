# Checklist de Seguridad — Fase 5 / Sprint 2

Revisión del código real de este repositorio contra el OWASP Top 10 (2021),
hecha al cerrar la Fase 5. Cada punto indica qué hay implementado, dónde
está el código relevante, y qué queda pendiente si algo no se cerró del todo.

---

## A01:2021 — Control de acceso roto

| Control | Estado | Dónde |
|---|---|---|
| Todos los endpoints protegidos por defecto, salvo los marcados `@Public()` explícitamente | ✅ | `common/guards/jwt-auth.guard.ts` — "secure by default": un endpoint nuevo sin decorador queda protegido automáticamente. |
| Control de acceso por rol (ADMIN / RECEPCION / ENTRENADOR) | ✅ | `common/guards/roles.guard.ts` + decorador `@Roles()` en cada controller. |
| Un ENTRENADOR no puede crear alumnos ni tocar pagos | ✅ | `academia.controller.ts` — `@Roles(ADMIN, RECEPCION)` a nivel de método sobrescribe el `@Roles()` del controller. |
| Reportes financieros restringidos a ADMIN | ✅ | `reportes.controller.ts` — `@Roles(RolUsuario.ADMIN)` a nivel de controller. |
| Sin sesión, `/admin/*` devuelve 401 | ✅ | Verificado manualmente en la Guía de Pasos 1-8, Fase 1, paso 8.4. |

## A02:2021 — Fallas criptográficas

| Control | Estado | Dónde |
|---|---|---|
| Contraseñas hasheadas con bcrypt, nunca en texto plano | ✅ | `auth.service.ts`, `prisma/seed.ts` |
| Datos de tarjeta NUNCA tocan nuestros servidores | ✅ | Checkout hospedado en BAC/NeoNet (ver Plan Técnico, sección 8) — reduce el alcance de cumplimiento PCI DSS a SAQ A. |
| JWT con expiración corta (access 15 min) + refresh token | ✅ | `.env.example` (`JWT_ACCESS_EXPIRES_IN=15m`) |
| Secretos (`JWT_ACCESS_SECRET`, etc.) fuera del código, nunca en Git | ✅ | `.gitignore` excluye `.env`. |
| **Pendiente:** rotación periódica de los secretos JWT en producción | ⚠️ | No hay mecanismo automático — procedimiento manual que el equipo debe calendarizar (ej. cada 90 días). |

## A03:2021 — Inyección

| Control | Estado | Dónde |
|---|---|---|
| Todo el acceso a datos vía Prisma (queries parametrizadas), cero SQL crudo concatenado | ✅ | Todo el código de `apps/api/src` |
| Validación de entrada con whitelist estricta | ✅ | `main.ts` — `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })`: un campo no declarado en el DTO se **rechaza**, no se ignora. |
| DTOs con `class-validator` en cada endpoint que recibe body | ✅ | Un DTO por cada `Post`/`Patch` en cada módulo. |

## A04:2021 — Diseño inseguro

| Control | Estado | Dónde |
|---|---|---|
| Anti doble-reserva en 2 capas (lock Redis + verificación en transacción) | ✅ | `reservas.service.ts` — probado con unit tests Y con carga real (`loadtest/reservas-concurrencia.js`). |
| Nunca confirmar un pago antes del webhook firmado | ✅ | `pagos.service.ts` — "Regla de oro", Plan Técnico sección 5.2. |
| Idempotencia en confirmación de reserva | ✅ | `ReservasService.confirmar()` — confirmar una reserva ya confirmada no falla ni duplica efectos. |
| Idempotencia en cobro mensual (no duplica el cargo del mismo mes) | ✅ | Índice único `(alumnoId, mes, anio)` + verificación explícita en `MensualidadesService.generarParaMesActual()`. |

## A05:2021 — Configuración incorrecta de seguridad

| Control | Estado | Dónde |
|---|---|---|
| Cabeceras HTTP de seguridad (helmet) | ✅ | `main.ts` — `app.use(helmet())` |
| CORS restringido a los orígenes configurados, no `*` | ✅ | `main.ts` — `origin: WEB_URL` |
| Rate limiting global | ✅ | `app.module.ts` — 120 peticiones/min por defecto |
| Rate limiting reforzado en endpoints sensibles (login, refresh) | ✅ | Agregado en esta fase — ver `auth.controller.ts` (5/min en login, 10/min en refresh). |
| Documentación Swagger deshabilitada en producción | ✅ | `main.ts` — `if (process.env.NODE_ENV !== 'production')` |
| **Pendiente:** rate limiting específico para `POST /pagos/:gateway/webhook` | ⚠️ | Hoy comparte el límite global (120/min). Como ya verifica firma criptográfica antes de procesar, el riesgo es menor, pero vale un límite dedicado si el volumen lo justifica. |

## A06:2021 — Componentes vulnerables y desactualizados

| Control | Estado | Dónde |
|---|---|---|
| `npm audit` corrido y revisado al cierre de esta fase | ✅ | Ver `AUDITORIA_DEPENDENCIAS.md` en la raíz del repo para el detalle completo. |
| CI corre en cada PR (detecta si una dependencia nueva introduce vulnerabilidades) | ✅ | `.github/workflows/ci.yml` |
| **Pendiente:** activar Dependabot o Renovate para alertas automáticas | ⚠️ | Recomendado: GitHub → Settings → Security → Dependabot alerts. |

## A07:2021 — Fallas de identificación y autenticación

| Control | Estado | Dónde |
|---|---|---|
| Mensaje de error genérico en login (no revela si el correo existe) | ✅ | `auth.service.ts` — mismo mensaje para "correo no existe" y "contraseña incorrecta" |
| Rate limiting específico en login (mitiga fuerza bruta) | ✅ | Agregado en esta fase, ver A05. |
| **Pendiente:** bloqueo de cuenta tras N intentos fallidos consecutivos | ⚠️ | El rate limiting por IP ayuda, pero no sustituye un bloqueo por cuenta — evaluar según el volumen de usuarios admin. |
| Endpoint para que un usuario cambie su propia contraseña | ✅ | `PATCH /auth/password` (agregado en esta fase) — requiere la contraseña actual antes de aceptar la nueva, para que una sesión robada no baste para tomar control de la cuenta. Cierra el pendiente señalado desde la Fase 1. |

## A08:2021 — Fallas de integridad de software y datos

| Control | Estado | Dónde |
|---|---|---|
| Verificación de firma en TODOS los webhooks externos (BAC, NeoNet) | ✅ | `pagos/hmac.util.ts` (`verificarFirmaHmac`) + `pagos/gateways/*.service.ts` |
| Un webhook sin firma válida se descarta sin procesar | ✅ | Mismo lugar — nunca se confía en el payload antes de verificar. |
| Lockfile (`package-lock.json`) commiteado, instalaciones reproducibles | ✅ | CI usa `npm ci`, no `npm install`. |

## A09:2021 — Fallas de registro y monitoreo de seguridad

| Control | Estado | Dónde |
|---|---|---|
| Logs estructurados de errores (500) con detalle completo | ✅ | `common/filters/all-exceptions.filter.ts` |
| Webhooks con firma inválida quedan registrados como advertencia | ✅ | `pagos.service.ts` — `logger.warn(...)` en cada rechazo |
| **Pendiente:** integración con una herramienta de monitoreo externa (Sentry, Datadog, etc.) | ⚠️ | Señalado en el Plan Técnico desde la Fase 1; sigue siendo trabajo futuro — hoy los logs solo viven en la salida estándar del proceso. |

## A10:2021 — Server-Side Request Forgery (SSRF)

| Control | Estado | Dónde |
|---|---|---|
| El backend no hace peticiones HTTP salientes a URLs proporcionadas por el usuario | ✅ | Las únicas peticiones salientes (`fetch`) van a URLs fijas de configuración (BAC, NeoNet) — nunca a una URL que venga en el body de una petición del cliente. |

---

## Resumen

De 10 categorías OWASP revisadas, **ninguna tiene un hallazgo abierto sin
mitigación parcial**. Los puntos ⚠️ son mejoras recomendadas antes de escalar
a un volumen alto de usuarios reales, no vulnerabilidades explotables
conocidas hoy. El pendiente más urgente al iniciar esta fase — la falta de un
endpoint de cambio de contraseña — se resolvió durante esta misma revisión
(`PATCH /auth/password`).
