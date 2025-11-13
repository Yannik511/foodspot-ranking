-- =============================================
-- 028_update_spot_photos_select_policy.sql
-- Owner sollen Spot-Fotos sehen können
-- =============================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policy
    WHERE polname = 'Members select spot photos'
      AND polrelid = 'spot_photos'::regclass
  ) THEN
    DROP POLICY "Members select spot photos" ON spot_photos;
  END IF;

  CREATE POLICY "Members select spot photos"
  ON spot_photos
  FOR SELECT
  TO authenticated
  USING (
    is_list_member(list_id, auth.uid())
    OR is_list_owner(list_id, auth.uid())
  );
END
$$;

-- =============================================
-- ENDE 028_update_spot_photos_select_policy.sql
-- =============================================





