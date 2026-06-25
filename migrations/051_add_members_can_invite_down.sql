-- =============================================
-- MIGRATION 051 DOWN: REVERT members_can_invite TOGGLE
-- =============================================
-- Stellt das Verhalten aus Migration 048 wieder her:
-- Editoren dürfen pauschal einladen, kein Owner-Toggle nötig.
-- =============================================

-- 1) Neue Policy entfernen
DROP POLICY IF EXISTS "List editors can create invitations when allowed" ON list_invitations;

-- 2) Alte Policy aus Migration 048 wiederherstellen
CREATE POLICY "List editors can create invitations"
ON list_invitations FOR INSERT TO authenticated
WITH CHECK (
  is_list_editor(list_id, auth.uid())
  AND inviter_id = auth.uid()
);

-- 3) Spalte entfernen
ALTER TABLE lists
  DROP COLUMN IF EXISTS members_can_invite;

-- =============================================
-- SUCCESS: Reverted to migration 048 behavior
-- =============================================
