import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query } from '../db';
import { asyncHandler } from '../middleware/error';
import { requireAuth, requireAdmin } from '../middleware/auth';

const router = Router();

router.use(requireAuth, requireAdmin);

interface UsuarioRow {
  id: number;
  email: string;
  nombre: string;
  rol: string;
  activo: boolean;
  created_at: Date;
  [key: string]: unknown;
}

const CreateSchema = z.object({
  email: z.string().email(),
  nombre: z.string().min(1),
  password: z.string().min(6),
  rol: z.enum(['admin', 'operador']),
});

const UpdateSchema = z.object({
  nombre: z.string().min(1).optional(),
  rol: z.enum(['admin', 'operador']).optional(),
  activo: z.boolean().optional(),
  password: z.string().min(6).optional(),
});

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const result = await query<UsuarioRow>(
      'SELECT id, email, nombre, rol, activo, created_at FROM usuarios ORDER BY id',
    );
    res.json({ users: result.rows });
  }),
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { email, nombre, password, rol } = CreateSchema.parse(req.body);
    const password_hash = await bcrypt.hash(password, 12);

    try {
      const result = await query<UsuarioRow>(
        `INSERT INTO usuarios (email, nombre, password_hash, rol)
         VALUES ($1, $2, $3, $4)
         RETURNING id, email, nombre, rol, activo`,
        [email, nombre, password_hash, rol],
      );
      const u = result.rows[0];
      res.status(201).json({
        user: { id: u.id, email: u.email, nombre: u.nombre, rol: u.rol, activo: u.activo },
      });
    } catch (err) {
      if ((err as { code?: string }).code === '23505') {
        res.status(409).json({ error: 'Email ya existe' });
        return;
      }
      throw err;
    }
  }),
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = UpdateSchema.parse(req.body);

    const sets: string[] = [];
    const params: unknown[] = [];
    let i = 1;

    if (body.nombre !== undefined) {
      sets.push(`nombre = $${i++}`);
      params.push(body.nombre);
    }
    if (body.rol !== undefined) {
      sets.push(`rol = $${i++}`);
      params.push(body.rol);
    }
    if (body.activo !== undefined) {
      sets.push(`activo = $${i++}`);
      params.push(body.activo);
    }
    if (body.password !== undefined) {
      const password_hash = await bcrypt.hash(body.password, 12);
      sets.push(`password_hash = $${i++}`);
      params.push(password_hash);
    }

    if (sets.length === 0) {
      res.status(400).json({ error: 'Sin campos para actualizar' });
      return;
    }

    params.push(id);
    const result = await query<UsuarioRow>(
      `UPDATE usuarios SET ${sets.join(', ')}, updated_at = now()
       WHERE id = $${i}
       RETURNING id, email, nombre, rol, activo`,
      params,
    );

    const u = result.rows[0];
    if (!u) {
      res.status(404).json({ error: 'No encontrado' });
      return;
    }
    res.json({ user: u });
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    await query('UPDATE usuarios SET activo = false, updated_at = now() WHERE id = $1', [id]);
    res.json({ ok: true });
  }),
);

export default router;
