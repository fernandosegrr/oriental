const mxn = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 0,
});

/** Format a number as MXN currency (no decimals). */
export function formatMXN(value: number | null | undefined): string {
  return mxn.format(value ?? 0);
}

/**
 * Business rule for the sale price preview shown in the UI:
 * precio_venta = round(precio_costo * 1.2 * 1.33333).
 */
export function calcPrecioVenta(precioCosto: number): number {
  return Math.round((precioCosto || 0) * 1.2 * 1.33333);
}
