import type { Request, Response, NextFunction } from 'express';
import { env } from '../env';

/**
 * Comparación de longitud + tiempo (aprox.) constante para evitar fugas por timing.
 */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  const provided = req.header('x-api-key');
  if (!provided || !safeEqual(provided, env.SEARCH_API_KEY)) {
    res.status(401).json({ error: 'API key inválida' });
    return;
  }
  next();
}
