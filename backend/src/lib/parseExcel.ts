import ExcelJS from 'exceljs';
import { parseDescripcion } from './parseDescripcion';
import { FACTOR_DESCUENTO } from './price';

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
 * Tolerancia (en proporción) al comprobar que precio con descuento / precio de lista
 * ≈ FACTOR_DESCUENTO (0.75). Cubre el redondeo a pesos enteros de los Excel históricos
 * (ej. 755 / 1007 = 0.7497) pero rechaza promociones distintas al 25 %.
 */
const TOLERANCIA_DESCUENTO = 0.03;

/** Cuántas filas de ejemplo se muestran por cada tipo de problema. */
const EJEMPLOS_POR_PROBLEMA = 3;

/** Hasta qué fila se busca un encabezado desplazado para dar una pista útil. */
const FILAS_BUSCAR_ENCABEZADO = 15;

/**
 * Error para cuando el Excel NO cumple el formato esperado. La carga se rechaza
 * completa: nunca se importa un archivo a medias ni "adivinando" columnas.
 * Lleva `status` para que el errorHandler lo convierta en HTTP 400, y `detalles`
 * con los formatos aceptados y la lista concreta de problemas para el frontend.
 */
export class FormatoExcelError extends Error {
  status = 400;
  detalles: {
    formatosAceptados: { nombre: string; columnas: string[] }[];
    ejemploFila: { descripcion: string; precioLista: number; precio25Desc: number };
    problemas: string[];
  };

  constructor(resumen: string, problemas: string[] = []) {
    super(
      `Archivo rechazado. ${resumen} ` +
        'No se cargó nada y el inventario actual sigue igual. ' +
        'Corrige el Excel y vuelve a subirlo.',
    );
    this.name = 'FormatoExcelError';
    this.detalles = {
      formatosAceptados: [
        {
          nombre: 'Formato estándar (una hoja con encabezados en la fila 1)',
          columnas: [
            'Fila 1 = encabezados. Los productos empiezan en la fila 2 (sin títulos ni filas vacías arriba)',
            'DESCRIPCION — la medida va primero: "P175/70R13 GOODYEAR ASSURANCE 82T BLK"',
            'PRECIO DE LISTA — número en pesos (precio_venta)',
            'PRECIO CON 25% DESC. — número, el 75% de la lista (precio_costo)',
            'Sin filas de títulos ni separadores (R13, R14…) y sin filas sin precio',
          ],
        },
        {
          nombre: 'Formato COSTO (alternativo)',
          columnas: [
            'DESCRIPCION',
            'COSTO VENTA CON 25% DESC. (precio_costo)',
            'COSTO DIRECTO (precio_venta)',
          ],
        },
      ],
      ejemploFila: {
        descripcion: 'P175/70R13 GOODYEAR ASSURANCE 82T BLK',
        precioLista: 1007,
        precio25Desc: 755,
      },
      problemas,
    };
  }
}

/**
 * Lee el valor de una celda de precio. Devuelve `null` si falta, no es numérica
 * (texto, error de fórmula, etc.) o no es finita. Las celdas de exceljs pueden ser
 * number, {result} de una fórmula, o string.
 */
function leerPrecio(value: unknown): number | null {
  let n: number;
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    n = value;
  } else if (typeof value === 'string') {
    const t = value.trim();
    if (!t) return null;
    n = Number(t);
  } else if (typeof value === 'object') {
    const inner = (value as { result?: unknown }).result;
    if (inner === null || inner === undefined) return null;
    n = typeof inner === 'number' ? inner : Number(inner);
  } else {
    return null;
  }
  return Number.isFinite(n) ? n : null;
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

type FormatoColumnas = 'ESTANDAR' | 'COSTO';

interface ColMap {
  colDescripcion: number;
  colVenta: number;
  colCosto: number;
  formato: FormatoColumnas;
}

interface AnalisisEncabezados {
  /** Cuántos encabezados de la fila 1 se reconocieron. 0 = la hoja no parece de inventario. */
  reconocidos: number;
  /** Problemas de encabezados (vacío si colMap es válido). */
  problemas: string[];
  colMap: ColMap | null;
}

/**
 * Lee la fila 1 de la hoja y ubica cada columna POR SU ENCABEZADO. No hay
 * adivinanza posicional: si falta, sobra o es ambigua una columna requerida,
 * se reportan los problemas y la hoja se rechaza.
 *
 * Formato estándar:  DESCRIPCION + PRECIO DE LISTA + PRECIO CON 25% DESC.
 * Formato COSTO:     DESCRIPCION + COSTO VENTA CON 25% DESC. + COSTO DIRECTO
 *   El API expone precio_costo como precio_descuento (lo que ve el cliente), así
 *   que en el formato COSTO el mapeo va invertido respecto al nombre:
 *     "COSTO VENTA CON 25% DESC." → precio_costo
 *     "COSTO DIRECTO"             → precio_venta
 */
function analizarEncabezados(sheet: ExcelJS.Worksheet): AnalisisEncabezados {
  const headerRow = sheet.getRow(1);
  const colCount = Math.max(sheet.columnCount, 1);

  const desc: number[] = [];
  const lista: number[] = [];
  const precioDesc: number[] = [];
  const costoVenta: number[] = [];
  const costoDirecto: number[] = [];
  const noReconocidos: string[] = [];

  for (let c = 1; c <= colCount; c++) {
    const texto = headerRow.getCell(c).text ?? '';
    const h = normHeader(texto);
    if (!h) continue;

    if (h.includes('COSTO VENTA')) costoVenta.push(c);
    else if (h.includes('COSTO DIRECTO')) costoDirecto.push(c);
    else if (h.includes('DESCRIPCION')) desc.push(c);
    else if (h.includes('LISTA')) lista.push(c);
    else if (h.includes('PRECIO') && h.includes('DESC')) precioDesc.push(c);
    else noReconocidos.push(h);
  }

  const reconocidos =
    desc.length + lista.length + precioDesc.length + costoVenta.length + costoDirecto.length;
  if (reconocidos === 0) {
    return { reconocidos: 0, problemas: [], colMap: null };
  }

  const letras = (cols: number[]) => cols.map((c) => sheet.getColumn(c).letter).join(', ');
  const problemas: string[] = [];
  const exactamenteUna = (cols: number[], nombre: string) => {
    if (cols.length === 0) problemas.push(`Falta la columna «${nombre}».`);
    else if (cols.length > 1) {
      problemas.push(
        `Hay ${cols.length} columnas «${nombre}» (${letras(cols)}); debe haber una sola.`,
      );
    }
  };

  exactamenteUna(desc, 'DESCRIPCION');

  const usaCosto = costoVenta.length + costoDirecto.length > 0;
  const usaEstandar = lista.length + precioDesc.length > 0;
  let formato: FormatoColumnas = 'ESTANDAR';

  if (usaCosto && usaEstandar) {
    problemas.push(
      'Mezcla encabezados de dos formatos (PRECIO DE LISTA / PRECIO CON 25% DESC. y ' +
        'COSTO VENTA / COSTO DIRECTO). Deja solo uno.',
    );
  } else if (usaCosto) {
    formato = 'COSTO';
    exactamenteUna(costoVenta, 'COSTO VENTA CON 25% DESC.');
    exactamenteUna(costoDirecto, 'COSTO DIRECTO');
  } else {
    exactamenteUna(lista, 'PRECIO DE LISTA');
    exactamenteUna(precioDesc, 'PRECIO CON 25% DESC.');
  }

  if (problemas.length > 0) {
    if (noReconocidos.length > 0) {
      problemas.push(
        'Encabezados sin reconocer en esta hoja: ' +
          noReconocidos
            .slice(0, 8)
            .map((h) => `«${h}»`)
            .join(', ') +
          '. Si alguno es el precio de lista o el precio con descuento, renómbralo.',
      );
    }
    return { reconocidos, problemas, colMap: null };
  }

  return {
    reconocidos,
    problemas: [],
    colMap: {
      colDescripcion: desc[0],
      colVenta: formato === 'COSTO' ? costoDirecto[0] : lista[0],
      colCosto: formato === 'COSTO' ? costoVenta[0] : precioDesc[0],
      formato,
    },
  };
}

/**
 * Para una hoja sin encabezados en la fila 1, arma el mensaje con la pista más
 * útil: dónde están realmente los encabezados (título arriba) o qué dice la fila 1.
 */
function explicarHojaSinEncabezados(sheet: ExcelJS.Worksheet): string {
  const colCount = Math.max(sheet.columnCount, 1);
  const nombre = sheet.name.trim();

  let primeraCelda = '';
  const fila1 = sheet.getRow(1);
  for (let c = 1; c <= colCount && !primeraCelda; c++) {
    primeraCelda = (fila1.getCell(c).text ?? '').trim();
  }
  const dice = primeraCelda ? ` (la fila 1 dice «${primeraCelda.slice(0, 60)}»)` : ' (la fila 1 está vacía)';

  const hasta = Math.min(sheet.rowCount, FILAS_BUSCAR_ENCABEZADO);
  for (let r = 2; r <= hasta; r++) {
    const row = sheet.getRow(r);
    for (let c = 1; c <= colCount; c++) {
      const h = normHeader(row.getCell(c).text);
      if (h.includes('DESCRIPCION') || h.includes('LISTA')) {
        return (
          `Hoja «${nombre}»: los encabezados están en la fila ${r}, pero deben estar en la ` +
          `fila 1${dice}. Borra las filas de arriba (títulos o filas vacías).`
        );
      }
    }
  }
  return (
    `Hoja «${nombre}»: no se reconocen encabezados en la fila 1${dice}. ` +
    'Se esperan DESCRIPCION, PRECIO DE LISTA y PRECIO CON 25% DESC.'
  );
}

interface ProblemaFila {
  hoja: string;
  fila: number;
  descripcion: string;
  motivo: string;
  detalle: string;
}

/**
 * Valida los dos precios de una fila. Devuelve el motivo del rechazo o null si es válida.
 * En el formato estándar además exige que el descuento sea el esperado (≈25 %), para que
 * una columna invertida o una promoción distinta nunca llegue al bot como "25% desc.".
 * En el formato COSTO solo se exige que ambos precios sean positivos: allí el precio de
 * lista sale de COSTO DIRECTO y no tiene una relación fija con el precio al cliente.
 */
function validarPrecios(
  venta: number | null,
  costo: number | null,
  formato: FormatoColumnas,
): string | null {
  const okVenta = venta !== null && venta > 0;
  const okCosto = costo !== null && costo > 0;

  if (!okVenta && !okCosto) {
    return 'sin ningún precio válido (¿título, separador o fila vacía? bórrala)';
  }
  if (!okVenta) return 'precio de lista vacío, no numérico o ≤ 0';
  if (!okCosto) return 'precio con descuento vacío, no numérico o ≤ 0';

  if (formato === 'ESTANDAR') {
    if (costo >= venta) {
      return 'el precio con descuento no es menor que el de lista (¿columnas invertidas?)';
    }
    if (Math.abs(costo / venta - FACTOR_DESCUENTO) > TOLERANCIA_DESCUENTO) {
      return 'el descuento no es ~25% (el precio con desc. debe ser ≈75% del precio de lista)';
    }
  }
  return null;
}

/**
 * Lee todas las filas de datos de una hoja usando el mapa de columnas detectado.
 * Comienza desde la fila 2; salta únicamente filas sin descripción (vacías).
 * Toda fila con descripción debe traer precios válidos: si no, se reporta como
 * problema (no se importa a medias).
 */
function parsearHoja(
  sheet: ExcelJS.Worksheet,
  colMap: ColMap,
  proveedorNorm: string,
): { rows: ParsedRow[]; problemas: ProblemaFila[] } {
  const { colDescripcion, colVenta, colCosto, formato } = colMap;
  const rows: ParsedRow[] = [];
  const problemas: ProblemaFila[] = [];

  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const cellDesc = row.getCell(colDescripcion);
    const rawDesc = (cellDesc.text ?? String(cellDesc.value ?? '')).trim();
    if (!rawDesc) continue;

    const precio_venta = leerPrecio(row.getCell(colVenta).value);
    const precio_costo = leerPrecio(row.getCell(colCosto).value);

    const motivo = validarPrecios(precio_venta, precio_costo, formato);
    if (motivo) {
      problemas.push({
        hoja: sheet.name.trim(),
        fila: r,
        descripcion: rawDesc.replace(/\s+/g, ' ').slice(0, 40),
        motivo,
        detalle: `lista=${precio_venta ?? 'vacío'}, desc.=${precio_costo ?? 'vacío'}`,
      });
      continue;
    }

    const parsed = parseDescripcion(rawDesc);

    rows.push({
      proveedor: proveedorNorm,
      descripcion: parsed.descripcion,
      medida: parsed.medida,
      medida_norm: parsed.medida_norm,
      marca: parsed.marca,
      modelo: parsed.modelo,
      specs: parsed.specs,
      stock: 0,
      precio_costo: precio_costo as number,
      precio_venta: precio_venta as number,
      origen: 'excel',
    });
  }

  return { rows, problemas };
}

/** Agrupa los problemas de fila por motivo y devuelve una línea legible por grupo. */
function resumirProblemasFila(problemas: ProblemaFila[], variasHojas: boolean): string[] {
  const grupos = new Map<string, ProblemaFila[]>();
  for (const p of problemas) {
    const lista = grupos.get(p.motivo) ?? [];
    lista.push(p);
    grupos.set(p.motivo, lista);
  }
  return [...grupos].map(([motivo, lista]) => {
    const ejemplos = lista
      .slice(0, EJEMPLOS_POR_PROBLEMA)
      .map((p) => {
        const donde = variasHojas ? `«${p.hoja}» fila ${p.fila}` : `fila ${p.fila}`;
        return `${donde} «${p.descripcion}» (${p.detalle})`;
      })
      .join('; ');
    const mas = lista.length > EJEMPLOS_POR_PROBLEMA ? `; …y ${lista.length - EJEMPLOS_POR_PROBLEMA} más` : '';
    return `${lista.length} fila(s): ${motivo}. Ej.: ${ejemplos}${mas}`;
  });
}

/**
 * Lee un Buffer de Excel en memoria y devuelve filas parseadas + estadísticas.
 *
 * Reglas (todas deben cumplirse o el archivo se rechaza COMPLETO con FormatoExcelError, HTTP 400):
 *   - Los encabezados están en la fila 1 y las columnas se ubican por su nombre
 *     (formato estándar o formato COSTO). No se adivinan columnas por posición.
 *   - Cada hoja de inventario tiene exactamente una columna por rol requerido.
 *   - Toda fila con descripción trae precio de lista y precio con descuento numéricos y > 0;
 *     en formato estándar, el descuento debe ser ≈25 %.
 * Las hojas sin ningún encabezado reconocible se ignoran (p. ej. una hoja de notas);
 * las hojas válidas se fusionan en un único array de filas.
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

  const problemasEncabezado: string[] = [];
  const problemasFila: ProblemaFila[] = [];
  const hojasSinEncabezados: string[] = [];
  const allRows: ParsedRow[] = [];
  const hojasUsadas: string[] = [];
  let hojasCandidatas = 0;

  const analisis = workbook.worksheets.map((sheet) => ({
    sheet,
    analisis: analizarEncabezados(sheet),
  }));
  const variasHojas = analisis.filter((a) => a.analisis.reconocidos > 0).length > 1;

  for (const { sheet, analisis: a } of analisis) {
    if (a.reconocidos === 0) {
      hojasSinEncabezados.push(explicarHojaSinEncabezados(sheet));
      continue;
    }
    hojasCandidatas += 1;

    if (!a.colMap) {
      for (const p of a.problemas) {
        problemasEncabezado.push(`Hoja «${sheet.name.trim()}»: ${p}`);
      }
      continue;
    }

    const res = parsearHoja(sheet, a.colMap, proveedorNorm);
    problemasFila.push(...res.problemas);
    if (res.rows.length > 0) {
      allRows.push(...res.rows);
      hojasUsadas.push(sheet.name.trim());
    } else if (res.problemas.length === 0) {
      problemasEncabezado.push(`Hoja «${sheet.name.trim()}»: no tiene filas de productos.`);
    }
  }

  if (hojasCandidatas === 0) {
    throw new FormatoExcelError(
      'Ninguna hoja tiene los encabezados esperados en la fila 1.',
      hojasSinEncabezados,
    );
  }

  if (problemasEncabezado.length > 0 || problemasFila.length > 0) {
    const problemas = [...problemasEncabezado, ...resumirProblemasFila(problemasFila, variasHojas)];
    const partes: string[] = [];
    if (problemasEncabezado.length > 0) {
      partes.push('los encabezados no coinciden con el formato');
    }
    if (problemasFila.length > 0) {
      partes.push(`${problemasFila.length} fila(s) con precios inválidos`);
    }
    throw new FormatoExcelError(
      `Se encontró esto: ${partes.join(' y ')}. Con este archivo el bot podría dar precios incorrectos.`,
      problemas,
    );
  }

  if (allRows.length === 0) {
    throw new FormatoExcelError('El archivo no tiene filas de productos.');
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
