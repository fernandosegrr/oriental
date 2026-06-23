-- 009_rol_visor.sql — Agrega rol 'visor' (solo lectura) a la tabla usuarios
-- Idempotent: safe to re-run.

ALTER TABLE usuarios
  DROP CONSTRAINT IF EXISTS usuarios_rol_check;

ALTER TABLE usuarios
  ADD CONSTRAINT usuarios_rol_check
    CHECK (rol IN ('admin', 'operador', 'visor'));
