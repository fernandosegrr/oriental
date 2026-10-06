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
 * precio_venta = round(precio_costo / 0.75), i.e. precio_costo is the list
 * price with 25% off. Must match backend/src/lib/price.ts.
 */
export function calcPrecioVenta(precioCosto: number): number {
  return Math.round((precioCosto || 0) / 0.75);
}
