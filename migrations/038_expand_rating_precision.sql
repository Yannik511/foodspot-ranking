-- =============================================
-- MIGRATION 038: Expand Rating Precision
-- =============================================
-- Behebt numeric overflow bei Ratings in foodspots
-- Erhöht die Präzision der Spalte rating von NUMERIC(3,2) auf NUMERIC(4,2)
-- =============================================

ALTER TABLE foodspots
  ALTER COLUMN rating TYPE NUMERIC(4,2)
  USING COALESCE(rating, 0)::NUMERIC(4,2);

-- Optional: Kommentare aktualisieren
COMMENT ON COLUMN foodspots.rating IS 'Gesamt-Rating (0.00 - 10.00)';

-- =============================================
-- SUCCESS: Rating precision expanded
-- =============================================
