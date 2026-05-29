import { env } from '../env';

/**
 * Calcula el precio de venta a partir del precio de costo.
 * precio_venta = costo * MARGIN_UTILIDAD * MARGIN_FACTOR (redondeado).
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
  return Math.round(precioCosto * env.MARGIN_UTILIDAD * env.MARGIN_FACTOR);
}
