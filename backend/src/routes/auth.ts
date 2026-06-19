import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../env';
import { query } from '../db';
import { asyncHandler } from '../middleware/error';
import { requireAuth } from '../middleware/auth';
import { logEvento } from '../lib/audit';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

interface UsuarioRow {
  id: number;
  email: string;
  nombre: string;
  password_hash: string;
  rol: string;
  activo: boolean;
  [key: string]: unknown;
}

router.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = LoginSchema.parse(req.body);

    const result = await query<UsuarioRow>(
      'SELECT * FROM usuarios WHERE email = $1 AND activo = true',
      [email],
    );
    const user = result.rows[0];

    if (!user) {
      logEvento('login_fallo', null, email);
      res.status(401).json({ error: 'Credenciales inválidas' });
      return;
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      logEvento('login_fallo', null, email);
      res.status(401).json({ error: 'Credenciales inválidas' });
      return;
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, nombre: user.nombre, rol: user.rol },
      env.JWT_SECRET,
      { expiresIn: '7d' },
    );

    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.COOKIE_SECURE,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    logEvento('login_ok', user.id, user.email);

    res.json({
      user: { id: user.id, email: user.email, nombre: user.nombre, rol: user.rol },
    });
  }),
);

router.post('/logout', (_req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

router.get(
  '/me',
  requireAuth,
  (req, res) => {
    res.json({ user: req.user });
  },
);

export default router;
