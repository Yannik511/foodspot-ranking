-- Migration 045: Listen-Modus (Ort vs. Produkt)
--
-- Fügt eine `list_mode` Spalte hinzu, mit der Listen als "location" (Standard)
-- oder "product" markiert werden. Bei product-Listen ist die Stadt-/Ortsangabe
-- optional. Standortdaten (latitude/longitude) werden weiterhin gespeichert,
-- sofern angegeben, damit eine spätere Weltkarten-Übersicht aller Spots
-- möglich bleibt.
--
-- Bestehende Listen bleiben automatisch im Modus "location".

ALTER TABLE lists
  ADD COLUMN IF NOT EXISTS list_mode varchar(20) NOT NULL DEFAULT 'location';

ALTER TABLE lists
  DROP CONSTRAINT IF EXISTS lists_list_mode_check;

ALTER TABLE lists
  ADD CONSTRAINT lists_list_mode_check
  CHECK (list_mode IN ('location', 'product'));

-- city war bisher NOT NULL. Bei product-Listen darf city leer bleiben.
ALTER TABLE lists
  ALTER COLUMN city DROP NOT NULL;

COMMENT ON COLUMN lists.list_mode IS
  'Listen-Modus: location = ortsbasiert (Default, city Pflicht in UI), product = produktbasiert (city optional)';
