CREATE TABLE bot_search_logs (
  id               SERIAL       PRIMARY KEY,
  consultado_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  medida           TEXT         NOT NULL,
  medida_norm      TEXT,
  marca            TEXT,
  q                TEXT,
  estrategia       TEXT,
  total_resultados INT          NOT NULL DEFAULT 0,
  opciones         JSONB        NOT NULL DEFAULT '[]'
);

CREATE INDEX idx_bot_search_logs_at        ON bot_search_logs (consultado_at DESC);
CREATE INDEX idx_bot_search_logs_medida    ON bot_search_logs (medida_norm);
