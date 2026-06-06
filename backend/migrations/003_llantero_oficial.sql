-- ============================================================
-- 003_llantero_oficial.sql
-- Consolida LEON + DILLAMA en un único proveedor LLANTERO_OFICIAL.
-- TRUNCATE limpia todos los productos (se recargará desde el nuevo Excel).
-- Idempotente: usa IF EXISTS / DO $$ para re-ejecuciones seguras.
-- ============================================================

-- 1. Vaciar todos los productos y reiniciar secuencia
TRUNCATE productos RESTART IDENTITY;

-- 2. Eliminar constraint vieja
ALTER TABLE productos DROP CONSTRAINT IF EXISTS productos_proveedor_check;

-- 3. Crear constraint nueva con el único proveedor
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'productos'
      AND constraint_name = 'productos_proveedor_check'
  ) THEN
    ALTER TABLE productos ADD CONSTRAINT productos_proveedor_check
      CHECK (proveedor IN ('LLANTERO_OFICIAL'));
  END IF;
END $$;
