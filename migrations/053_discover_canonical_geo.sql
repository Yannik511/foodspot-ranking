-- Migration 053: Kanonischer Spot + Geo-Filter + aggregierender Discover-Feed
--
-- REIN ADDITIV: neue Spalten (nullable, mit Default-Backfill) + neue Funktionen.
-- Bestehende Tabellen-Logik, Policies und Merge-Funktionen bleiben unberührt.
-- Ersetzt die Discover-Funktionen aus 052 durch aggregierende Varianten.
--
-- Konzept:
--   * canonical_key = gerundete Koordinaten (~11 m) + normalisierter Name.
--     Gleicher Key = gleicher physischer Spot. In den Feed-Funktionen wird
--     nach diesem Key GRUPPIERT (kein Tabellen-Umbau): eine Karte je Spot,
--     Durchschnitt + Anzahl über alle Nutzer, Adresse vom ältesten Eintrag.
--   * country_code / city werden beim Anlegen vom Client per Reverse-Geocoding
--     gesetzt (MapKit). Alt-Bestand wird separat client-seitig nachgezogen.

-- =====================================================================
-- 1) Spalten
-- =====================================================================
ALTER TABLE public.foodspots ADD COLUMN IF NOT EXISTS canonical_key text;
ALTER TABLE public.foodspots ADD COLUMN IF NOT EXISTS country_code text; -- ISO-3166-1 alpha-2, z. B. 'DE'
ALTER TABLE public.foodspots ADD COLUMN IF NOT EXISTS city text;

-- =====================================================================
-- 2) canonical_key automatisch pflegen (Trigger)
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
    -- Produktbasiert (z. B. Bier): Kanonik NUR über den Namen — Standort irrelevant.
    NEW.canonical_key := 'product|' || lower(btrim(COALESCE(NEW.normalized_name, NEW.name, '')));
  ELSIF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    -- Standortbasiert: Kanonik über gerundete Koordinaten + Name.
    NEW.canonical_key := 'geo|' ||
      round(NEW.latitude, 4)::text || '|' ||
      round(NEW.longitude, 4)::text || '|' ||
      lower(btrim(COALESCE(NEW.normalized_name, NEW.name, '')));
  ELSE
    -- Standortbasiert ohne Koordinaten: keine Kanonik (bleibt Einzel-Eintrag).
    NEW.canonical_key := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_foodspot_canonical_key ON public.foodspots;
CREATE TRIGGER trg_foodspot_canonical_key
  BEFORE INSERT OR UPDATE OF latitude, longitude, normalized_name, name
  ON public.foodspots
  FOR EACH ROW
  EXECUTE FUNCTION public.set_foodspot_canonical_key();

-- Einmaliger Backfill für Bestandsdaten (typabhängig: Produkt=Name, sonst Geo)
UPDATE public.foodspots f
SET canonical_key = CASE
  WHEN l.list_mode = 'product'
    THEN 'product|' || lower(btrim(COALESCE(f.normalized_name, f.name, '')))
  WHEN f.latitude IS NOT NULL AND f.longitude IS NOT NULL
    THEN 'geo|' ||
      round(f.latitude, 4)::text || '|' ||
      round(f.longitude, 4)::text || '|' ||
      lower(btrim(COALESCE(f.normalized_name, f.name, '')))
  ELSE NULL
END
FROM public.lists l
WHERE l.id = f.list_id;

-- =====================================================================
-- 3) Indizes
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_foodspots_canonical_key ON public.foodspots (canonical_key);
CREATE INDEX IF NOT EXISTS idx_foodspots_country_code ON public.foodspots (country_code);
CREATE INDEX IF NOT EXISTS idx_foodspots_city ON public.foodspots (lower(city));
CREATE INDEX IF NOT EXISTS idx_foodspots_category ON public.foodspots (category);

-- =====================================================================
-- 4) get_discover_ranked
--    Aggregierte, gefilterte Spot-Liste. Mit p_lat/p_lng → Distanz-Sortierung
--    ("In deiner Nähe"); ohne → Sortierung nach Bewertung ("beste Spots in …").
--    KEIN Owner (Name/Avatar nur in "Neu von Freunden").
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_discover_ranked(
  p_lat double precision DEFAULT NULL,
  p_lng double precision DEFAULT NULL,
  p_categories text[] DEFAULT NULL,
  p_country_codes text[] DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_limit integer DEFAULT 30,
  p_radius_km double precision DEFAULT 25   -- "In deiner Nähe": Umkreis (nur mit p_lat/p_lng aktiv)
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
    WHERE f.user_id <> auth.uid()
      AND COALESCE(au.raw_user_meta_data->>'discover_sharing', 'true') <> 'false'
      AND (p_categories IS NULL OR f.category = ANY(p_categories))
      AND (p_country_codes IS NULL OR f.country_code = ANY(p_country_codes))
      AND (p_city IS NULL OR f.city ILIKE p_city)
      -- Standort-Sortierung nur mit Koordinaten
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
    ORDER BY grp, created_at ASC   -- Repräsentant = ältester Eintrag (Erst-Ersteller)
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
    -- Nicht-Nähe-Modus (kein Standort/kein Radius): kein Distanz-Filter
    (p_lat IS NULL OR p_lng IS NULL OR p_radius_km IS NULL)
    -- Nähe-Modus: Spot liegt im Umkreis …
    OR c.distance_km <= p_radius_km
    -- … oder es liegt GAR NICHTS im Umkreis → weicher Fallback: nächstgelegene
    OR NOT EXISTS (
      SELECT 1 FROM computed c2
      WHERE c2.distance_km IS NOT NULL AND c2.distance_km <= p_radius_km
    )
  ORDER BY
    c.distance_km ASC NULLS LAST,    -- ohne Standort sind alle NULL → egal
    c.avg_rating DESC NULLS LAST,
    c.cnt DESC
  LIMIT GREATEST(p_limit, 1);
END;
$$;

ALTER FUNCTION public.get_discover_ranked(double precision, double precision, text[], text[], text, integer, double precision) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.get_discover_ranked(double precision, double precision, text[], text[], text, integer, double precision) TO authenticated;

-- =====================================================================
-- 5) get_discover_top_by_category — pro Kategorie Top-N (aggregiert, gefiltert)
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
BEGIN
  RETURN QUERY
  WITH filtered AS (
    SELECT f.*, COALESCE(f.canonical_key, f.id::text) AS grp
    FROM public.foodspots f
    JOIN auth.users au ON au.id = f.user_id
    WHERE f.user_id <> auth.uid()
      AND COALESCE(au.raw_user_meta_data->>'discover_sharing', 'true') <> 'false'
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

ALTER FUNCTION public.get_discover_top_by_category(integer, text[], text[], text) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.get_discover_top_by_category(integer, text[], text[], text) TO authenticated;

-- =====================================================================
-- 6) get_discover_friends_recent — pro Eintrag (Owner sichtbar!), gefiltert
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
DECLARE
  v_me uuid := auth.uid();
BEGIN
  RETURN QUERY
  WITH my_friends AS (
    SELECT CASE WHEN fr.requester_id = v_me THEN fr.addressee_id ELSE fr.requester_id END AS friend_id
    FROM public.friendships fr
    WHERE fr.status = 'accepted' AND (fr.requester_id = v_me OR fr.addressee_id = v_me)
  ),
  -- Aggregat je kanonischem Spot für Durchschnitt/Anzahl (über ALLE Nutzer)
  agg AS (
    SELECT COALESCE(canonical_key, id::text) AS grp, avg(rating) AS avg_rating, count(*) AS cnt
    FROM public.foodspots
    GROUP BY COALESCE(canonical_key, id::text)
  )
  SELECT
    f.id, f.canonical_key, f.list_id, f.name::text, f.category::text, f.address, f.city, f.country_code,
    f.latitude, f.longitude, f.rating, a.avg_rating, a.cnt::integer, f.cover_photo_url,
    f.tier::text, f.created_at,
    f.user_id, up.username, up.profile_image_url
  FROM public.foodspots f
  JOIN my_friends mf ON mf.friend_id = f.user_id
  JOIN auth.users au ON au.id = f.user_id
  LEFT JOIN public.user_profiles up ON up.id = f.user_id
  JOIN agg a ON a.grp = COALESCE(f.canonical_key, f.id::text)
  WHERE COALESCE(au.raw_user_meta_data->>'discover_sharing', 'true') <> 'false'
    AND (p_categories IS NULL OR f.category = ANY(p_categories))
    AND (p_country_codes IS NULL OR f.country_code = ANY(p_country_codes))
    AND (p_city IS NULL OR f.city ILIKE p_city)
  ORDER BY f.created_at DESC
  LIMIT GREATEST(p_limit, 1);
END;
$$;

ALTER FUNCTION public.get_discover_friends_recent(integer, text[], text[], text) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.get_discover_friends_recent(integer, text[], text[], text) TO authenticated;

-- =====================================================================
-- 7) find_canonical_spot — Dedup-Check beim Anlegen (Task 3)
--    Gibt den ältesten bestehenden Spot mit gleichem canonical_key zurück
--    (RLS-unabhängig), damit der Client vor dem Insert warnen/verknüpfen kann.
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
DECLARE
  v_key text;
BEGIN
  IF p_list_mode = 'product' THEN
    -- Produkt: Kanonik nur über den Namen
    v_key := 'product|' || lower(btrim(COALESCE(p_name, '')));
  ELSIF p_lat IS NOT NULL AND p_lng IS NOT NULL THEN
    v_key := 'geo|' ||
             round(p_lat::numeric, 4)::text || '|' ||
             round(p_lng::numeric, 4)::text || '|' ||
             lower(btrim(COALESCE(p_name, '')));
  ELSE
    RETURN; -- standortbasiert ohne Koordinaten → keine Kanonik-Prüfung
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

ALTER FUNCTION public.find_canonical_spot(double precision, double precision, text, text) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.find_canonical_spot(double precision, double precision, text, text) TO authenticated;
