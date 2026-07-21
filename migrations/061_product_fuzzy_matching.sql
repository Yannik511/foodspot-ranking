-- Migration 061: Toleranter Namensabgleich für PRODUKT-Spots (Tippfehler).
--
-- Ziel: "Guiness" und "Guinness" gelten als dasselbe Produkt.
-- Ansatz: Beim Anlegen eines Produkt-Spots wird der Name gegen bestehende
-- Produkt-Spots gematcht (Levenshtein-Distanz). Passt einer nahe genug, wird
-- dessen canonical_key übernommen (erste Schreibweise = kanonisch), sonst neu.
--
-- Schwelle v_max_dist = 1 (klare Einzel-Tippfehler). char_length >= 5 als Schutz,
-- damit kurze Wörter (z. B. "Hell" vs "Helles", Distanz 2) NICHT fälschlich mergen.
-- Nur Produkte betroffen; Standort-Spots bleiben koordinatenbasiert.

-- =====================================================================
-- 0) Extensions (Levenshtein + Trigram)
-- =====================================================================
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Trigram-Index für schnelle Ähnlichkeitssuche (optional, hilft bei Wachstum)
CREATE INDEX IF NOT EXISTS idx_foodspots_normname_trgm
  ON public.foodspots USING gin (lower(btrim(normalized_name)) gin_trgm_ops);

-- =====================================================================
-- 1) Trigger: Produkt-Schlüssel mit Fuzzy-Auflösung
-- =====================================================================
CREATE OR REPLACE FUNCTION public.set_foodspot_canonical_key()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_mode text;
  v_norm text;
  v_match text;
  v_max_dist int := 1;  -- tunbar: 1 = nur klare Einzel-Tippfehler
BEGIN
  SELECT l.list_mode INTO v_mode FROM public.lists l WHERE l.id = NEW.list_id;

  IF v_mode = 'product' THEN
    v_norm := lower(btrim(COALESCE(NEW.normalized_name, NEW.name, '')));
    -- ähnlichsten bestehenden Produkt-Schlüssel suchen
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
-- 2) Backfill: bestehende Produkt-Duplikate clustern
--    (chronologisch: die früheste Schreibweise wird kanonisch, spätere
--     ähnliche übernehmen deren Schlüssel)
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

-- =====================================================================
-- 3) find_canonical_spot: Fuzzy auch beim Anlegen-Dedup (für später)
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
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_key text;
  v_norm text;
  v_max_dist int := 1;
BEGIN
  IF p_list_mode = 'product' THEN
    v_norm := lower(btrim(COALESCE(p_name, '')));
    -- passenden bestehenden Produkt-Schlüssel per Fuzzy finden
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
