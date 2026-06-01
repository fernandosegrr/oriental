-- ============================================================
-- 002_proveedor.sql
-- Renombra la columna sucursal → proveedor en productos.
-- LEON y DILLAMA son proveedores (hojas del Excel), no sucursales.
-- Hay una sola tienda: Llantas Oriental Irapuato.
-- Idempotente: usa DO $$ para evitar errores en re-ejecuciones.
-- ============================================================

-- 1. Renombrar columna (solo si todavía se llama sucursal)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'productos' AND column_name = 'sucursal'
  ) THEN
    ALTER TABLE productos RENAME COLUMN sucursal TO proveedor;
  END IF;
END $$;

-- 2. Eliminar constraint vieja y crear la nueva
ALTER TABLE productos DROP CONSTRAINT IF EXISTS productos_sucursal_check;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'productos'
      AND constraint_name = 'productos_proveedor_check'
  ) THEN
    ALTER TABLE productos ADD CONSTRAINT productos_proveedor_check
      CHECK (proveedor IN ('LEON', 'DILLAMA'));
  END IF;
END $$;

-- 3. Renombrar índice
ALTER INDEX IF EXISTS idx_productos_sucursal_activo
  RENAME TO idx_productos_proveedor_activo;
