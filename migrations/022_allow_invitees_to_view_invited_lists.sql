-- =============================================
-- MIGRATION 022: ALLOW INVITEES TO VIEW INVITED LISTS
-- =============================================
-- Stellt sicher, dass Eingeladene die Liste sehen können,
-- zu der sie eine pending Einladung haben (für Join in Query)
-- =============================================

-- =============================================
-- PROBLEM
-- =============================================
-- Wenn ein User eine Einladung zu einer Liste hat, aber die Einladung noch nicht angenommen hat,
-- kann er die Liste über RLS nicht sehen. Das verhindert, dass die Liste in der Einladungs-Query
-- angezeigt wird (Join mit lists:list_id schlägt fehl oder gibt null zurück).

-- =============================================
-- LÖSUNG: NEUE RLS POLICY FÜR LISTS
-- =============================================
-- Füge eine Policy hinzu, die es Eingeladenen erlaubt, Listen zu sehen,
-- zu denen sie eine pending Einladung haben.

-- WICHTIG: Diese Policy verwendet eine SECURITY DEFINER Funktion, um Rekursion zu vermeiden
-- Die Funktion prüft, ob der User eine pending Einladung zur Liste hat

-- Funktion: Prüft ob User eine pending Einladung zu einer Liste hat (ohne RLS)
CREATE OR REPLACE FUNCTION has_pending_invitation(p_list_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Direkte Prüfung ohne RLS (SECURITY DEFINER)
  RETURN EXISTS (
    SELECT 1 FROM list_invitations
    WHERE list_id = p_list_id
    AND invitee_id = p_user_id
    AND status = 'pending'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Kommentar für die Funktion
COMMENT ON FUNCTION has_pending_invitation(UUID, UUID) IS 'Prüft ob ein User eine pending Einladung zu einer Liste hat (ohne RLS)';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION has_pending_invitation(UUID, UUID) TO authenticated;

-- Neue Policy: Eingeladene können Listen sehen, zu denen sie eine pending Einladung haben
-- WICHTIG: Diese Policy ist ZUSÄTZLICH zu den bestehenden Policies
CREATE POLICY "Invitees can view lists they are invited to"
ON lists FOR SELECT TO authenticated
USING (
  -- User hat eine pending Einladung zu dieser Liste
  has_pending_invitation(id, auth.uid())
);

-- =============================================
-- VERIFIZIERUNG
-- =============================================
-- Nach dieser Migration sollten:
-- 1. Eingeladene Nutzer die Liste sehen können, zu der sie eine pending Einladung haben
-- 2. Die Join-Query in fetchListInvitations sollte funktionieren
-- 3. Die Liste sollte in der Einladungs-Karte angezeigt werden

-- =============================================
-- SUCCESS: Invitees Can View Invited Lists
-- =============================================





