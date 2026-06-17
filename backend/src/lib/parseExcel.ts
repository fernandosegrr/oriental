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
 * Error específico para cuando el Excel no coincide con ningún formato conocido.
 * Lleva `status` para que el errorHandler lo convierta en HTTP 400,
 * y `detalles` con los formatos aceptados para que el frontend los muestre.
 */
export class FormatoExcelError extends Error {
  status = 400;
  detalles: {
    formatosAceptados: { nombre: string; columnas: string[] }[];
    ejemploFila: { descripcion: string; precioLista: number; precio25Desc: number };
  };

  constructor() {
    super(
      'Formato de Excel no reconocido. ' +
        'Se esperan una o más hojas con columnas: DESCRIPCION, PRECIO DE LISTA y PRECIO CON % DESC. ' +
        'Ejemplo de fila: "P175/70R13 GOODYEAR ASSURANCE 82T BLK" | lista: 1007 | 25% desc: 755.',
    );
    this.name = 'FormatoExcelError';
    this.detalles = {
      formatosAceptados: [
        {
          nombre: 'Formato clásico (una hoja)',
          columnas: [
            'A: DESCRIPCION',
            'B: PRECIO DE LISTA (precio_venta)',
            'C: PRECIO CON % DESC. (precio_costo)',
          ],
        },
        {
          nombre: 'Formato nuevo (una o varias hojas)',
          columnas: [
            'A: DESCRIPCION',
            'B: EXISTS. (existencias, se ignora)',
            'C: C.D. (costo distribuidor, se ignora)',
            'E: PRECIO CON 25% DESC. (precio_costo)',
            'F: PRECIO DE LISTA (precio_venta)',
          ],
        },
      ],
      ejemploFila: {
        descripcion: 'P175/70R13 GOODYEAR ASSURANCE 82T BLK',
        precioLista: 1007,
        precio25Desc: 755,
      },
    };
  }
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
 * Normaliza el texto de una celda de encabezado para comparaciones:
 * pasa a mayúsculas y elimina espacios/saltos redundantes.
 */
function normHeader(value: unknown): string {
  const raw = typeof value === 'string' ? value : String(value ?? '');
  return raw
    .toUpperCase()
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

interface ColMap {
  colDescripcion: number;
  colVenta: number;
  colCosto: number;
}

/**
 * Lee la fila 1 de la hoja y detecta los índices de columna por encabezado.
 * Fallback posicional si no se encuentran encabezados reconocidos:
 *   - colDescripcion = 1 (A)
 *   - colVenta       = 2 (B)  ← layout antiguo: precio de lista en B
 *   - colCosto       = 3 (C)  ← layout antiguo: precio con desc en C
 */
function detectarColumnas(sheet: ExcelJS.Worksheet): ColMap {
  const headerRow = sheet.getRow(1);

  let colDescripcion = 1;
  let colVenta = 2;
  let colCosto = 3;

  const colCount = sheet.columnCount || 10;
  for (let c = 1; c <= colCount; c++) {
    const h = normHeader(headerRow.getCell(c).value);
    if (!h) continue;

    if (h.includes('DESCRIPCION') && c < colDescripcion + 20) {
      // Primer encabezado con DESCRIPCION gana
      if (colDescripcion === 1 && h.includes('DESCRIPCION')) {
        colDescripcion = c;
      }
    }
    if (h.includes('LISTA')) {
      colVenta = c;
    }
    // "PRECIO CON % DESC" o "PRECIO 20% DESC" — no debe ser DESCRIPCION
    if (h.includes('DESC') && !h.includes('DESCRIPCION') && h.includes('PRECIO')) {
      colCosto = c;
    }
  }

  return { colDescripcion, colVenta, colCosto };
}

/**
 * Determina si una hoja tiene encabezados o contenido reconocible como
 * inventario de llantas. Se acepta si cualquiera de:
 *   1. encabezado fila 1 contiene DESCRIPCION o LISTA
 *   2. nombre de la hoja (en mayúsculas) coincide con el proveedor
 *   3. tiene ≥1 fila con texto en col A y número > 0 en col B o C (fallback posicional)
 */
function esHojaValida(sheet: ExcelJS.Worksheet, proveedorUpper: string): boolean {
  const headerRow = sheet.getRow(1);
  const colCount = sheet.columnCount || 6;

  // 1. Encabezados reconocibles
  for (let c = 1; c <= colCount; c++) {
    const h = normHeader(headerRow.getCell(c).value);
    if (h.includes('DESCRIPCION') || h.includes('LISTA')) {
      return true;
    }
  }

  // 2. Nombre de hoja coincide con proveedor (legacy, ej. "LLANTERO OFICIAL")
  if (sheet.name.trim().toUpperCase() === proveedorUpper) {
    return true;
  }

  // 3. Fallback posicional: al menos una fila con descripción larga (>12 chars,
  //    típico de llantas: "P175/70R13 GOODYEAR...") y precio > 100.
  //    Intencionalmente estricto para no aceptar reportes ajenos (vendedores, etc.).
  for (let r = 2; r <= Math.min(sheet.rowCount, 20); r++) {
    const row = sheet.getRow(r);
    const descText = (row.getCell(1).text ?? '').trim();
    const price = coerceNumber(row.getCell(2).value) || coerceNumber(row.getCell(3).value);
    if (descText.length > 12 && price > 100) {
      return true;
    }
  }

  return false;
}

/**
 * Lee todas las filas de datos de una hoja usando el mapa de columnas detectado.
 * Comienza desde la fila 2; salta filas sin descripción (vacías o multiplicadores).
 */
function parsearHoja(
  sheet: ExcelJS.Worksheet,
  colMap: ColMap,
  proveedorNorm: string,
): ParsedRow[] {
  const { colDescripcion, colVenta, colCosto } = colMap;
  const rows: ParsedRow[] = [];

  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const cellDesc = row.getCell(colDescripcion);
    const rawDesc = (cellDesc.text ?? String(cellDesc.value ?? '')).trim();
    if (!rawDesc) continue;

    const precio_venta = coerceNumber(row.getCell(colVenta).value);
    const precio_costo = coerceNumber(row.getCell(colCosto).value);
    const stock = 0;

    const parsed = parseDescripcion(rawDesc);

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

  return rows;
}

/**
 * Lee un Buffer de Excel en memoria y devuelve filas parseadas + estadísticas.
 *
 * Soporta dos formatos de forma transparente:
 *   - Formato clásico: hoja única, col A=descripción, B=precio_venta, C=precio_costo.
 *   - Formato nuevo:  una o varias hojas, encabezados en fila 1, col F=LISTA, E=25%DESC.
 *
 * Si ninguna hoja coincide con un formato reconocido lanza FormatoExcelError (HTTP 400).
 * Las hojas válidas se fusionan en un único array de filas.
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
  const proveedorNorm = proveedor.trim().toUpperCase();

  // Filtrar hojas válidas
  const hojasValidas = workbook.worksheets.filter((ws) =>
    esHojaValida(ws, proveedorNorm),
  );

  if (hojasValidas.length === 0) {
    throw new FormatoExcelError();
  }

  // Parsear y fusionar todas las hojas válidas
  const allRows: ParsedRow[] = [];
  const hojasUsadas: string[] = [];

  for (const sheet of hojasValidas) {
    const colMap = detectarColumnas(sheet);
    const sheetRows = parsearHoja(sheet, colMap, proveedorNorm);
    if (sheetRows.length > 0) {
      allRows.push(...sheetRows);
      hojasUsadas.push(sheet.name.trim());
    }
  }

  if (allRows.length === 0) {
    throw new FormatoExcelError();
  }

  const total = allRows.length;
  const conMedida = allRows.filter((row) => row.medida !== null).length;
  const sinMedida = total - conMedida;

  return {
    rows: allRows,
    stats: {
      total,
      conMedida,
      sinMedida,
      hojaUsada: hojasUsadas.join(', '),
      hojasDisponibles,
    },
  };
}
