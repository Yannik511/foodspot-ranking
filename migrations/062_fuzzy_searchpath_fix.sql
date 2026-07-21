-- Migration 062: Fix search_path für Fuzzy (levenshtein liegt im 'extensions'-Schema).
--
-- 061 hat den Backfill im SQL-Editor ausgeführt, wo 'extensions' nicht im
-- search_path lag → levenshtein nicht gefunden → Backfill lief nicht durch,
-- bestehende Produkt-Duplikate blieben getrennt.
--
-- Hier: Extensions sicherstellen, Trigger + find_canonical_spot mit explizitem
-- search_path (public, extensions) neu anlegen, Backfill mit gesetztem
-- search_path erneut ausführen.

CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

SET search_path = public, extensions;

-- =====================================================================
-- Trigger (jetzt mit explizitem search_path)
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
    NEW.canonical_key := 'name|' || lower(btrim(COALESCE(NEW.normalized_name, NEW.name, '')));
  END IF;
  RETURN NEW;
END;
$$;

-- =====================================================================
-- find_canonical_spot (search_path public, extensions)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.find_canonical_spot(
  p_lat double precision,
  p_lng double precision,
  p_name text,
  p_list_mode text DEFAULT 'location'
)
RETURNS TABLE(
  spot_id uuid, name text, address text, city text, country_code text,
  latitude numeric, longitude numeric, ratings_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
#variable_conflict use_column
DECLARE
  v_key text;
  v_norm text;
  v_max_dist int := 1;
BEGIN
  IF p_list_mode = 'product' THEN
    v_norm := lower(btrim(COALESCE(p_name, '')));
    SELECT e.canonical_key INTO v_key
    FROM public.foodspots e
    WHERE e.canonical_key LIKE 'product|%'
      AND (
        lower(btrim(COALESCE(e.normalized_name, e.name, ''))) = v_norm
        OR (char_length(v_norm) >= 5
            AND levenshtein(lower(btrim(COALESCE(e.normalized_name, e.name, ''))), v_norm) <= v_max_dist)
      )
    ORDER BY levenshtein(lower(btrim(COALESCE(e.normalized_name, e.name, ''))), v_norm) ASC,
             e.created_at ASC
    LIMIT 1;
    v_key := COALESCE(v_key, 'product|' || v_norm);
  ELSIF p_lat IS NOT NULL AND p_lng IS NOT NULL THEN
    v_key := 'geo|' || round(p_lat::numeric, 4)::text || '|' || round(p_lng::numeric, 4)::text;
  ELSIF p_name IS NOT NULL AND btrim(p_name) <> '' THEN
    v_key := 'name|' || lower(btrim(p_name));
  ELSE
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    f.id, f.name::text, f.address, f.city, f.country_code, f.latitude, f.longitude,
    (SELECT count(*)::integer FROM public.foodspots x WHERE x.canonical_key = v_key)
  FROM public.foodspots f
  WHERE f.canonical_key = v_key
  ORDER BY f.created_at ASC
  LIMIT 1;
END;
$$;

-- =====================================================================
-- Backfill erneut (search_path oben gesetzt → levenshtein auffindbar)
-- =====================================================================
DO $$
DECLARE
  r record;
  v_match text;
  v_norm text;
  v_max_dist int := 1;
BEGIN
  FOR r IN
    SELECT f.id, lower(btrim(COALESCE(f.normalized_name, f.name, ''))) AS norm, f.created_at
    FROM public.foodspots f
    JOIN public.lists l ON l.id = f.list_id
    WHERE l.list_mode = 'product'
    ORDER BY f.created_at ASC, f.id ASC
  LOOP
    v_norm := r.norm;
    SELECT e.canonical_key INTO v_match
    FROM public.foodspots e
    WHERE e.canonical_key LIKE 'product|%'
      AND e.id <> r.id
      AND (e.created_at < r.created_at OR (e.created_at = r.created_at AND e.id < r.id))
      AND (
        lower(btrim(COALESCE(e.normalized_name, e.name, ''))) = v_norm
        OR (char_length(v_norm) >= 5
            AND levenshtein(lower(btrim(COALESCE(e.normalized_name, e.name, ''))), v_norm) <= v_max_dist)
      )
    ORDER BY levenshtein(lower(btrim(COALESCE(e.normalized_name, e.name, ''))), v_norm) ASC,
             e.created_at ASC
    LIMIT 1;

    UPDATE public.foodspots
    SET canonical_key = COALESCE(v_match, 'product|' || v_norm)
    WHERE id = r.id;
  END LOOP;
END $$;
