-- Migration 057: Standort-primäre Kanonik + Mehrheitsname in der Anzeige.
--
-- Neue canonical_key-Logik (typabhängig):
--   * Produkt (list_mode='product')            → 'product|' + normalized_name
--   * Standort MIT Koordinaten                 → 'geo|' + round(lat,4) + '|' + round(lng,4)   (NAME egal!)
--   * Standort OHNE Koordinaten (nur getippt)  → 'name|' + normalized_name                    (Fallback)
--
-- Dadurch werden Spots am selben Ort zusammengeführt, auch wenn sie
-- unterschiedlich benannt wurden ("Sendling Spezial" vs "Sendling Döner").
-- Angezeigter Name = der von den meisten Einträgen genutzte (Mehrheit),
-- Adresse/Koordinaten = ältester Eintrag (stabil).
--
-- Rein CREATE OR REPLACE + Trigger-Update + Backfill. Signaturen unverändert.

-- =====================================================================
-- 1) Trigger: neue Schlüssel-Logik
-- =====================================================================
CREATE OR REPLACE FUNCTION public.set_foodspot_canonical_key()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_mode text;
BEGIN
  SELECT l.list_mode INTO v_mode FROM public.lists l WHERE l.id = NEW.list_id;

  IF v_mode = 'product' THEN
    NEW.canonical_key := 'product|' || lower(btrim(COALESCE(NEW.normalized_name, NEW.name, '')));
  ELSIF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    -- Standort-primär: nur Koordinaten, Name spielt keine Rolle
    NEW.canonical_key := 'geo|' || round(NEW.latitude, 4)::text || '|' || round(NEW.longitude, 4)::text;
  ELSE
    -- Standort ohne Koordinaten: Fallback über den Namen
    NEW.canonical_key := 'name|' || lower(btrim(COALESCE(NEW.normalized_name, NEW.name, '')));
  END IF;
  RETURN NEW;
END;
$$;

-- =====================================================================
-- 2) Backfill (typabhängig)
-- =====================================================================
UPDATE public.foodspots f
SET canonical_key = CASE
  WHEN l.list_mode = 'product'
    THEN 'product|' || lower(btrim(COALESCE(f.normalized_name, f.name, '')))
  WHEN f.latitude IS NOT NULL AND f.longitude IS NOT NULL
    THEN 'geo|' || round(f.latitude, 4)::text || '|' || round(f.longitude, 4)::text
  ELSE
    'name|' || lower(btrim(COALESCE(f.normalized_name, f.name, '')))
END
FROM public.lists l
WHERE l.id = f.list_id;

-- =====================================================================
-- 3) get_discover_ranked — Mehrheitsname
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_discover_ranked(
  p_lat double precision DEFAULT NULL,
  p_lng double precision DEFAULT NULL,
  p_categories text[] DEFAULT NULL,
  p_country_codes text[] DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_limit integer DEFAULT 30,
  p_radius_km double precision DEFAULT 25
)
RETURNS TABLE(
  spot_id uuid, canonical_key text, list_id uuid,
  name text, category text, address text, city text, country_code text,
  latitude numeric, longitude numeric,
  avg_rating numeric, ratings_count integer, cover_photo_url text,
  distance_km double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  RETURN QUERY
  WITH filtered AS (
    SELECT f.*, COALESCE(f.canonical_key, f.id::text) AS grp
    FROM public.foodspots f
    JOIN auth.users au ON au.id = f.user_id
    WHERE COALESCE(au.raw_user_meta_data->>'discover_sharing', 'true') <> 'false'
      AND (p_categories IS NULL OR f.category = ANY(p_categories))
      AND (p_country_codes IS NULL OR f.country_code = ANY(p_country_codes))
      AND (p_city IS NULL OR f.city ILIKE p_city)
      AND (p_lat IS NULL OR p_lng IS NULL OR (f.latitude IS NOT NULL AND f.longitude IS NOT NULL))
  ),
  agg AS (
    SELECT
      filtered.grp,
      SUM(COALESCE(filtered.avg_score, filtered.rating) * GREATEST(COALESCE(filtered.ratings_count, 0), 1))
        / NULLIF(SUM(GREATEST(COALESCE(filtered.ratings_count, 0), 1)), 0) AS avg_rating,
      SUM(GREATEST(COALESCE(filtered.ratings_count, 0), 1)) AS cnt
    FROM filtered GROUP BY filtered.grp
  ),
  name_pick AS (
    SELECT t.grp, t.name FROM (
      SELECT filtered.grp AS grp, filtered.name AS name,
        ROW_NUMBER() OVER (PARTITION BY filtered.grp ORDER BY COUNT(*) DESC, MIN(filtered.created_at) ASC) AS rn
      FROM filtered GROUP BY filtered.grp, filtered.name
    ) t WHERE t.rn = 1
  ),
  rep AS (
    SELECT DISTINCT ON (filtered.grp)
      filtered.grp, filtered.id, filtered.list_id, filtered.category,
      filtered.address, filtered.city, filtered.country_code,
      filtered.latitude, filtered.longitude, filtered.cover_photo_url
    FROM filtered
    ORDER BY filtered.grp, filtered.created_at ASC
  ),
  computed AS (
    SELECT
      rep.id, rep.grp, rep.list_id, np.name, rep.category, rep.address, rep.city, rep.country_code,
      rep.latitude, rep.longitude, agg.avg_rating, agg.cnt, rep.cover_photo_url,
      CASE
        WHEN p_lat IS NULL OR p_lng IS NULL OR rep.latitude IS NULL OR rep.longitude IS NULL
          THEN NULL::double precision
        ELSE 6371 * acos(least(1, greatest(-1,
          sin(radians(p_lat)) * sin(radians(rep.latitude::double precision)) +
          cos(radians(p_lat)) * cos(radians(rep.latitude::double precision)) *
          cos(radians(rep.longitude::double precision - p_lng))
        )))
      END AS distance_km
    FROM rep
    JOIN agg ON agg.grp = rep.grp
    JOIN name_pick np ON np.grp = rep.grp
  )
  SELECT
    computed.id, computed.grp, computed.list_id, computed.name::text, computed.category::text,
    computed.address, computed.city, computed.country_code,
    computed.latitude, computed.longitude, computed.avg_rating, computed.cnt::integer,
    computed.cover_photo_url, computed.distance_km
  FROM computed
  WHERE
    (p_lat IS NULL OR p_lng IS NULL OR p_radius_km IS NULL)
    OR computed.distance_km <= p_radius_km
    OR NOT EXISTS (SELECT 1 FROM computed c2 WHERE c2.distance_km IS NOT NULL AND c2.distance_km <= p_radius_km)
  ORDER BY
    computed.distance_km ASC NULLS LAST,
    computed.avg_rating DESC NULLS LAST,
    computed.cnt DESC
  LIMIT GREATEST(p_limit, 1);
END;
$$;

-- =====================================================================
-- 4) get_discover_top_by_category — Mehrheitsname
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_discover_top_by_category(
  p_per_category integer DEFAULT 10,
  p_categories text[] DEFAULT NULL,
  p_country_codes text[] DEFAULT NULL,
  p_city text DEFAULT NULL
)
RETURNS TABLE(
  spot_id uuid, canonical_key text, list_id uuid,
  name text, category text, address text, city text, country_code text,
  latitude numeric, longitude numeric,
  avg_rating numeric, ratings_count integer, cover_photo_url text,
  category_rank integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  RETURN QUERY
  WITH filtered AS (
    SELECT f.*, COALESCE(f.canonical_key, f.id::text) AS grp
    FROM public.foodspots f
    JOIN auth.users au ON au.id = f.user_id
    WHERE COALESCE(au.raw_user_meta_data->>'discover_sharing', 'true') <> 'false'
      AND f.category IS NOT NULL
      AND (p_categories IS NULL OR f.category = ANY(p_categories))
      AND (p_country_codes IS NULL OR f.country_code = ANY(p_country_codes))
      AND (p_city IS NULL OR f.city ILIKE p_city)
  ),
  agg AS (
    SELECT
      filtered.grp,
      SUM(COALESCE(filtered.avg_score, filtered.rating) * GREATEST(COALESCE(filtered.ratings_count, 0), 1))
        / NULLIF(SUM(GREATEST(COALESCE(filtered.ratings_count, 0), 1)), 0) AS avg_rating,
      SUM(GREATEST(COALESCE(filtered.ratings_count, 0), 1)) AS cnt
    FROM filtered GROUP BY filtered.grp
  ),
  name_pick AS (
    SELECT t.grp, t.name FROM (
      SELECT filtered.grp AS grp, filtered.name AS name,
        ROW_NUMBER() OVER (PARTITION BY filtered.grp ORDER BY COUNT(*) DESC, MIN(filtered.created_at) ASC) AS rn
      FROM filtered GROUP BY filtered.grp, filtered.name
    ) t WHERE t.rn = 1
  ),
  rep AS (
    SELECT DISTINCT ON (filtered.grp)
      filtered.grp, filtered.id, filtered.list_id, filtered.category,
      filtered.address, filtered.city, filtered.country_code,
      filtered.latitude, filtered.longitude, filtered.cover_photo_url
    FROM filtered
    ORDER BY filtered.grp, filtered.created_at ASC
  ),
  ranked AS (
    SELECT
      rep.id, rep.grp, rep.list_id, np.name, rep.category, rep.address, rep.city, rep.country_code,
      rep.latitude, rep.longitude, agg.avg_rating, agg.cnt, rep.cover_photo_url,
      ROW_NUMBER() OVER (PARTITION BY rep.category ORDER BY agg.avg_rating DESC NULLS LAST, agg.cnt DESC) AS rn
    FROM rep
    JOIN agg ON agg.grp = rep.grp
    JOIN name_pick np ON np.grp = rep.grp
  )
  SELECT
    ranked.id, ranked.grp, ranked.list_id, ranked.name::text, ranked.category::text,
    ranked.address, ranked.city, ranked.country_code,
    ranked.latitude, ranked.longitude, ranked.avg_rating, ranked.cnt::integer,
    ranked.cover_photo_url, ranked.rn::integer
  FROM ranked
  WHERE ranked.rn <= GREATEST(p_per_category, 1)
  ORDER BY ranked.category ASC, ranked.rn ASC;
END;
$$;

-- =====================================================================
-- 5) find_canonical_spot — neue Schlüssel-Logik (Dedup beim Anlegen)
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
BEGIN
  IF p_list_mode = 'product' THEN
    v_key := 'product|' || lower(btrim(COALESCE(p_name, '')));
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
