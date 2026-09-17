# Pendientes — Inventario completo al cierre de Fase 5

Lista de TODO lo que quedó pendiente o fue intencionalmente simplificado
durante las Fases 1–5. No es un backlog priorizado — es un inventario
para que el equipo decida qué atacar y cuándo.

## Resuelto (2026-09-07)

- **Next.js 14 → 15** (sección 4.1) — migrado a `next`/`eslint-config-next`
  **15.5.25** + `react`/`react-dom` **19.2.8** (`@types/react`/`@types/react-dom`
  ^19). Se adaptaron las dos rutas dinámicas `'use client'` (`app/torneos/[id]` y
  `app/admin/torneos/[id]`) al nuevo `params: Promise<{ id }>` con el patrón
  oficial de la Upgrade Guide (`const { id } = use(params)`). Verificado: lint
  limpio, `tsc --noEmit` limpio, `next build` OK (15/15 rutas, ambas `[id]`
  dinámicas) y smoke de `next start` en `/`, `/torneos/<id>`,
  `/admin/torneos/<id>`, `/pago/resultado` (200, sin crash). La API (NestJS) no
  se tocó.
- **Dependabot** (sección 3.4) — `.github/dependabot.yml` creado (npm, semanal,
  máximo 5 PRs). *Pendiente externo:* activar "Dependabot alerts" en GitHub
  Settings → Security.

## Resuelto (2026-09-13)

- **WebSocket `/chat` 404** (sección 10.1) — el chat de reservas dejó de usar
  Socket.IO. Se **eliminó** `chat-gateway.ts` por completo y el bot ahora es un
  endpoint HTTP síncrono `POST /api/chat/mensajes`
  (`ChatController` + `MensajeChatDto`). Decisión de diseño: el bot es una
  máquina de estados determinística — el cliente manda texto, el servidor
  devuelve `MensajeSaliente[]`; **ningún** flujo de negocio dependía de push
  (creación de reserva, liberación por timeout BullMQ, pago y confirmación son
  todos HTTP/DB — verificado: los únicos `client.emit()` vivían dentro del
  gateway eliminado). `sessionId` persiste en `localStorage` y viaja en el
  body. El rate-limit de memoria del gateway (sección 6) se reemplaza por el
  global `ThrottlerGuard` + `@Throttle({ limit: 30, ttl: 60_000 })` en el
  controller.
  - **Frontend:** `ChatWidget.tsx` reescrito a `fetch()` (sin
    `socket.io-client`, ahora fuera de `package.json`). El/la usuario/ia ve un
    estado de conexión visual: **verde "Conectado · Listo para ayudarte"** (API
    responde) / **ámbar "Verificando…"** / **rojo "Sin conexión"**, con poll de
    `/api/health` cada 10s y recuperación automática.
  - **Página pública nueva:** `/reservar` — frontend público "dumb proof" de
    reservas vía bot en el mismo estilo navy de `/torneos`: pasos visuales
    (Elegí cancha → horario → pagá), chips de sugerencia, banner de conexión,
    CTA amarillo "Empezar a reservar". `app/page.tsx` ahora redirige a
    `/reservar`; `/reservas` sigue siendo admin. `/chat-demo` se eliminó.
  - **Verificado en browser:** build API + `next build` web limpios (se fijó
    un lint de `rules-of-hooks` en `ChatWidget` — hooks tras un early return),
    flujo completo Hola → cancha → horario → precio → contacto → reserva
    creada → pago BAC simulado → "¡Pago confirmado!" en `/pago/resultado`, y el
    indicador de conexión en ambos sentidos (up→verde, down→rojo, recuperación
    →verde). 111/111 tests de API verdes.

## Resuelto (2026-09-14)

- **Re-auditoría `ui-reviewer` (2ª ronda)** — re-emitido tras los cambios de
  m13 + date picker. Resultado: **2 Major + 6 Minor**, ninguno una regresión
  de C1-C3/M1-M10/m1-m12. Todos corregidos:
  - **M-A (bug real):** los dos dashboards de reservas (admin `profutbol-antigua`
    y app externa `apps/web`) seguían usando `hoyISO()` con
    `toISOString().slice(0,10)` (UTC) — entre las 18:00 y 23:59 GT el listado
    arrancaba en **mañana (día vacío)**. Se aplicó el mismo helper de fecha
    local que ya tenían `/reservar` y `ChatWidget`. Verificado en browser: el
    dashboard abre hoy (2026-09-14) a las ~19:00 locales.
  - **M-B:** confirmaciones destructivas indistinguibles de las benignas.
    `ConfirmarModal` ahora acepta `variante?: 'primario' | 'peligro'`; cancelar
    reserva y desactivar alumno pintan el botón con el token `red #E4032C`.
    Verificado en browser: `rgb(228,3,44)` (peligro) vs `rgb(0,32,91)` (primario).
  - **m-A/m-B:** botones del modal y los 5 date pickers bajo el piso de 44px
    (SC 2.5.8) → `min-h-11`. Verificado: 44px en `/reservar`, `ChatWidget` y modal.
  - **m-C:** Escape cerraba el modal durante una acción en vuelo (el backdrop
    sí estaba guardado) → guard `!cargando`.
  - **m-D:** el `useEffect` del modal corría en cada render (el refresco
    silencioso de 30s del dashboard rompía el foco del teclado) → listener
    registrado una vez con refs al valor actual. Verificado: Escape cierra y
    devuelve el foco al botón que lo abrió.
  - **m-E:** `id="modal-titulo"` estático y sin `aria-describedby` →
    `useId()` + ids únicos + `aria-describedby` (verificado en el DOM).
  - **m-F:** bordes de los pickers nuevos por debajo de 3:1 (SC 1.4.11) →
    `gray-300`→`gray-500` y `white/20`→`white/40`.
  - `ChatWidget`: fila de fecha ahora es `<label>` real (área clickeable +
    asociación). `tsc --noEmit` limpio en ambas apps.

- **Date picker de fecha en el chat de reservas** — antes el bot siempre
  reservaba para el día actual (`mostrarDisponibilidad` hardcodeaba
  `fecha = hoy`). Ahora el/la usuario/a elige para qué día reserva y esa
  fecha viaja por todo el flujo hasta la tabla `reservas`:
  - **UI:** `<input type="date">` con `min = hoy` (fecha **local GT**, no
    UTC — `toISOString()` corría el "hoy" un día adelante cerca de
    medianoche) en `/reservar` y en `ChatWidget`. La fecha se envía en cada
    `POST /api/chat/mensajes` como `fecha: "YYYY-MM-DD"`.
  - **API:** `MensajeChatDto.fecha` opcional con `@IsDateString`; el
    `ChatController` la reenvía; `ChatService.procesar` siembra la sesión
    con la fecha elegida (las pasadas se ignoran — red de seguridad sobre el
    `min=hoy` del picker).
  - **Lógica:** `disponibilidad()` consulta la cancha en la **fecha
    elegida**; los mensajes del bot muestran la fecha formateada
    ("martes, 15 de septiembre"); `crearReserva` persiste esa `fecha` con
    un guard anti-pasado en `reservas.service.ts`.
  - **Tests:** 2 nuevos en `chat.service.spec.ts` (respeta la fecha
    elegida / ignora una fecha pasada del cliente) + 1 en
    `reservas.service.spec.ts` (rechaza fecha pasada). Suite API completa
    **126/126**, `tsc --noEmit` limpio en las 3 apps, flujo verificado en
    browser (repo testeado: horario listado "el miércoles, 16 de
    septiembre" para la fecha elegida).
  - **Nota operativa:** la API corre como `node dist/main.js` (sin
    `--watch`). Tras tocar el backend hay que `nest build` + reiniciar el
    proceso (esto arregló el `400 property fecha should not exist` de la
    `dist` vieja).

## Resuelto (2026-09-05)

- **Tests de exportación** (sección 2.1) — creados
  `excel-export.service.spec.ts` y `pdf-export.service.spec.ts` en
  `apps/api/src/modules/reportes/exportacion/`: generan un archivo real y
  verifican buffer no vacío, tamañana mínima, magic bytes (`PK\x03\x04`
  para XLSX, `%PDF`/`%%EOF` para PDF) y round-trip de lectura del libro
  Excel. Total 111/111 tests verdes.
- **k6 en CI** (sección 2.2) — nueva workflow
  `.github/workflows/loadtest.yml` disparada manualmente
  (`workflow_dispatch`, NO en cada PR) que corre `disponibilidad.js` y
  `reservas-concurrencia.js` contra staging. Se añadió un threshold a
  `reservas-concurrencia.js` (`reservas_exitosas count == 1`) para que el
  job falle si el lock no deja exactamente 1 reserva.
- **Seguridad 3.1 — Bloqueo de cuenta** — implementado en `auth.service.ts`
  (`login`): 5 fallos consecutivos → `bloqueadoHasta` = ahora + 15 min,
  mensaje de cuenta bloqueada, reinicio de contadores al éxito y tras
  expiración del bloqueo. Columnas `intentosFallidos`/`bloqueadoHasta` en
  el modelo `Usuario` (migración `add_lockout_fields`). Verificado e2e
  contra Postgres real (5 fallos → bloqueo; login correcto → tokens +
  reset) y con 3 unit tests nuevos en `auth.service.spec.ts` (total 106/106
  tests verdes).
- **Seguridad 3.2 — Rate limit de webhooks** — `@Throttle` dedicado
  (60/min) en `POST /payments/:gateway/webhook` (`pagos.controller.ts`).
- **Seguridad 3.3 — Rotación de secretos JWT** — procedimiento documentado
  en `RUNBOOK.md` (generar secretos, actualizar `.env`, reiniciar, verificar,
  calendarizar cada 90 días; nota sobre alternar con RS256 en el futuro).
- **Páginas admin de reportes y perfil** (sección 1) — creadas en
  `apps/web/app/admin/reportes/` y `apps/web/app/admin/perfil/`, con los
  métodos correspondientes en `lib/api-client.ts` y los DTOs añadidos a
  `packages/shared-types`. Link "Reportes" y "Mi perfil" en el header.
- **Swagger** (sección 7) — `@ApiOperation` en todos los endpoints de
  reportes y auth; descripción de `main.ts` actualizada (ya no dice "Fase 1").
- **Documentación** (sección 8) — README actualizado a "Fases 1–5" con la
  lista de implementado/no-implementado corregida; ruta de login en
  `MANUAL_USUARIO.md` corregida (`/login`).
- **Bug `formato` en exportación de reportes** — los endpoints
  `/reportes/ingresos/exportar` y `/reportes/morosidad/exportar`
  rechazaban siempre con 400 ("property formato should not exist")
  porque `ReporteQueryDto` no declaraba la propiedad `formato` y el
  `ValidationPipe` con `forbidNonWhitelisted` la bloqueaba. Corregido:
  añadido `@IsOptional() @IsIn(['excel','pdf']) formato?: string` al
  DTO. Los 4 flujos (excel/pdf × ingresos/morosidad) ahora devuelven
  archivos válidos.
- **Smoke test de browser** — Playwright headless contra localhost:3000,
  10/10 checks PASS: login+guard, nav, reportes (ingresos/ocupación/morosidad),
  exportación Excel, cambio de contraseña round-trip, relogin.

---

## 1. Frontend faltante (del scaffold Fase 5) ✅ (resuelto 2026-09-05)

El scaffold (`profutbol-antigua-fase5-tmp/`) creó 3 páginas admin que **ya se
copiaron y adaptaron** al repo real:

| Archivo en scaffold | Qué hace | Estado |
|---|---|---|
| `apps/web/app/admin/reportes/page.tsx` | Página completa: ingresos, ocupación por cancha, morosidad, botones Excel/PDF. Usa `api.reporteIngresos()`, `api.reporteOcupacion()`, `api.reporteMorosidad()`, `api.descargarExportacion()`. | ✅ Copiado y adaptado (2026-09-05) |
| `apps/web/app/admin/perfil/page.tsx` | Formulario de cambio de contraseña (3 campos: actual, nueva, confirmar). Llama `api.cambiarPassword()`. | ✅ Copiado y adaptado (2026-09-05) |
| `apps/web/app/admin/layout.tsx` | Layout admin con header/nav que incluye link a Reportes y "Mi perfil" (via `apps/web/components/AdminLayout.tsx`). | ✅ Copiado y adaptado (2026-09-05) |

**Resuelto:** los endpoints de reportes y cambio de contraseña son accesibles
desde la interfaz; el header admin navega a `/admin/reportes` y `/admin/perfil`.

---

## 2. Tests faltantes

### 2.1 Specs de servicios de exportación ✅ (resuelto 2026-09-05)
Creados `excel-export.service.spec.ts` y `pdf-export.service.spec.ts` en
`apps/api/src/modules/reportes/exportacion/` (5 tests): buffer no vacío,
magic bytes reales (`PK\x03\x04` para XLSX, `%PDF`/`%%EOF` para PDF),
round-trip de lectura del libro generado y caso de morosidad vacío. Se
usó `as any` puntual en la carga del libro por un desajuste del tipo
`Buffer` de exceljs contra @types/node 20 — solo tipo, sin cambio de
runtime.

### 2.2 k6 load tests no están en CI ✅ (resuelto 2026-09-05)
Nueva workflow `.github/workflows/loadtest.yml` con disparo **manual**
(`workflow_dispatch`) que corre ambos scripts contra `BASE_URL` de
staging con `CANCHA_ID` real (inputs configurables). Para que el job
gatee de verdad, se añadió un threshold a
`reservas-concurrencia.js`: `reservas_exitosas count == 1` — si el lock
no deja exactamente una reserva, k6 falla (exit != 0) y el job se marca
rojo. Probar antes de cada deploy importante (ver comentario del
workflow).

---

## 3. Seguridad (de SECURITY_CHECKLIST.md)

Los puntos marcados con ⚠️ en el checklist:

### 3.1 Bloqueo de cuenta tras N intentos fallidos ✅ (resuelto 2026-09-05)
5 fallos consecutivos → cuenta bloqueada 15 min (mensaje: *"Cuenta
temporalmente bloqueada por intentos fallidos"*). Migración
`add_lockout_fields` añade `intentosFallidos` + `bloqueadoHasta` a
`Usuario`. Verificación e2e contra Postgres real + 3 unit tests
nuevos (`auth.service.spec.ts`); 106/106 tests verdes.

### 3.2 Rate limiting para webhooks de pago ✅ (resuelto 2026-09-05)
`@Throttle({ default: { limit: 60, ttl: 60_000 } })` aplicado en el
handler `POST /payments/:gateway/webhook` (`pagos.controller.ts`). Se
aplica por encima del límite global sin afectar la verificación HMAC.

### 3.3 Rotación de secretos JWT ✅ (resuelto 2026-09-05)
Procedimiento manual documentado en `RUNBOOK.md` ("Rotación de secretos
JWT"): generar secretos nuevos (`openssl rand -hex 64`), actualizar
`.env`, reiniciar, verificar y calendarizar cada 90 días. La alternativa
RS256 (rotación sin invalidar tokens activos) queda documentada como
evolución futura.

### 3.4 Dependabot/Renovate ✅ (resuelto 2026-09-07)
`.github/dependabot.yml` creado (npm/weekly, máx. 5 PRs) para actualizaciones
automáticas de dependencias. La detección de vulnerabilidades en transitivas
(Dependabot alerts) requiere todavía un paso **manual EXTERNO**: ir a GitHub →
Settings → Security → Dependabot alerts → Enable (5 minutos).

---

## 4. Dependencias (de AUDITORIA_DEPENDENCIAS.md)

### 4.1 Next.js 14 → 15 ✅ (resuelto 2026-09-07)
`next@14.2.35` tenía múltiples CVEs de severidad alta (DoS en Server
Components, SSRF vía Server Actions), corregidos en la rama 15.x.

Migrado a `next`/`eslint-config-next` **15.5.25** y React **19.2.8**.
Adaptadas las 2 rutas dinámicas `'use client'` (`/torneos/[id]`,
`/admin/torneos/[id]`) al `params` asíncrono con `use()` (patrón "Synchronous
Page" de la Upgrade Guide). `next.config.js` no requirió cambios (solo
`reactStrictMode`, `transpilePackages`, `rewrites`); `@types/node`,
`tailwindcss`, `postcss` compatibles. Verificado con lint, `tsc --noEmit`,
`next build` (15/15 rutas) y smoke de `next start` en `/`,
`/torneos/<id>`, `/admin/torneos/<id>`, `/pago/resultado` (200, sin crash).

### 4.2 NestJS 10 → 11 ✅ (resuelto 2026-09-08)
`@nestjs/*` de v10 a **11.2.3** en `apps/api/package.json` (common, core,
platform-express, platform-socket.io, websockets, jwt, passport, bullmq,
swagger, cli, schematics, testing) + `@nestjs/config` a v4.

- **Overrides en raíz `package.json`** para forzar v11 en todos los peers
  (`npm` resolvía `@nestjs/common` v10 para bullmq/config/jwt/passport,
  causando árbol duplicado y riesgo de error de DI en runtime). Reinstala
  en frío (lockfile + node_modules) para colapsar a un solo v11.
- **Fix de tipos:** `auth.service.ts` — `@nestjs/jwt` v11 tipa `expiresIn`
  como `ms.StringValue`; `config.get<string>()` devuelve `string` genérico.
  Cast a `JwtSignOptions['expiresIn']` (valor env `'15m'`/`'7d'` válido en
  runtime).
- **Prisma:** regenerar `prisma generate` tras reinstalación en frío (los
  enums `RolUsuario`/`EstadoReserva`/`FormaPago` y `Prisma.Decimal` no se
  materializan solos).
- **Verificado:** `tsc --noEmit` limpio, build de api emitido a `dist/`,
  **111/111 tests**, `next build` web limpio, API arrancada desde `dist`
  (Postgres OK, health/swagger/torneos 200, login JWT válido con `exp` 15m).

**✅ Resuelto (2026-09-13, §4.2):** el CLI (`nest build`/`nest start`) no
materializaba su cierre de transitivas (`ansis`, `yoctocolors-cjs`,
`chokidar@4`, `@inquirer/*`) porque el lockfile tenía el subtree
`apps/api/node_modules/@nestjs/cli` **incompleto** (npm siempre
reproducía el hueco: un `npm i` contra el lockfile roto churn-ea 10k
líneas sin sanar nada). Fix duradero: **declarar `@nestjs/cli` como
devDependency en la RAÍZ** (`package.json` root). npm re-instala el CLI
con su cierre completo hoisteado en `node_modules` (primera vez: 113
añadidos), y **dedup-plica** la copia rota de `apps/api/node_modules`.
- Verificado: `nest --version` → 11.0.24, `npx nest build` → exit 0
  (reenvía a `dist/`), audit `--omit=dev` **9** (sin regresión),
  **111/111 tests**, API arrancada desde `dist` (health/swagger 200).
- El lockfile quedó **coherente** (diff acotado ~3.2k líneas, closure
  sano). Un futuro `npm ci` instala el CLI completo (nada que re-healear).
- Alternativa que NO usar: `tsc -p tsconfig.build.json` sigue siendo la
  ruta de build equivalente si `nest` falta en algún entorno.

---

### 4.3 Otras dependencias transitivas ✅ (recontadas 2026-09-13)
`npm audit --omit=dev` re-ejecutado tras la migración NestJS 11 (lockfile
estable, sin `--force`): **9 vulnerabilidades (1 crítica, 5 altas, 3
moderadas) — el mismo número que al cierre de Fase 5**. Ninguna en código
propio; todas transitivas. Compare con la pre-migración, el **footprint
mejoró**: los CVEs altos de `next@14` (SSRF/DoS) **desaparecieron** (Next 15)
y ya no aparecen `lodash`/`glob`/`webpack` (eran dev-deps). El residuo real:

| Paquete | Sev | De dónde llega | Evaluación real | Fix |
|---|---|---|---|---|
| `tar` | crítica | `bcrypt` → `@mapbox/node-pre-gyp` | node-pre-gyp extrae el binario de bcrypt **solo en `npm install`**; el código de tar jamás corre en runtime. Requeriría alimentarle un `.tar` malicioso durante la instalación — no es alcanzable en deploy | `npm audit fix` (semver-safe), diferido |
| `multer` | alta | `@nestjs/platform-express` | **No hay endpoints multipart** (verificado: cero `FileInterceptor`/`UploadedFile` en `apps/api/src`) — multer solo se activa como middleware si una ruta lo declara | No existe fix upstream |
| `postcss` | alta | incluido **dentro** de `next@15.5.25` | Solo corre en build procesando CSS propio del repo (nunca CSS de un usuario externo) | `next@16` (major, breaking) |
| `uuid` | moderada | `exceljs` (exportación reportes) | `exceljs` usa `uuid` internamente sin exponer el parámetro `buf`; el CVE aplica a v3/v5/v6 con buf controlado | Solo `--force` (downgrade absurd existente) |

**Deferred:** el único fix no-breaking disponible (`npm audit fix` → tar) se
difiere para no volver a re-resolver el árbol frágil (ver 4.2); es higiene de
instalación, no exposición en runtime. Los fixes `--force` (`next@16`,
`exceljs@3.4.0`) son majors breaking que no se justifican para cerrar estos
vectores. Revisar en la próxima actualización mayor de `next`/NestJS.
**Nota:** `Dependabot` (sección 3.4) repetirá este análisis semanalmente.

---

## 5. Monitoreo ✅ (resuelto 2026-09-13)

Los logs solo viven en stdout del proceso NestJS. Si el proceso muere o el
contenedor se reinicia, los logs se pierden.

**Resuelto:** se integró **Sentry** (Plan Gratis: ~50k eventos/mes, retención
30 días, alertas por email, sin infraestructura propia) con `@sentry/nestjs`.

**Cómo funciona (DSN-gated):**
- `main.ts` llama `Sentry.init({ dsn: SENTRY_DSN, ... })` **solo si**
  `SENTRY_DSN` está definida; sin DSN el arranque es byte-idéntico (no-op).
- `AllExceptionsFilter` captura en Sentry los **5xx** (`captureException`),
  no los 4xx (validación/401/404) para no gastar el cupo del plan gratis.
- `tracesSampleRate: 0.1` (muestreo bajo de trazas).

**Para activar en producción:** crear un proyecto en
`sentry.io` ⨯ crear DSN ⨯ ponerlo en `SENTRY_DSN` del hosting (el `.env`
local queda vacío). **Upgrade path:** si se necesita retención > 30 días o
más de 50k eventos/mes, subir al plan de pago; Datadog queda obsoleto
salvo que se quiera métricas de infraestructura además de errores.

---

## 6. Código simplificado (ponytail comments)

Estas son simplificaciones deliberadas marcadas en el código que tienen
un techo conocido:

| Archivo | Qué se simplificó | Upgrade path |
|---|---|---|
| `academia-notificaciones.scanner.ts` | Notificaciones solo loguean, no envían WhatsApp/SMS | Integrar gateway de WhatsApp Business API cuando esté disponible |
| ~~`chat-gateway.ts`~~ | ~~Rate limiting en memoria (Map)~~ — **archivo eliminado 2026-09-13**; el chat ahora es `POST /api/chat/mensajes` con `@Throttle` global (30/60s). Ver sección 10.1 | Si el hosting usa múltiples réplicas, que Redis (BullMQ ya usa Redis) provea el store de throttling |
| `chat.service.ts` | Normalización de texto con `toLowerCase().trim()` simple | Agregar stemming/lematización si se necesita matching más robusto |
| `pagos/gateways/gateway.service.ts` | Llamada HTTP real a pasarela de pago no implementada (stub) | Implementar HTTP real cuando se defina la integración con BAC/NeoNet |
| `torneos/fixture.service.ts` | Rondas siguientes de eliminación directa se arman manualmente — **resuelto 2026-09-13**: `generarRondaSiguiente` arma rondas 2+ con los ganadores; empates requieren `penalesGanadorId` (selector en el panel admin), sino responde `penalesPendientes` | Si el desempate por penales necesita marcador numérico (goles de penales), guardarlo además del ganador |

---

## 7. Swagger/OpenAPI ✅ (resuelto 2026-09-05)

`@ApiOperation` en todos los endpoints de reportes y auth; descripción de
`main.ts` ya no dice "Fase 1". Ver nota en "Resuelto (2026-09-05)".

---

## 8. Documentación desactualizada ✅ (resuelto 2026-09-05)

README actualizado a "Fases 1–5" (lista de implementado/no-implementado
corregida) y `MANUAL_USUARIO.md` apunta a la ruta real `/login` (no
`/admin/login`). Ver nota en "Resuelto (2026-09-05)".

---

## 9. CI/CD

- La imagen Docker se construye en CI (`build-imagen-docker` job) pero
  **no se despliega** — el hosting definitivo no está definido.
- No hay pipeline de deploy a staging/producción.
- Los k6 load tests no corren en CI (ver sección 2.2).

**Para resolver:** definir el proveedor de hosting (Railway, Fly.io, AWS
ECS, etc.) y agregar el paso de deploy después de `build-imagen-docker`.

---

## 10. Hallazgos del testing browser (2026-09-13)

Tres hallazgos surgieron del testing manual end-to-end vía Playwright (ver
`TESTING_MANUAL.md`). Ninguno es causado por la migración NestJS 10→11; son
pre-existentes o de superficie.

### 10.1 WebSocket `/chat` devuelve 404 ✅ (resuelto 2026-09-13)
Se reemplazó el WebSocket por HTTP: `ChatGateway` eliminado, nuevo
`POST /api/chat/mensajes` (ver "Resuelto (2026-09-13)"). El chat funciona
completo vía REST y el widget/página pública muestran estado de conexión
visual (verde/ámbar/rojo). Se quitaron `@nestjs/websockets`,
`@nestjs/platform-socket.io` y `socket.io-client` de las dependencias.

### 10.2 Dashboard de reservas no se auto-refresca (UX) — ✅ resuelto
- **Problema:** si una reserva expira (`expiraEn` pasada) mientras el
  dashboard está abierto, la fila seguía mostrando "Pendiente de pago" con
  botones Confirmar/Cancelar hasta recargar la página manualmente.
- **Solución (2026-09-13):** `refrescar` silencioso en
  `apps/web/app/(dashboard)/reservas/page.tsx`:
  - Polling cada **30s** con `setInterval` → `api.listarReservas({ fecha })`,
    sin tocar el spinner "Cargando..." (no parpadea la tabla).
  - En el `catch` de `ejecutarAccion` (Confirmar/Cancelar), se cierra el
    modal y se llama `refrescar()`: si la reserva se liberó/confirmó en otro
    lado, la fila refleja el estado real.
- **Verificado E2E:** con API en `RESERVA_TIMEOUT_PAGO_EN_LINEA_MIN=1`, una
  reserva PENDIENTE_PAGO expiró a los ~60s y la fila cambió sola a
  "Liberada (timeout)" (botones fuera, stat "Pend. pago" → 0) **sin
  recargar la página**.

### 10.3 Gateway `SIMULADO` no existe en el enum (foot-gun latente) — ✅ resuelto
- **Problema:** `POST /payments/SIMULADO/create` retornaba 500 ("Gateway no
  soportado: SIMULADO") porque `GatewayPago` solo definía
  `BAC`/`NEONET`/`EFECTIVO`. El simulado real se alcanzaba solo vía
  BAC-sin-credenciales (`crearSiConfigurado` → `simulada()`).
- **Solución (2026-09-13):** `SIMULADO` es ahora un gateway de primer nivel:
  - `packages/shared-types`: `GatewayPago.SIMULADO` añadido al enum.
  - `apps/api` `gateway.service.ts`: caso `SIMULADO` → `simulada()` siempre
    (sin depender de credenciales).
  - DB: `SIMULADO` añadido al enum `GatewayPago` del esquema Prisma
    (migración `20260914010325_add_gateway_simulado`) para poder persistir
    el pago con ese gateway.
- **Verificado E2E:** reserva PENDIENTE_PAGO → `POST /payments/SIMULADO/create`
  → 201 con `redirectUrl …/pago/resultado?ref=…&simulado=1` y `gateway=SIMULADO`
  persistido → `POST /payments/simulado/confirmar` → pago COMPLETADO y
  reserva CONFIRMADA.

## 11. Auditoría de UI/UX (2026-09-13) ✅ (resuelto 2026-09-14)

Resultado del agente `ui-reviewer` (auditoría estática de `apps/web`):
**26 hallazgos — 3 Critical · 10 Major · 13 Minor.** El detalle completo con
snippets y refactors listos para copiar está en **`UI_REVIEW.md`** (repo root).
Los ítems de abajo son el índice accionable; cada `Cx`/`Mx`/`mx` referencia
ese archivo. Confirmar con browser (axe + 200% zoom) antes de dar por cerrados
los que dicen "(verificar browser)".

| ID | Severidad | Finding (resumen) | Archivo principal | Estado |
|---|---|---|---|---|
| C1 | 🔴 Critical | Admin oscuro sobre `body bg-gray-50` → texto ~1.3-2.7:1 invisible | `AdminLayout.tsx` + `globals.css` (sección 11 admin) | ✅ resuelto |
| C2 | 🔴 Critical | "Pagar ahora" verde+blanco 2.3:1 (money CTA) | `reservar/page.tsx:142`, `ChatWidget.tsx:138` | ✅ resuelto |
| C3 | 🔴 Critical | Burbujas usuario `blue-500`+blanco 3.7:1 | `reservar/page.tsx:118` | ✅ resuelto |
| M1 | 🟠 Major | Modal sin `role="dialog"`/Escape/focus+ (SC 1.3.1, 2.1.2) | `(dashboard)/reservas/page.tsx:60,315` | ✅ resuelto |
| M2 | 🟠 Major | Inputs solo con `placeholder` (SC 3.3.2, 4.1.2) | `torneos/[id]`, `admin/torneos`, `admin/academia`, `admin/perfil` | ✅ resuelto |
| M3 | 🟠 Major | `text-gray-400` en blanco ≈ 2.5:1 | `admin/reportes`, `reservas` | ✅ resuelto |
| M4 | 🟠 Major | Tablas sin `overflow-x-auto` (reflow 200%) (verificar browser) | `admin/academia*`, `admin/torneos/[id]` | ✅ resuelto |
| M5 | 🟠 Major | Header admin sin wrap → scroll horizontal en phone (verificar browser) | `AdminLayout.tsx:43` | ✅ resuelto |
| M6 | 🟠 Major | ChatWidget `w-[370px]` fijo clips en ≤375px (verificar browser) | `ChatWidget.tsx:167` | ✅ resuelto |
| M7 | 🟠 Major | Focus invisible en input de chat (SC 2.4.7) | `reservar/page.tsx:241` | ✅ resuelto |
| M8 | 🟠 Major | `text-white/40` ≈ 3.2:1 footer/placeholder | `reservar/page.tsx:241,257` | ✅ resuelto |
| M9 | 🟠 Major | Inputs registro torneo sin fondo/borde en navy | `torneos/[id]/page.tsx:101` | ✅ resuelto |
| M10 | 🟠 Major | Estado toggle solo por color, sin `aria-pressed` | `asistencia/page.tsx:81`, `reservas:223` | ✅ resuelto |
| m1 | 🟡 Minor | Touch targets <44px (SC 2.5.8) | chips/acciones/export/chat (6 sitios) | ✅ resuelto |
| m2 | 🟡 Minor | Sin skip-to-content (SC 2.4.1) | layouts | ✅ resuelto |
| m3 | 🟡 Minor | Sin `prefers-reduced-motion` | `ChatWidget`, `reservar` | ✅ resuelto |
| m4 | 🟡 Minor | Magic values (`z-[9999]`, `w-[370px]`, …) | `ChatWidget`, `reservar` | ✅ resuelto |
| m5 | 🟡 Minor | Jerarquía de botones/chat inconsistente entre superficies | `reportes`, `reservar`/`ChatWidget` | ✅ resuelto |
| m6 | 🟡 Minor | Selector de mes con números, no nombres | `mensualidades/page.tsx:33` | ✅ resuelto |
| m7 | 🟡 Minor | Asistencia: optimistic update sin rollback en error | `asistencia/page.tsx:37` | ✅ resuelto |
| m8 | 🟡 Minor | Sin `autoComplete` en credenciales | `login`, `admin/perfil` | ✅ resuelto |
| m9 | 🟡 Minor | Flash de "sin torneos" antes de cargar | `torneos`, `admin/torneos` | ✅ resuelto |
| m10 | 🟡 Minor | Sin feedback de éxito al crear torneo | `admin/torneos/page.tsx:36` | ✅ resuelto |
| m11 | 🟡 Minor | Date/period inputs sin `aria-label` | `reservas`, `reportes`, `mensualidades` | ✅ resuelto |
| m12 | 🟡 Minor | `alert()` nativo en un solo flujo | `reservas/page.tsx:180` | ✅ resuelto |
| m13 | 🟡 Minor | Patrón de confirmación destructiva inconsistente | `admin/academia`, `reservas` | ✅ resuelto |

**Para resolver:** partir de C1 (el fix más impacto/usuarios — superficie oscura
para `/admin/*`), luego C2/C3 (contraste del flujo de pago/chat), después M1-M10
y barrer los m1-m13 que son quick wins. Re-emitir `ui-reviewer` tras cada tanda
(requiere reinicio de sesión para que el agente quede registrado) y cerrar con
verificación en browser.

---

| Categoría | Items | Esfuerzo estimado |
|---|---|---|
| Frontend admin (reportes + perfil) | 3 páginas | ✅ resuelto (2026-09-05) |
| Tests de exportación | 2 specs | ✅ resuelto (5 tests) |
| k6 en CI | 1 job | ✅ resuelto (workflow manual) |
| Bloqueo de cuenta | Modelo + lógica | ✅ resuelto (unit + e2e) |
| Rate limit webhooks | 1 decorador | ✅ resuelto |
| Rotación JWT | Documentación | ✅ resuelto (RUNBOOK.md) |
| Dependabot | dependabot.yml | ✅ resuelto (2026-09-07)* |
| Next.js 15 | Migración + pruebas | ✅ resuelto (2026-09-07) |
| NestJS 11 | Migración + pruebas | ✅ resuelto (2026-09-08) |
| @nestjs/cli transitivas (sección 4.2) | `nest build`/`nest start` faltaba cierre de deps | ✅ resuelto (2026-09-13): @nestjs/cli como devDep en raíz |
| Audit transitivas (sección 4.3) | Recuento post-Nest-11 | ✅ 9 residuales, mismo baseline (2026-09-13) |
| Monitoreo (sección 5) | Sentry, DSN-gated (errores 5xx) | ✅ resuelto (2026-09-13): @sentry/nestjs, solo 5xx, activar con SENTRY_DSN |
| Bracket automático (sección 6) | Rondas 2+ de eliminación directa se armaban a mano | ✅ resuelto (2026-09-13): generarRondaSiguiente + penales en el panel admin |
| Date picker de fecha en el chat | UI + DTO + lógica de disponibilidad/reserva | ✅ resuelto (2026-09-14): 126/126 tests, verificado en browser |
| Re-auditoría UI/UX 2ª ronda (§11) | 2 M · 6 m de `ui-reviewer` post m13/date-picker | ✅ resuelto (2026-09-14): incl. bug de fecha UTC en ambos dashboards; verificado en browser |
| Auditoría UI/UX (sección 11) | 3 C · 10 M · 13 m de `ui-reviewer` (detalle en UI_REVIEW.md) | ✅ resuelto (2026-09-14): C1-C3, M1-M10, m1-m12 fijados, verificado en browser |
| Swagger docs | Decoradores | ✅ resuelto (2026-09-05) |
| Documentación (README, manual) | 2–3 archivos | ✅ resuelto (2026-09-05) |
| Deploy pipeline | Definir hosting + pipeline | 1–2 días |
| Código ponytail (§6, 3 items: notif. academia, chat, gateway pago) | Variable | Según prioridad de negocio |
| WebSocket /chat 404 (sección 10.1) | Chat → HTTP + página pública | ✅ resuelto (2026-09-13) |
| Dashboard no auto-refresca (sección 10.2) | UX | ✅ resuelto (2026-09-13) |
| Gateway SIMULADO no en enum (sección 10.3) | 1 enum | ✅ resuelto (2026-09-13) |

* \* Dependabot **version updates** activado vía `.github/dependabot.yml` (PRs semanales). Las **alertas de seguridad** se activan manualmente en GitHub → Settings → Code security → Dependabot → Enable (no se puede desde CLI).
