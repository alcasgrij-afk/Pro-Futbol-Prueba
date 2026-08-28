# syntax=docker/dockerfile:1

# =============================================================================
# Etapa 1: build - instala TODAS las dependencias (incluye devDependencies)
# y compila TypeScript a JavaScript.
# =============================================================================
FROM node:20-alpine AS builder
WORKDIR /repo

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

COPY package.json package-lock.json ./
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY apps/api/package.json apps/api/package.json

RUN npm ci --omit=dev --ignore-scripts

COPY --from=builder /repo/packages/shared-types/dist packages/shared-types/dist
COPY --from=builder /repo/apps/api/dist apps/api/dist
COPY --from=builder /repo/apps/api/prisma apps/api/prisma
COPY --from=builder /repo/apps/api/node_modules/.prisma apps/api/node_modules/.prisma

EXPOSE 3001
WORKDIR /app/apps/api
CMD ["node", "dist/src/main.js"]
