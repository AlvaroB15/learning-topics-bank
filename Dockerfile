# ============================================================
#  Dockerfile — Banking API (Koa.js + TypeScript)
#  Multi-stage build: build → producción
#  Variables de entorno: pasar con --env-file .env al correr
# ============================================================

# ── Stage 1: Build ──────────────────────────────────────────
FROM node:24-alpine AS builder
# Agrega esto después del FROM para actualizar el OS
RUN apk update && apk upgrade --no-cache

WORKDIR /app

RUN npm install -g pnpm

# Copia dependencias primero (aprovecha layer cache de Docker)
COPY package.json pnpm-lock.yaml ./
COPY pnpm-workspace.yaml* ./

RUN pnpm install --frozen-lockfile

COPY tsconfig.json ./
COPY src/ ./src/

RUN pnpm build

# ── Stage 2: Producción ─────────────────────────────────────
FROM node:24-alpine AS production
RUN apk update && apk upgrade --no-cache
WORKDIR /app

# Usuario no-root por seguridad
RUN addgroup -S appgroup && adduser -S appuser -G appgroup && npm install -g pnpm

COPY package.json pnpm-lock.yaml ./
COPY pnpm-workspace.yaml* ./

# Solo dependencias de producción
RUN pnpm install --frozen-lockfile --prod

# Copia el build del stage anterior
COPY --from=builder /app/dist ./dist

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

# Las variables de entorno se pasan al correr el container:
# docker run --env-file .env -p 3000:3000 banking-api:latest
CMD ["node", "dist/server.js"]
