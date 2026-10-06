/** El precio con descuento (precio_costo) es el 75% del precio de lista (25% de descuento). */
export const FACTOR_DESCUENTO = 0.75;

/**
 * Calcula el precio de lista (precio_venta) a partir del precio con descuento
 * (precio_costo), respetando la relación del Excel: precio_costo = precio_venta * 0.75.
 * precio_venta = precio_costo / 0.75 (redondeado a pesos enteros).
 * Devuelve 0 si el costo es inválido (null/undefined/NaN/<=0).
 */
export function calcPrecioVenta(precioCosto: number): number {
  if (
    precioCosto === null ||
    precioCosto === undefined ||
    Number.isNaN(precioCosto) ||
    precioCosto <= 0
  ) {
    return 0;
  }
  return Math.round(precioCosto / FACTOR_DESCUENTO);
}
