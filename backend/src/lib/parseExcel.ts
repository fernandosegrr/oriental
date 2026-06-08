import ExcelJS from 'exceljs';
import { parseDescripcion } from './parseDescripcion';

export interface ParsedRow {
  proveedor: string;
  descripcion: string;
  medida: string | null;
  medida_norm: string | null;
  marca: string | null;
  modelo: string | null;
  specs: string | null;
  stock: number;
  precio_costo: number;
  precio_venta: number;
  origen: 'excel';
}

export interface ParseExcelResult {
  rows: ParsedRow[];
  stats: {
    total: number;
    conMedida: number;
    sinMedida: number;
    hojaUsada: string;
    hojasDisponibles: string[];
  };
}

/**
 * Coacciona el valor de una celda numérica de exceljs.
 * Las celdas pueden ser number, {result}/{formula}, o string.
 * Devuelve 0 si falta, es NaN o es negativo.
 */
function coerceNumber(value: unknown): number {
  let n: number;
  if (value === null || value === undefined) {
    return 0;
  }
  if (typeof value === 'number') {
    n = value;
  } else if (typeof value === 'object') {
    const obj = value as { result?: unknown; value?: unknown };
    const inner = obj.result ?? obj.value;
    n = typeof inner === 'number' ? inner : Number(inner);
  } else {
    n = Number(value);
  }
  if (Number.isNaN(n) || n < 0) {
    return 0;
  }
  return n;
}

/**
 * Lee un Buffer de Excel en memoria y devuelve filas parseadas + estadísticas.
 * Los datos comienzan en la FILA 3 (fila 1 = encabezados, fila 2 = vacía/multiplicadores).
 * Columnas: A = descripción, B = precio_venta (PRECIO DE LISTA), C = precio_costo (PRECIO 20% DESC.).
 * El Excel de mayoreo no incluye stock; se guarda como 0.
 */
export async function parseExcelBuffer(
  buffer: Buffer,
  proveedor: string,
): Promise<ParseExcelResult> {
  const workbook = new ExcelJS.Workbook();
  // exceljs declara su propio tipo Buffer (augmentación global) que difiere del
  // Buffer<ArrayBufferLike> de @types/node; el cast puentea ambas definiciones.
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);

  const hojasDisponibles = workbook.worksheets.map((ws) => ws.name);

  const target = proveedor.trim().toUpperCase();
  let sheet = workbook.worksheets.find((ws) => ws.name.trim().toUpperCase() === target);
  if (!sheet) {
    sheet = workbook.worksheets[0];
  }
  const hojaUsada = sheet ? sheet.name : '';

  const proveedorNorm = proveedor.trim().toUpperCase();
  const rows: ParsedRow[] = [];

  if (sheet) {
    const lastRow = sheet.rowCount;
    for (let r = 3; r <= lastRow; r++) {
      const row = sheet.getRow(r);
      const cellA = row.getCell(1);
      const rawA = cellA.text ?? String(cellA.value ?? '');
      const descRaw = (rawA || '').trim();
      if (!descRaw) {
        continue;
      }

      const precio_venta = Math.round(coerceNumber(row.getCell(2).value));
      const precio_costo = coerceNumber(row.getCell(3).value);
      const stock = 0;

      const parsed = parseDescripcion(rawA);

      rows.push({
        proveedor: proveedorNorm,
        descripcion: parsed.descripcion,
        medida: parsed.medida,
        medida_norm: parsed.medida_norm,
        marca: parsed.marca,
        modelo: parsed.modelo,
        specs: parsed.specs,
        stock,
        precio_costo,
        precio_venta,
        origen: 'excel',
      });
    }
  }

  const total = rows.length;
  const conMedida = rows.filter((row) => row.medida !== null).length;
  const sinMedida = total - conMedida;

  return {
    rows,
    stats: {
      total,
      conMedida,
      sinMedida,
      hojaUsada,
      hojasDisponibles,
    },
  };
}
