-- =============================================
-- MIGRATION 048: ALLOW EDITORS TO INVITE
-- =============================================
-- Erlaubt Editoren, Personen zu geteilten Listen einzuladen
-- =============================================
-- 
-- UP: Fügt Policy hinzu, die Editoren erlaubt Einladungen zu erstellen
-- DOWN: Entfernt die Policy wieder (siehe 048_allow_editors_to_invite_down.sql)
-- =============================================

-- Policy: Editoren können Einladungen erstellen
-- WICHTIG: Diese Policy ist ZUSÄTZLICH zur bestehenden "List owners can create invitations" Policy
-- Owner werden weiterhin durch die bestehende Policy abgedeckt
-- WICHTIG: Verwendet SECURITY DEFINER Funktion is_list_editor(), um Rekursion zu vermeiden
CREATE POLICY "List editors can create invitations"
ON list_invitations FOR INSERT TO authenticated
WITH CHECK (
  -- User ist Editor der Liste (nicht Owner, da Owner bereits durch andere Policy abgedeckt)
  -- Verwendet is_list_editor() Funktion (SECURITY DEFINER) statt direkter Subquery
  is_list_editor(list_id, auth.uid())
  AND inviter_id = auth.uid()
);

-- =============================================
-- VERIFIZIERUNG
-- =============================================
-- Nach dieser Migration sollten:
-- 1. Owner weiterhin Einladungen erstellen können (bestehende Policy)
-- 2. Editoren ebenfalls Einladungen erstellen können (neue Policy)
-- 3. Viewer können KEINE Einladungen erstellen (keine Policy für viewer)
-- 4. Sicherheit bleibt gewährleistet: inviter_id muss auth.uid() sein
-- =============================================
-- SUCCESS: Editors can now invite users to shared lists
-- =============================================

