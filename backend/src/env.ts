import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL es requerida'),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET debe tener al menos 16 caracteres'),
  // Clave que usa la tool del chatbot en el header x-api-key.
  SEARCH_API_KEY: z.string().min(8, 'SEARCH_API_KEY debe tener al menos 8 caracteres'),

  // Admin sembrado en el primer arranque (seed idempotente).
  ADMIN_EMAIL: z.string().email().default('admin@oriental.local'),
  ADMIN_PASSWORD: z.string().min(6).default('admin1234'),
  ADMIN_NOMBRE: z.string().default('Administrador'),

  // Carpeta del build del frontend a servir desde el mismo backend (modo
  // "un solo enlace"). Si se define y existe, el backend sirve el SPA + /api.
  // En dev se deja vacío (Vite sirve el frontend aparte).
  FRONTEND_DIR: z.string().optional(),

  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  // Multiplicadores de precio (configurables). precio_venta = costo * UTILIDAD * FACTOR
  MARGIN_UTILIDAD: z.coerce.number().positive().default(1.2),
  MARGIN_FACTOR: z.coerce.number().positive().default(1.33333),

  // Migraciones automáticas al arrancar (usado en Docker).
  RUN_MIGRATIONS: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Configuración de entorno inválida:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
