-- =============================================
-- MIGRATION 050: FIX SHARED FOODSPOT DELETE PERMISSIONS
-- =============================================
-- Passt die DELETE-Policy für Foodspots in geteilten Listen an:
-- - Owner kann ALLE Foodspots löschen (unabhängig vom Ersteller)
-- - Editor kann nur eigene Foodspots löschen (die er selbst erstellt hat)
-- =============================================

-- Entferne die alte DELETE-Policy
DROP POLICY IF EXISTS "List editors can delete foodspots in shared lists" ON foodspots;

-- Neue DELETE-Policy für geteilte Listen:
-- Owner kann ALLE Spots löschen, Editor nur eigene
CREATE POLICY "List editors can delete foodspots in shared lists"
ON foodspots FOR DELETE TO authenticated
USING (
  -- Fall 1: Owner kann ALLE Spots löschen (unabhängig vom Ersteller)
  is_list_owner(list_id, auth.uid())
  OR
  -- Fall 2: Editor kann nur eigene Spots löschen (auth.uid() = user_id)
  (
    auth.uid() = user_id
    AND is_list_editor(list_id, auth.uid())
  )
);

COMMENT ON POLICY "List editors can delete foodspots in shared lists" ON foodspots IS 
'Owner kann alle Foodspots löschen, Editor nur eigene. Für private Listen gilt weiterhin die Policy "Users can delete own foodspots".';

-- =============================================
-- SUCCESS: DELETE Permissions Updated
-- =============================================

