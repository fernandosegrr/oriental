-- ============================================================
-- 001_init.sql  –  Llantas Oriental Irapuato – Initial Schema
-- Idempotent: safe to re-run.
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- ============================================================
-- Table: usuarios
-- ============================================================
CREATE TABLE IF NOT EXISTS usuarios (
  id            SERIAL        PRIMARY KEY,
  email         TEXT          UNIQUE NOT NULL,
  nombre        TEXT          NOT NULL,
  password_hash TEXT          NOT NULL,
  rol           TEXT          NOT NULL DEFAULT 'operador'
                              CHECK (rol IN ('admin', 'operador')),
  activo        BOOLEAN       NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ============================================================
-- Table: productos
-- ============================================================
CREATE TABLE IF NOT EXISTS productos (
  id            SERIAL        PRIMARY KEY,
  sucursal      TEXT          NOT NULL
                              CHECK (sucursal IN ('LEON', 'DILLAMA')),
  descripcion   TEXT          NOT NULL,
  medida        TEXT,
  medida_norm   TEXT,
  marca         TEXT,
  modelo        TEXT,
  specs         TEXT,
  stock         INT           NOT NULL DEFAULT 0,
  precio_costo  NUMERIC(10,2) NOT NULL DEFAULT 0,
  precio_venta  INT           NOT NULL DEFAULT 0,
  origen        TEXT          NOT NULL DEFAULT 'excel'
                              CHECK (origen IN ('excel', 'manual')),
  activo        BOOLEAN       NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_productos_sucursal_activo
  ON productos (sucursal, activo);

CREATE INDEX IF NOT EXISTS idx_productos_medida_norm
  ON productos (medida_norm);

CREATE INDEX IF NOT EXISTS idx_productos_descripcion_trgm
  ON productos USING gin (descripcion gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_productos_marca_trgm
  ON productos USING gin (marca gin_trgm_ops);

-- ============================================================
-- updated_at trigger function
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: usuarios
DROP TRIGGER IF EXISTS trg_usuarios_updated ON usuarios;
CREATE TRIGGER trg_usuarios_updated
  BEFORE UPDATE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Trigger: productos
DROP TRIGGER IF EXISTS trg_productos_updated ON productos;
CREATE TRIGGER trg_productos_updated
  BEFORE UPDATE ON productos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
