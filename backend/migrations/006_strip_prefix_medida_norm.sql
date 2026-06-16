-- Elimina prefijos de tipo de llanta (LT, P, ST) de medida_norm que pudieron
-- quedar en registros ingresados manualmente (los importados desde Excel ya
-- tienen el prefijo descartado por parseDescripcion).
-- Idempotente: el WHERE solo afecta filas donde el prefijo aún existe.
UPDATE productos
SET medida_norm = regexp_replace(medida_norm, '^(LT|ST|P)', '')
WHERE medida_norm ~ '^(LT|ST|P)\d';
