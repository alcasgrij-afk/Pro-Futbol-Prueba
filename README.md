# Pro Futbol Antigua — Fase 1 (MVP)

Sistema de Reservas, Pagos y Gestion Deportiva. Este repositorio contiene el
codigo de la **Fase 1** descrita en el Plan de Desarrollo Tecnico: chatbot
web con maquina de estados, reservas con disponibilidad en tiempo real,
pago en linea por redireccion (BAC/NeoNet), y panel administrativo basico.

Si no has leido el Plan de Desarrollo Tecnico completo, leelo primero — este
README asume que conoces la arquitectura general (Diagrama 1) y el modelo de
datos (Diagrama 2).

---

## 1. Que hay en este repositorio

```
profutbol-antigua/
├── apps/
│   ├── api/          Backend NestJS (bot, reservas, pagos, panel admin API)
│   └── web/           Panel administrativo en Next.js
├── packages/
│   └── shared-types/   Tipos TypeScript compartidos entre api y web
├── docker-compose.yml       Postgres + Redis para desarrollo local
├── docker-compose.prod.yml  Stack de referencia para produccion
└── .github/workflows/ci.yml Pipeline de CI (lint + test + build)
```

**Lo que SI esta implementado en esta Fase 1:**
- Chatbot web (widget flotante) con maquina de estados completa (INICIO → ... → RESERVA_CONFIRMADA/LIBERADA), atendido por WebSocket (namespace `/chat`) y sesion en Redis
- Calculo de disponibilidad en tiempo real (sin tabla de horarios fijos)
- Creacion de reservas con lock distribuido en Redis + verificacion en transaccion (anti doble-reserva)
- Liberacion automatica de reservas no pagadas (BullMQ, timeout configurable)
- Pago en linea por redireccion a BAC Credomatic / NeoNet (ver seccion 6)
- Panel admin: login, listado de reservas del dia, confirmar/cancelar
- Autenticacion JWT con roles (ADMIN / RECEPCION / ENTRENADOR)
- 37 pruebas unitarias sobre la logica de negocio critica (disponibilidad, locking, maquina de estados, firma de webhooks)

**Lo que NO esta en esta Fase 1** (llega en fases posteriores, ver Plan Tecnico):
- Sitio web publico de reservas (Fase 2)
- Integracion completa con NeoNet/VisaNet y API completa de BAC (Fase 2)
- Torneos, academia, reportes avanzados (Fases 3-5)
- Envio real de recordatorios automaticos (Fase 2)

---

## 2. Requisitos previos

| Herramienta | Version | Notas |
|---|---|---|
| Node.js | 20.x | Ver `.nvmrc`. Usa `nvm use` si tenes nvm instalado. |
| npm | 10.x | Viene con Node 20. Este monorepo usa **npm workspaces** (no pnpm/yarn). |
| Docker + Docker Compose | Reciente | Para Postgres y Redis en desarrollo local. |

---

## 3. Arranque rapido (menos de 15 minutos)

```bash
# 1. Clonar e instalar dependencias de todo el monorepo
git clone <url-del-repo>
cd profutbol-antigua
npm install

# 2. Levantar Postgres y Redis
docker compose up -d
docker compose exec postgres pg_isready -U profutbol

# 3. Configurar variables de entorno del backend
cp .env.example apps/api/.env
cp apps/web/.env.local.example apps/web/.env.local
# El .env.example ya trae valores por defecto que funcionan con el
# docker-compose.yml de este repo, no es necesario editar nada para
# arrancar en local.

# 4. Build del monorepo (necesario ANTES de test la primera vez y tras cambios en shared-types)
npm run build

# 5. Generar el cliente de Prisma y aplicar el esquema
npm run prisma:generate
npm run prisma:migrate -w apps/api -- --name init

# 6. Cargar datos iniciales (2 canchas + usuario admin)
npm run prisma:seed

# 7. Arrancar el backend (puerto 3001) y el panel admin (puerto 3000)
npm run dev:api      # en una terminal
npm run dev:web      # en otra terminal
```

Verificacion de que todo esta funcionando:
- `http://localhost:3001/health` → `{ "status": "ok", ... }`
- `http://localhost:3001/api/docs` → documentacion Swagger de todos los endpoints
- `http://localhost:3000` → redirige a `/login`. Entra con
  `admin@profutbolantigua.com` / `CambiarEsta123!` (definido en `prisma/seed.ts`;
  **cambiar esta contrasena antes de usar datos reales**).
- `http://localhost:3000/chat-demo` → abre el widget del chatbot para probar
  el flujo de reserva por chat (sin credenciales externas).

> **Nota:** `npm run test` requiere que `npm run build` se haya ejecutado al menos una vez (genera `packages/shared-types/dist`). En CI, el orden correcto es `build → test → lint`.

Si algo falla, ver la seccion **9. Solucion de problemas** al final.

---

## 4. Como probar el chatbot web sin ninguna cuenta externa

El chatbot vive dentro del sitio web: es un widget flotante que el cliente
abre en el navegador y que el backend atiende por WebSocket (gateway en el
namespace `/chat`). No necesita WhatsApp ni ninguna credencial para probarlo.

1. Arranca el backend y el frontend:
   ```bash
   npm run dev:api      # terminal 1, puerto 3001
   npm run dev:web      # terminal 2, puerto 3000
   ```
2. Abrí en el navegador **http://localhost:3000/chat-demo**. Vas a ver, abajo
   a la derecha, un botón flotante de chat. Hacelo clic para abrir el panel.
3. Escribí "Hola" o tocá una opción del menú (Canchas / Torneos / Academia /
   Soporte). El bot te va guiando por el flujo de reserva: elegí cancha →
   horario → confirmá el precio → forma de pago → confirmación.
4. Para seguir la conversación desde la consola: el estado de la sesión se
   guarda en Redis bajo la llave `session:{sessionId}` — la podés inspeccionar
   en `http://localhost:8081` (Redis Commander, incluido en
   `docker-compose.yml`).

---

## 5. Pago en linea (redireccion a BAC / NeoNet)

El pago en línea usa un **flujo de redirección**, no links pegados a mano:
el sistema le pide a la pasarela (BAC Credomatic o NeoNet) crear una orden de
pago y recibe una `redirectUrl`; el cliente es redirigido a la página de pago
de la pasarela, paga ahí, y la pasarela avisa al sistema por **webhook**
(`POST /payments/webhook/:gateway`, verificado con HMAC) que el pago se
completó. La reserva se confirma sola, sin intervención de nadie.

Para probarlo localmente necesitás las credenciales de la pasarela en
`apps/api/.env` (`BAC_MERCHANT_ID`, `BAC_API_KEY`, `BAC_WEBHOOK_SECRET`, o los
equivalentes de NeoNet). Con una reserva en estado `PENDIENTE_PAGO`:

```bash
curl -X POST http://localhost:3001/payments/BAC/create \
  -H "Content-Type: application/json" \
  -d '{"monto": 350, "referenciaTipo": "RESERVA", "referenciaId": "<id-de-la-reserva>"}'
```

Deberías recibir `{ "redirectUrl": "...", "gatewayOrderId": "..." }`. Al
completar el pago en la pasarela (o al simular el webhook en desarrollo), el
estado de la reserva pasa a `CONFIRMADA`.

Los parámetros del checkout (merchant ID, API key, secret del webhook, URL de
retorno) se confirman con el banco durante la afiliación — ver sección 10 del
Plan Técnico. El código no cambia por esa respuesta; solo cambian los valores
en `.env`.

---

## 6. Pagos en la Fase 1

La Fase 1 implementa el pago en línea por redirección descrito en la sección 5
(BAC Credomatic y NeoNet). Las reservas "pagar en sede" se confirman
directamente desde el panel admin (botón **"Confirmar"** o
`PATCH /reservas/:id/confirmar`) sin pasar por ninguna pasarela.

---

## 7. Comandos utiles

| Comando | Que hace |
|---|---|
| `npm run dev:api` | Backend con hot-reload (puerto 3001) |
| `npm run dev:web` | Panel admin con hot-reload (puerto 3000) |
| `npm run build` | Build de produccion de todo el monorepo |
| `npm test` | Corre las 37 pruebas unitarias del backend (requiere `npm run build` previo) |
| `npm run test:cov` | Igual, con reporte de cobertura |
| `npm run lint` | ESLint en api y web |
| `npm run prisma:studio` | Explorador visual de la base de datos |
| `npm run prisma:migrate -w apps/api -- --name algo` | Crea una nueva migracion |
| `docker compose logs -f` | Ver logs de Postgres/Redis |

---

## 8. Despliegue

- **CI**: `.github/workflows/ci.yml` corre lint + tests + build en cada Pull
  Request contra `main`, y construye la imagen Docker de la API cuando el
  merge llega a `main` (ver Plan Tecnico, seccion 7).
- **Imagen Docker de la API**: `apps/api/Dockerfile` (build multi-stage).
  Probar localmente:
  ```bash
  docker build -f apps/api/Dockerfile -t profutbol-api .
  ```
- **Stack de produccion de referencia**: `docker-compose.prod.yml` (API +
  Postgres + Redis). Requiere un archivo `apps/api/.env` con las variables de
  produccion reales (nunca commitear este archivo).
- Para el panel admin (`apps/web`), lo mas simple es desplegarlo en Vercel o
  en DigitalOcean App Platform como sitio Next.js está preparado para eso
  (`next build && next start`), apuntando `NEXT_PUBLIC_API_URL` a la URL
  publica de la API.

---

## 9. Solucion de problemas

**`prisma generate` falla con error de red / checksum:** Prisma necesita
descargar sus binarios de `binaries.prisma.sh` la primera vez. Si estas
detras de un proxy o firewall corporativo, asegurate de permitir ese dominio.

**El backend arranca pero `/reservas` da error 500:** revisa que
`docker compose up -d` este corriendo y que `DATABASE_URL` en
`apps/api/.env` apunte a `localhost:5432` (o al host correcto si Docker corre
en una VM).

**El widget de chat no conecta:** revisá que `npm run dev:api` y
`npm run dev:web` estén corriendo, y que el navegador pueda llegar al backend
por WebSocket (el widget usa `ws://localhost:3001/chat` en desarrollo y hace
fallback a SSE/REST si el WebSocket falla). Si sigue sin conectar, mirá la
consola de `dev:api` — el `ChatGateway` registra allí cada conexión entrante.

**Login falla con "Correo o contrasena incorrectos" recien despues del
seed:** confirma que `npm run prisma:seed` corrio sin errores y que estas
usando exactamente `admin@profutbolantigua.com` / `CambiarEsta123!`.

---

## 10. Siguientes pasos

Una vez que el dueño del negocio de el visto bueno al piloto (Sprint 4, ver
Plan de Desarrollo Tecnico), el trabajo de la Fase 2 continua en este mismo
repositorio: sitio web publico, integracion completa de NeoNet y BAC, y
notificaciones automaticas. Ningun modulo de la Fase 1 deberia necesitar
reescritura para eso — solo extension.
