-- Fix for user_profiles view issue
-- Run this in Supabase SQL Editor

-- Step 1: Drop the view if it exists (to recreate it properly)
DROP VIEW IF EXISTS public.user_profiles CASCADE;

-- Step 2: Drop the functions if they exist (to recreate them with new return types)
DROP FUNCTION IF EXISTS search_users_by_username(TEXT) CASCADE;
DROP FUNCTION IF EXISTS get_user_profile(UUID) CASCADE;

-- Step 3: Create the search function (this will always work)
CREATE OR REPLACE FUNCTION search_users_by_username(search_query TEXT)
RETURNS TABLE (
  id UUID,
  email TEXT,
  username TEXT,
  profile_image_url TEXT,
  profile_visibility TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.email::TEXT,
    COALESCE(u.raw_user_meta_data->>'username', split_part(u.email, '@', 1))::TEXT as username,
    (u.raw_user_meta_data->>'profileImageUrl')::TEXT as profile_image_url,
    COALESCE(u.raw_user_meta_data->>'profile_visibility', 'private')::TEXT as profile_visibility,
    u.created_at
  FROM auth.users u
  WHERE LOWER(COALESCE(u.raw_user_meta_data->>'username', split_part(u.email, '@', 1))) LIKE LOWER('%' || search_query || '%')
  ORDER BY u.created_at DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION search_users_by_username(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION search_users_by_username(TEXT) TO anon;

-- Step 4: Try to create the view (this might require superuser privileges)
-- If this fails, the app will use the function instead
CREATE OR REPLACE VIEW public.user_profiles AS
SELECT 
  u.id,
  u.email::TEXT as email,
  COALESCE(u.raw_user_meta_data->>'username', split_part(u.email, '@', 1))::TEXT as username,
  (u.raw_user_meta_data->>'profileImageUrl')::TEXT as profile_image_url,
  COALESCE(u.raw_user_meta_data->>'profile_visibility', 'private')::TEXT as profile_visibility,
  u.created_at
FROM auth.users u;

-- Grant SELECT permission on the view
GRANT SELECT ON public.user_profiles TO authenticated;
GRANT SELECT ON public.user_profiles TO anon;

-- Step 5: Create the get_user_profile function (for fetching single user profiles)
CREATE OR REPLACE FUNCTION get_user_profile(user_id UUID)
RETURNS TABLE (
  id UUID,
  email TEXT,
  username TEXT,
  profile_image_url TEXT,
  profile_visibility TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    up.id,
    up.email,
    up.username,
    up.profile_image_url,
    up.profile_visibility,
    up.created_at
  FROM public.user_profiles up
  WHERE up.id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the get_user_profile function
GRANT EXECUTE ON FUNCTION get_user_profile(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_profile(UUID) TO anon;

