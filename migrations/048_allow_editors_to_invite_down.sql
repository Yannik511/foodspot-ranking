-- =============================================
-- MIGRATION 048 DOWN: ROLLBACK EDITOR INVITATIONS
-- =============================================
-- Entfernt die Policy, die Editoren erlaubt Einladungen zu erstellen
-- =============================================
-- 
-- WICHTIG: Diese Migration stellt den vorherigen Zustand wieder her
-- (nur Owner können einladen)
-- =============================================

-- Entferne die Policy für Editoren
DROP POLICY IF EXISTS "List editors can create invitations" ON list_invitations;

-- =============================================
-- VERIFIZIERUNG
-- =============================================
-- Nach dieser Migration:
-- 1. Nur Owner können wieder Einladungen erstellen (wie vorher)
-- 2. Editoren können KEINE Einladungen mehr erstellen
-- =============================================
-- SUCCESS: Rollback complete - only owners can invite again
-- =============================================

