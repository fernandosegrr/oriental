# syntax=docker/dockerfile:1
#
# Imagen ÚNICA (un solo enlace): el backend Express compila y sirve el SPA de
# React además de la API en el mismo puerto. Ideal para EasyPanel cuando solo
# tienes una app disponible. Build: `docker build -t oriental .`

# ── Stage 1: build del frontend ───────────────────────────────────────────────
FROM node:22-bookworm-slim AS frontend
WORKDIR /fe
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ── Stage 2: build del backend ────────────────────────────────────────────────
FROM node:22-bookworm-slim AS backend
WORKDIR /be
COPY backend/package*.json ./
RUN npm ci
COPY backend/tsconfig.json ./
COPY backend/src ./src
COPY backend/migrations ./migrations
COPY backend/scripts ./scripts
RUN npm run build
# tsc no copia los .sql — los dejamos junto al runner compilado.
RUN mkdir -p dist/migrations && cp migrations/*.sql dist/migrations/

# ── Stage 3: runtime ──────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
# El backend sirve el frontend desde aquí (modo un solo enlace).
ENV FRONTEND_DIR=/app/public

COPY backend/package*.json ./
RUN npm ci --omit=dev

COPY --from=backend /be/dist ./dist
COPY --from=frontend /fe/dist ./public
COPY backend/docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 3001

# El entrypoint corre migraciones + seed si RUN_MIGRATIONS=true y luego arranca.
ENTRYPOINT ["./docker-entrypoint.sh"]
