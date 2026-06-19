CREATE TABLE audit_logs (
  id            SERIAL       PRIMARY KEY,
  evento_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  tipo          TEXT         NOT NULL,
  usuario_id    INT          REFERENCES usuarios(id) ON DELETE SET NULL,
  usuario_email TEXT,
  detalle       JSONB        NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_audit_logs_at   ON audit_logs (evento_at DESC);
CREATE INDEX idx_audit_logs_tipo ON audit_logs (tipo);
