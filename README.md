# Llantas Oriental Irapuato — Sistema de Inventario

Panel web de administración y API REST para inventario de llantas. Incluye un endpoint de búsqueda para el chatbot de WhatsApp. La base de datos PostgreSQL es **externa/remota** — no se incluye ningún servicio de BD por defecto en el despliegue de producción.

En producción todo corre como **una sola app / un solo enlace**: el backend Express sirve la API en `/api/*` y el panel de React (SPA) en el mismo puerto. Esto permite desplegarlo en plataformas como **EasyPanel** usando una única aplicación.

---

## Estructura del repositorio

```
oriental/
├── backend/          # Node 22 + Express + TypeScript → API REST + sirve el SPA
├── frontend/         # Vite + React → SPA (build estático servido por el backend)
├── Dockerfile        # Imagen ÚNICA (un solo enlace): backend + frontend juntos
├── docker-compose.yml
└── .env.example      # Plantilla de variables de entorno
```

---

## Requisitos

- **Node 20+ ó 22** (para desarrollo local)
- **Docker + Docker Compose v2** (para despliegue en VPS)
- Una instancia de **PostgreSQL 14+** accesible desde el servidor

---

## Desarrollo local

### Backend

```bash
cd backend
npm install

# Crea backend/.env basándote en el .env.example de la raíz:
#   - Ajusta DATABASE_URL a tu BD local o remota de desarrollo
#   - CORS_ORIGIN=http://localhost:5173
#   - COOKIE_SECURE=false
cp ../.env.example .env   # luego edita los valores

npm run migrate   # ejecuta las migraciones SQL
npm run seed      # crea el usuario administrador inicial
npm run dev       # inicia en http://localhost:3001
```

### Frontend

```bash
cd frontend
npm install
npm run dev       # inicia en http://localhost:5173
                  # /api se proxea automáticamente al backend en :3001
```

---

## Despliegue: una sola app (un solo enlace)

La imagen de la raíz (`Dockerfile`) compila el frontend y el backend y arranca **un solo proceso** que sirve el panel + la API + el endpoint del bot en el mismo puerto (3001 dentro del contenedor). Las migraciones y el seed corren **automáticamente** al arrancar gracias a `RUN_MIGRATIONS=true`.

### Opción A — EasyPanel (recomendado si solo tienes una app)

1. **Crea una sola App** en EasyPanel con fuente = este repositorio Git (o sube el código). Build type = **Dockerfile** (usa el `Dockerfile` de la raíz).
2. En **Environment**, define las variables (equivalente al `.env`):
   - `DATABASE_URL` = tu PostgreSQL remota
   - `JWT_SECRET` (≥16 caracteres), `SEARCH_API_KEY` (≥8; la usa el bot)
   - `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NOMBRE`
   - `RUN_MIGRATIONS=true`, `NODE_ENV=production`, `COOKIE_SECURE=true`
   - `CORS_ORIGIN` = tu dominio público (en un solo enlace CORS no interviene, pero déjalo correcto)
   - *No definas `FRONTEND_DIR`*: la imagen ya lo fija a `/app/public`.
3. En **Domains**, apunta tu dominio al **puerto 3001** del contenedor. EasyPanel gestiona el HTTPS.
4. Despliega. Una sola URL sirve el panel (`/`), la API (`/api/...`) y el endpoint del bot.

### Opción B — Docker Compose (VPS propio)

```bash
git clone <url-del-repo> oriental && cd oriental
cp .env.example .env
nano .env                      # rellena DATABASE_URL, JWT_SECRET, SEARCH_API_KEY, etc.
docker compose up --build -d   # app en http://IP_DEL_VPS (puerto 80 -> 3001)
```

Para correr migraciones/seed manualmente:

```bash
docker compose run --rm app node dist/migrations/run.js
docker compose run --rm app node dist/scripts/seed.js
```

---

## Login inicial

| Campo      | Valor                  |
|------------|------------------------|
| Email      | `admin@oriental.local` |
| Contraseña | `admin1234`            |

> **Cambia la contraseña inmediatamente** tras el primer inicio de sesión.

---

## Endpoint para el chatbot de WhatsApp

Búsqueda de inventario por medida de llanta:

```bash
curl 'https://TU_DOMINIO/api/inventory/search?medida=175/70R13' \
  -H 'x-api-key: <SEARCH_API_KEY>'
```

La medida se normaliza, así que el bot puede mandar cualquier formato y encuentra igual: `175/70R13`, `17570R13`, `175/70/13`, `175 70 13` o `175/70r13`. Parámetros opcionales: `marca` (coincidencia parcial) y `sucursal` (`LEON` o `DILLAMA`). Solo devuelve llantas activas con stock > 0, ordenadas por `precio_venta` ascendente.

Ejemplo de respuesta:

```json
{
  "medida": "175/70R13",
  "encontradas": true,
  "opciones": [
    { "sucursal": "LEON", "marca": "APLUS", "modelo": "COMFORT HP", "precio_venta": 986, "stock": 371 },
    { "sucursal": "LEON", "marca": "HANKOOK", "modelo": "H735 KINERGY ST", "precio_venta": 1595, "stock": 35 }
  ]
}
```

Si no hay resultados, `encontradas` es `false` y `opciones` es un arreglo vacío.

---

## Seguridad

- **Rota la contraseña de PostgreSQL** — si fue compartida en texto plano, cámbiala antes de usar en producción.
- **Nunca commitees el archivo `.env`** — está en `.gitignore`.
- **Usa HTTPS en el VPS**: puedes configurar [Caddy](https://caddyserver.com/) o nginx + Certbot para TLS automático.
- Activa `COOKIE_SECURE=true` en el `.env` una vez tengas HTTPS.
- Rota `JWT_SECRET` y `SEARCH_API_KEY` periódicamente.
