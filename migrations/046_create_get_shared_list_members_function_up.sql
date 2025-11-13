-- =============================================
-- MIGRATION 046 (UP): CREATE get_shared_list_members FUNCTION
-- =============================================
-- Stellt eine Sicherheitsdefinierte RPC-Funktion bereit, damit
-- Owner und akzeptierte Mitglieder einer Liste alle Mitglieder
-- (inkl. Owner) sehen können – unabhängig von RLS-Einschränkungen.
-- =============================================

CREATE OR REPLACE FUNCTION public.get_shared_list_members(p_list_id uuid)
RETURNS TABLE (
  user_id uuid,
  role text,
  joined_at timestamptz,
  username text,
  profile_image_url text,
  email text
)
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    member.user_id,
    member.role,
    member.joined_at,
    up.username,
    up.profile_image_url,
    up.email
  FROM (
    -- Owner wird immer inkludiert
    SELECT l.user_id, 'owner'::text AS role, l.created_at AS joined_at
    FROM public.lists l
    WHERE l.id = p_list_id
    UNION
    -- Alle akzeptierten Mitglieder der Liste
    SELECT lm.user_id, lm.role, lm.joined_at
    FROM public.list_members lm
    WHERE lm.list_id = p_list_id
  ) AS member
  LEFT JOIN public.user_profiles up ON up.id = member.user_id
  WHERE
    -- Zugriff erlaubt, wenn aufrufender User Owner ist ...
    EXISTS (
      SELECT 1 FROM public.lists l
      WHERE l.id = p_list_id
      AND l.user_id = auth.uid()
    )
    OR
    -- ... oder als Mitglied der Liste eingetragen ist
    EXISTS (
      SELECT 1 FROM public.list_members lm2
      WHERE lm2.list_id = p_list_id
      AND lm2.user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.get_shared_list_members(uuid) TO authenticated;

-- =============================================
-- ENDE UP-MIGRATION
-- =============================================

