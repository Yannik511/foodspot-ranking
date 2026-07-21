-- Migration 065: Lockerer (fuzzy) Standort-Merge name→geo (ersetzt 064).
--
-- 064 hat nur EXAKT gleiche normalized_name gemerged. normalized_name ist aber
-- nur LOWER(TRIM(name)) — Leerzeichen/Bindestriche/Tippfehler bleiben. Deshalb
-- standen "Sendling Spezial", "Sendling-Spezial" und "Sendlinger Spezial" weiter
-- getrennt vom geo-Spot.
--
-- Jetzt: Vergleich auf KOLLABIERTER Form (nur Buchstaben/Ziffern, ohne Leer-
-- zeichen/Bindestrich/Satzzeichen) + Levenshtein-Toleranz:
--   * kollabiert gleich  → "Sendling Spezial" == "Sendling-Spezial"
--   * Levenshtein <= 3 (bei kollabierter Länge >= 6) → "…Spezial" == "…erSpezial"
-- Nur Standort-Spots (location-Modus erzeugt 'name|'/'geo|', Produkte 'product|').
-- Bei mehreren geo-Kandidaten gewinnt der ähnlichste, dann der älteste.
-- Nicht-destruktiv (nur canonical_key). Selbstständig ausführbar (unabhängig von 064).

CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;
SET search_path = public, extensions;

-- =====================================================================
-- Trigger: ELSE-Zweig (koordinatenlos) mit kollabiertem Fuzzy-Match
-- =====================================================================
CREATE OR REPLACE FUNCTION public.set_foodspot_canonical_key()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
  v_mode text;
  v_norm text;
  v_coll text;
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
    -- Standort-Spot ohne Koordinaten: an ähnlichsten geo-Spot gleichen Namens hängen
    v_norm := lower(btrim(COALESCE(NEW.normalized_name, NEW.name, '')));
    v_coll := regexp_replace(v_norm, '[^[:alnum:]]+', '', 'g');
    v_match := NULL;
    IF v_coll <> '' THEN
      SELECT e.canonical_key INTO v_match
      FROM public.foodspots e
      WHERE e.canonical_key LIKE 'geo|%'
        AND e.id <> NEW.id
        AND (
          regexp_replace(lower(btrim(COALESCE(e.normalized_name, e.name, ''))), '[^[:alnum:]]+', '', 'g') = v_coll
          OR (char_length(v_coll) >= 6
              AND levenshtein(regexp_replace(lower(btrim(COALESCE(e.normalized_name, e.name, ''))), '[^[:alnum:]]+', '', 'g'), v_coll) <= 3)
        )
      ORDER BY levenshtein(regexp_replace(lower(btrim(COALESCE(e.normalized_name, e.name, ''))), '[^[:alnum:]]+', '', 'g'), v_coll) ASC,
               e.created_at ASC
      LIMIT 1;
    END IF;
    NEW.canonical_key := COALESCE(v_match, 'name|' || v_norm);
  END IF;
  RETURN NEW;
END;
$$;

-- =====================================================================
-- Backfill: bestehende 'name|'-Spots fuzzy an geo-Spot hängen
-- =====================================================================
DO $$
DECLARE
  r record;
  v_match text;
  v_coll text;
BEGIN
  FOR r IN
    SELECT f.id,
           regexp_replace(lower(btrim(COALESCE(f.normalized_name, f.name, ''))), '[^[:alnum:]]+', '', 'g') AS coll
    FROM public.foodspots f
    WHERE f.canonical_key LIKE 'name|%'
  LOOP
    v_coll := r.coll;
    IF v_coll = '' THEN CONTINUE; END IF;

    SELECT e.canonical_key INTO v_match
    FROM public.foodspots e
    WHERE e.canonical_key LIKE 'geo|%'
      AND (
        regexp_replace(lower(btrim(COALESCE(e.normalized_name, e.name, ''))), '[^[:alnum:]]+', '', 'g') = v_coll
        OR (char_length(v_coll) >= 6
            AND levenshtein(regexp_replace(lower(btrim(COALESCE(e.normalized_name, e.name, ''))), '[^[:alnum:]]+', '', 'g'), v_coll) <= 3)
      )
    ORDER BY levenshtein(regexp_replace(lower(btrim(COALESCE(e.normalized_name, e.name, ''))), '[^[:alnum:]]+', '', 'g'), v_coll) ASC,
             e.created_at ASC
    LIMIT 1;

    IF v_match IS NOT NULL THEN
      UPDATE public.foodspots SET canonical_key = v_match WHERE id = r.id;
    END IF;
  END LOOP;
END $$;
