-- Create RPC function to get user statistics (aggregated server-side)
-- This function returns all stats for a user in a single query for better performance
-- Run this in Supabase SQL Editor

-- Drop function if exists (to recreate with updated schema)
DROP FUNCTION IF EXISTS get_user_stats(UUID) CASCADE;

-- Create the function
CREATE OR REPLACE FUNCTION get_user_stats(target_user_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
  total_spots_count INTEGER;
  total_lists_count INTEGER;
  total_cities_count INTEGER;
  avg_score DECIMAL(10, 1);
  most_visited_city_data JSON;
  top_category_data JSON;
  recent_spots_data JSON;
  top_spots_data JSON;
  top_categories_data JSON;
BEGIN
  -- Get total spots count
  SELECT COUNT(*) INTO total_spots_count
  FROM foodspots
  WHERE user_id = target_user_id AND rating IS NOT NULL;

  -- Get total lists count
  SELECT COUNT(*) INTO total_lists_count
  FROM lists
  WHERE user_id = target_user_id;

  -- Get total cities (unique cities from lists)
  SELECT COUNT(DISTINCT city) INTO total_cities_count
  FROM lists
  WHERE user_id = target_user_id;

  -- Calculate average score (normalized to 10, 1 decimal place)
  SELECT COALESCE(ROUND(AVG(rating)::NUMERIC, 1), 0) INTO avg_score
  FROM foodspots
  WHERE user_id = target_user_id AND rating IS NOT NULL;

  -- Get most visited city
  SELECT json_build_object(
    'city', city,
    'count', count
  ) INTO most_visited_city_data
  FROM (
    SELECT l.city, COUNT(DISTINCT f.id) as count
    FROM lists l
    LEFT JOIN foodspots f ON f.list_id = l.id AND f.user_id = target_user_id
    WHERE l.user_id = target_user_id AND l.city IS NOT NULL
    GROUP BY l.city
    ORDER BY count DESC, l.city
    LIMIT 1
  ) city_stats;

  -- Get top category (most rated) with percentage
  SELECT json_build_object(
    'category', category,
    'count', count,
    'percentage', percentage
  ) INTO top_category_data
  FROM (
    SELECT 
      category,
      COUNT(*) as count,
      ROUND((COUNT(*)::NUMERIC / NULLIF(total_spots_count, 0)) * 100, 1) as percentage
    FROM foodspots
    WHERE user_id = target_user_id AND category IS NOT NULL AND rating IS NOT NULL
    GROUP BY category
    ORDER BY count DESC, category
    LIMIT 1
  ) category_stats;

  -- Get top categories (max 3) with percentages
  SELECT json_agg(
    json_build_object(
      'category', category,
      'count', count,
      'percentage', percentage
    ) ORDER BY count DESC
  ) INTO top_categories_data
  FROM (
    SELECT 
      category,
      COUNT(*) as count,
      ROUND((COUNT(*)::NUMERIC / NULLIF(total_spots_count, 0)) * 100, 1) as percentage
    FROM foodspots
    WHERE user_id = target_user_id AND category IS NOT NULL AND rating IS NOT NULL
    GROUP BY category
    ORDER BY count DESC, category
    LIMIT 3
  ) top_categories;

  -- Get recent spots (last 3 entries: name, city, score, date)
  SELECT json_agg(
    json_build_object(
      'id', f.id,
      'name', f.name,
      'city', COALESCE(l.city, ''),
      'rating', f.rating,
      'tier', f.tier,
      'category', f.category,
      'cover_photo_url', f.cover_photo_url,
      'updated_at', f.updated_at,
      'created_at', f.created_at
    ) ORDER BY f.updated_at DESC NULLS LAST, f.created_at DESC
  ) INTO recent_spots_data
  FROM (
    SELECT f.*
    FROM foodspots f
    WHERE f.user_id = target_user_id AND f.rating IS NOT NULL
    ORDER BY f.updated_at DESC NULLS LAST, f.created_at DESC
    LIMIT 3
  ) f
  LEFT JOIN lists l ON l.id = f.list_id;

  -- Get top spots (top 3 by score, tie-break: newest date)
  SELECT json_agg(
    json_build_object(
      'id', f.id,
      'name', f.name,
      'city', COALESCE(l.city, ''),
      'rating', f.rating,
      'tier', f.tier,
      'category', f.category,
      'cover_photo_url', f.cover_photo_url,
      'updated_at', f.updated_at,
      'created_at', f.created_at
    ) ORDER BY f.rating DESC, f.updated_at DESC NULLS LAST, f.created_at DESC
  ) INTO top_spots_data
  FROM (
    SELECT f.*
    FROM foodspots f
    WHERE f.user_id = target_user_id AND f.rating IS NOT NULL
    ORDER BY f.rating DESC, f.updated_at DESC NULLS LAST, f.created_at DESC
    LIMIT 3
  ) f
  LEFT JOIN lists l ON l.id = f.list_id;

  -- Build result JSON
  result := json_build_object(
    'total_spots', COALESCE(total_spots_count, 0),
    'total_lists', COALESCE(total_lists_count, 0),
    'total_cities', COALESCE(total_cities_count, 0),
    'avg_score', COALESCE(avg_score, 0),
    'most_visited_city', COALESCE(most_visited_city_data, json_build_object('city', NULL, 'count', 0)),
    'top_category', COALESCE(top_category_data, json_build_object('category', NULL, 'count', 0, 'percentage', 0)),
    'top_categories', COALESCE(top_categories_data, '[]'::json),
    'recent_spots', COALESCE(recent_spots_data, '[]'::json),
    'top_spots', COALESCE(top_spots_data, '[]'::json)
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_user_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_stats(UUID) TO anon;

