import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { query, withTransaction } from '../db';
import { asyncHandler } from '../middleware/error';
import { requireAuth } from '../middleware/auth';
import { requireApiKey } from '../middleware/apiKey';
import { calcPrecioVenta } from '../lib/price';
import { parseDescripcion, normalizeMedida } from '../lib/parseDescripcion';
import { parseExcelBuffer } from '../lib/parseExcel';
import { logEvento } from '../lib/audit';

const router = Router();

const PROVEEDORES = ['LLANTERO_OFICIAL'] as const;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const isXlsx =
      file.originalname.toLowerCase().endsWith('.xlsx') ||
      file.mimetype ===
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    if (isXlsx) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  },
});

interface ProductoRow {
  id: number;
  proveedor: string;
  descripcion: string;
  medida: string | null;
  medida_norm: string | null;
  marca: string | null;
  modelo: string | null;
  specs: string | null;
  stock: number;
  precio_costo: string | number;
  precio_venta: number;
  origen: string;
  activo: boolean;
  created_at: Date;
  updated_at: Date;
  [key: string]: unknown;
}

function serialize(row: ProductoRow) {
  return { ...row, precio_costo: Number(row.precio_costo) };
}

// ---------- POST /upload ----------
const UploadBodySchema = z.object({
  proveedor: z.enum(PROVEEDORES),
});

const INSERT_COLUMNS = [
  'proveedor',
  'descripcion',
  'medida',
  'medida_norm',
  'marca',
  'modelo',
  'specs',
  'stock',
  'precio_costo',
  'precio_venta',
  'origen',
] as const;

router.post(
  '/upload',
  requireAuth,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const { proveedor } = UploadBodySchema.parse(req.body);

    if (!req.file) {
      res.status(400).json({ error: 'Archivo requerido (.xlsx)' });
      return;
    }

    const result = await parseExcelBuffer(req.file.buffer, proveedor);

    if (req.query.dryRun === 'true') {
      res.json({ stats: result.stats, sample: result.rows.slice(0, 20) });
      return;
    }

    await withTransaction(async (client) => {
      await client.query('DELETE FROM productos WHERE proveedor = $1', [proveedor]);

      const colCount = INSERT_COLUMNS.length;
      const batchSize = 500;
      for (let offset = 0; offset < result.rows.length; offset += batchSize) {
        const batch = result.rows.slice(offset, offset + batchSize);
        const placeholders: string[] = [];
        const params: unknown[] = [];
        batch.forEach((row, idx) => {
          const base = idx * colCount;
          const ph = INSERT_COLUMNS.map((_, c) => `$${base + c + 1}`);
          placeholders.push(`(${ph.join(', ')})`);
          params.push(
            row.proveedor,
            row.descripcion,
            row.medida,
            row.medida_norm,
            row.marca,
            row.modelo,
            row.specs,
            row.stock,
            row.precio_costo,
            row.precio_venta,
            row.origen,
          );
        });
        await client.query(
          `INSERT INTO productos (${INSERT_COLUMNS.join(', ')}) VALUES ${placeholders.join(', ')}`,
          params,
        );
      }
    });

    logEvento('excel_carga', req.user!.id, req.user!.email, {
      proveedor,
      total: result.stats.total,
      con_medida: result.stats.conMedida,
      sin_medida: result.stats.sinMedida,
      hoja: result.stats.hojaUsada,
    });

    res.json({ stats: result.stats });
  }),
);

// ---------- GET / (listado con filtros) ----------
const ListQuerySchema = z.object({
  medida: z.string().optional(),
  marca: z.string().optional(),
  proveedor: z.enum(PROVEEDORES).optional(),
  conStock: z.string().optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { medida, marca, proveedor, conStock, q, page, pageSize } = ListQuerySchema.parse(
      req.query,
    );

    const conditions: string[] = ['activo = true'];
    const params: unknown[] = [];
    let i = 1;

    if (medida) {
      const norm = normalizeMedida(medida);
      const dig = norm.replace(/[^0-9]/g, '');
      // Coincidencia tolerante: exacta, por prefijo, y por solo-dígitos
      // (para que "175 70 13", "175/70/13" o sin la R encuentren igual).
      const ors = [`medida_norm = $${i}`, `medida_norm LIKE $${i + 1}`];
      params.push(norm, norm + '%');
      i += 2;
      if (dig.length >= 5) {
        ors.push(`regexp_replace(medida_norm, '[^0-9]', '', 'g') = $${i}`);
        params.push(dig);
        i += 1;
      }
      // 4.° fallback: flotación con cero decimal superfluo (27X8.5R14 ↔ 27X8.50R14).
      // Aplica solo cuando la medida normalizada contiene X y punto (formato flotación).
      if (norm.includes('X') && norm.includes('.')) {
        const normFloat = norm.replace(/(X\d+\.\d*[1-9])0+/g, '$1');
        ors.push(
          `regexp_replace(medida_norm, '(X\\d+\\.\\d*[1-9])0+', '\\1', 'g') = $${i}`,
        );
        params.push(normFloat);
        i += 1;
      }
      conditions.push(`(${ors.join(' OR ')})`);
    }
    if (marca) {
      conditions.push(`marca ILIKE '%' || $${i} || '%'`);
      params.push(marca);
      i += 1;
    }
    if (proveedor) {
      conditions.push(`proveedor = $${i}`);
      params.push(proveedor);
      i += 1;
    }
    if (conStock === 'true') {
      conditions.push('stock > 0');
    }
    if (q) {
      conditions.push(`descripcion ILIKE '%' || $${i} || '%'`);
      params.push(q);
      i += 1;
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*)::int AS count FROM productos ${where}`,
      params,
    );
    const total = Number(countResult.rows[0].count);

    const limitPh = i;
    const offsetPh = i + 1;
    const listParams = [...params, pageSize, (page - 1) * pageSize];
    const itemsResult = await query<ProductoRow>(
      `SELECT * FROM productos ${where} ORDER BY id LIMIT $${limitPh} OFFSET $${offsetPh}`,
      listParams,
    );

    res.json({
      items: itemsResult.rows.map(serialize),
      total,
      page,
      pageSize,
    });
  }),
);

// ---------- POST / (alta manual) ----------
const CreateSchema = z
  .object({
    proveedor: z.enum(PROVEEDORES),
    stock: z.number().int().min(0),
    precio_costo: z.number().min(0),
    descripcion: z.string().min(1).optional(),
    medida: z.string().optional(),
    marca: z.string().optional(),
    modelo: z.string().optional(),
    specs: z.string().optional(),
  })
  .refine(
    (d) =>
      (d.descripcion && d.descripcion.length > 0) ||
      Boolean(d.medida || d.marca || d.modelo || d.specs),
    { message: 'Se requiere descripcion o al menos medida/marca/modelo/specs' },
  );

router.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = CreateSchema.parse(req.body);

    let descripcion: string;
    let medida: string | null;
    let medida_norm: string | null;
    let marca: string | null;
    let modelo: string | null;
    let specs: string | null;

    if (body.descripcion) {
      const p = parseDescripcion(body.descripcion);
      descripcion = body.descripcion;
      medida = p.medida;
      medida_norm = p.medida_norm;
      marca = p.marca;
      modelo = p.modelo;
      specs = p.specs;
    } else {
      medida = body.medida ?? null;
      marca = body.marca ?? null;
      modelo = body.modelo ?? null;
      specs = body.specs ?? null;
      descripcion = [medida, marca, modelo, specs].filter(Boolean).join(' ');
      medida_norm = medida ? normalizeMedida(medida) : null;
    }

    const precio_venta = calcPrecioVenta(body.precio_costo);

    const result = await query<ProductoRow>(
      `INSERT INTO productos
         (proveedor, descripcion, medida, medida_norm, marca, modelo, specs, stock, precio_costo, precio_venta, origen)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'manual')
       RETURNING *`,
      [
        body.proveedor,
        descripcion,
        medida,
        medida_norm,
        marca,
        modelo,
        specs,
        body.stock,
        body.precio_costo,
        precio_venta,
      ],
    );

    res.status(201).json({ producto: serialize(result.rows[0]) });
  }),
);

// ---------- PUT /:id ----------
const UpdateSchema = z.object({
  proveedor: z.enum(PROVEEDORES).optional(),
  descripcion: z.string().optional(),
  medida: z.string().optional(),
  marca: z.string().optional(),
  modelo: z.string().optional(),
  specs: z.string().optional(),
  stock: z.number().int().min(0).optional(),
  precio_costo: z.number().min(0).optional(),
});

router.put(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = UpdateSchema.parse(req.body);

    const sets: string[] = [];
    const params: unknown[] = [];
    let i = 1;

    const pushSet = (col: string, val: unknown) => {
      sets.push(`${col} = $${i++}`);
      params.push(val);
    };

    if (body.proveedor !== undefined) pushSet('proveedor', body.proveedor);
    if (body.descripcion !== undefined) pushSet('descripcion', body.descripcion);
    if (body.medida !== undefined) {
      pushSet('medida', body.medida);
      pushSet('medida_norm', body.medida ? normalizeMedida(body.medida) : null);
    }
    if (body.marca !== undefined) pushSet('marca', body.marca);
    if (body.modelo !== undefined) pushSet('modelo', body.modelo);
    if (body.specs !== undefined) pushSet('specs', body.specs);
    if (body.stock !== undefined) pushSet('stock', body.stock);
    if (body.precio_costo !== undefined) {
      pushSet('precio_costo', body.precio_costo);
      pushSet('precio_venta', calcPrecioVenta(body.precio_costo));
    }

    if (sets.length === 0) {
      res.status(400).json({ error: 'Sin campos para actualizar' });
      return;
    }

    params.push(id);
    const result = await query<ProductoRow>(
      `UPDATE productos SET ${sets.join(', ')}, updated_at = now() WHERE id = $${i} RETURNING *`,
      params,
    );

    const row = result.rows[0];
    if (!row) {
      res.status(404).json({ error: 'No encontrado' });
      return;
    }
    res.json({ producto: serialize(row) });
  }),
);

// ---------- DELETE /:id ----------
router.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    await query('UPDATE productos SET activo = false, updated_at = now() WHERE id = $1', [id]);
    res.json({ ok: true });
  }),
);

// ---------- GET /audit-logs (admin, actividad del sistema) ----------
const AuditLogsQuerySchema = z.object({
  tipo: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

router.get(
  '/audit-logs',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { tipo, from, to, page, pageSize } = AuditLogsQuerySchema.parse(req.query);

    const conditions: string[] = [];
    const params: unknown[] = [];
    let i = 1;

    if (tipo) {
      conditions.push(`tipo = $${i++}`);
      params.push(tipo);
    }
    if (from) {
      conditions.push(`evento_at >= $${i++}`);
      params.push(from);
    }
    if (to) {
      conditions.push(`evento_at <= $${i++}`);
      params.push(to);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*)::int AS count FROM audit_logs ${where}`,
      params,
    );
    const total = Number(countResult.rows[0].count);

    const limitPh = i;
    const offsetPh = i + 1;
    const itemsResult = await query(
      `SELECT id, evento_at, tipo, usuario_id, usuario_email, detalle
       FROM audit_logs ${where}
       ORDER BY evento_at DESC
       LIMIT $${limitPh} OFFSET $${offsetPh}`,
      [...params, pageSize, (page - 1) * pageSize],
    );

    res.json({ items: itemsResult.rows, total, page, pageSize });
  }),
);

// ---------- GET /search (API key, para el chatbot) ----------
// Busca en AMBOS proveedores sin distinguirlos en la respuesta.
// El bot recibe el inventario unificado de la tienda.
const SearchQuerySchema = z.object({
  medida: z.string().min(1),
  marca: z.string().optional(),
  // q: búsqueda libre en descripción; se usa como último recurso cuando
  // ninguna estrategia por medida encuentra resultados.
  q: z.string().optional(),
});

interface SearchRow {
  marca: string | null;
  modelo: string | null;
  precio_venta: number;
  precio_costo: number;
  [key: string]: unknown;
}

// ---------- GET /search-logs (admin, auditoría del bot) ----------
const SearchLogsQuerySchema = z.object({
  medida: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

router.get(
  '/search-logs',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { medida, from, to, page, pageSize } = SearchLogsQuerySchema.parse(req.query);

    const conditions: string[] = [];
    const params: unknown[] = [];
    let i = 1;

    if (medida) {
      const norm = normalizeMedida(medida);
      conditions.push(`medida_norm ILIKE '%' || $${i++} || '%'`);
      params.push(norm);
    }
    if (from) {
      conditions.push(`consultado_at >= $${i++}`);
      params.push(from);
    }
    if (to) {
      conditions.push(`consultado_at <= $${i++}`);
      params.push(to);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*)::int AS count FROM bot_search_logs ${where}`,
      params,
    );
    const total = Number(countResult.rows[0].count);

    const limitPh = i;
    const offsetPh = i + 1;
    const itemsResult = await query(
      `SELECT id, consultado_at, medida, medida_norm, marca, q, estrategia,
              total_resultados, opciones
       FROM bot_search_logs ${where}
       ORDER BY consultado_at DESC
       LIMIT $${limitPh} OFFSET $${offsetPh}`,
      [...params, pageSize, (page - 1) * pageSize],
    );

    res.json({ items: itemsResult.rows, total, page, pageSize });
  }),
);

router.get(
  '/search',
  requireApiKey,
  asyncHandler(async (req, res) => {
    const { medida, marca, q } = SearchQuerySchema.parse(req.query);
    const norm = normalizeMedida(medida);

    const buildQuery = (medidaClause: string, startIdx: number) => {
      const conditions = ['activo = true', medidaClause];
      const params: unknown[] = [];
      let i = startIdx;
      if (marca) {
        conditions.push(`marca ILIKE '%' || $${i++} || '%'`);
        params.push(marca);
      }
      return {
        text: `SELECT marca, modelo, precio_venta, precio_costo FROM productos
               WHERE ${conditions.join(' AND ')} ORDER BY precio_venta ASC`,
        params,
      };
    };

    let estrategia = 'sin_resultado';

    // Intento exacto.
    const exact = buildQuery('medida_norm = $1', 2);
    let result = await query<SearchRow>(exact.text, [norm, ...exact.params]);
    if (result.rows.length > 0) estrategia = 'exacta';

    // Fallback por prefijo.
    if (result.rows.length === 0) {
      const fuzzy = buildQuery('medida_norm LIKE $1', 2);
      result = await query<SearchRow>(fuzzy.text, [norm + '%', ...fuzzy.params]);
      if (result.rows.length > 0) estrategia = 'prefijo';
    }

    // Fallback por solo-dígitos (ignora R/ZR, barras, espacios).
    if (result.rows.length === 0) {
      const dig = norm.replace(/[^0-9]/g, '');
      if (dig.length >= 5) {
        const byDigits = buildQuery(
          `regexp_replace(medida_norm, '[^0-9]', '', 'g') = $1`,
          2,
        );
        result = await query<SearchRow>(byDigits.text, [dig, ...byDigits.params]);
        if (result.rows.length > 0) estrategia = 'digitos';
      }
    }

    // Fallback por flotación con cero decimal superfluo (27X8.5R14 ↔ 27X8.50R14).
    // Cubre datos cargados antes de la migración 005.
    if (result.rows.length === 0 && norm.includes('X') && norm.includes('.')) {
      const normFloat = norm.replace(/(X\d+\.\d*[1-9])0+/g, '$1');
      const byFloat = buildQuery(
        `regexp_replace(medida_norm, '(X\\d+\\.\\d*[1-9])0+', '\\1', 'g') = $1`,
        2,
      );
      result = await query<SearchRow>(byFloat.text, [normFloat, ...byFloat.params]);
      if (result.rows.length > 0) estrategia = 'flotacion';
    }

    // Último recurso: búsqueda libre en la descripción completa (parámetro q).
    // Útil cuando el bot conoce el modelo popular pero no la medida exacta.
    if (result.rows.length === 0 && q) {
      let qi = 1;
      const qConds = ['activo = true', `descripcion ILIKE '%' || $${qi++} || '%'`];
      const qParams: unknown[] = [q];
      if (marca) {
        qConds.push(`marca ILIKE '%' || $${qi++} || '%'`);
        qParams.push(marca);
      }
      const textResult = await query<SearchRow>(
        `SELECT marca, modelo, precio_venta, precio_costo FROM productos
         WHERE ${qConds.join(' AND ')} ORDER BY precio_venta ASC`,
        qParams,
      );
      result = textResult;
      if (result.rows.length > 0) estrategia = 'texto_libre';
    }

    const opciones = result.rows.map((r) => ({
      marca: r.marca,
      modelo: r.modelo,
      precio_lista: Number(r.precio_venta),
      precio_descuento: Number(r.precio_costo),
    }));

    // Log fire-and-forget: nunca retrasa ni rompe la respuesta al bot.
    query(
      `INSERT INTO bot_search_logs
         (medida, medida_norm, marca, q, estrategia, total_resultados, opciones)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [medida, norm, marca ?? null, q ?? null, estrategia, opciones.length, JSON.stringify(opciones)],
    ).catch(() => {});

    res.json({
      medida,
      encontradas: opciones.length > 0,
      opciones,
    });
  }),
);

export default router;
