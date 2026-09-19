# syntax=docker/dockerfile:1

# =============================================================================
# Etapa 1: build - instala TODAS las dependencias (incluye devDependencies)
# y compila TypeScript a JavaScript.
# =============================================================================
FROM node:20-alpine AS builder
WORKDIR /repo

# node:*-alpine no trae libssl del sistema (solo el OpenSSL estatico interno
# de Node): sin esto, `prisma generate` no puede detectar la version y el
# motor de consultas no carga en runtime ("libssl.so.1.1: No such file").
RUN apk add --no-cache openssl

COPY package.json package-lock.json ./
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY apps/api/package.json apps/api/package.json

RUN npm ci

COPY packages/shared-types packages/shared-types
COPY apps/api apps/api

RUN npm run build -w packages/shared-types
RUN npm run -w apps/api prisma:generate
RUN npm run build -w apps/api

# =============================================================================
# Etapa 2: runtime - imagen liviana, solo dependencias de produccion y el
# codigo ya compilado. No incluye TypeScript, ts-node, jest, etc.
# =============================================================================
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache openssl

COPY package.json package-lock.json ./
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY apps/api/package.json apps/api/package.json

RUN npm ci --omit=dev --ignore-scripts

COPY --from=builder /repo/packages/shared-types/dist packages/shared-types/dist
COPY --from=builder /repo/apps/api/dist apps/api/dist
COPY --from=builder /repo/apps/api/prisma apps/api/prisma
# El cliente generado de Prisma (.prisma) queda en el node_modules RAIZ del
# workspace, no en apps/api/node_modules: npm workspaces lo hoistea ahi.
COPY --from=builder /repo/node_modules/.prisma node_modules/.prisma
# bcrypt es un addon nativo: --ignore-scripts de arriba deja el paquete sin
# compilar (bcrypt_lib.node falta) y crashea al iniciar. Se copia ya compilado
# desde builder (mismo node:20-alpine en ambas etapas, binario compatible).
COPY --from=builder /repo/node_modules/bcrypt node_modules/bcrypt

EXPOSE 3001
WORKDIR /app/apps/api
# rootDir=src en tsconfig.build.json aplana el output: no hay dist/src/, main.js
# queda directo en dist/.
CMD ["node", "dist/main.js"]
