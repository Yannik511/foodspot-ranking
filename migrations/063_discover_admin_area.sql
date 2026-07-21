-- Migration 063: Standort-Filter um Bundesland-Ebene erweitern (Feature 1, Variante C).
--
-- MapKit liefert pro Koordinate KEINEN Landkreis (kein subAdministrativeArea),
-- aber Land (countryCode), Bundesland (administrativeArea) und Stadt (locality).
-- Der Client speichert diese ab jetzt in foodspots. Hier:
--   1) neue Spalte admin_area (Bundesland),
--   2) die drei Discover-RPCs so, dass der Text-Filter p_city sowohl gegen
--      city ALS AUCH gegen admin_area matcht → "München" trifft die Stadt,
--      "Bayern" das Bundesland. Land bleibt über p_country_codes (Chips).
--
-- Basis unverändert aus 059 übernommen; einzige Änderung: die p_city-Filterzeile
-- in filtered/friend_spots. country_code/city existieren seit 053.
--
-- HINWEIS: admin_area/city/country_code werden nur beim Anlegen/Bearbeiten
-- (Client-Reverse-Geocoding) gefüllt. Bestandsspots ohne diese Felder erscheinen
-- weiter nur im "Weltweit"-Modus, bis sie neu gespeichert werden.

ALTER TABLE public.foodspots ADD COLUMN IF NOT EXISTS admin_area text; -- Bundesland, z. B. 'Bayern'
CREATE INDEX IF NOT EXISTS idx_foodspots_admin_area ON public.foodspots (lower(admin_area));

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
      AND (p_city IS NULL OR f.city ILIKE p_city OR f.admin_area ILIKE p_city)
      AND (p_lat IS NULL OR p_lng IS NULL OR (f.latitude IS NOT NULL AND f.longitude IS NOT NULL))
  ),
  keys AS ( SELECT DISTINCT filtered.grp AS grp FROM filtered ),
  indiv AS (
    -- geteilte Einzelbewertungen
    SELECT COALESCE(f.canonical_key, f.id::text) AS ck, fr.user_id AS uid, fr.score AS score
    FROM public.foodspot_ratings fr
    JOIN public.foodspots f ON f.id = fr.foodspot_id
    WHERE COALESCE(f.canonical_key, f.id::text) IN (SELECT grp FROM keys)
    UNION ALL
    -- private Bewertungen (Zeilen ohne foodspot_ratings)
    SELECT COALESCE(f.canonical_key, f.id::text) AS ck, f.user_id AS uid, f.rating AS score
    FROM public.foodspots f
    WHERE f.rating IS NOT NULL
      AND COALESCE(f.canonical_key, f.id::text) IN (SELECT grp FROM keys)
      AND NOT EXISTS (SELECT 1 FROM public.foodspot_ratings fr2 WHERE fr2.foodspot_id = f.id)
  ),
  per_person AS (
    SELECT indiv.ck AS ck, indiv.uid AS uid, avg(indiv.score) AS person_score
    FROM indiv GROUP BY indiv.ck, indiv.uid
  ),
  agg AS (
    SELECT per_person.ck AS grp, avg(per_person.person_score) AS avg_rating, count(*) AS cnt
    FROM per_person GROUP BY per_person.ck
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
      AND (p_city IS NULL OR f.city ILIKE p_city OR f.admin_area ILIKE p_city)
  ),
  keys AS ( SELECT DISTINCT filtered.grp AS grp FROM filtered ),
  indiv AS (
    SELECT COALESCE(f.canonical_key, f.id::text) AS ck, fr.user_id AS uid, fr.score AS score
    FROM public.foodspot_ratings fr
    JOIN public.foodspots f ON f.id = fr.foodspot_id
    WHERE COALESCE(f.canonical_key, f.id::text) IN (SELECT grp FROM keys)
    UNION ALL
    SELECT COALESCE(f.canonical_key, f.id::text) AS ck, f.user_id AS uid, f.rating AS score
    FROM public.foodspots f
    WHERE f.rating IS NOT NULL
      AND COALESCE(f.canonical_key, f.id::text) IN (SELECT grp FROM keys)
      AND NOT EXISTS (SELECT 1 FROM public.foodspot_ratings fr2 WHERE fr2.foodspot_id = f.id)
  ),
  per_person AS (
    SELECT indiv.ck AS ck, indiv.uid AS uid, avg(indiv.score) AS person_score
    FROM indiv GROUP BY indiv.ck, indiv.uid
  ),
  agg AS (
    SELECT per_person.ck AS grp, avg(per_person.person_score) AS avg_rating, count(*) AS cnt
    FROM per_person GROUP BY per_person.ck
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
  friend_spots AS (
    SELECT f.*, COALESCE(f.canonical_key, f.id::text) AS grp
    FROM public.foodspots f
    JOIN my_friends mf ON mf.friend_id = f.user_id
    JOIN auth.users au ON au.id = f.user_id
    WHERE COALESCE(au.raw_user_meta_data->>'discover_sharing', 'true') <> 'false'
      AND (p_categories IS NULL OR f.category = ANY(p_categories))
      AND (p_country_codes IS NULL OR f.country_code = ANY(p_country_codes))
      AND (p_city IS NULL OR f.city ILIKE p_city OR f.admin_area ILIKE p_city)
  ),
  keys AS ( SELECT DISTINCT friend_spots.grp AS grp FROM friend_spots ),
  indiv AS (
    SELECT COALESCE(f.canonical_key, f.id::text) AS ck, fr.user_id AS uid, fr.score AS score
    FROM public.foodspot_ratings fr
    JOIN public.foodspots f ON f.id = fr.foodspot_id
    WHERE COALESCE(f.canonical_key, f.id::text) IN (SELECT grp FROM keys)
    UNION ALL
    SELECT COALESCE(f.canonical_key, f.id::text) AS ck, f.user_id AS uid, f.rating AS score
    FROM public.foodspots f
    WHERE f.rating IS NOT NULL
      AND COALESCE(f.canonical_key, f.id::text) IN (SELECT grp FROM keys)
      AND NOT EXISTS (SELECT 1 FROM public.foodspot_ratings fr2 WHERE fr2.foodspot_id = f.id)
  ),
  per_person AS (
    SELECT indiv.ck AS ck, indiv.uid AS uid, avg(indiv.score) AS person_score
    FROM indiv GROUP BY indiv.ck, indiv.uid
  ),
  agg AS (
    SELECT per_person.ck AS grp, avg(per_person.person_score) AS avg_rating, count(*) AS cnt
    FROM per_person GROUP BY per_person.ck
  )
  SELECT
    fs.id, fs.canonical_key, fs.list_id, fs.name::text, fs.category::text, fs.address, fs.city, fs.country_code,
    fs.latitude, fs.longitude, fs.rating, agg.avg_rating, agg.cnt::integer, fs.cover_photo_url,
    fs.tier::text, fs.created_at,
    fs.user_id, up.username, up.profile_image_url
  FROM friend_spots fs
  LEFT JOIN public.user_profiles up ON up.id = fs.user_id
  JOIN agg ON agg.grp = fs.grp
  ORDER BY fs.created_at DESC
  LIMIT GREATEST(p_limit, 1);
END;
$$;
