-- Migration 052: Entdecken-Tab (Discover) — Feed-Funktionen
--
-- REIN ADDITIV. Es werden KEINE bestehenden Tabellen, Spalten, Policies oder
-- Funktionen geändert. Nur drei neue SECURITY-DEFINER-Funktionen kommen hinzu.
--
-- Sichtbarkeits-Flag "discover_sharing":
--   Wird — exakt wie das bestehende "profile_visibility" — in
--   auth.users.raw_user_meta_data gespeichert (kein neues Tabellenfeld).
--   Default = an: fehlt der Wed, gilt der Nutzer als opt-in ('true').
--   Nur Spots von Usern mit discover_sharing != 'false' erscheinen im Feed.
--
-- Alle Funktionen:
--   * laufen als SECURITY DEFINER (dürfen fremde Spots lesen, RLS-unabhängig),
--   * schließen die eigenen Spots des Aufrufers aus,
--   * geben eine einheitliche Spaltenform zurück (wiederverwendbares Card-Mapping),
--   * sind idempotent via CREATE OR REPLACE.

-- =====================================================================
-- 1) "In deiner Nähe" — nach Distanz (Haversine), sonst nach Bewertung
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_discover_nearby(
  p_lat double precision DEFAULT NULL,
  p_lng double precision DEFAULT NULL,
  p_limit integer DEFAULT 20
)
RETURNS TABLE(
  spot_id uuid,
  list_id uuid,
  name text,
  category text,
  tier text,
  rating numeric,
  avg_score numeric,
  ratings_count integer,
  cover_photo_url text,
  latitude numeric,
  longitude numeric,
  address text,
  created_at timestamptz,
  owner_id uuid,
  owner_username text,
  owner_avatar text,
  distance_km double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    f.id, f.list_id, f.name::text, f.category::text, f.tier::text,
    f.rating, f.avg_score, f.ratings_count, f.cover_photo_url,
    f.latitude, f.longitude, f.address, f.created_at,
    f.user_id, up.username, up.profile_image_url,
    CASE
      WHEN p_lat IS NULL OR p_lng IS NULL OR f.latitude IS NULL OR f.longitude IS NULL
        THEN NULL::double precision
      ELSE 6371 * acos(least(1, greatest(-1,
        sin(radians(p_lat)) * sin(radians(f.latitude::double precision)) +
        cos(radians(p_lat)) * cos(radians(f.latitude::double precision)) *
        cos(radians(f.longitude::double precision - p_lng))
      )))
    END AS distance_km
  FROM public.foodspots f
  JOIN auth.users au ON au.id = f.user_id
  LEFT JOIN public.user_profiles up ON up.id = f.user_id
  WHERE f.user_id <> auth.uid()
    AND COALESCE(au.raw_user_meta_data->>'discover_sharing', 'true') <> 'false'
    -- "In deiner Nähe" nur mit Koordinaten (sofern der Aufrufer Standort hat)
    AND (p_lat IS NULL OR p_lng IS NULL OR (f.latitude IS NOT NULL AND f.longitude IS NOT NULL))
  ORDER BY
    distance_km ASC NULLS LAST,
    f.rating DESC NULLS LAST,
    f.ratings_count DESC
  LIMIT GREATEST(p_limit, 1);
END;
$$;

ALTER FUNCTION public.get_discover_nearby(double precision, double precision, integer) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.get_discover_nearby(double precision, double precision, integer) TO authenticated;

-- =====================================================================
-- 2) "Top nach Kategorie" — pro Kategorie die bestbewerteten Spots
--    (window-basiert, damit keine Kategorie den Feed dominiert)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_discover_top_by_category(
  p_per_category integer DEFAULT 8
)
RETURNS TABLE(
  spot_id uuid,
  list_id uuid,
  name text,
  category text,
  tier text,
  rating numeric,
  avg_score numeric,
  ratings_count integer,
  cover_photo_url text,
  latitude numeric,
  longitude numeric,
  address text,
  created_at timestamptz,
  owner_id uuid,
  owner_username text,
  owner_avatar text,
  category_rank integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH ranked AS (
    SELECT
      f.id, f.list_id, f.name::text AS name, f.category::text AS category, f.tier::text AS tier,
      f.rating, f.avg_score, f.ratings_count, f.cover_photo_url,
      f.latitude, f.longitude, f.address, f.created_at,
      f.user_id, up.username, up.profile_image_url,
      ROW_NUMBER() OVER (
        PARTITION BY f.category
        ORDER BY f.rating DESC NULLS LAST, f.ratings_count DESC, f.created_at DESC
      ) AS rn
    FROM public.foodspots f
    JOIN auth.users au ON au.id = f.user_id
    LEFT JOIN public.user_profiles up ON up.id = f.user_id
    WHERE f.user_id <> auth.uid()
      AND COALESCE(au.raw_user_meta_data->>'discover_sharing', 'true') <> 'false'
      AND f.category IS NOT NULL
  )
  SELECT
    ranked.id, ranked.list_id, ranked.name, ranked.category, ranked.tier,
    ranked.rating, ranked.avg_score, ranked.ratings_count, ranked.cover_photo_url,
    ranked.latitude, ranked.longitude, ranked.address, ranked.created_at,
    ranked.user_id, ranked.username, ranked.profile_image_url,
    ranked.rn::integer
  FROM ranked
  WHERE ranked.rn <= GREATEST(p_per_category, 1)
  ORDER BY ranked.category ASC, ranked.rn ASC;
END;
$$;

ALTER FUNCTION public.get_discover_top_by_category(integer) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.get_discover_top_by_category(integer) TO authenticated;

-- =====================================================================
-- 3) "Neu von Freunden" — zuletzt hinzugefügte Spots aus dem Freundeskreis
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_discover_friends_recent(
  p_limit integer DEFAULT 20
)
RETURNS TABLE(
  spot_id uuid,
  list_id uuid,
  name text,
  category text,
  tier text,
  rating numeric,
  avg_score numeric,
  ratings_count integer,
  cover_photo_url text,
  latitude numeric,
  longitude numeric,
  address text,
  created_at timestamptz,
  owner_id uuid,
  owner_username text,
  owner_avatar text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
BEGIN
  RETURN QUERY
  WITH my_friends AS (
    SELECT CASE WHEN fr.requester_id = v_me THEN fr.addressee_id ELSE fr.requester_id END AS friend_id
    FROM public.friendships fr
    WHERE fr.status = 'accepted'
      AND (fr.requester_id = v_me OR fr.addressee_id = v_me)
  )
  SELECT
    f.id, f.list_id, f.name::text, f.category::text, f.tier::text,
    f.rating, f.avg_score, f.ratings_count, f.cover_photo_url,
    f.latitude, f.longitude, f.address, f.created_at,
    f.user_id, up.username, up.profile_image_url
  FROM public.foodspots f
  JOIN my_friends mf ON mf.friend_id = f.user_id
  JOIN auth.users au ON au.id = f.user_id
  LEFT JOIN public.user_profiles up ON up.id = f.user_id
  WHERE COALESCE(au.raw_user_meta_data->>'discover_sharing', 'true') <> 'false'
  ORDER BY f.created_at DESC
  LIMIT GREATEST(p_limit, 1);
END;
$$;

ALTER FUNCTION public.get_discover_friends_recent(integer) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.get_discover_friends_recent(integer) TO authenticated;
