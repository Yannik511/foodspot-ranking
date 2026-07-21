-- Migration 055: FIX "column reference is ambiguous" in allen Discover-Funktionen.
--
-- Ursache: Die RETURNS TABLE(...)-Spaltennamen (list_id, name, category, …) sind
-- zugleich PL/pgSQL-Ausgabe-Variablen. Wo sie im Body unqualifiziert vorkommen
-- (rep-CTE mit DISTINCT ON), ist unklar ob Variable oder Spalte gemeint ist.
-- Lösung: Direktive `#variable_conflict use_column` → immer die Tabellenspalte.
--
-- Diese Datei ersetzt die Discover-Funktionen aus 052/053/054 vollständig
-- (inkl. "eigene Spots einschließen"). Rein CREATE OR REPLACE.

-- =====================================================================
-- get_discover_ranked
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
    SELECT filtered.grp, avg(filtered.rating) AS avg_rating, count(*) AS cnt
    FROM filtered GROUP BY filtered.grp
  ),
  rep AS (
    SELECT DISTINCT ON (filtered.grp)
      filtered.grp, filtered.id, filtered.list_id, filtered.name, filtered.category,
      filtered.address, filtered.city, filtered.country_code,
      filtered.latitude, filtered.longitude, filtered.cover_photo_url
    FROM filtered
    ORDER BY filtered.grp, filtered.created_at ASC
  ),
  computed AS (
    SELECT
      rep.id, rep.grp, rep.list_id, rep.name, rep.category, rep.address, rep.city, rep.country_code,
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
-- get_discover_top_by_category
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
    SELECT filtered.grp, avg(filtered.rating) AS avg_rating, count(*) AS cnt
    FROM filtered GROUP BY filtered.grp
  ),
  rep AS (
    SELECT DISTINCT ON (filtered.grp)
      filtered.grp, filtered.id, filtered.list_id, filtered.name, filtered.category,
      filtered.address, filtered.city, filtered.country_code,
      filtered.latitude, filtered.longitude, filtered.cover_photo_url
    FROM filtered
    ORDER BY filtered.grp, filtered.created_at ASC
  ),
  ranked AS (
    SELECT
      rep.id, rep.grp, rep.list_id, rep.name, rep.category, rep.address, rep.city, rep.country_code,
      rep.latitude, rep.longitude, agg.avg_rating, agg.cnt, rep.cover_photo_url,
      ROW_NUMBER() OVER (PARTITION BY rep.category ORDER BY agg.avg_rating DESC NULLS LAST, agg.cnt DESC) AS rn
    FROM rep JOIN agg ON agg.grp = rep.grp
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
-- get_discover_friends_recent
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_discover_friends_recent(
  p_limit integer DEFAULT 20,
  p_categories text[] DEFAULT NULL,
  p_country_codes text[] DEFAULT NULL,
  p_city text DEFAULT NULL
)
RETURNS TABLE(
  spot_id uuid, canonical_key text, list_id uuid,
  name text, category text, address text, city text, country_code text,
  latitude numeric, longitude numeric,
  rating numeric, avg_rating numeric, ratings_count integer, cover_photo_url text,
  tier text, created_at timestamptz,
  owner_id uuid, owner_username text, owner_avatar text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_me uuid := auth.uid();
BEGIN
  RETURN QUERY
  WITH my_friends AS (
    SELECT CASE WHEN fr.requester_id = v_me THEN fr.addressee_id ELSE fr.requester_id END AS friend_id
    FROM public.friendships fr
    WHERE fr.status = 'accepted' AND (fr.requester_id = v_me OR fr.addressee_id = v_me)
  ),
  agg AS (
    SELECT COALESCE(f2.canonical_key, f2.id::text) AS grp, avg(f2.rating) AS avg_rating, count(*) AS cnt
    FROM public.foodspots f2
    GROUP BY COALESCE(f2.canonical_key, f2.id::text)
  )
  SELECT
    f.id, f.canonical_key, f.list_id, f.name::text, f.category::text, f.address, f.city, f.country_code,
    f.latitude, f.longitude, f.rating, agg.avg_rating, agg.cnt::integer, f.cover_photo_url,
    f.tier::text, f.created_at,
    f.user_id, up.username, up.profile_image_url
  FROM public.foodspots f
  JOIN my_friends mf ON mf.friend_id = f.user_id
  JOIN auth.users au ON au.id = f.user_id
  LEFT JOIN public.user_profiles up ON up.id = f.user_id
  JOIN agg ON agg.grp = COALESCE(f.canonical_key, f.id::text)
  WHERE COALESCE(au.raw_user_meta_data->>'discover_sharing', 'true') <> 'false'
    AND (p_categories IS NULL OR f.category = ANY(p_categories))
    AND (p_country_codes IS NULL OR f.country_code = ANY(p_country_codes))
    AND (p_city IS NULL OR f.city ILIKE p_city)
  ORDER BY f.created_at DESC
  LIMIT GREATEST(p_limit, 1);
END;
$$;

-- =====================================================================
-- find_canonical_spot
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
    v_key := 'geo|' ||
             round(p_lat::numeric, 4)::text || '|' ||
             round(p_lng::numeric, 4)::text || '|' ||
             lower(btrim(COALESCE(p_name, '')));
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
