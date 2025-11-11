-- =============================================
-- MIGRATION 021: FIX INVITATION VISIBILITY
-- =============================================
-- Stellt sicher, dass eingeladene Nutzer ihre Einladungen sehen können
-- und alle RLS Policies korrekt sind (verwendet SECURITY DEFINER Funktionen)
-- =============================================

-- =============================================
-- VORBEREITUNG: STELLE SICHER, DASS SECURITY DEFINER FUNKTIONEN EXISTIEREN
-- =============================================
-- Diese Funktionen sollten bereits durch Migration 018 existieren,
-- aber wir stellen sicher, dass sie vorhanden sind

-- Funktion: Prüft ob User Owner einer Liste ist (ohne RLS)
CREATE OR REPLACE FUNCTION is_list_owner(p_list_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Direkte Prüfung ohne RLS (SECURITY DEFINER)
  RETURN EXISTS (
    SELECT 1 FROM lists
    WHERE id = p_list_id
    AND user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- LIST_INVITATIONS POLICIES NEU ERSTELLEN
-- =============================================
-- Entferne alle bestehenden Policies und erstelle sie neu
-- WICHTIG: Verwendet SECURITY DEFINER Funktionen, um Rekursion zu vermeiden

-- Entferne alle bestehenden Policies
DROP POLICY IF EXISTS "Users can view own invitations" ON list_invitations;
DROP POLICY IF EXISTS "Invitees can view their own pending invitations" ON list_invitations;
DROP POLICY IF EXISTS "Invitees can view their own invitations" ON list_invitations;
DROP POLICY IF EXISTS "List owners can view all invitations" ON list_invitations;
DROP POLICY IF EXISTS "List owners can create invitations" ON list_invitations;
DROP POLICY IF EXISTS "Invitees can respond to invitations" ON list_invitations;
DROP POLICY IF EXISTS "List owners can delete invitations" ON list_invitations;

-- Policy 1: Eingeladene können ihre eigenen Einladungen sehen (unabhängig vom Status)
-- WICHTIG: Diese Policy muss ZUERST kommen, damit Eingeladene ihre Einladungen sehen können
CREATE POLICY "Invitees can view their own invitations"
ON list_invitations FOR SELECT TO authenticated
USING (auth.uid() = invitee_id);

-- Policy 2: Owner kann alle Einladungen seiner Liste sehen
-- WICHTIG: Verwendet SECURITY DEFINER Funktion, um Rekursion zu vermeiden
CREATE POLICY "List owners can view all invitations"
ON list_invitations FOR SELECT TO authenticated
USING (
  is_list_owner(list_id, auth.uid())
);

-- Policy 3: Owner kann Einladungen erstellen
-- WICHTIG: Verwendet SECURITY DEFINER Funktion, um Rekursion zu vermeiden
CREATE POLICY "List owners can create invitations"
ON list_invitations FOR INSERT TO authenticated
WITH CHECK (
  is_list_owner(list_id, auth.uid())
  AND inviter_id = auth.uid()
);

-- Policy 4: Eingeladene können ihre Einladungen annehmen/ablehnen
CREATE POLICY "Invitees can respond to invitations"
ON list_invitations FOR UPDATE TO authenticated
USING (auth.uid() = invitee_id AND status = 'pending')
WITH CHECK (
  auth.uid() = invitee_id
  AND status IN ('accepted', 'rejected')
  AND responded_at IS NOT NULL
);

-- Policy 5: Owner kann Einladungen löschen
-- WICHTIG: Verwendet SECURITY DEFINER Funktion, um Rekursion zu vermeiden
CREATE POLICY "List owners can delete invitations"
ON list_invitations FOR DELETE TO authenticated
USING (
  is_list_owner(list_id, auth.uid())
);

-- =============================================
-- VERIFIZIERUNG
-- =============================================
-- Nach dieser Migration sollten:
-- 1. Eingeladene Nutzer ihre eigenen Einladungen sehen können (SELECT)
-- 2. Owner alle Einladungen ihrer Listen sehen können (SELECT)
-- 3. Owner Einladungen erstellen können (INSERT)
-- 4. Eingeladene Einladungen annehmen/ablehnen können (UPDATE)

-- =============================================
-- SUCCESS: Invitation Visibility Fixed
-- =============================================

