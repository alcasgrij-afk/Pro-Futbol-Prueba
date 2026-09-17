# Auditoría de Dependencias — Fase 5 / Sprint 2

Resultado de `npm audit` al cerrar la Fase 5, con la evaluación real de
qué representa un riesgo para este proyecto específico y qué no. El
objetivo de este documento no es "que el número llegue a cero" — muchas de
estas alertas son de herramientas de build que nunca corren en producción
— sino separar el ruido de lo que realmente hay que resolver.

**Resumen del escaneo:** vulnerabilidades reportadas en dependencias
transitivas — **ninguna en código propio de este repositorio**.

---

## Acción recomendada con más prioridad: actualizar Next.js

**`next` (actualmente 14.2.35) — múltiples CVEs de severidad alta**,
incluyendo denegación de servicio (DoS) en Server Components y
Server-Side Request Forgery (SSRF) vía Server Actions. Las versiones
corregidas de varias de estas fallas solo existen en la rama 15.x — la
14.x dejó de recibir backport de algunas de ellas.

**Por qué importa:** `next` es una dependencia de **producción** que sirve
tráfico público directamente (el sitio web y el panel admin) — a
diferencia de la mayoría de lo demás en esta lista, esto sí es superficie
de ataque real.

**Recomendación:** planificar la migración a Next.js 15 como una tarea
propia (no un `npm audit fix --force` a ciegas) — el App Router tuvo
cambios entre versiones mayores que ameritan volver a probar cada página
del sitio (`/`, `/torneos`, `/reservar`, y todo `/admin/*`) antes de
desplegar. No se hizo dentro de esta fase para no introducir una migración
mayor sin la ventana de pruebas que merece.

---

## Revisadas y evaluadas como bajo riesgo real para este proyecto

### `tar` (crítico) y `glob`, `webpack`, `tmp`, `inquirer` (altas/moderadas)

Todas llegan exclusivamente a través de `@nestjs/cli` → `@angular-devkit/*`
→ herramientas de build (webpack, schematics). **Son `devDependencies`**:
nunca se incluyen en la imagen de producción (`apps/api/Dockerfile` usa
`npm ci --omit=dev` en la etapa de runtime, ver Plan Técnico sección 3.6) y
solo procesan los propios archivos del repositorio durante `nest build`,
nunca un archivo `.tar` ni una URL proporcionados por un usuario externo.
El vector de ataque que describen estos CVEs (extracción de un `.tar`
malicioso, un glob controlado por un atacante) no aplica a cómo se usan
acá.

### `lodash` (alta — inyección de código en `_.template`; prototype pollution en `_.unset`/`_.omit`)

Llega de forma transitiva vía `@nestjs/config` y `@nestjs/swagger`. Ninguna
parte de este código llama a `_.template()`, `_.unset()` ni `_.omit()`
directamente con datos que vengan de una petición HTTP — son funciones
internas de esos paquetes de NestJS, no expuestas por nuestra API. Riesgo
real bajo, pero se recomienda revisar de nuevo cuando NestJS publique una
versión que actualice esta dependencia.

### `exceljs` → `uuid` (moderada — falta de validación de límites en v3/v5/v6 con buffer proporcionado)

Solo aplica cuando el código que llama a `uuid` pasa explícitamente un
`buf` propio — `exceljs` lo usa internamente para IDs de relación del
archivo `.xlsx`, sin exponer ese parámetro a datos externos. Confirmado
además con las pruebas unitarias de `excel-export.service.spec.ts`
(los archivos generados se leen de vuelta sin error).

### `pdfkit` → `crypto-browserify`, `stream-browserify` (moderadas, transitivas)

Llegan a través de la cadena de dependencias de `pdfkit` (usado solo en
`reportes/exportacion/pdf-export.service.ts`). Son polyfills de Node.js
para entornos de browser — en nuestro caso corren en servidor (Node.js
nativo), no en el browser, y no reciben datos de usuario que controlen su
comportamiento.

### `js-yaml`, `postcss`, `ajv`, `picomatch`, `qs`, `body-parser`, `file-type`, `multer`, `nanoid` (moderadas/altas, transitivas)

Todas llegan vía herramientas de desarrollo (`@nestjs/cli`,
`eslint-config-next`) o como dependencias internas de paquetes de NestJS
sin que nuestro código las invoque directamente con datos de usuario.
Ninguna requiere acción inmediata; se revisan de nuevo en la próxima
actualización mayor de NestJS/Next.

---

## Qué SÍ se hizo en esta fase

- `npm audit fix` (sin `--force`) corrido — no había arreglos disponibles
  sin cambios incompatibles (todo lo pendiente requiere una versión mayor
  de `@nestjs/cli` o `next`).
- Cada hallazgo de severidad alta o crítica fue revisado individualmente
  (no solo contado) para confirmar si nuestro patrón de uso lo expone
  realmente — ver el detalle arriba.
- Recomendación priorizada y documentada (Next.js 15) en vez de dejar la
  lista completa como "pendiente" sin distinguir qué importa.

---

## Recomendación de proceso hacia adelante

Activar **Dependabot** (GitHub → Settings → Security → Dependabot alerts,
gratuito en repos privados) para que este análisis se repita
automáticamente en cada semana, no solo al cerrar una fase — así una
vulnerabilidad nueva en `next` u otra dependencia de producción se detecta
en días, no en la siguiente revisión manual.