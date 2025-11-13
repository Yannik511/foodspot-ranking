-- =============================================
-- MIGRATION 031 V2: Restore Profile Functions & Fix Visibility
-- =============================================
-- Erstellt die fehlenden RPC-Funktionen und setzt
-- profile_visibility für alle User auf 'friends'
-- =============================================

-- 1. Lösche existierende Funktionen (falls vorhanden)
DROP FUNCTION IF EXISTS get_user_profile(UUID);
DROP FUNCTION IF EXISTS get_user_stats(UUID);

-- 2. RPC-Funktion: get_user_profile
-- Diese Funktion gibt das Profil eines Users zurück
CREATE OR REPLACE FUNCTION get_user_profile(user_id UUID)
RETURNS TABLE (
  id UUID,
  username TEXT,
  profile_image_url TEXT,
  profile_visibility TEXT,
  bio TEXT,
  email TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) 
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    up.id,
    up.username,
    up.profile_image_url,
    up.profile_visibility,
    up.bio,
    up.email,
    up.created_at,
    up.updated_at
  FROM user_profiles up
  WHERE up.id = user_id;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_user_profile(UUID) TO authenticated;

-- 3. RPC-Funktion: get_user_stats
-- Diese Funktion gibt die Statistiken eines Users zurück
CREATE OR REPLACE FUNCTION get_user_stats(target_user_id UUID)
RETURNS JSON
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
  v_total_spots INT;
  v_total_lists INT;
  v_total_cities INT;
  v_avg_score NUMERIC;
  v_most_visited_city JSON;
  v_top_category JSON;
  v_top_categories JSON;
  v_recent_spots JSON;
  v_top_spots JSON;
BEGIN
  -- Total spots (private lists only)
  SELECT COUNT(DISTINCT f.id)
  INTO v_total_spots
  FROM foodspots f
  JOIN lists l ON f.list_id = l.id
  WHERE l.user_id = target_user_id;

  -- Total lists (private lists only)
  SELECT COUNT(*)
  INTO v_total_lists
  FROM lists
  WHERE user_id = target_user_id;

  -- Total cities
  SELECT COUNT(DISTINCT l.city)
  INTO v_total_cities
  FROM lists l
  WHERE l.user_id = target_user_id;

  -- Average score
  SELECT ROUND(AVG(f.rating)::numeric, 2)
  INTO v_avg_score
  FROM foodspots f
  JOIN lists l ON f.list_id = l.id
  WHERE l.user_id = target_user_id
  AND f.rating IS NOT NULL;

  -- Most visited city
  SELECT json_build_object(
    'city', city,
    'count', count
  )
  INTO v_most_visited_city
  FROM (
    SELECT l.city, COUNT(*) as count
    FROM foodspots f
    JOIN lists l ON f.list_id = l.id
    WHERE l.user_id = target_user_id
    GROUP BY l.city
    ORDER BY count DESC
    LIMIT 1
  ) sub;

  -- Top category
  SELECT json_build_object(
    'category', category,
    'count', count,
    'percentage', ROUND((count::numeric / NULLIF(v_total_spots, 0) * 100), 1)
  )
  INTO v_top_category
  FROM (
    SELECT f.category, COUNT(*) as count
    FROM foodspots f
    JOIN lists l ON f.list_id = l.id
    WHERE l.user_id = target_user_id
    AND f.category IS NOT NULL
    GROUP BY f.category
    ORDER BY count DESC
    LIMIT 1
  ) sub;

  -- Top categories (top 5)
  SELECT json_agg(
    json_build_object(
      'category', category,
      'count', count,
      'percentage', ROUND((count::numeric / NULLIF(v_total_spots, 0) * 100), 1)
    )
  )
  INTO v_top_categories
  FROM (
    SELECT f.category, COUNT(*) as count
    FROM foodspots f
    JOIN lists l ON f.list_id = l.id
    WHERE l.user_id = target_user_id
    AND f.category IS NOT NULL
    GROUP BY f.category
    ORDER BY count DESC
    LIMIT 5
  ) sub;

  -- Recent spots (last 5)
  SELECT json_agg(
    json_build_object(
      'id', f.id,
      'name', f.name,
      'category', f.category,
      'rating', f.rating,
      'tier', f.tier,
      'city', l.city,
      'created_at', f.created_at
    )
  )
  INTO v_recent_spots
  FROM (
    SELECT f.*, l.city
    FROM foodspots f
    JOIN lists l ON f.list_id = l.id
    WHERE l.user_id = target_user_id
    ORDER BY f.created_at DESC
    LIMIT 5
  ) f;

  -- Top spots (by rating, top 5)
  SELECT json_agg(
    json_build_object(
      'id', f.id,
      'name', f.name,
      'category', f.category,
      'rating', f.rating,
      'tier', f.tier,
      'city', l.city,
      'created_at', f.created_at
    )
  )
  INTO v_top_spots
  FROM (
    SELECT f.*, l.city
    FROM foodspots f
    JOIN lists l ON f.list_id = l.id
    WHERE l.user_id = target_user_id
    AND f.rating IS NOT NULL
    ORDER BY f.rating DESC
    LIMIT 5
  ) f;

  -- Build final result
  result := json_build_object(
    'total_spots', COALESCE(v_total_spots, 0),
    'total_lists', COALESCE(v_total_lists, 0),
    'total_cities', COALESCE(v_total_cities, 0),
    'avg_score', COALESCE(v_avg_score, 0),
    'most_visited_city', COALESCE(v_most_visited_city, json_build_object('city', null, 'count', 0)),
    'top_category', COALESCE(v_top_category, json_build_object('category', null, 'count', 0, 'percentage', 0)),
    'top_categories', COALESCE(v_top_categories, '[]'::json),
    'recent_spots', COALESCE(v_recent_spots, '[]'::json),
    'top_spots', COALESCE(v_top_spots, '[]'::json)
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_user_stats(UUID) TO authenticated;

-- 4. Setze profile_visibility für alle User auf 'friends'
-- Damit Freunde die Statistiken sehen können
UPDATE user_profiles
SET profile_visibility = 'friends'
WHERE profile_visibility = 'private' OR profile_visibility IS NULL;

-- =============================================
-- ERFOLG: Profile Functions wiederhergestellt!
-- =============================================
-- Jetzt:
-- 1. Browser neu laden (Cmd+Shift+R)
-- 2. Freundesstatistiken sollten wieder sichtbar sein
-- =============================================






