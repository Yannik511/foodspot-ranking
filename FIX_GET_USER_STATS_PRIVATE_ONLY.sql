-- =============================================
-- FINAL FIX: get_user_stats - NUR private Listen
-- Filtert geteilte Listen korrekt aus!
-- =============================================

-- Schritt 1: Alte Funktion löschen
DROP FUNCTION IF EXISTS get_user_stats(UUID) CASCADE;

-- Schritt 2: Neue Funktion erstellen (nur private Listen)
CREATE FUNCTION get_user_stats(target_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
  v_total_spots INT := 0;
  v_total_lists INT := 0;
  v_total_cities INT := 0;
  v_avg_score NUMERIC := 0;
  v_most_visited_city JSON;
  v_top_category JSON;
  v_top_categories JSON;
  v_recent_spots JSON;
  v_top_spots JSON;
BEGIN
  -- Total spots (ONLY from private lists = lists with NO other members)
  SELECT COUNT(DISTINCT foodspots.id)
  INTO v_total_spots
  FROM foodspots
  INNER JOIN lists ON foodspots.list_id = lists.id
  WHERE lists.user_id = target_user_id
    AND NOT EXISTS (
      SELECT 1 
      FROM list_members 
      WHERE list_members.list_id = lists.id 
        AND list_members.user_id != target_user_id
    );

  -- Total lists (ONLY private lists)
  SELECT COUNT(*)
  INTO v_total_lists
  FROM lists
  WHERE lists.user_id = target_user_id
    AND NOT EXISTS (
      SELECT 1 
      FROM list_members 
      WHERE list_members.list_id = lists.id 
        AND list_members.user_id != target_user_id
    );

  -- Total cities (ONLY from private lists)
  SELECT COUNT(DISTINCT lists.city)
  INTO v_total_cities
  FROM lists
  WHERE lists.user_id = target_user_id
    AND NOT EXISTS (
      SELECT 1 
      FROM list_members 
      WHERE list_members.list_id = lists.id 
        AND list_members.user_id != target_user_id
    );

  -- Average score (ONLY from private lists)
  SELECT ROUND(AVG(foodspots.rating)::numeric, 2)
  INTO v_avg_score
  FROM foodspots
  INNER JOIN lists ON foodspots.list_id = lists.id
  WHERE lists.user_id = target_user_id
    AND foodspots.rating IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 
      FROM list_members 
      WHERE list_members.list_id = lists.id 
        AND list_members.user_id != target_user_id
    );

  -- Most visited city (ONLY from private lists)
  SELECT json_build_object('city', sub.city, 'count', sub.count)
  INTO v_most_visited_city
  FROM (
    SELECT lists.city, COUNT(*) as count
    FROM foodspots
    INNER JOIN lists ON foodspots.list_id = lists.id
    WHERE lists.user_id = target_user_id
      AND NOT EXISTS (
        SELECT 1 
        FROM list_members 
        WHERE list_members.list_id = lists.id 
          AND list_members.user_id != target_user_id
      )
    GROUP BY lists.city
    ORDER BY count DESC
    LIMIT 1
  ) sub;

  -- Top category (ONLY from private lists)
  SELECT json_build_object(
    'category', sub.category,
    'count', sub.count,
    'percentage', ROUND((sub.count::numeric / NULLIF(v_total_spots, 0) * 100), 1)
  )
  INTO v_top_category
  FROM (
    SELECT foodspots.category, COUNT(*) as count
    FROM foodspots
    INNER JOIN lists ON foodspots.list_id = lists.id
    WHERE lists.user_id = target_user_id
      AND foodspots.category IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 
        FROM list_members 
        WHERE list_members.list_id = lists.id 
          AND list_members.user_id != target_user_id
      )
    GROUP BY foodspots.category
    ORDER BY count DESC
    LIMIT 1
  ) sub;

  -- Top categories (top 5, ONLY from private lists)
  SELECT json_agg(
    json_build_object(
      'category', sub.category,
      'count', sub.count,
      'percentage', ROUND((sub.count::numeric / NULLIF(v_total_spots, 0) * 100), 1)
    )
  )
  INTO v_top_categories
  FROM (
    SELECT foodspots.category, COUNT(*) as count
    FROM foodspots
    INNER JOIN lists ON foodspots.list_id = lists.id
    WHERE lists.user_id = target_user_id
      AND foodspots.category IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 
        FROM list_members 
        WHERE list_members.list_id = lists.id 
          AND list_members.user_id != target_user_id
      )
    GROUP BY foodspots.category
    ORDER BY count DESC
    LIMIT 5
  ) sub;

  -- Recent spots (last 5, ONLY from private lists)
  SELECT json_agg(
    json_build_object(
      'id', sub.id,
      'name', sub.name,
      'category', sub.category,
      'rating', sub.rating,
      'tier', sub.tier,
      'city', sub.city,
      'cover_photo_url', sub.cover_photo_url,
      'created_at', sub.created_at
    )
  )
  INTO v_recent_spots
  FROM (
    SELECT 
      foodspots.id,
      foodspots.name,
      foodspots.category,
      foodspots.rating,
      foodspots.tier,
      lists.city,
      foodspots.cover_photo_url,
      foodspots.created_at
    FROM foodspots
    INNER JOIN lists ON foodspots.list_id = lists.id
    WHERE lists.user_id = target_user_id
      AND NOT EXISTS (
        SELECT 1 
        FROM list_members 
        WHERE list_members.list_id = lists.id 
          AND list_members.user_id != target_user_id
      )
    ORDER BY foodspots.created_at DESC
    LIMIT 5
  ) sub;

  -- Top spots (by rating, top 10, ONLY from private lists)
  SELECT json_agg(
    json_build_object(
      'id', sub.id,
      'name', sub.name,
      'category', sub.category,
      'rating', sub.rating,
      'tier', sub.tier,
      'city', sub.city,
      'cover_photo_url', sub.cover_photo_url,
      'created_at', sub.created_at
    )
  )
  INTO v_top_spots
  FROM (
    SELECT 
      foodspots.id,
      foodspots.name,
      foodspots.category,
      foodspots.rating,
      foodspots.tier,
      lists.city,
      foodspots.cover_photo_url,
      foodspots.created_at
    FROM foodspots
    INNER JOIN lists ON foodspots.list_id = lists.id
    WHERE lists.user_id = target_user_id
      AND foodspots.rating IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 
        FROM list_members 
        WHERE list_members.list_id = lists.id 
          AND list_members.user_id != target_user_id
      )
    ORDER BY foodspots.rating DESC
    LIMIT 10
  ) sub;

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
$$;

-- Schritt 3: Permissions
GRANT EXECUTE ON FUNCTION get_user_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_stats(UUID) TO anon;

-- =============================================
-- FERTIG! Funktion zählt NUR private Listen!
-- =============================================

