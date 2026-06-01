import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../env';
import { asyncHandler } from '../middleware/error';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Limita el uso del asistente (protege la cuota de OpenAI).
const limiter = rateLimit({ windowMs: 60 * 1000, max: 30 });

const BodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(2000),
      }),
    )
    .min(1)
    .max(20),
});

const SYSTEM_PROMPT = `Eres el asistente de ayuda del panel de inventario de "Llantas Oriental Irapuato".
Respondes en español, de forma breve, clara y amable, SOLO sobre cómo usar este sistema.
Si preguntan algo no relacionado, dilo con cortesía y reorienta hacia el uso del sistema.

Qué hace el sistema:
- Cargar Excel: sección "Cargar Excel". Se elige el proveedor (LEON o DILLAMA; son distribuidores, no sucursales) y se arrastra el archivo .xlsx. Muestra una vista previa con cuántas filas se importarán; al confirmar, REEMPLAZA todo el inventario de ese proveedor (no se mezcla con lo anterior). Hay una sola tienda.
- Agregar producto: sección "Agregar producto". Se puede pegar la descripción completa (el sistema separa medida, marca, modelo y specs) o llenar los campos uno por uno. El precio de venta se calcula automáticamente.
- Editar / eliminar: en "Inventario", cada fila (o tarjeta en móvil) tiene botones de editar y eliminar. Eliminar es un borrado lógico (se oculta, no se borra de la base).
- Buscar / filtrar: por medida (acepta cualquier formato: 175/70R13, 17570R13 o 175 70 13), marca (coincidencia parcial), proveedor (LEON o DILLAMA), "solo con stock" o búsqueda libre de texto.
- Precios: precio de venta = costo × 1.2 × 1.33333, redondeado a entero. Solo se captura el costo.
- Proveedores: LEON y DILLAMA son los distribuidores cuyo inventario alimenta el catálogo. La carga de Excel reemplaza únicamente el proveedor elegido.
- Usuarios: solo el rol admin administra usuarios (crear admin/operador, editar, desactivar). Para cambiar tu contraseña, edita tu propio usuario.
- Chatbot de WhatsApp: consulta el inventario unificado de la tienda por el endpoint /api/inventory/search (con API key) y obtiene marca, modelo, precio de venta y stock de llantas disponibles (sin distinción de proveedor).

No inventes funciones que no existan. Si no sabes algo, dilo.`;

router.post(
  '/',
  requireAuth,
  limiter,
  asyncHandler(async (req, res) => {
    if (!env.OPENAI_API_KEY) {
      res.status(503).json({ error: 'El asistente no está configurado (falta OPENAI_API_KEY).' });
      return;
    }

    const { messages } = BodySchema.parse(req.body);

    // Solo se mandan los últimos turnos para acotar tokens.
    const recent = messages.slice(-10);

    let openaiRes: Response;
    try {
      openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: env.OPENAI_MODEL,
          temperature: 0.3,
          max_tokens: 400,
          messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...recent],
        }),
      });
    } catch {
      res.status(502).json({ error: 'No se pudo contactar al asistente.' });
      return;
    }

    if (!openaiRes.ok) {
      console.error('OpenAI error', openaiRes.status, await openaiRes.text());
      res.status(502).json({ error: 'El asistente no está disponible en este momento.' });
      return;
    }

    const data = (await openaiRes.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      res.status(502).json({ error: 'El asistente no devolvió respuesta.' });
      return;
    }

    res.json({ reply });
  }),
);

export default router;
