-- =============================================
-- MIGRATION 051: ADD members_can_invite TOGGLE
-- =============================================
-- Owner-gesteuerter Toggle, ob Editoren Mitglieder einladen dürfen.
-- Default: false  → Standardmäßig dürfen nur Owner einladen.
-- =============================================
-- Ersetzt das Verhalten aus Migration 048, das Editoren pauschal das
-- Einladen erlaubt hat. Ab dieser Migration greift die Editor-Einladung
-- nur noch, wenn der Owner members_can_invite = true gesetzt hat.
-- =============================================

-- 1) Neue Spalte
ALTER TABLE lists
  ADD COLUMN IF NOT EXISTS members_can_invite boolean NOT NULL DEFAULT false;

-- 2) Alte "immer erlauben"-Policy entfernen
DROP POLICY IF EXISTS "List editors can create invitations" ON list_invitations;

-- 3) Neue Policy: Editor darf nur einladen, wenn members_can_invite = true
CREATE POLICY "List editors can create invitations when allowed"
ON list_invitations FOR INSERT TO authenticated
WITH CHECK (
  is_list_editor(list_id, auth.uid())
  AND inviter_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM lists
    WHERE lists.id = list_invitations.list_id
      AND lists.members_can_invite = true
  )
);

-- =============================================
-- VERIFIZIERUNG
-- =============================================
-- 1. Owner können weiterhin einladen (bestehende "List owners can create invitations"-Policy)
-- 2. Editoren können einladen, falls members_can_invite = true gesetzt ist
-- 3. Editoren ohne Toggle bekommen RLS-Fehler beim Insert
-- 4. Viewer können nie einladen
-- =============================================
-- SUCCESS: Member-invite is now owner-controlled per list
-- =============================================
