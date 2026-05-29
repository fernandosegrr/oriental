import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodError } from 'zod';

/**
 * Envuelve un handler async para que cualquier promesa rechazada llegue a next().
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ error: 'No encontrado' });
}

interface HttpError extends Error {
  status?: number;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  console.error(err);

  if (err instanceof ZodError) {
    res.status(400).json({ error: 'Validación', detalles: err.flatten() });
    return;
  }

  const e = err as HttpError;
  if (typeof e?.status === 'number') {
    res.status(e.status).json({ error: e.message });
    return;
  }

  res.status(500).json({ error: 'Error interno' });
}
