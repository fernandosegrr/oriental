import { env } from './env';
import path from 'path';
import fs from 'fs';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRouter from './routes/auth';
import usersRouter from './routes/users';
import inventoryRouter from './routes/inventory';
import { notFound, errorHandler } from './middleware/error';

const app = express();

// CSP desactivado: cuando el backend sirve el SPA en el mismo origen, la CSP
// estricta por defecto de helmet bloquea los estilos en línea de Mantine.
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/inventory', inventoryRouter);

// Modo "un solo enlace": servir el frontend compilado desde el mismo backend.
// Si FRONTEND_DIR está definido y existe, sirve los estáticos y hace fallback
// a index.html para las rutas del SPA (todo lo que no empiece con /api).
const frontendDir = env.FRONTEND_DIR;
if (frontendDir && fs.existsSync(frontendDir)) {
  app.use(express.static(frontendDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(frontendDir, 'index.html'));
  });
  console.log(`Sirviendo frontend desde ${frontendDir}`);
}

app.use(notFound);
app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`API escuchando en :${env.PORT}`);
});
