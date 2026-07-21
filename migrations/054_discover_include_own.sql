-- Migration 054: Eigene Spots im Entdecken-Feed NICHT mehr ausschließen.
-- Grund: bei kleiner Nutzerbasis (und im Test) gehören fast alle Spots dem
-- eingeloggten Nutzer → Feed war leer. Discover zeigt jetzt ALLE freigegebenen
-- Spots (inkl. eigene). "Neu von Freunden" bleibt naturgemäß fremd (Join über Freunde).
--
-- Nur CREATE OR REPLACE der beiden Aggregat-Funktionen. Rein additiv.

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
    SELECT grp, avg(rating) AS avg_rating, count(*) AS cnt
    FROM filtered GROUP BY grp
  ),
  rep AS (
    SELECT DISTINCT ON (grp)
      grp, id, list_id, name, category, address, city, country_code,
      latitude, longitude, cover_photo_url
    FROM filtered
    ORDER BY grp, created_at ASC
  ),
  computed AS (
    SELECT
      r.id, r.grp, r.list_id, r.name, r.category, r.address, r.city, r.country_code,
      r.latitude, r.longitude, a.avg_rating, a.cnt, r.cover_photo_url,
      CASE
        WHEN p_lat IS NULL OR p_lng IS NULL OR r.latitude IS NULL OR r.longitude IS NULL
          THEN NULL::double precision
        ELSE 6371 * acos(least(1, greatest(-1,
          sin(radians(p_lat)) * sin(radians(r.latitude::double precision)) +
          cos(radians(p_lat)) * cos(radians(r.latitude::double precision)) *
          cos(radians(r.longitude::double precision - p_lng))
        )))
      END AS distance_km
    FROM rep r
    JOIN agg a ON a.grp = r.grp
  )
  SELECT
    c.id, c.grp, c.list_id, c.name::text, c.category::text, c.address, c.city, c.country_code,
    c.latitude, c.longitude, c.avg_rating, c.cnt::integer, c.cover_photo_url, c.distance_km
  FROM computed c
  WHERE
    (p_lat IS NULL OR p_lng IS NULL OR p_radius_km IS NULL)
    OR c.distance_km <= p_radius_km
    OR NOT EXISTS (SELECT 1 FROM computed c2 WHERE c2.distance_km IS NOT NULL AND c2.distance_km <= p_radius_km)
  ORDER BY
    c.distance_km ASC NULLS LAST,
    c.avg_rating DESC NULLS LAST,
    c.cnt DESC
  LIMIT GREATEST(p_limit, 1);
END;
$$;

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
    SELECT grp, avg(rating) AS avg_rating, count(*) AS cnt
    FROM filtered GROUP BY grp
  ),
  rep AS (
    SELECT DISTINCT ON (grp)
      grp, id, list_id, name, category, address, city, country_code,
      latitude, longitude, cover_photo_url
    FROM filtered
    ORDER BY grp, created_at ASC
  ),
  ranked AS (
    SELECT
      r.id, r.grp, r.list_id, r.name, r.category, r.address, r.city, r.country_code,
      r.latitude, r.longitude, a.avg_rating, a.cnt, r.cover_photo_url,
      ROW_NUMBER() OVER (PARTITION BY r.category ORDER BY a.avg_rating DESC NULLS LAST, a.cnt DESC) AS rn
    FROM rep r JOIN agg a ON a.grp = r.grp
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
