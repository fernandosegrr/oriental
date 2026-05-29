/**
 * Normaliza una medida de llanta para indexado/búsqueda:
 * mayúsculas y solo se conservan A-Z, 0-9 y el punto decimal.
 */
export function normalizeMedida(s: string): string {
  return (s || '').toUpperCase().replace(/[^A-Z0-9.]/g, '');
}

export interface ParsedDescripcion {
  descripcion: string;
  medida: string | null;
  medida_norm: string | null;
  marca: string | null;
  modelo: string | null;
  specs: string | null;
}

/**
 * Patrones de medida ordenados de más específico a más general.
 * El primero que haga match (anclado al inicio de la cadena tras el prefijo
 * opcional P|LT|ST) gana.
 *
 * Casos soportados:
 *   P175/70R13, 175/70R13            -> métrica con prefijo opcional
 *   225/45ZR17                       -> rating ZR dentro de la medida
 *   LT195/R15                        -> falta aspect ratio (slash seguido de letra)
 *   LT165R14                         -> sin slash
 *   LT27X8.50R14                     -> flotación, separador X, decimales
 *   7.00-14                          -> bias / numérica con guion
 *   295/80R22.5                      -> diámetro de rin con .5 (se conserva)
 */
// Prefijo opcional (P|LT|ST). Se captura aparte para descartarlo de la medida:
// el caso de referencia "P175/70R13" debe producir medida "175/70R13".
const PREFIX = '(LT|ST|P)?';
// Rating de construcción que puede aparecer antes del diámetro de rin.
const RATING = '(?:Z?R|D|B|-)';

// Cada patrón captura: grupo 1 = prefijo (descartado), grupo 2 = cuerpo (medida).
const MEDIDA_PATTERNS: RegExp[] = [
  // Flotación: 27X8.50R14 / 35X12.50R15 (ancho X seccion R rin)
  new RegExp(`^${PREFIX}(\\d{2,3}X\\d{1,2}(?:\\.\\d+)?${RATING}\\d{2}(?:\\.\\d+)?)`, 'i'),
  // Métrica completa con slash: 175/70R13, 225/45ZR17, 295/80R22.5, 35/12.50R20
  new RegExp(`^${PREFIX}(\\d{2,3}/\\d{1,2}(?:\\.\\d+)?${RATING}\\d{2}(?:\\.\\d+)?)`, 'i'),
  // Métrica sin aspect ratio: 195/R15 (slash directo al rating)
  new RegExp(`^${PREFIX}(\\d{2,3}/${RATING}\\d{2}(?:\\.\\d+)?)`, 'i'),
  // Sin slash: 165R14, 165ZR14
  new RegExp(`^${PREFIX}(\\d{2,3}(?:Z?R)\\d{2}(?:\\.\\d+)?)`, 'i'),
  // Bias / numérica con guion o R: 7.00-14, 7.50R16, 11R22.5
  new RegExp(`^${PREFIX}(\\d{1,2}(?:\\.\\d+)?(?:-|Z?R)\\d{2}(?:\\.\\d+)?)`, 'i'),
];

// Índices de carga/velocidad: 82T, 102/100R, 91Y, 75H, 100/97Q
const RE_LOAD_SPEED = /^\d{2,3}(?:\/\d{2,3})?[A-Z]$/i;
// Ply rating: 8C, 10C, 6PR, 8PR, 10PR
const RE_PLY = /^\d{1,2}(?:C|PR)$/i;
// Flags textuales reconocidos como specs.
const SPEC_FLAGS = new Set([
  'XL',
  'OE',
  'BLK',
  'OWL',
  'RWL',
  'WL',
  'BSW',
  'S/C',
  'M+S',
  'LT',
]);

function isSpecToken(tok: string): boolean {
  const t = tok.toUpperCase();
  if (SPEC_FLAGS.has(t)) return true;
  if (RE_LOAD_SPEED.test(t)) return true;
  if (RE_PLY.test(t)) return true;
  return false;
}

/**
 * Parsea una descripción concatenada del Excel:
 *   [PREFIX][MEDIDA] [MARCA] [MODELO...] [SPECS]
 * Nunca lanza excepción.
 */
export function parseDescripcion(raw: string): ParsedDescripcion {
  const descripcion = (raw || '').replace(/\s+/g, ' ').trim();

  if (!descripcion) {
    return {
      descripcion,
      medida: null,
      medida_norm: null,
      marca: null,
      modelo: null,
      specs: null,
    };
  }

  // El primer token contiene la medida (posiblemente con prefijo pegado).
  const tokens = descripcion.split(' ');
  const first = tokens[0];

  let medida: string | null = null;
  let matchedLen = 0;
  for (const re of MEDIDA_PATTERNS) {
    const m = re.exec(first);
    if (m && m[2]) {
      // Grupo 2 = cuerpo de la medida sin el prefijo P|LT|ST.
      medida = m[2].toUpperCase();
      matchedLen = m[0].length;
      break;
    }
  }

  // FALLBACK: ninguna medida coincide.
  if (!medida) {
    const marca = tokens.length > 0 ? tokens[0] : null;
    const modelo = tokens.length > 1 ? tokens.slice(1).join(' ') : null;
    return {
      descripcion,
      medida: null,
      medida_norm: null,
      marca: marca || null,
      modelo: modelo || null,
      specs: null,
    };
  }

  // Lo que sobra del primer token después de la medida (p.ej. prefijo pegado a
  // la marca) se reincorpora como token siguiente si no está vacío.
  const restOfFirst = first.slice(matchedLen);
  const afterTokens = tokens.slice(1);
  if (restOfFirst) {
    afterTokens.unshift(restOfFirst);
  }

  // Algunas descripciones traen el índice de carga/velocidad (o ply/flags)
  // ANTES de la marca: "185/65R15 88H BROAD PEAK...". Saltamos esos specs
  // iniciales para que la marca no quede como "88H".
  const leadingSpecs: string[] = [];
  let startIdx = 0;
  while (startIdx < afterTokens.length && isSpecToken(afterTokens[startIdx])) {
    leadingSpecs.push(afterTokens[startIdx]);
    startIdx += 1;
  }

  // marca = primer token no-spec después de la medida.
  const marca = startIdx < afterTokens.length ? afterTokens[startIdx] : null;
  const modeloTokens = afterTokens.slice(startIdx + 1);

  // Recortar specs desde el FINAL del modelo mientras parezcan specs.
  const trailingSpecs: string[] = [];
  while (modeloTokens.length > 0 && isSpecToken(modeloTokens[modeloTokens.length - 1])) {
    trailingSpecs.unshift(modeloTokens.pop() as string);
  }

  const modelo = modeloTokens.length > 0 ? modeloTokens.join(' ') : null;
  const specsCombined = [...leadingSpecs, ...trailingSpecs];
  const specs = specsCombined.length > 0 ? specsCombined.join(' ') : null;

  return {
    descripcion,
    medida,
    medida_norm: medida ? normalizeMedida(medida) : null,
    marca: marca || null,
    modelo,
    specs,
  };
}
