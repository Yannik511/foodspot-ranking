-- =============================================
-- MIGRATION 041: Fix foodspot_ratings.score Precision
-- =============================================
-- Aktualisiert den Datentyp von foodspot_ratings.score auf NUMERIC(4,2)
-- und stellt sicher, dass Werte im Bereich 0.00 - 10.00 liegen.
-- =============================================

ALTER TABLE foodspot_ratings
  DROP CONSTRAINT IF EXISTS foodspot_ratings_score_check;

ALTER TABLE foodspot_ratings
  ALTER COLUMN score TYPE NUMERIC(4,2)
  USING CASE
    WHEN score IS NULL THEN NULL
    ELSE LEAST(GREATEST(score::NUMERIC, 0.00), 10.00)
  END;

ALTER TABLE foodspot_ratings
  ALTER COLUMN score SET NOT NULL;

ALTER TABLE foodspot_ratings
  ADD CONSTRAINT foodspot_ratings_score_check CHECK (score >= 0 AND score <= 10);

-- =============================================
-- SUCCESS: foodspot_ratings.score precision fixed
-- =============================================

