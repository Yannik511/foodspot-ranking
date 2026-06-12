-- Migration 047: Batch-RPC get_user_profiles_batch
--
-- Die bestehende `get_user_profile(uuid)` muss aufgerufen werden, weil sie
-- `profile_visibility` aus `auth.users.raw_user_meta_data` liest (Workaround,
-- weil die Tabelle user_profiles diese Spalte nicht hat).
--
-- FriendsTab und Dashboard rufen die Funktion heute pro User einzeln auf
-- (N+1). Diese Batch-Variante ersetzt die Schleife mit einem Roundtrip.
--
-- Rückgabewerte identisch zu get_user_profile, damit Client-Mapping
-- wiederverwendbar bleibt.

CREATE OR REPLACE FUNCTION public.get_user_profiles_batch(p_user_ids uuid[])
RETURNS TABLE(
  id uuid,
  username text,
  profile_image_url text,
  profile_visibility text,
  bio text,
  email text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    up.id,
    up.username,
    up.profile_image_url,
    COALESCE(au.raw_user_meta_data->>'profile_visibility', 'private')::text AS profile_visibility,
    NULL::text AS bio,
    up.email,
    up.created_at,
    up.updated_at
  FROM public.user_profiles up
  JOIN auth.users au ON au.id = up.id
  WHERE up.id = ANY(p_user_ids);
END;
$$;

ALTER FUNCTION public.get_user_profiles_batch(uuid[]) OWNER TO postgres;

COMMENT ON FUNCTION public.get_user_profiles_batch(uuid[]) IS
  'Batch-Variante von get_user_profile. Liest profile_visibility aus auth.users.user_metadata.';
