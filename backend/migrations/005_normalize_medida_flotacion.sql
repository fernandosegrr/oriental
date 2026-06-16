-- Re-normaliza medida_norm para llantas de flotación:
-- elimina ceros decimales superfluos en el segmento de ancho (después de X).
-- Ejemplos: 27X8.50R14 → 27X8.5R14   31X10.50R15 → 31X10.5R15
-- Las llantas bias (7.0014) no se ven afectadas porque no contienen X.
UPDATE productos
SET medida_norm = regexp_replace(medida_norm, '(X\d+\.\d*[1-9])0+', '\1', 'g')
WHERE medida_norm ~ 'X\d+\.\d*[1-9]0+';
