# Despliegue: GitHub + Render + Vercel

Guía para publicar **Pro Futbol Antigua** por primera vez:

- **GitHub:** código y CI.
- **Render:** API NestJS, PostgreSQL y Redis.
- **Vercel:** frontend Next.js.

> No guardes secretos en Git. `.env`, URLs con credenciales, claves JWT, claves de pago y secretos de webhooks deben configurarse solamente en Render o Vercel.

---

## 0. Antes de publicar

### Requisitos

1. Cuenta en [GitHub](https://github.com), [Render](https://render.com) y [Vercel](https://vercel.com).
2. Git instalado: `git --version`.
3. **Node 20 LTS** instalado: `node --version`.
4. Dependencias instaladas correctamente desde la raíz del monorepo.

El proyecto usa npm workspaces:

```text
apps/api                 API NestJS
apps/web                 frontend Next.js
packages/shared-types    tipos compartidos
```

### Resolver primero el error de npm

El error reportado:

```text
npm ERR! Cannot set properties of null (setting 'peer')
```

se produjo usando Node `v24.19.0` con npm `9.9.4`. Antes de borrar archivos, cambia a **Node 20 LTS** y prueba conservando el lockfile:

```bash
node --version
npm --version
npm cache clean --force
npm ci
```

Si `npm ci` falla, guarda el log de npm y revísalo antes de borrar `node_modules` o `package-lock.json`. No borres el lockfile como primer paso: es el archivo que hace reproducible el build local y el de Render.

### Corregir y validar el código

No publiques hasta que el build y las pruebas relevantes pasen. Hay cambios pendientes que deben estar resueltos antes de este paso (errores de TypeScript/configuración y estilos del panel admin).

> El proyecto no permite hacer build mientras `npm run dev` está activo. Detén el servidor de desarrollo primero.

Desde la raíz:

```bash
npm run lint
npm test
npm run build
```

Si `npm run build` detecta un dev server activo, detenlo con `Ctrl+C`; no omitas el guard de seguridad.

---

## 1. Crear el repositorio en GitHub

### 1.1 Revisar lo que se va a publicar

Desde la raíz del proyecto:

```bash
git status
git diff --check
```

Revisa que no haya secretos, builds, ni `node_modules` en los cambios. El `.gitignore` ya excluye `.env`, `node_modules`, `apps/api/dist` y `apps/web/.next`.

### 1.2 Inicializar Git si es necesario

```bash
git init
git branch -M main
git add .
git commit -m "Initial commit"
```

Si `git status` ya funciona y hay historial, no ejecutes `git init` otra vez.

### 1.3 Crear el repositorio remoto

1. Ve a <https://github.com/new>.
2. Elige un nombre, por ejemplo `profutbol-antigua`.
3. No marques “Add a README”, `.gitignore` ni licencia: ya existen localmente.
4. Crea el repositorio.

Conecta y publica el repositorio local, reemplazando `TU-USUARIO`:

```bash
git remote add origin https://github.com/TU-USUARIO/profutbol-antigua.git
git remote -v
git push -u origin main
```

Confirma en GitHub que no aparezcan archivos `.env` ni secretos.

---

## 2. Crear recursos en Render

Crea los tres recursos en la **misma región** para reducir latencia y permitir conexiones internas.

### 2.1 PostgreSQL

1. Render → **New** → **PostgreSQL**.
2. Nombre sugerido: `profutbol-antigua-db`.
3. Selecciona la región más cercana a los usuarios.
4. Crea la base de datos.
5. Cuando esté disponible, copia su **Internal Database URL**.

Esta URL será el valor de `DATABASE_URL` en la API. No la pegues en GitHub ni en archivos versionados.

### 2.2 Redis

1. Render → **New** → **Redis**.
2. Nombre sugerido: `profutbol-antigua-redis`.
3. Elige la misma región que Postgres.
4. Crea el servicio.
5. Copia host, puerto y contraseña o URL de conexión desde el panel de Render.

### 2.3 Generar secretos JWT

Genera dos valores distintos en tu terminal:

```bash
openssl rand -base64 48
openssl rand -base64 48
```

Guárdalos directamente en Render como `JWT_ACCESS_SECRET` y `JWT_REFRESH_SECRET`. No los copies en este documento ni en commits.

---

## 3. Desplegar la API NestJS en Render

### Punto importante: contexto Docker

La API tiene un Dockerfile en `apps/api/Dockerfile`, pero ese Dockerfile copia archivos desde la **raíz del monorepo**:

```dockerfile
COPY package.json package-lock.json ./
COPY packages/shared-types ...
COPY apps/api ...
```

Por eso, **no configures `apps/api` como Root Directory en Render** cuando uses ese Dockerfile. El contexto de build debe ser la raíz del repositorio.

### 3.1 Crear el servicio web

1. Render → **New** → **Web Service**.
2. Conecta el repositorio de GitHub.
3. Selecciona la rama `main`.
4. Configura:

| Ajuste | Valor |
|---|---|
| Name | `profutbol-antigua-api` |
| Region | La misma de Postgres y Redis |
| Root Directory | Vacío / raíz del repositorio |
| Runtime | Docker |
| Dockerfile Path | `apps/api/Dockerfile` |
| Branch | `main` |

Render usará Node 20 porque el Dockerfile parte de `node:20-alpine`.

### 3.2 Migraciones Prisma

El Dockerfile actual compila la API, pero **no ejecuta** `prisma migrate deploy`. Configura un **Pre-Deploy Command** en Render:

```bash
npm run prisma:deploy -w apps/api
```

Si tu plan o configuración no ofrece Pre-Deploy Command, no publiques todavía: agrega un mecanismo de migración explícito y revisado. No ejecutes migraciones manuales sin tener `DATABASE_URL` configurada en el entorno de Render.

### 3.3 Variables de entorno de Render

En **Environment** del servicio API, añade estos valores:

| Variable | Valor |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Internal Database URL de Render Postgres |
| `REDIS_HOST` | Host de Render Redis |
| `REDIS_PORT` | Puerto de Redis, normalmente `6379` |
| `REDIS_PASSWORD` | Contraseña de Redis, si Render la provee |
| `JWT_ACCESS_SECRET` | Primer secreto generado |
| `JWT_REFRESH_SECRET` | Segundo secreto generado |
| `JWT_ACCESS_EXPIRES_IN` | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | `7d` |
| `BCRYPT_SALT_ROUNDS` | `12` |
| `TZ` | `America/Guatemala` |
| `WEB_URL` | URL de Vercel; se completa en el paso 4 |

Añade además las variables de BAC/NeoNet y Sentry únicamente si esas integraciones se usarán en producción. Nunca dejes habilitada una simulación de pago para un flujo de cobros real sin revisarla primero.

`PORT` lo asigna Render. La API ya lee `process.env.PORT`, así que no hace falta definirlo manualmente.

### 3.4 Desplegar y verificar la API

Crea el servicio y revisa los logs. Debes ver que el contenedor construye correctamente, Prisma aplica las migraciones y Nest inicia sin errores.

Prueba una ruta pública o de salud definida por la aplicación. Swagger solo está disponible fuera de producción, así que no dependas de `/api/docs` como comprobación de producción si la configuración actual lo deshabilita.

Guarda la URL de Render, por ejemplo:

```text
https://profutbol-antigua-api.onrender.com
```

---

## 4. Desplegar el frontend Next.js en Vercel

### 4.1 Crear el proyecto

1. Vercel → **Add New** → **Project**.
2. Importa el repositorio de GitHub.
3. En configuración del proyecto selecciona:

| Ajuste | Valor |
|---|---|
| Framework Preset | Next.js |
| Root Directory | `apps/web` |
| Install Command | Dejar el detectado por Vercel o usar el comando recomendado por su integración de monorepo |
| Build Command | El detectado por Vercel para Next.js |

El frontend depende de `packages/shared-types`. Si Vercel no detecta correctamente los workspaces al usar `apps/web` como root, configura el proyecto para construir desde la raíz del repositorio y ejecutar el build de `apps/web`; no copies tipos ni cambies imports para “arreglar” el despliegue.

### 4.2 Variable de entorno del frontend

En Vercel → **Settings** → **Environment Variables**, crea para Preview y Production:

| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_API_URL` | URL HTTPS del API de Render, sin slash final |

Ejemplo:

```text
NEXT_PUBLIC_API_URL=https://profutbol-antigua-api.onrender.com
```

El frontend llama siempre rutas relativas como `/api/auth/login`. `apps/web/next.config.js` las reescribe hacia `NEXT_PUBLIC_API_URL`; no cambies los clientes API para concatenar la URL de Render manualmente.

### 4.3 Crear preview primero

Ejecuta el deploy de preview desde Vercel. No promociones a producción hasta que completes las verificaciones de la siguiente sección.

Una vez que Vercel asigne una URL, vuelve a Render y configura `WEB_URL` con esa URL exacta. Para previews que necesiten llamar a la API, puedes permitir temporalmente ambas URLs separadas por coma, porque la API procesa `WEB_URL` como lista de orígenes.

Ejemplo:

```text
WEB_URL=https://tu-produccion.vercel.app,https://tu-preview.vercel.app
```

---

## 5. Validar integración antes de producción

En el preview de Vercel:

1. Abre la página principal y verifica que carga sin errores.
2. Inicia sesión y comprueba que las solicitudes llegan a `/api/...` y responden desde la API de Render.
3. Comprueba una reserva de prueba sin procesar pagos reales.
4. Abre herramientas del navegador → Network y busca errores CORS, 401 inesperados o respuestas 500.
5. Revisa logs de Render y Vercel.
6. Confirma que las tablas Prisma existen y que Render puede conectarse a Postgres y Redis.

Si hay un error CORS, verifica que `WEB_URL` en Render coincide exactamente con el dominio de Vercel: protocolo `https`, dominio correcto y sin rutas adicionales.

---

## 6. Promover a producción

Cuando el preview funcione:

1. Promueve el deployment a producción desde Vercel, o haz merge a `main` si el proyecto está conectado para desplegar producción desde esa rama.
2. Copia el dominio final de Vercel.
3. Actualiza `WEB_URL` en Render con el dominio final.
4. Espera el redeploy de Render y prueba de nuevo login y reserva.
5. Revisa los logs de ambos servicios durante los primeros minutos.

Antes de aceptar reservas reales, prueba una operación completa con datos de prueba y confirma el comportamiento de pagos, webhooks y cancelaciones.

---

## 7. Flujo de cambios posterior

```bash
git checkout -b feature/mi-cambio
# editar y probar localmente
git add .
git commit -m "feat: descripcion breve"
git push -u origin feature/mi-cambio
```

Abre un Pull Request. Vercel debe crear un preview para revisarlo. Cuando esté validado, mergea a `main`; Render y Vercel desplegarán según su configuración de Git.

---

## Lista final de seguridad

- [ ] Ningún `.env` ni secreto está en GitHub.
- [ ] `JWT_ACCESS_SECRET` y `JWT_REFRESH_SECRET` son valores largos, distintos y privados.
- [ ] `BCRYPT_SALT_ROUNDS=12` está configurado en Render.
- [ ] `DATABASE_URL` usa la URL interna de Render, no una URL expuesta innecesariamente.
- [ ] `WEB_URL` solo permite tus dominios Vercel autorizados.
- [ ] Las migraciones Prisma se ejecutan de forma explícita antes del arranque.
- [ ] El preview pasó login, reserva y revisión de logs antes de producción.

## Referencias

- [Render: Docker deployments](https://render.com/docs/docker-deploy)
- [Render: Pre-deploy commands](https://render.com/docs/deploys#pre-deploy-command)
- [Vercel: Monorepos](https://vercel.com/docs/monorepos)
- [Prisma: deploy migrations](https://www.prisma.io/docs/orm/prisma-migrate/workflows/development-and-production)
