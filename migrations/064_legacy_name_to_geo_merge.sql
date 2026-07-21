-- Migration 064: Koordinatenlose Standort-Spots an bestehenden geo-Spot mergen (Feature 2).
--
-- Problem: Ein Standort-Spot (Liste im location-Modus) OHNE Koordinaten bekommt
-- canonical_key 'name|<name>' und erscheint im Entdecken-Tab getrennt vom
-- 'geo|lat|lng'-Spot desselben Ladens → derselbe Laden mehrfach sichtbar.
--
-- Fix: Existiert ein geo-Spot mit exakt gleichem normalisierten Namen, übernimmt
-- der koordinatenlose Spot dessen canonical_key (per Name zusammengeführt).
--   * Nur EXAKTER Namensabgleich (kein Fuzzy) — bei Orten wären Tippfehler-Merges
--     riskant (verschiedene Läden ähnlichen Namens).
--   * Nur Standort-Spots betroffen; 'name|'-Keys entstehen nur im location-Modus
--     ohne Koordinaten, 'geo|'-Keys ebenfalls nur dort → Produkte bleiben außen vor.
--   * Bei mehreren geo-Kandidaten gleichen Namens gewinnt der älteste (Erst-Ersteller).
--
-- Nicht-destruktiv: nur canonical_key wird umgesetzt, keine Zeilen gelöscht.

SET search_path = public, extensions;

-- =====================================================================
-- Trigger: ELSE-Zweig (koordinatenlos) versucht Anhängen an geo-Spot
-- =====================================================================
CREATE OR REPLACE FUNCTION public.set_foodspot_canonical_key()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
  v_mode text;
  v_norm text;
  v_match text;
  v_max_dist int := 1;
BEGIN
  SELECT l.list_mode INTO v_mode FROM public.lists l WHERE l.id = NEW.list_id;

  IF v_mode = 'product' THEN
    v_norm := lower(btrim(COALESCE(NEW.normalized_name, NEW.name, '')));
    SELECT e.canonical_key INTO v_match
    FROM public.foodspots e
    WHERE e.canonical_key LIKE 'product|%'
      AND e.id <> NEW.id
      AND (
        lower(btrim(COALESCE(e.normalized_name, e.name, ''))) = v_norm
        OR (char_length(v_norm) >= 5
            AND levenshtein(lower(btrim(COALESCE(e.normalized_name, e.name, ''))), v_norm) <= v_max_dist)
      )
    ORDER BY levenshtein(lower(btrim(COALESCE(e.normalized_name, e.name, ''))), v_norm) ASC,
             e.created_at ASC
    LIMIT 1;
    NEW.canonical_key := COALESCE(v_match, 'product|' || v_norm);

  ELSIF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.canonical_key := 'geo|' || round(NEW.latitude, 4)::text || '|' || round(NEW.longitude, 4)::text;

  ELSE
    -- Standort-Spot ohne Koordinaten: an bestehenden geo-Spot gleichen Namens hängen
    v_norm := lower(btrim(COALESCE(NEW.normalized_name, NEW.name, '')));
    v_match := NULL;
    IF v_norm <> '' THEN
      SELECT e.canonical_key INTO v_match
      FROM public.foodspots e
      WHERE e.canonical_key LIKE 'geo|%'
        AND e.id <> NEW.id
        AND lower(btrim(COALESCE(e.normalized_name, e.name, ''))) = v_norm
      ORDER BY e.created_at ASC
      LIMIT 1;
    END IF;
    NEW.canonical_key := COALESCE(v_match, 'name|' || v_norm);
  END IF;
  RETURN NEW;
END;
$$;

-- =====================================================================
-- Backfill: bestehende 'name|'-Spots an geo-Spot gleichen Namens hängen
--   (pro Name der älteste geo-Spot ist kanonisch)
-- =====================================================================
UPDATE public.foodspots nf
SET canonical_key = g.canonical_key
FROM (
  SELECT DISTINCT ON (norm) norm, canonical_key
  FROM (
    SELECT lower(btrim(COALESCE(normalized_name, name, ''))) AS norm,
           canonical_key, created_at
    FROM public.foodspots
    WHERE canonical_key LIKE 'geo|%'
  ) geo
  WHERE norm <> ''
  ORDER BY norm, created_at ASC
) g
WHERE nf.canonical_key LIKE 'name|%'
  AND lower(btrim(COALESCE(nf.normalized_name, nf.name, ''))) = g.norm;
