import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../env';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: number; email: string; nombre: string; rol: string };
    }
  }
}

interface JwtPayload {
  id: number;
  email: string;
  nombre: string;
  rol: string;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.token as string | undefined;
  if (!token) {
    res.status(401).json({ error: 'No autenticado' });
    return;
  }
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.user = {
      id: payload.id,
      email: payload.email,
      nombre: payload.nombre,
      rol: payload.rol,
    };
    next();
  } catch {
    res.status(401).json({ error: 'No autenticado' });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.rol !== 'admin') {
    res.status(403).json({ error: 'Requiere rol admin' });
    return;
  }
  next();
}
