-- Cambia precio_venta de INT a NUMERIC(10,2) para preservar decimales del Excel.
ALTER TABLE productos
  ALTER COLUMN precio_venta TYPE NUMERIC(10,2) USING precio_venta::NUMERIC(10,2);
