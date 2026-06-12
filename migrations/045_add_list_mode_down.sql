-- Rollback Migration 045
-- WARNUNG: Vor dem Rollback müssen alle Listen mit list_mode = 'product'
-- und city IS NULL eine Stadt bekommen, sonst schlägt ALTER COLUMN SET NOT NULL fehl.

ALTER TABLE lists
  DROP CONSTRAINT IF EXISTS lists_list_mode_check;

ALTER TABLE lists
  DROP COLUMN IF EXISTS list_mode;

-- Optional: city wieder NOT NULL setzen (nur ausführen, wenn alle Zeilen city != NULL).
-- ALTER TABLE lists ALTER COLUMN city SET NOT NULL;
