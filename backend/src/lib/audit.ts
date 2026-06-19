import { query } from '../db';

export function logEvento(
  tipo: string,
  usuarioId: number | null,
  usuarioEmail: string | null,
  detalle: Record<string, unknown> = {},
) {
  query(
    `INSERT INTO audit_logs (tipo, usuario_id, usuario_email, detalle)
     VALUES ($1, $2, $3, $4)`,
    [tipo, usuarioId ?? null, usuarioEmail ?? null, JSON.stringify(detalle)],
  ).catch(() => {});
}
