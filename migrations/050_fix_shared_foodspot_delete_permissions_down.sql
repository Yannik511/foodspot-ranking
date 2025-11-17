-- =============================================
-- MIGRATION 050 DOWN: REVERT SHARED FOODSPOT DELETE PERMISSIONS
-- =============================================
-- Stellt die alte DELETE-Policy wieder her
-- =============================================

-- Entferne die neue DELETE-Policy
DROP POLICY IF EXISTS "List editors can delete foodspots in shared lists" ON foodspots;

-- Stelle die alte DELETE-Policy wieder her (aus Migration 018)
CREATE POLICY "List editors can delete foodspots in shared lists"
ON foodspots FOR DELETE TO authenticated
USING (
  auth.uid() = user_id
  AND (
    is_list_owner(list_id, auth.uid())
    OR is_list_editor(list_id, auth.uid())
  )
);

-- =============================================
-- SUCCESS: DELETE Permissions Reverted
-- =============================================

