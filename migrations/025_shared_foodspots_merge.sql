-- =============================================
-- MIGRATION 025: SHARED FOODSPOTS MERGE & RATINGS
-- =============================================
-- Ziel:
--  1. Foodspots nach Namen (case-insensitive) pro Liste vereinheitlichen
--  2. Aggregierte Scores (avg_score / ratings_count) pflegen
--  3. Erste*r Uploader*in & gemeinsame Beschreibung speichern
--  4. Tabelle foodspot_ratings für Einzelbewertungen einführen
--  5. Trigger/Funktionen zur automatischen Pflege der Aggregates
-- =============================================

-- 1) Neue Spalten für Foodspots (falls noch nicht vorhanden)
ALTER TABLE foodspots
  ADD COLUMN IF NOT EXISTS first_uploader_id UUID,
  ADD COLUMN IF NOT EXISTS ratings_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_score NUMERIC(4,2),
  ADD COLUMN IF NOT EXISTS normalized_name TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT;

-- Erste*r Uploader*in mit bisherigen Daten füllen
UPDATE foodspots
SET first_uploader_id = user_id
WHERE first_uploader_id IS NULL;

-- Beschreibung aus bestehenden Notizen übernehmen (falls leer)
UPDATE foodspots
SET description = notes
WHERE description IS NULL AND notes IS NOT NULL;

-- Normalisierte Namen vorbereiten
UPDATE foodspots
SET normalized_name = LOWER(TRIM(name))
WHERE normalized_name IS NULL AND name IS NOT NULL;

-- 2) Doppelte Foodspots (gleiche Liste + Name) zusammenführen
WITH duplicates AS (
  SELECT
    list_id,
    LOWER(TRIM(name)) AS norm_name,
    MIN(id::text)::uuid AS keep_id,
    ARRAY_REMOVE(
      ARRAY_AGG(id ORDER BY created_at),
      MIN(id::text)::uuid
    ) AS remove_ids
  FROM foodspots
  GROUP BY list_id, LOWER(TRIM(name))
  HAVING COUNT(*) > 1
),
duplicate_data AS (
  SELECT
    d.keep_id,
    AVG(f.rating) FILTER (WHERE f.rating IS NOT NULL) AS merged_avg,
    COUNT(f.rating) FILTER (WHERE f.rating IS NOT NULL) AS merged_count,
    MAX(f.description) FILTER (WHERE f.description IS NOT NULL) AS merged_description
  FROM duplicates d
  JOIN foodspots f
    ON f.list_id = d.list_id
   AND LOWER(TRIM(f.name)) = d.norm_name
  GROUP BY d.keep_id
)
UPDATE foodspots f
SET
  avg_score = COALESCE(dd.merged_avg, f.avg_score, f.rating),
  rating = COALESCE(dd.merged_avg, f.rating),
  ratings_count = GREATEST(COALESCE(dd.merged_count, f.ratings_count), f.ratings_count),
  description = COALESCE(dd.merged_description, f.description)
FROM duplicate_data dd
WHERE f.id = dd.keep_id;

-- Überzählige Foodspots löschen
WITH duplicates AS (
  SELECT
    list_id,
    LOWER(TRIM(name)) AS norm_name,
    MIN(id::text)::uuid AS keep_id,
    ARRAY_REMOVE(
      ARRAY_AGG(id ORDER BY created_at),
      MIN(id::text)::uuid
    ) AS remove_ids
  FROM foodspots
  GROUP BY list_id, LOWER(TRIM(name))
  HAVING COUNT(*) > 1
)
DELETE FROM foodspots
WHERE id IN (
  SELECT unnest(remove_ids)
  FROM duplicates
  WHERE remove_ids IS NOT NULL
);

-- 3) Tabelle für Einzelbewertungen erstellen
CREATE TABLE IF NOT EXISTS foodspot_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  foodspot_id UUID NOT NULL REFERENCES foodspots(id) ON DELETE CASCADE,
  list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score NUMERIC(4,2) NOT NULL CHECK (score >= 0 AND score <= 10),
  criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
  UNIQUE (foodspot_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_foodspot_ratings_list_user
  ON foodspot_ratings(list_id, user_id);

CREATE INDEX IF NOT EXISTS idx_foodspot_ratings_foodspot
  ON foodspot_ratings(foodspot_id);

-- Trigger für updated_at
CREATE OR REPLACE FUNCTION set_updated_at_foodspot_ratings()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_updated_at_foodspot_ratings ON foodspot_ratings;
CREATE TRIGGER set_updated_at_foodspot_ratings
BEFORE UPDATE ON foodspot_ratings
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_foodspot_ratings();

-- 4) Foodspots normalisieren (Name & Normalized Name pflegen)
CREATE OR REPLACE FUNCTION normalize_foodspot_name()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.name IS NOT NULL THEN
    NEW.name := TRIM(NEW.name);
    NEW.normalized_name := LOWER(NEW.name);
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.first_uploader_id IS NULL THEN
      NEW.first_uploader_id := NEW.user_id;
    END IF;
    IF NEW.ratings_count IS NULL THEN
      NEW.ratings_count := 0;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_foodspot_name ON foodspots;
CREATE TRIGGER trg_normalize_foodspot_name
BEFORE INSERT OR UPDATE ON foodspots
FOR EACH ROW
EXECUTE FUNCTION normalize_foodspot_name();

-- Normalisierte Namen sicherstellen
UPDATE foodspots
SET normalized_name = LOWER(TRIM(name))
WHERE normalized_name IS NULL;

-- NOT NULL setzen (nachdem alle Werte vorhanden sind)
ALTER TABLE foodspots
  ALTER COLUMN normalized_name SET NOT NULL;

-- Eindeutigkeit pro Liste erzwingen
CREATE UNIQUE INDEX IF NOT EXISTS idx_foodspots_unique_name_per_list
  ON foodspots (list_id, normalized_name);

-- 5) Aggregat-Funktion für Foodspots
CREATE OR REPLACE FUNCTION refresh_foodspot_aggregates(p_foodspot_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_avg NUMERIC(4,2);
  v_count INTEGER;
BEGIN
  SELECT
    ROUND(AVG(score)::numeric, 2),
    COUNT(*)
  INTO v_avg, v_count
  FROM foodspot_ratings
  WHERE foodspot_id = p_foodspot_id;

  UPDATE foodspots
  SET
    rating = CASE WHEN v_count > 0 THEN v_avg ELSE NULL END,
    avg_score = CASE WHEN v_count > 0 THEN v_avg ELSE NULL END,
    ratings_count = v_count,
    tier = CASE
      WHEN v_count = 0 THEN NULL
      WHEN v_avg >= 9.0 THEN 'S'
      WHEN v_avg >= 8.0 THEN 'A'
      WHEN v_avg >= 6.5 THEN 'B'
      WHEN v_avg >= 5.0 THEN 'C'
      WHEN v_avg >= 3.0 THEN 'D'
      ELSE 'E'
    END,
    updated_at = timezone('utc', now())
  WHERE id = p_foodspot_id;
END;
$$;

-- Trigger auf foodspot_ratings zur Pflege der Aggregate
CREATE OR REPLACE FUNCTION trg_refresh_foodspot_aggregates()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_foodspot_id UUID;
BEGIN
  v_foodspot_id := COALESCE(NEW.foodspot_id, OLD.foodspot_id);
  PERFORM refresh_foodspot_aggregates(v_foodspot_id);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_foodspot_ratings_after_iud ON foodspot_ratings;
CREATE TRIGGER trg_foodspot_ratings_after_iud
AFTER INSERT OR UPDATE OR DELETE ON foodspot_ratings
FOR EACH ROW
EXECUTE FUNCTION trg_refresh_foodspot_aggregates();

-- 6) Bestehende Ratings in neue Tabelle überführen
INSERT INTO foodspot_ratings (foodspot_id, list_id, user_id, score, criteria, comment, created_at, updated_at)
SELECT
  id,
  list_id,
  user_id,
  rating,
  COALESCE(ratings, '{}'::jsonb),
  NULL,
  created_at,
  updated_at
FROM foodspots
WHERE rating IS NOT NULL
ON CONFLICT (foodspot_id, user_id) DO NOTHING;

-- Aggregat einmalig aktualisieren
UPDATE foodspots
SET ratings_count = sub.cnt,
    rating = sub.avg_score,
    avg_score = sub.avg_score,
    tier = CASE
      WHEN sub.cnt = 0 THEN NULL
      WHEN sub.avg_score >= 9.0 THEN 'S'
      WHEN sub.avg_score >= 8.0 THEN 'A'
      WHEN sub.avg_score >= 6.5 THEN 'B'
      WHEN sub.avg_score >= 5.0 THEN 'C'
      WHEN sub.avg_score >= 3.0 THEN 'D'
      ELSE 'E'
    END
FROM (
  SELECT
    foodspot_id,
    COUNT(*) AS cnt,
    ROUND(AVG(score)::numeric, 2) AS avg_score
  FROM foodspot_ratings
  GROUP BY foodspot_id
) sub
WHERE id = sub.foodspot_id;

-- Fehlende Werte (keine Bewertungen) auf 0 setzen
UPDATE foodspots
SET ratings_count = 0,
    rating = NULL,
    avg_score = NULL,
    tier = NULL
WHERE id NOT IN (SELECT DISTINCT foodspot_id FROM foodspot_ratings);

-- 7) RLS-Policies für foodspot_ratings
ALTER TABLE foodspot_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view foodspot ratings" ON foodspot_ratings;
CREATE POLICY "Members can view foodspot ratings"
ON foodspot_ratings FOR SELECT TO authenticated
USING (
  is_list_member(list_id, auth.uid())
  OR is_list_owner(list_id, auth.uid())
);

DROP POLICY IF EXISTS "Members can add foodspot ratings" ON foodspot_ratings;
CREATE POLICY "Members can add foodspot ratings"
ON foodspot_ratings FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    is_list_member(list_id, auth.uid())
    OR is_list_owner(list_id, auth.uid())
  )
);

DROP POLICY IF EXISTS "Members can update own foodspot ratings" ON foodspot_ratings;
CREATE POLICY "Members can update own foodspot ratings"
ON foodspot_ratings FOR UPDATE TO authenticated
USING (
  auth.uid() = user_id
)
WITH CHECK (
  auth.uid() = user_id
);

DROP POLICY IF EXISTS "Members can delete own foodspot ratings" ON foodspot_ratings;
CREATE POLICY "Members can delete own foodspot ratings"
ON foodspot_ratings FOR DELETE TO authenticated
USING (
  auth.uid() = user_id
  OR is_list_editor(list_id, auth.uid())
  OR is_list_owner(list_id, auth.uid())
);

-- 8) RPC: Foodspot anlegen / zusammenführen / bewerten
CREATE OR REPLACE FUNCTION merge_foodspot(
  p_list_id UUID,
  p_name TEXT,
  p_score NUMERIC(4,2),
  p_criteria JSONB DEFAULT '{}'::jsonb,
  p_comment TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_latitude DOUBLE PRECISION DEFAULT NULL,
  p_longitude DOUBLE PRECISION DEFAULT NULL,
  p_cover_photo TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_website TEXT DEFAULT NULL
)
RETURNS foodspots
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_foodspot foodspots;
  v_normalized_name TEXT := LOWER(TRIM(p_name));
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  IF p_list_id IS NULL THEN
    RAISE EXCEPTION 'list_id is required' USING ERRCODE = '23502';
  END IF;

  IF v_normalized_name IS NULL OR v_normalized_name = '' THEN
    RAISE EXCEPTION 'name must not be empty' USING ERRCODE = '23514';
  END IF;

  -- Nur Owner/Editor dürfen Spots und Bewertungen bearbeiten
  IF NOT (is_list_owner(p_list_id, v_user_id) OR is_list_editor(p_list_id, v_user_id)) THEN
    RAISE EXCEPTION 'Keine Berechtigung für diese Liste' USING ERRCODE = '42501';
  END IF;

  -- Bestehenden Spot sperren (falls vorhanden)
  SELECT *
  INTO v_foodspot
  FROM foodspots
  WHERE list_id = p_list_id
    AND normalized_name = v_normalized_name
  FOR UPDATE;

  IF FOUND THEN
    -- Spot aktualisieren (nur Angaben überschreiben, die vorhanden sind)
    UPDATE foodspots
    SET
      name = TRIM(p_name),
      category = COALESCE(p_category, category),
      description = COALESCE(NULLIF(TRIM(p_description), ''), description),
      address = COALESCE(NULLIF(TRIM(p_address), ''), address),
      latitude = COALESCE(p_latitude, latitude),
      longitude = COALESCE(p_longitude, longitude),
      phone = COALESCE(NULLIF(TRIM(p_phone), ''), phone),
      website = COALESCE(NULLIF(TRIM(p_website), ''), website),
      cover_photo_url = COALESCE(p_cover_photo, cover_photo_url),
      updated_at = timezone('utc', now())
    WHERE id = v_foodspot.id
    RETURNING * INTO v_foodspot;
  ELSE
    -- Neuer Spot
    INSERT INTO foodspots (
      list_id,
      user_id,
      first_uploader_id,
      name,
      normalized_name,
      category,
      description,
      address,
      latitude,
      longitude,
      phone,
      website,
      cover_photo_url,
      ratings,
      rating,
      avg_score,
      ratings_count
    )
    VALUES (
      p_list_id,
      v_user_id,
      v_user_id,
      TRIM(p_name),
      v_normalized_name,
      p_category,
      NULLIF(TRIM(p_description), ''),
      NULLIF(TRIM(p_address), ''),
      p_latitude,
      p_longitude,
      NULLIF(TRIM(p_phone), ''),
      NULLIF(TRIM(p_website), ''),
      p_cover_photo,
      '{}'::jsonb,
      NULL,
      NULL,
      0
    )
    RETURNING * INTO v_foodspot;
  END IF;

  -- Bewertung anlegen oder aktualisieren (optional, nur wenn Score angegeben)
  IF p_score IS NOT NULL THEN
    INSERT INTO foodspot_ratings (
      foodspot_id,
      list_id,
      user_id,
      score,
      criteria,
      comment
    )
    VALUES (
      v_foodspot.id,
      p_list_id,
      v_user_id,
      p_score,
      COALESCE(p_criteria, '{}'::jsonb),
      NULLIF(TRIM(p_comment), '')
    )
    ON CONFLICT (foodspot_id, user_id)
    DO UPDATE SET
      score = EXCLUDED.score,
      criteria = EXCLUDED.criteria,
      comment = EXCLUDED.comment,
      updated_at = timezone('utc', now());
  END IF;

  -- Aktualisierte Werte zurückgeben
  SELECT *
  INTO v_foodspot
  FROM foodspots
  WHERE id = v_foodspot.id;

  RETURN v_foodspot;
END;
$$;

-- 9) RPC: Eigene Bewertung entfernen
CREATE OR REPLACE FUNCTION delete_foodspot_rating(p_foodspot_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_list_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  SELECT list_id
  INTO v_list_id
  FROM foodspots
  WHERE id = p_foodspot_id;

  IF v_list_id IS NULL THEN
    RAISE EXCEPTION 'Foodspot nicht gefunden' USING ERRCODE = 'P0002';
  END IF;

  IF NOT is_list_member(v_list_id, v_user_id) THEN
    RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE = '42501';
  END IF;

  DELETE FROM foodspot_ratings
  WHERE foodspot_id = p_foodspot_id
    AND user_id = v_user_id;
END;
$$;

-- =============================================
-- SUCCESS: Shared Foodspots Merge & Ratings
-- =============================================

