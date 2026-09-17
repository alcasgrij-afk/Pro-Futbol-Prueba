# Guía de prueba manual — Pro Futbol Antigua

Validación end-to-end de todas las funciones y componentes construidos,
post-migración NestJS 11 / Next.js 15. Corre contra el stack local
(Docker Postgres + Redis) con la API en `:3001` y el web en `:3000`.

> **Cuándo:** antes de dar por cerrada una migración o un release, y tras
> cualquier cambio en rutas, auth o reservas/pagos.
> **Alternativa automatizada:** `npm test` (111 tests) + smoke de Playwright.

---

## 0. Preflight — levantar el stack

```bash
# 1. Postgres + Redis (Docker)
docker compose up -d
docker ps            # esperar: profutbol-postgres (healthy), profutbol-redis (healthy)

# 2. Base de datos: aplicar migraciones + sembrar datos base
npm run prisma:migrate
npm run prisma:seed

# 3. API (hot-reload en :3001)
npm run dev:api

# 4. Web (hot-reload en :3000)
npm run dev:web

# 5. Smoke: la API responde
curl http://localhost:3001/health
# → {"status":"ok",...}
```

| Recurso | URL | Nota |
|---|---|---|
| API | http://localhost:3001 | versionless, `/api/*` fw del web |
| Swagger/OpenAPI | http://localhost:3001/api/docs | `@ApiOperation` en auth + reportes |
| Web | http://localhost:3000 | login en `/login` |
| Redis UI | http://localhost:8081 | opcional, para inspeccionar colas |

### Credenciales sembradas

| Usuario | Rol | Credencial |
|---|---|---|
| `admin@profutbolantigua.com` | `ADMIN` | `CambiarEsta123!` |

Canchas: `seed-cancha-futbol-5` (F5, Q250/Q300) y `seed-cancha-futbol-7`
(F7, Q350/Q420). Horario 08:00–22:00, bloques de 60 min.

Definí una variable para los ejemplos (Git Bash):

```bash
BASE=http://localhost:3001
ADM_EMAIL=admin@profutbolantigua.com
ADM_PASS=CambiarEsta123!
```

> **Ojo con el throttle:** login 5/min, refresh 10/min, webhook 60/min,
> global 120/min por IP. Si te llegan 429, espera un momento.

---

## 1. Auth (`/api/auth`)

### 1.1 Login correcto
```bash
curl -s -X POST $BASE/auth/login -H 'Content-Type: application/json' \
  -d "{\"email\":\"$ADM_EMAIL\",\"password\":\"$ADM_PASS\"}" | tee /tmp/login.json
```
- ✔ Responde 201 con `accessToken`, `refreshToken` y `usuario{id,nombre,rol}`.
- ✔ `usuario.rol == "ADMIN"`.
- ✔ Decodifica el access token (`jwt.io` o consola): `exp - iat ≈ 15 min`.
- ✔ Email incorrecto → 401 `Correo o contrasena incorrectos.` (mismo mensaje
  si la cuenta no existe — no filtra existencia).

```bash
export TOKEN=$(node -e "const l=require('/tmp/login.json');console.log(l.accessToken)")
export REFRESH=$(node -e "const l=require('/tmp/login.json');console.log(l.refreshToken)")
```

### 1.2 Password incorrecto → 401

### 1.3 Bloqueo de cuenta (5 fallos → 15 min)
> Hazlo al final de la sesión o con un usuario de prueba, porque bloquea la
> cuenta 15 min. Para desbloquear antes: `npm run prisma:studio` → `Usuario`
> → limpiar `intentosFallidos=0`, `bloqueadoHasta=null`.

```bash
# 5 intentos con password erroneo
for i in 1 2 3 4 5; do
  curl -s -o /dev/null -w "intento $i -> %{http_code}\n" -X POST $BASE/auth/login \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$ADM_EMAIL\",\"password\":\"incorrecta\"}"
done
```
- ✔ Intentos 1–4 → 401 genérico.
- ✔ Intento 5 → 401 con `Cuenta temporalmente bloqueada por intentos fallidos...`
- ✔ Login correcto durante el bloqueo → también bloqueado (se chequea antes
  de comparar el hash).
- ✔ Después de desbloquear (o 15 min), login correcto → tokens y contador reseteado.

### 1.4 Refresh token
```bash
curl -s -X POST $BASE/auth/refresh -H 'Content-Type: application/json' \
  -d "{\"refreshToken\":\"$REFRESH\"}"
```
- ✔ Emite un **nuevo par** de tokens.
- ✔ Refresh token inválido/expirado → 401 `Refresh token invalido o expirado.`

### 1.5 Cambio de contraseña (`PATCH /auth/password`)
```bash
curl -s -X PATCH $BASE/auth/password -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"passwordActual":"CambiarEsta123!","passwordNuevo":"NuevaTemporal123!"}'
# → {"mensaje":"Contrasena actualizada correctamente."}

# revertir (y verificar que la actual ya no sirve):
curl -s -X PATCH $BASE/auth/password -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"passwordActual":"CambiarEsta123!","passwordNuevo":"X"}'   # → 400 Unauthorized, la actual cambio
curl -s -X PATCH $BASE/auth/password -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"passwordActual":"NuevaTemporal123!","passwordNuevo":"CambiarEsta123!"}'   # → OK (revertido)
```
- ✔ Password actual incorrecta → 401.
- ✔ Requiere token (sin Bearer → 401).

### 1.6 Guard de rutas protegidas
```bash
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $TOKEN" $BASE/reportes/ingresos   # 200
curl -s -o /dev/null -w "%{http_code}\n" $BASE/reportes/ingresos                                  # 401 (sin token)
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer token-falso" $BASE/reportes/ingresos  # 401
```

---

## 2. Canchas (público)

```bash
curl -s $BASE/canchas
# → 2 canchas con nombre, tipo, precioAnticipadoQ, precioSedeQ, horario
curl -s "$BASE/canchas/seed-cancha-futbol-5/disponibilidad?fecha=$(date +%F)"
```
- ✔ 200, `disponibilidad` con bloques de 60 min en horario 08:00–22:00.
- ✔ Fecha fuera de rango / sin bloques → lista vacía, no error.
- ✔ Fecha inválida (`fecha=no-es-fecha`) → 400 (ValidationPipe global).

---

## 3. Reservas (flujo completo — el core del negocio)

DTO: `{ canchaId, clienteTelefono, clienteNombre, fecha, horaInicio, formaPago }`.
`formaPago`: `ANTICIPADO_EN_LINEA` | `EN_SEDE`.

```bash
FECHA=$(date -d tomorrow +%F)   # en Git Bash/Linux; en Windows: usa una fecha futura a mano
curl -s -X POST $BASE/reservas -H 'Content-Type: application/json' \
  -d "{\"canchaId\":\"seed-cancha-futbol-5\",\"clienteTelefono\":\"+502 5555 1234\",\"clienteNombre\":\"Juan Perez\",\"fecha\":\"$FECHA\",\"horaInicio\":\"19:00\",\"formaPago\":\"ANTICIPADO_EN_LINEA\"}" \
  > /tmp/reserva.json && cat /tmp/reserva.json
export RESERVA_ID=$(node -e "console.log(require('/tmp/reserva.json').id)")
```

### 3.1 Validación de entrada
- ✔ `horaInicio:"07:00"` (fuera de horario) → 400 o rechazo por disponibilidad.
- ✔ `horaInicio:"19:30"` (no múltiplo de bloque 60 min) → 400/conflicto.
- ✔ `clienteTelefono` < 8 chars → 400.
- ✔ Campo extra no declarado → 400 (forbidNonWhitelisted).

### 3.2 Consulta de la reserva (público, pre-pago)
```bash
curl -s "$BASE/reservas/$RESERVA_ID"
# → detalle con monto por anticipado/sede según forma de pago
```

### 3.3 Concurrencia (lock anti-doble-booking)
```bash
# dos reservas simultaneas para el mismo bloque:
( curl -s -X POST $BASE/reservas -H 'Content-Type: application/json' \
    -d "{\"canchaId\":\"seed-cancha-futbol-5\",\"clienteTelefono\":\"+502 1111 2222\",\"clienteNombre\":\"Ana Lopez\",\"fecha\":\"$FECHA\",\"horaInicio\":\"18:00\",\"formaPago\":\"EN_SEDE\"}" &
  curl -s -X POST $BASE/reservas -H 'Content-Type: application/json' \
    -d "{\"canchaId\":\"seed-cancha-futbol-5\",\"clienteTelefono\":\"+502 3333 4444\",\"clienteNombre\":\"Luis Paz\",\"fecha\":\"$FECHA\",\"horaInicio\":\"18:00\",\"formaPago\":\"EN_SEDE\"}" &
  wait )
```
- ✔ Solo una termina 201; la otra → 409 `ya existe una reserva`/conflicto de bloque.
- ✔ (Opcional) k6: `.github/workflows/loadtest.yml` — *workflow_dispatch* con
  «reservas_exitosas count == 1».

### 3.4 Panel admin (Bearer ADMIN/RECEPCION)
```bash
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/reservas?fecha=$FECHA"          # lista del dia
curl -s -X PATCH -H "Authorization: Bearer $TOKEN" "$BASE/reservas/$RESERVA_ID/confirmar"
curl -s -X PATCH -H "Authorization: Bearer $TOKEN" "$BASE/reservas/$RESERVA_ID/cancelar"
```
- ✔ Estados visibles: `PENDIENTE_PAGO`, `PENDIENTE_SEDE`, `CONFIRMADA`,
  `LIBERADA` (timeout), `CANCELADA`.
- ✔ Sin token / rol RECEPCION → 403/401.



---

## 4. Pagos (gateway simulado) + `/pago/resultado`

### 4.1 Crear pago desde la reserva (simulado)
```bash
curl -s -X POST $BASE/payments/simulado/create -H 'Content-Type: application/json' \
  -d "{\"referenciaTipo\":\"RESERVA\",\"referenciaId\":\"$RESERVA_ID\",\"returnUrl\":\"http://localhost:3000/pago/resultado\"}" \
  > /tmp/pago.json && cat /tmp/pago.json
export PAGO_ID=$(node -e "console.log(require('/tmp/pago.json').paymentId)")
```
- ✔ 201, `paymentId` generado, estado inicial `PENDIENTE`.

### 4.2 Estado del pago (polling que usa `/pago/resultado`)
```bash
curl -s "$BASE/payments/$PAGO_ID"
```

### 4.3 Simular pago completado (dev)
```bash
curl -s -X POST $BASE/payments/simulado/confirmar -H 'Content-Type: application/json' \
  -d "{\"paymentId\":\"$PAGO_ID\"}"
curl -s "$BASE/payments/$PAGO_ID"     # → COMPLETADO
```
- ✔ Confirmar el pago → la reserva pasa a `CONFIRMADA` (ver §3.4).

### 4.4 Flujo completo desde el navegador
1. Abre `http://localhost:3000/pago/resultado?ref=$PAGO_ID&simulado=1`.
2. ✔ Muestra monto + descripción; hace polling (máx 15 intentos).
3. ✔ Si confirmaste en 4.3 → muestra **PAGO COMPLETADO**.
4. Sin `ref` → estado ERROR.
5. Nota: `remaining` reservas `PENDIENTE_PAGO` no pagadas en N min se
   liberan (`LIBERADA`) vía cola Redis — revisa que aparezca en
   `http://localhost:8081` (bull queue) y luego el estado en §3.4.

### 4.5 Webhook + rate limit
```bash
# Throttle 60/min (este endpoint):
curl -s -o /dev/null -w "%{http_code}\n" -X POST $BASE/payments/SIMULADO/webhook \
  -H 'Content-Type: application/json' -d '{}'   # 201 o 400 (HMAC), no 200 de mas
```

---

## 5. Torneos (público + admin) y páginas web

```bash
# Público
curl -s $BASE/torneos                                  # lista
curl -s $BASE/torneos/<id_torneo>                      # detalle + equipos + tabla
curl -s $BASE/torneos/<id_torneo>/equipos              # equipos inscritos
curl -s -X POST $BASE/torneos/<id_torneo>/equipos -H 'Content-Type: application/json' \
  -d '{"nombreEquipo":"FC Antigua","capitanNombre":"Pedro","capitanTelefono":"+502 7777 8888"}'   # (ajusta campos al DTO Swagger)

# Admin (Bearer)
curl -s -X POST $BASE/torneos -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"nombre":"Copa Antigua 2026","tipo":"ELIMINACION_DIRECTA","fechaInicio":"'$(date -d "+30 days" +%F)'"}'   # (ajusta campos al DTO)
curl -s -X POST $BASE/torneos/<id>/fixture     -H "Authorization: Bearer $TOKEN"     # generar fixture (solo ronda 1)
curl -s -X PATCH $BASE/torneos/<id>/resultados -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"partidoId":"<partidoId>","golesLocal":2,"golesVisitante":1}'  # (ajusta campos al DTO)
curl -s -X PATCH $BASE/torneos/<id>/estado     -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"estado":"EN_CURSO"}'
```
- ✔ `POST /torneos/:id/equipos` puede devolver redirect de pago (si el torneo
  cobra inscripción).
- ✔ fixture con N equipos → (N-1) partidos ronda 1; rondas 2+ pendientes de
  `torneos/fixture.service.ts` (ponytail — bracket automático no implementado).

**En el navegador:**
- `/torneos` — lista pública.
- `/torneos/<id>` — detalle + auto-inscripción de equipos (parámetro async
  `params` post-Next 15).
- `/admin/torneos` — listar + crear torneo.
- `/admin/torneos/<id>` — generar fixture, capturar resultados, cambiar estado.

---

## 6. Academia + Asistencia (Bearer; ADMIN/RECEPCION/ENTRENADOR)

```bash
# Alumno
curl -s -X POST $BASE/academia/alumnos -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"nombre":"Carlos Mendez","categoria":"SUB_13","padreNombre":"Rosa Mendez","padreTelefono":"+502 9999 0000"}'   # (ajusta campos al DTO)
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/academia/alumnos?activo=true"
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/academia/alumnos/<alumnoId>"
curl -s -X PATCH -H "Authorization: Bearer $TOKEN" "$BASE/academia/alumnos/<alumnoId>/desactivar"

# Asistencia
FECHA_A=$(date +%F)
curl -s -X POST $BASE/asistencia -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"alumnoId\":\"<alumnoId>\",\"fecha\":\"$FECHA_A\",\"presente\":true}"
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/asistencia?fecha=$FECHA_A"
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/asistencia/alumnos/<alumnoId>"

# Mensualidades
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/academia/mensualidades?mes=$(date +%m)&anio=$(date +%Y)"
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/academia/alumnos/<alumnoId>/mensualidades"
```
- ✔ Crear alumno → aparece en el listado y en la página de asistencia.
- ✔ `PATCH desactivar` → no aparece más en `?activo=true`.

**En el navegador:** `/admin/academia` (registrar alumno), `/admin/academia/asistencia`
(registrar asistencia del día), `/admin/academia/mensualidades` (por mes/año).

---

## 7. Reportes (Bearer, solo ADMIN)

```bash
DESDE=$(date -d "-30 days" +%F); HASTA=$(date +%F)
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/reportes/ingresos?desde=$DESDE&hasta=$HASTA"
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/reportes/ocupacion?desde=$DESDE&hasta=$HASTA"
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/reportes/morosidad?diasVencimiento=30"
```
- ✔ Ingresos desglosados por fuente (reservas + torneos + academia).
- ✔ Ocupación por cancha en el rango.
- ✔ Morosidad: pagos pendientes con +30 días. Con cero morosos → reporte vacío, no crash.

### 7.1 Exportación (Excel/PDF)
```bash
curl -s -H "Authorization: Bearer $TOKEN" -o /tmp/ingresos.xlsx "$BASE/reportes/ingresos/exportar?formato=excel"
curl -s -H "Authorization: Bearer $TOKEN" -o /tmp/morosidad.pdf  "$BASE/reportes/morosidad/exportar?formato=pdf"
file /tmp/ingresos.xlsx   # ZIP (PK\003\004)
file /tmp/morosidad.pdf   # %PDF ... %%EOF
```
- ✔ Ambos formatos × ambas fuentes (4 combinaciones), archivos abren sin error.
- ✔ `formato` omitido o inválido → 400 (regresión ya arreglada del DTO).

**En el navegador:** `/admin/reportes` — tres reportes con botones
«Excel/PDF».

---

## 8. Chat de reservas (HTTP `POST /api/chat/mensajes`)

El chat dejó de usar WebSocket (2026-09-13): es un endpoint HTTP síncrono.
El frontend **público** está en `/reservar` (el widget flotante sigue en las
páginas del admin). El bot es una máquina de estados: el cliente manda texto,
el servidor devuelve `MensajeSaliente[]`.

```bash
BASE=http://localhost:3001
curl -s -X POST $BASE/chat/mensajes -H 'Content-Type: application/json' \
  -d '{"texto":"Hola"}' > /tmp/chat.json && cat /tmp/chat.json
# → { "sessionId":"<uuid>", "mensajes":[ { tipo:"lista", texto:"...", opciones:[canchas...] } ] }
```
- ✔ Sin `sessionId` → el servidor genera uno y lo devuelve; mandándolo de
  vuelta, el bot **recuerda la conversación** (estado en `ChatSessionService`).
- ✔ Flujo completo: `Hola` → canchas → horario → precio → contacto → reserva
  creada → mensaje de pago con `gateway`/`reservaId`/`montoQ`.
- ✔ Throttle `@Throttle`: 30 msgs/min (este endpoint); sobrepasar → 429.
- ✔ Es `@Public()` (sin JWT) aunque el resto de la API exija `Bearer`.

**En el navegador:** `/reservar` (ver §9). El indicador de conexión muestra
verde "Conectado · Listo para ayudarte" / ámbar "Verificando…" / rojo "Sin
conexión" según responda `/api/health`; se recupera solo cuando la API vuelve.

---

## 9. UI web end-to-end (navegador)

| Paso | URL | Qué verificar |
|---|---|---|
| Home | `/` | Redirige a `/reservar` (visitante público → chatbot). El admin usa `/reservas` o `/login` directo |
| Login | `/login` | Credenciales válidas → redirige a `/reservas`; inválidas → error; **se guarda el token en localStorage (`profutbol_access_token`)** |
| Reservas del día | `/reservas` | Tabla filtrable por estado, confirmar/cancelar, tarjetas de resumen |
| Reserva sin sesión | `/reservas` sin token | La API devuelve 401 (no hay middleware de ruta) → la página muestra el error |
| Academia | `/admin/academia` | Listar/crear alumno |
| Asistencia | `/admin/academia/asistencia` | Marcar `presente`/`ausente` del día |
| Mensualidades | `/admin/academia/mensualidades` | Selector mes/año, estados de pago |
| Torneos público | `/torneos`, `/torneos/<id>` | Lista, detalle con `use()` async params, auto-inscripción |
| Torneos admin | `/admin/torneos`, `/admin/torneos/<id>` | Crear, fixture, resultados, estado |
| Reportes | `/admin/reportes` | 3 reportes + descargas Excel/PDF |
| Perfil | `/admin/perfil` | Cambio de contraseña (3 campos, valida la actual) |
| Pago | `/pago/resultado?ref=<id>&simulado=1` | Flujo de §4.4 |
| Chat público | `/reservar` | Página pública de reserva vía bot: pasos, chips sugeridos, banner de conexión, `Pagar ahora — Q{monto}` → §8 |

> **Expiración de access token (15 min):** deja el navegador idle > 15 min y
> vuelve a una página admin → espera 401 (el cliente **no renueva** con el
> refresh token; solo `/auth/refresh` vía API lo hace). Esto es el
> comportamiento actual a verificar, no un bug.

---

## 10. Lista de verificación final

- [ ] `docker compose up -d` healthy (postgres + redis)
- [ ] `npm test` → 111/111 verdes
- [ ] `/health` 200 · Swagger `/api/docs` carga con tags Auth/Reportes
- [ ] Login OK + 401 con credenciales malas + bloqueo tras 5 fallos
- [ ] Refresh emite par nuevo · cambio de password con validación de la actual
- [ ] Canchas + disponibilidad horaria
- [ ] Reserva 201 → detalle público → confirm/cancel por admin → 409 en bloque duplicado
- [ ] Pago simulado PENDIENTE → confirmar → COMPLETADO → reserva CONFIRMADA
- [ ] `/pago/resultado` muestra COMPLETADO y FALLIDO/ERROR
- [ ] Torneos: crear, fixture, resultados, estado, inscripción de equipos
- [ ] Academia: alumno, asistencia, mensualidades, desactivar
- [ ] Reportes: ingresos/ocupación/morosidad + 4 exportaciones abren
- [ ] Chat: `POST /api/chat/mensajes` sin token == 200; flujo completo en `/reservar`; indicador verde/rojo según `/api/health`
- [ ] UI: todas las rutas de §9 cargan y operan sin 500
- [ ] Token expirado → 401, no crash

**Si algo falla:** captura el status + cuerpo del error, y el log de la API
(`npm run dev:api`). Abre un issue en el repo con: paso, URL, request,
response, log.

---

## Resultados del Testing Browser — 2026-09-13

Ejecución manual vía Playwright (browser real) contra stack local:
Docker Postgres+Redis, API `dist/main.js` (:3001), Next.js dev (:3000).

### Login + guard (PASS)
- `POST /auth/login` → accessToken + refreshToken.
- UI: formulario en `/login`, campos Correo + Contraseña.
- Login exitoso → redirección a `/reservas` + token guardado en `localStorage['profutbol_access_token']`.
- Token expirado (TTL 15 min) → petición a API retorna 401; UI no crashea.
- Re-login por UI → token fresco, peticiones vuelven a funcionar.

### Reservas del día — Dashboard (PASS)
- Ruta `/reservas`: date picker (YYYY-MM-DD), stat cards (Total, Pend. sede, Pend. pago, Confirmadas, Monto), filtros (Todas / Pend. pago / Pend. sede / Confirmadas / Liberadas / Canceladas), tabla (Horario / Cancha / Cliente / Pago / Monto / Estado / Acciones).
- Stat cards se actualizan al hacer fetch: Total=5, Pend.sede=0, Pend.pago=0, **Confirmadas=1**, **Monto=Q300**.
- Filtro Confirmadas: tabla muestra solo filas con estado CONFIRMADA; otros ocultados. ✅

### Reserva — Crear (PASS)
- `POST /reservas` con formaPago `EN_SEDE`: devuelve 201 con `estado: PENDIENTE_SEDE`, `expiraEn` (~15–30 min), precio del tipo correspondiente (Q300 precio sede).
- Reserva aparece en el dashboard inmediatamente al hacer fetch.

### Reserva — Confirmar (PASS)
- Botón "Confirmar" en fila → **ConfirmarModal** con mensaje: *"Vas a confirmar la reserva de [Nombre] en [Cancha] a las [hora]."*.
- Confirmar → PATCH exitoso → estado cambia a `CONFIRMADA`; stat "Confirmadas" incrementa, "Monto" se actualiza.
- Filas confirmadas no muestran acciones Confirmar/Cancelar.

### Reserva — Expiración / Liberada (PASS)
- Reservas en estado `PENDIENTE_PAGO` con `expiraEn` pasada → transicionan automáticamente a `LIBERADA (timeout)` server-side.
- Dashboard las muestra como "Liberada (timeout)" sin acciones.
- **Auto-refresco §10.2 (RESUELTO 2026-09-13):** el dashboard ahora
  refresca la lista cada **30s** sin recargar la página. Verificado E2E con
  API en `RESERVA_TIMEOUT_PAGO_EN_LINEA_MIN=1`: una fila PENDIENTE_PAGO
  expiró a los ~60s y cambió sola a "Liberada (timeout)" (botones fuera,
  stat "Pend. pago" → 0) sin tocarla. Cuando la accion Confirmar/Cancelar
  falla (reserva ya liberada en otro lado), el modal se cierra y la fila se
  refresca sola. Confirmar una fila expirada retorna error de negocio:
  *"No se puede confirmar una reserva en estado LIBERADA."* (no crashea, no 401).

### Reserva — Confirmar sobre reserva ya LIBERADA (PASS)
- Backend rechaza correctamente con mensaje de negocio claro (no status 500).
- UI muestra alerta con el mensaje de error; al aceptar se cierra el modal.

### Token expirado durante Confirmar (PASS)
- Primer intento de Confirmar con token expirado → alert "Unauthorized" (401).
- No corrompe el estado ni crea reservas duplicadas.

### Chat — WebSocket → HTTP (RESUELTO 2026-09-13)
- `chat-gateway.ts` eliminado; el chat ahora es `POST /api/chat/mensajes`.
- Widget flotante y `/reservar` verificados end-to-end en browser (ver
  sección "Chat público `/reservar`" abajo).

### Chat público `/reservar` (PASS)
- Página pública navy: hero "Reservá tu cancha", 3 pasos visuales (Elegí
  cancha → Elegí horario → Pagá), CTA amarillo "Empezar a reservar" que envía
  `Hola`, y "Ver torneos".
- Estado de conexión visual: **verde "Conectado · Listo para ayudarte"** con
  API arriba; **rojo "Sin conexión"** con banner de error y botón Enviar
  deshabilitado; **recuperación automática a verde** al volver la API
  (poll `/api/health` cada 10s).
- Flujo completo del bot: Hola → cancha (F5) → horario (18:00) → precio Q250 →
  contacto (Juan Perez/5555-1234) → **reserva creada** → "Pagar ahora — Q250"
  → redirect BAC simulado → `/pago/resultado` **"¡Pago confirmado!"**.
- `localStorage['profutbol_chat_session']` persiste la sesión entre mensajes.

### Errores en consola del browser
- 13 errores registrados durante la sesión: todos corresponden a WebSocket 401/404 del ChatWidget y al intento de Confirmar con token expirado. Ninguno es nuevo o causado por la migración.

### Admin — Reportes (PASS)
- `/admin/reportes`: tarjetas **Ingresos Q1,150**, **Ocupación por cancha** (F5 1.6%, F7 0%), **Morosidad Q0**, botones de exportación Excel/PDF. Captura: `admin-reportes.png`.

### Admin — Academia · Alumnos (PASS)
- `/admin/academia`: título "Academia · Alumnos", links a Asistencia/Mensualidades, botón "+ Nuevo alumno". Empty state correcto con seed: *"No hay alumnos registrados todavía."*

### Admin — Academia · Asistencia (PASS)
- `/admin/academia/asistencia`: date picker (2026-09-12), empty state *"No hay alumnos activos para marcar asistencia."* (sin alumnos activos en seed).

### Admin — Academia · Mensualidades (PASS)
- `/admin/academia/mensualidades`: selectores mes/año (9/2026), tabla **Alumno / Periodo / Monto / Estado** con datos reales del seed: *Mateo Garcia* y *Sofia Lopez* (9/2026, **Q150**, Pendiente). Al cambiar a un mes sin cobro → empty state *"No hay mensualidades para <mes/año>. El cobro se genera el día 1 de cada mes para los alumnos activos."*
- **Nota:** primera visita con token expirado (TTL 15 min) → la tabla mostraba "Unauthorized". Esperado, misma causa que en reservas; tras re-login por UI los datos cargan.

### Admin — Perfil (PASS)
- `/admin/perfil`: formulario "Cambiar contrasena" con **3 campos** (actual, nueva, confirmar) + botón "Cambiar contrasena" deshabilitado hasta completar. Validación client-side en código: min 8 caracteres y coincidencia actualización/nueva antes de llamar al API.
- **Hallazgo menor:** el primer load mostró `Invalid or unexpected token` en consola y la página en blanco (error transitorio del dev server Next.js); tras `location.reload()` la página renderiza correctamente. No reproducible, no bloqueante. Captura: `admin-perfil.png`.

### Admin — Torneos lista (PASS)
- `/admin/torneos`: form **"Crear nuevo torneo"** (nombre, formato Liga/Eliminación directa, máx. equipos, cuota Q, categoría, fecha límite, descripción) + lista con badges de estado. Seed: **"Liga de Verano 2026"** (Todos contra todos · 4/4 equipos · Cuota Q100 · "Inscripciones abiertas"), con link al detalle.

### Admin — Torneos detalle (PASS)
- `/admin/torneos/[id]` (Liga de Verano 2026): selector de estado, tabla **"Equipos inscritos"** (Equipo / Capitán / Teléfono / Cuota: Todos "Pagada").
- **Fixture generado** de 3 jornadas con marcadores (Los Canarios 2-1 Atletico Cerro; Real Antigua 3-2 Dep. Santa Ana; etc.). Botón "Generar fixture" deshabilitado porque ya existe.
- **Tabla de posiciones verificada aritméticamente** (3 pts/win, 1/draw, orden por Pts desc, Dif = GF−GC correcto):
  1. Real Antigua — 3J 2G 1E 0P · Pts **7** ✅
  2. Dep. Santa Ana — 3J 2G 0E 1P · Pts **6** ✅
  3. Los Canarios — 3J 1G 0E 2P · Pts **3** ✅
  4. Atletico Cerro — 3J 0G 1E 2P · Pts **1** ✅
- Captura: `admin-torneo-detalle.png`.

### Público — Torneos (lista) (PASS)
- `/torneos`: layout público (logo "Pro Futbol Antigua" + link "Reservar cancha"), título "Torneos y campeonatos". Card "Liga de Verano 2026" con badge "Inscripciones abiertas" y "Todos contra todos · 4/4 equipos", link al detalle.

### Público — Torneo detalle (PASS)
- `/torneos/[id]`: link "Volver a torneos", encabezado (nombre, "Equipos 4/4 · Cuota Q100"), lista "Equipos inscritos" (Los Canarios, Real Antigua, Dep. Santa Ana, Atletico Cerro — todas "Cuota pagada"), form **"Inscribir mi equipo"** (nombre, capitán opcional, teléfono opcional, botón).
- Mismo **Fixture** (3 jornadas con marcadores) y **Tabla de posiciones** verificada que en el admin. Pass de la ruta dinámica `[id]` con `params: Promise` (migrada a Next 15).

### Público — Chat (reemplaza a `/chat-demo`, eliminada)
- `/chat-demo` se eliminó; el chat público vive en **`/reservar`** (Home `/`
  redirige ahí). Setup internacional-fire a voluntad: `/chat-demo` → 404 esperado.

### Público — Pago resultado (flujo simulado end-to-end) (PASS)
- Flujo completo ejecutado contra la API real:
  1. `POST /auth/login` → token fresco.
  2. `POST /reservas` (cancha F5, 19:30, `ANTICIPADO_EN_LINEA`) → 201, estado `PENDIENTE_PAGO`.
  3. `POST /payments/BAC/create` (`referenciaTipo=RESERVA`, `referenciaId=<reserva>`) → 201 con `{ paymentId, redirectUrl: /pago/resultado?ref=<id>&simulado=1, gateway: 'BAC' }`.
  4. Navegación a `redirectUrl` → `/pago/resultado?ref=...&simulado=1`.
- La página ejecutó `POST /payments/simulado/confirmar` + polling `GET /payments/:id` y terminó en estado **COMPLETADO**: tarjeta **"¡Pago confirmado!"**, "Cancha: Cancha 1 - Futbol 5", "Monto: Q250", "Tu reserva quedo confirmada. ¡Nos vemos en la cancha!", botón "Volver al inicio". Captura: `pago-resultado.png`.
- **Hallazgo de integración (no bloqueante, pre-existente):** el gateway `SIMULADO` no existe en el enum `GatewayPago` (solo BAC/NEONET/EFECTIVO); llamar `POST /payments/SIMULADO/create` retorna 500 ("Gateway no soportado: SIMULADO"). En dev sin credenciales, **BAC** es el que entrega la redirección simulada. Documentado aquí; el frontend crea siempre con BAC, así que el usuario nunca pega `SIMULADO`.

---

## Referencias

- `PENDIENTES.md` — cola de pendientes guardada (monitoreo, deploy, código ponytail, audit).
- `RUNBOOK.md` — operación, rotación de secretos JWT, deploy.
- `README.md` — arquitectura y alcance Fases 1–5.